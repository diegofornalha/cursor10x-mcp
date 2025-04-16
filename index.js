#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createClient } from "@libsql/client";
import { fileURLToPath } from "url";
import { dirname } from "path";
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables if they don't exist in process.env
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  try {
    // Try to load from .env.local in current directory
    const dotenv = await import('dotenv').catch(() => null);
    if (dotenv) {
      // Check multiple possible env file locations
      const possibleEnvFiles = [
        path.join(process.cwd(), '.env.local'),
        path.join(process.cwd(), '.env'),
        path.join(dirname(fileURLToPath(import.meta.url)), '.env')
      ];
      
      // Try each file
      for (const envFile of possibleEnvFiles) {
        if (fs.existsSync(envFile)) {
          dotenv.config({ path: envFile });
          console.log(`Loaded environment variables from ${envFile}`);
          break;
        }
      }
    }
  } catch (error) {
    // Just log and continue - don't stop execution
    console.log(`Note: Could not load environment variables from file: ${error.message}`);
  }
}

// Set up proper paths for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Formats a timestamp into a human-readable string
 * @param {number} timestamp - Unix timestamp to format
 * @returns {string} Human readable timestamp
 */
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  
  // Within the last hour
  if (now - date < 60 * 60 * 1000) {
    const minutesAgo = Math.floor((now - date) / (60 * 1000));
    return `${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
  }
  
  // Within the same day
  if (date.getDate() === now.getDate() && 
      date.getMonth() === now.getMonth() && 
      date.getFullYear() === now.getFullYear()) {
    return `Today at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getDate() === yesterday.getDate() && 
      date.getMonth() === yesterday.getMonth() && 
      date.getFullYear() === yesterday.getFullYear()) {
    return `Yesterday at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Within the last week
  if (now - date < 7 * 24 * 60 * 60 * 1000) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${days[date.getDay()]} at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
  }
  
  // Default format for older dates
  return `${date.toLocaleDateString()} at ${date.getHours()}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// Vector embedding and similarity search utilities

/**
 * Generate a simple vector embedding from text using a basic hashing technique
 * This is a placeholder for a proper embedding model that would be integrated
 * with an actual ML model or embedding API
 * 
 * @param {string} text - Text to generate embedding for
 * @param {number} dimensions - Dimensionality of the vector (default: 128)
 * @returns {Float32Array} A float32 vector representation
 */
async function createEmbedding(text, dimensions = 128) {
  try {
    // In a production system, this would call an embedding API or model
    // For this implementation, we'll use a simple deterministic approach
    // that creates vector representations that maintain some text similarity
    
    // Normalize text
    const normalizedText = text.toLowerCase().trim();
    
    // Create a fixed size Float32Array
    const vector = new Float32Array(dimensions);
    
    // Simple hash function to generate vector elements
    for (let i = 0; i < dimensions; i++) {
      // Use different character combinations to influence each dimension
      let value = 0;
      for (let j = 0; j < normalizedText.length; j++) {
        const charCode = normalizedText.charCodeAt(j);
        // Use different seeds for each dimension to vary the representation
        value += Math.sin(charCode * (i + 1) * 0.01) * Math.cos(j * 0.01);
      }
      // Normalize to a value between -1 and 1
      vector[i] = Math.tanh(value);
    }
    
    // Log and return the vector
    logDebug(`Generated ${dimensions}-d embedding for text`);
    return vector;
  } catch (error) {
    log(`Error creating embedding: ${error.message}`, "error");
    // Return zero vector as fallback
    return new Float32Array(dimensions);
  }
}

/**
 * Convert a Float32Array to a Buffer for database storage
 * 
 * @param {Float32Array} vector - Vector to convert
 * @returns {Buffer} Buffer representation of the vector
 */
function vectorToBuffer(vector) {
  return Buffer.from(vector.buffer);
}

/**
 * Convert a Buffer back to a Float32Array
 * 
 * @param {Buffer} buffer - Buffer to convert
 * @returns {Float32Array} Float32Array representation
 */
function bufferToVector(buffer) {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.length / 4);
}

/**
 * Store an embedding vector in the database
 * 
 * @param {number} contentId - ID of the content this vector represents
 * @param {string} contentType - Type of content (message, file, snippet, etc.)
 * @param {Float32Array} vector - The embedding vector
 * @param {Object} metadata - Additional info about the vector (optional)
 * @returns {Promise<Object>} Result of the insert operation
 */
async function storeEmbedding(contentId, contentType, vector, metadata = null) {
  try {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    // Convert the Float32Array to a buffer for storage
    const vectorBuffer = vectorToBuffer(vector);
    const now = Date.now();
    
    // Store in the vectors table
    const result = await db.prepare(`
      INSERT INTO vectors (content_id, content_type, vector, created_at, metadata)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      contentId,
      contentType,
      vectorBuffer,
      now,
      metadata ? JSON.stringify(metadata) : null
    );
    
    logDebug(`Stored ${vector.length}-d vector for ${contentType} with ID ${contentId}`);
    return result;
  } catch (error) {
    log(`Error storing embedding: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Find similar content using vector similarity
 * 
 * @param {Float32Array} queryVector - Vector to search for
 * @param {string} contentType - Type of content to search (optional)
 * @param {number} limit - Maximum number of results (default: 10)
 * @param {number} threshold - Similarity threshold (default: 0.7)
 * @returns {Promise<Array>} Array of similar content with similarity scores
 */
async function findSimilarVectors(queryVector, contentType = null, limit = 10, threshold = 0.7) {
  try {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    // Convert the query vector to a buffer
    const queryBuffer = vectorToBuffer(queryVector);
    
    // First try to use Turso's vector_top_k for efficient similarity search
    try {
      // Build the query based on whether contentType is specified
      let sql;
      let params;
      
      if (contentType) {
        sql = `
          SELECT id, content_id, content_type, similarity
          FROM vector_top_k('idx_vectors_vector', ?, ?) AS v
          JOIN vectors ON vectors.id = v.rowid
          WHERE content_type = ?
          AND similarity >= ?
          LIMIT ?
        `;
        params = [queryBuffer, limit * 2, contentType, threshold, limit];
      } else {
        sql = `
          SELECT id, content_id, content_type, similarity
          FROM vector_top_k('idx_vectors_vector', ?, ?) AS v
          JOIN vectors ON vectors.id = v.rowid
          WHERE similarity >= ?
          LIMIT ?
        `;
        params = [queryBuffer, limit * 2, threshold, limit];
      }
      
      const results = await db.prepare(sql).all(...params);
      return results;
    } catch (vectorError) {
      // If vector_top_k fails (e.g., not supported in this Turso version),
      // fall back to a simple full table scan with manual similarity calculation
      log(`Vector index search failed, falling back to full scan: ${vectorError.message}`, "error");
      
      // Get all vectors of the requested type
      let sql = 'SELECT id, content_id, content_type, vector FROM vectors';
      let params = [];
      
      if (contentType) {
        sql += ' WHERE content_type = ?';
        params.push(contentType);
      }
      
      const allVectors = await db.prepare(sql).all(...params);
      
      // Calculate similarities manually
      const withSimilarity = allVectors.map(row => {
        const storedVector = bufferToVector(row.vector);
        const similarity = cosineSimilarity(queryVector, storedVector);
        return { ...row, similarity };
      });
      
      // Filter by threshold, sort by similarity, and limit results
      return withSimilarity
        .filter(row => row.similarity >= threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    }
  } catch (error) {
    log(`Error finding similar vectors: ${error.message}`, "error");
    return [];
  }
}

/**
 * Calculate cosine similarity between two vectors
 * 
 * @param {Float32Array} a - First vector 
 * @param {Float32Array} b - Second vector
 * @returns {number} Cosine similarity (-1 to 1)
 */
function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (normA * normB);
}

/**
 * Create vector indexes for efficient similarity search
 * Should be called after database schema changes
 * 
 * @returns {Promise<boolean>} Success status
 */
async function createVectorIndexes() {
  try {
    if (!db) {
      throw new Error("Database not initialized");
    }
    
    // Basic indexes for content lookup
    const basicIndexes = [
      `CREATE INDEX IF NOT EXISTS idx_vectors_content_type ON vectors(content_type)`,
      `CREATE INDEX IF NOT EXISTS idx_vectors_content_id ON vectors(content_id)`,
    ];
    
    // Try to create the basic indexes
    for (const indexSQL of basicIndexes) {
      await db.prepare(indexSQL).run();
    }
    
    // Now try to create the vector index using libsql_vector_idx
    try {
      const vectorIndexSQL = `
        CREATE INDEX IF NOT EXISTS idx_vectors_vector ON vectors(libsql_vector_idx(vector)) WHERE vector IS NOT NULL
      `;
      await db.prepare(vectorIndexSQL).run();
      log('Vector similarity index created successfully');
    } catch (vectorError) {
      // Non-fatal - the system can still work without vector indexes
      log(`Note: Could not create vector similarity index: ${vectorError.message}. Vector search will use full scans.`, "error");
    }
    
    return true;
  } catch (error) {
    log(`Error creating vector indexes: ${error.message}`, "error");
    return false;
  }
}

// Logging function with timestamps and severity levels
function log(message, level = "info") {
  const timestamp = new Date().toISOString();
  const prefix = level === "error" ? "ERROR: " : "";
  console.error(`[${timestamp}] ${prefix}${message}`);
}

// Log environment information for debugging
log(`Environment variables:
NODE_ENV: ${process.env.NODE_ENV || 'not set'}
TURSO_DATABASE_URL: ${process.env.TURSO_DATABASE_URL ? (process.env.TURSO_DATABASE_URL.substring(0, 15) + "...") : 'not set'}
TURSO_AUTH_TOKEN: ${process.env.TURSO_AUTH_TOKEN ? "provided" : 'not set'}`);

// Database-related code - Turso Adapter implementation
let debugLogging = process.env.LOG_LEVEL === "debug";

/**
 * Log database operations when in debug mode
 * @param {string} message - The message to log
 */
function logDebug(message) {
  if (debugLogging) {
    console.log(`[DB] ${message}`);
  }
}

/**
 * Create a Turso client with connection fallback
 * @returns {Object} Turso client
 */
function createTursoClient() {
  try {
    // Get database URL and auth token from environment variables
    const dbUrl = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    log(`Database URL: ${dbUrl ? dbUrl.substring(0, 15) + "..." : "not set"}`);
    log(`Auth token: ${authToken ? "provided" : "not set"}`);
    
    // Check if required environment variables are set
    if (!dbUrl) {
      throw new Error("TURSO_DATABASE_URL environment variable is required");
    }
    
    // Check if URL has the correct protocol
    if (!dbUrl.startsWith("libsql://") && !dbUrl.startsWith("file:")) {
      log(`Invalid database URL protocol: ${dbUrl.split("://")[0]}://`, "error");
      log(`URL should start with libsql:// or file://`, "error");
      throw new Error("Invalid database URL protocol. Must start with libsql:// or file://");
    }

    // For remote Turso database, auth token is required
    if (dbUrl.startsWith("libsql://") && !authToken) {
      log("Auth token is required for remote Turso database but not provided", "error");
      throw new Error("Auth token is required for remote Turso database");
    }

    // Create remote Turso client
    if (dbUrl.startsWith("libsql://")) {
      log("Using remote Turso database");
      return createClient({
        url: dbUrl,
        authToken: authToken
      });
    }

    // File path handling for local SQLite
    if (dbUrl.startsWith("file:")) {
      log("Using local SQLite database");

      // Get the file path from the URL
      let filePath = dbUrl.replace("file:", "");

      // Make path absolute if it isn't already
      if (!path.isAbsolute(filePath)) {
        filePath = path.join(process.cwd(), filePath);
      }

      const dirPath = path.dirname(filePath);

      // Ensure directory exists
      if (!fs.existsSync(dirPath)) {
        log(`Creating database directory: ${dirPath}`);
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Log database path
      log(`Local SQLite database path: ${filePath}`);

      // Create local SQLite client
      const localClient = createClient({
        url: `file:${filePath}`,
      });

      return localClient;
    }
    
    // This should never happen due to previous checks
    throw new Error(`Unsupported database URL format: ${dbUrl}`);
  } catch (error) {
    log(`Database connection error: ${error.message}`, "error");
    throw error;
  }
}

/**
 * Statement class to emulate better-sqlite3 interface
 */
class Statement {
  constructor(client, sql) {
    this.client = client;
    this.sql = sql;

    // Convert positional parameters (?) to named parameters (:param1, :param2, etc.)
    // This fixes issues with parameter binding in libsql
    let paramCount = 0;
    this.convertedSql = sql.replace(/\?/g, () => `:param${++paramCount}`);
    this.paramCount = paramCount;
  }

  /**
   * Run a SQL statement with parameters
   * @param {...any} params - Parameters for the statement
   * @returns {Object} Result object
   */
  async run(...params) {
    try {
      // Convert positional parameters to named parameters object
      const namedParams = {};
      for (let i = 0; i < params.length; i++) {
        namedParams[`param${i + 1}`] = params[i];
      }

      logDebug(
        `Running SQL: ${this.convertedSql} with params: ${JSON.stringify(
          namedParams
        )}`
      );

      const result = await this.client.execute({
        sql: this.convertedSql,
        args: namedParams,
      });

      return {
        changes: result.rowsAffected || 0,
        lastInsertRowid: result.lastInsertRowid,
      };
    } catch (error) {
      log(`Error running SQL: ${this.sql}`, "error");
      throw error;
    }
  }

  /**
   * Get a single row as an object
   * @param {...any} params - Parameters for the statement
   * @returns {Object|undefined} Row object or undefined
   */
  async get(...params) {
    try {
      // Convert positional parameters to named parameters object
      const namedParams = {};
      for (let i = 0; i < params.length; i++) {
        namedParams[`param${i + 1}`] = params[i];
      }

      logDebug(
        `Getting row with SQL: ${
          this.convertedSql
        } with params: ${JSON.stringify(namedParams)}`
      );

      const result = await this.client.execute({
        sql: this.convertedSql,
        args: namedParams,
      });

      return result.rows[0] || undefined;
    } catch (error) {
      log(`Error getting row with SQL: ${this.sql}`, "error");
      throw error;
    }
  }

  /**
   * Get all rows as objects
   * @param {...any} params - Parameters for the statement
   * @returns {Array<Object>} Array of row objects
   */
  async all(...params) {
    try {
      // Convert positional parameters to named parameters object
      const namedParams = {};
      for (let i = 0; i < params.length; i++) {
        namedParams[`param${i + 1}`] = params[i];
      }

      logDebug(
        `Getting all rows with SQL: ${
          this.convertedSql
        } with params: ${JSON.stringify(namedParams)}`
      );

      const result = await this.client.execute({
        sql: this.convertedSql,
        args: namedParams,
      });

      return result.rows || [];
    } catch (error) {
      log(`Error getting all rows with SQL: ${this.sql}`, "error");
      throw error;
    }
  }
}

/**
 * Create a database adapter that emulates better-sqlite3 interface
 * @returns {Object} Database adapter object
 */
function createTursoAdapter() {
  const client = createTursoClient();

  return {
    /**
     * Prepare a SQL statement
     * @param {string} sql - SQL statement
     * @returns {Statement} Statement object
     */
    prepare(sql) {
      return new Statement(client, sql);
    },

    /**
     * Execute a SQL statement
     * @param {string} sql - SQL statement
     * @returns {void}
     */
    async exec(sql) {
      logDebug(`Executing SQL: ${sql}`);

      try {
        // Handle multiple statements separated by semicolons
        const statements = sql.split(";").filter((stmt) => stmt.trim());

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await client.execute({ sql: statement.trim() });
            } catch (stmtError) {
              log(
                `Error executing statement: ${statement.trim()}`,
                "error"
              );
              throw stmtError;
            }
          }
        }
      } catch (error) {
        log(`Error executing SQL: ${sql}`, "error");
        throw error;
      }
    },

    /**
     * Close the database connection
     * @returns {void}
     */
    async close() {
      log("Closing database connection");
      // Turso client doesn't have a close method, but we'll include this for API compatibility
    },
  };
}

let db = null;
let serverInstance = null;

// Define all memory tools
const MEMORY_TOOLS = {
  // System tools
  BANNER: {
    name: "generateBanner",
    description: "Generates a banner containing memory system statistics and status",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  HEALTH: {
    name: "checkHealth",
    description: "Checks the health of the memory system and its database",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  
  // Unified tool for beginning of conversation
  INIT_CONVERSATION: {
    name: "initConversation",
    description: "Initializes a conversation by storing the user message, generating a banner, and retrieving context in one operation",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content of the user message"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "low"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the message",
          additionalProperties: true
        }
      },
      required: ["content"]
    }
  },
  
  // Unified tool for ending a conversation
  END_CONVERSATION: {
    name: "endConversation",
    description: "Ends a conversation by storing the assistant message, recording a milestone, and logging an episode in one operation",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content of the assistant's final message"
        },
        milestone_title: {
          type: "string",
          description: "Title of the milestone to record"
        },
        milestone_description: {
          type: "string",
          description: "Description of what was accomplished"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "medium"
        },
        metadata: {
          type: "object",
          description: "Optional metadata",
          additionalProperties: true
        }
      },
      required: ["content", "milestone_title", "milestone_description"]
    }
  },
  
  // Short-term memory tools
  STORE_USER_MESSAGE: {
    name: "storeUserMessage",
    description: "Stores a user message in the short-term memory",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content of the message"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "low"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the message",
          additionalProperties: true
        }
      },
      required: ["content"]
    }
  },
  STORE_ASSISTANT_MESSAGE: {
    name: "storeAssistantMessage",
    description: "Stores an assistant message in the short-term memory",
    inputSchema: {
      type: "object",
      properties: {
        content: {
          type: "string",
          description: "Content of the message"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "low"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the message",
          additionalProperties: true
        }
      },
      required: ["content"]
    }
  },
  TRACK_ACTIVE_FILE: {
    name: "trackActiveFile",
    description: "Tracks an active file being accessed by the user",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Path to the file being tracked"
        },
        action: {
          type: "string",
          description: "Action performed on the file (open, edit, close, etc.)"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the file",
          additionalProperties: true
        }
      },
      required: ["filename", "action"]
    }
  },
  GET_RECENT_MESSAGES: {
    name: "getRecentMessages",
    description: "Retrieves recent messages from the short-term memory",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of messages to retrieve",
          default: 10
        },
        importance: {
          type: "string",
          description: "Filter by importance level (low, medium, high)"
        }
      }
    }
  },
  GET_ACTIVE_FILES: {
    name: "getActiveFiles",
    description: "Retrieves active files from the short-term memory",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of files to retrieve",
          default: 10
        }
      }
    }
  },

  // Long-term memory tools
  STORE_MILESTONE: {
    name: "storeMilestone",
    description: "Stores a project milestone in the long-term memory",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the milestone"
        },
        description: {
          type: "string",
          description: "Description of the milestone"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "medium"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the milestone",
          additionalProperties: true
        }
      },
      required: ["title", "description"]
    }
  },
  STORE_DECISION: {
    name: "storeDecision",
    description: "Stores a project decision in the long-term memory",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the decision"
        },
        content: {
          type: "string",
          description: "Content of the decision"
        },
        reasoning: {
          type: "string",
          description: "Reasoning behind the decision"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "medium"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the decision",
          additionalProperties: true
        }
      },
      required: ["title", "content"]
    }
  },
  STORE_REQUIREMENT: {
    name: "storeRequirement",
    description: "Stores a project requirement in the long-term memory",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Title of the requirement"
        },
        content: {
          type: "string",
          description: "Content of the requirement"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "medium"
        },
        metadata: {
          type: "object",
          description: "Optional metadata for the requirement",
          additionalProperties: true
        }
      },
      required: ["title", "content"]
    }
  },

  // Episodic memory tools
  RECORD_EPISODE: {
    name: "recordEpisode",
    description: "Records an episode (action) in the episodic memory",
    inputSchema: {
      type: "object",
      properties: {
        actor: {
          type: "string",
          description: "Actor performing the action (user, assistant, system)"
        },
        action: {
          type: "string",
          description: "Type of action performed"
        },
        content: {
          type: "string",
          description: "Content or details of the action"
        },
        importance: {
          type: "string",
          description: "Importance level (low, medium, high)",
          default: "low"
        },
        context: {
          type: "string",
          description: "Context for the episode"
        }
      },
      required: ["actor", "action", "content"]
    }
  },
  GET_RECENT_EPISODES: {
    name: "getRecentEpisodes",
    description: "Retrieves recent episodes from the episodic memory",
    inputSchema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of episodes to retrieve",
          default: 10
        },
        context: {
          type: "string",
          description: "Filter by context"
        }
      }
    }
  },
  
  // Context tools
  GET_COMPREHENSIVE_CONTEXT: {
    name: "getComprehensiveContext",
    description: "Retrieves comprehensive context from all memory systems",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Optional query for semantic search to find relevant context"
        }
      }
    }
  },
  GET_MEMORY_STATS: {
    name: "getMemoryStats",
    description: "Retrieves statistics about the memory system",
    inputSchema: {
      type: "object",
      properties: {}
    }
  },
  
  // Vector management tool
  MANAGE_VECTOR: {
    name: "manageVector",
    description: "Unified tool for managing vector embeddings with operations for store, search, update, and delete",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          description: "Operation to perform (store, search, update, delete)",
          enum: ["store", "search", "update", "delete"]
        },
        contentId: {
          type: "number",
          description: "ID of the content this vector represents (for store, update, delete)"
        },
        contentType: {
          type: "string",
          description: "Type of content (message, file, snippet, etc.)"
        },
        vector: {
          type: "array",
          description: "Vector data as array of numbers (for store, update) or query vector (for search)"
        },
        metadata: {
          type: "object",
          description: "Additional info about the vector (optional)",
          additionalProperties: true
        },
        vectorId: {
          type: "number",
          description: "ID of the vector to update or delete"
        },
        limit: {
          type: "number",
          description: "Maximum number of results for search operation",
          default: 10
        },
        threshold: {
          type: "number",
          description: "Similarity threshold for search operation",
          default: 0.7
        }
      },
      required: ["operation"]
    }
  }
};

// In-memory store as fallback if database initialization fails
const inMemoryStore = {
  messages: [],
  activeFiles: [],
  milestones: [],
  decisions: [],
  requirements: [],
  episodes: []
};

let useInMemory = false;

// Initialize database
async function initializeDatabase() {
  try {
    // Check if environment variables are set (from either process.env or .env.local)
    if (!process.env.TURSO_DATABASE_URL) {
      log('TURSO_DATABASE_URL environment variable not found - using in-memory database', 'error');
      useInMemory = true;
      return null;
    }
    
    if (process.env.TURSO_DATABASE_URL.startsWith('libsql://') && !process.env.TURSO_AUTH_TOKEN) {
      log('TURSO_AUTH_TOKEN environment variable required for remote Turso database but not found - using in-memory database', 'error');
      useInMemory = true;
      return null;
    }
    
    log('Initializing database with Turso');
    db = createTursoAdapter();
    
    // Test connection
    try {
      const testResult = await db.prepare('SELECT 1 as test').get();
      log(`Database connection test successful: ${JSON.stringify(testResult)}`);
    } catch (error) {
      log(`Failed to connect to Turso database: ${error.message}`, "error");
      log('Falling back to in-memory database', 'error');
      useInMemory = true;
      return null;
    }
    
    // Create tables if they don't exist
    const tables = {
      messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL,
          metadata TEXT,
          importance TEXT DEFAULT 'low'
        )
      `,
      active_files: `
    CREATE TABLE IF NOT EXISTS active_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
          filename TEXT UNIQUE,
          last_accessed INTEGER,
      metadata TEXT
        )
      `,
      milestones: `
    CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          description TEXT,
          importance TEXT DEFAULT 'medium',
          created_at INTEGER,
      metadata TEXT
        )
      `,
      decisions: `
    CREATE TABLE IF NOT EXISTS decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
      reasoning TEXT,
          importance TEXT DEFAULT 'medium',
          created_at INTEGER,
      metadata TEXT
        )
      `,
      requirements: `
    CREATE TABLE IF NOT EXISTS requirements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT,
          content TEXT,
          importance TEXT DEFAULT 'medium',
          created_at INTEGER,
      metadata TEXT
        )
      `,
      episodes: `
    CREATE TABLE IF NOT EXISTS episodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor TEXT,
          action TEXT,
          content TEXT,
          timestamp INTEGER,
          importance TEXT DEFAULT 'low',
      context TEXT,
      metadata TEXT
        )
      `,
      // New vector-based tables for codebase indexing
      vectors: `
    CREATE TABLE IF NOT EXISTS vectors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content_id INTEGER NOT NULL,
      content_type TEXT NOT NULL,
      vector BLOB NOT NULL,
      created_at INTEGER NOT NULL,
      metadata TEXT
    )
      `,
      code_files: `
    CREATE TABLE IF NOT EXISTS code_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_path TEXT UNIQUE,
      language TEXT,
      last_indexed INTEGER,
      size INTEGER,
      metadata TEXT
    )
      `,
      code_snippets: `
    CREATE TABLE IF NOT EXISTS code_snippets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_id INTEGER,
      start_line INTEGER,
      end_line INTEGER,
      content TEXT,
      symbol_type TEXT,
      metadata TEXT,
      FOREIGN KEY (file_id) REFERENCES code_files(id)
    )
      `
    };
    
    // Verify or create each table
    for (const [name, createStatement] of Object.entries(tables)) {
      try {
        await db.prepare(createStatement).run();
        log(`Table ${name} verified/created`);
      } catch (error) {
        log(`Failed to create table ${name}: ${error.message}`, "error");
        throw error;
      }
    }
    
    // Create vector indexes for efficient similarity search
    try {
      await createVectorIndexes();
      log('Vector indexes setup completed');
    } catch (indexError) {
      // Non-fatal error - the system can still work without vector indexes
      log(`Vector indexes creation failed: ${indexError.message}. Continuing with setup.`, "error");
    }
    
    // Create a test_connection table to verify write access
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS test_connection (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          created_at TEXT
        )
      `).run();
      
      const now = new Date().toISOString();
      await db.prepare(`
        INSERT INTO test_connection (name, created_at)
        VALUES ('test', ?)
      `).run(now);
      
      const testResult = await db.prepare('SELECT * FROM test_connection ORDER BY id DESC LIMIT 1').get();
      log(`Write test successful: ${JSON.stringify(testResult)}`);
    } catch (error) {
      log(`Failed to write to database: ${error.message}`, "error");
      throw error;
    }
    
    useInMemory = false;
    return db;
  } catch (error) {
    log(`Database initialization failed: ${error.message}`, "error");
    log("Falling back to in-memory storage", "error");
    useInMemory = true;
    return null;
  }
}

// Define main function to start the server
async function main() {
  try {
    // Initialize the database
    await initializeDatabase();
    log('Database initialization completed');
    
    // Create the server with metadata following the brave.ts pattern
    const server = new Server(
      {
        name: "cursor10x-mcp",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    // Define the tools handler - returns list of available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      // Return all memory tools
      return {
        tools: Object.values(MEMORY_TOOLS).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      };
    });
    
    // Define the call handler - executes the tools
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        
        // Some tools don't require arguments
        const noArgsTools = [
          MEMORY_TOOLS.BANNER.name,
          MEMORY_TOOLS.HEALTH.name,
          MEMORY_TOOLS.GET_COMPREHENSIVE_CONTEXT.name,
          MEMORY_TOOLS.GET_MEMORY_STATS.name
        ];
        
        if (!args && !noArgsTools.includes(name)) {
          throw new Error("No arguments provided");
        }

        // Helper function to retrieve comprehensive context
        async function getComprehensiveContext(userMessage = null) {
          const context = {
            shortTerm: {},
            longTerm: {},
            episodic: {},
            semantic: {}, // Section for semantically similar content
            system: { healthy: true, timestamp: new Date().toISOString() }
          };
          
          try {
            let queryVector = null;
            // Generate embedding for the user message if provided
            if (userMessage) {
              queryVector = await createEmbedding(userMessage);
              log(`Generated query vector for context relevance scoring`);
            }
            
            // --- SHORT-TERM CONTEXT ---
            // Fetch more messages than we'll ultimately use, so we can filter by relevance
            const messages = await db.prepare(`
              SELECT id, role, content, created_at, importance
              FROM messages
              ORDER BY created_at DESC
              LIMIT 15
            `).all();
            
            // Score messages by relevance if we have a query vector
            let scoredMessages = messages;
            if (queryVector) {
              scoredMessages = await scoreItemsByRelevance(messages, queryVector, 'user_message', 'assistant_message');
              // Take top 5 most relevant messages
              scoredMessages = scoredMessages.slice(0, 5);
            } else {
              // Without a query, just take the 5 most recent
              scoredMessages = messages.slice(0, 5);
            }
            
            // Get active files (similar approach)
            const files = await db.prepare(`
              SELECT id, filename, last_accessed
              FROM active_files
              ORDER BY last_accessed DESC
              LIMIT 10
            `).all();
            
            // Score files by relevance if we have a query vector
            let scoredFiles = files;
            if (queryVector) {
              scoredFiles = await scoreItemsByRelevance(files, queryVector, 'code_file');
              // Take top 5 most relevant files
              scoredFiles = scoredFiles.slice(0, 5);
            } else {
              // Without a query, just take the 5 most recent
              scoredFiles = files.slice(0, 5);
            }
            
            context.shortTerm = {
              recentMessages: scoredMessages.map(msg => ({
                ...msg,
                created_at: new Date(msg.created_at).toISOString(),
                relevance: msg.relevance || null
              })),
              activeFiles: scoredFiles.map(file => ({
                ...file,
                last_accessed: new Date(file.last_accessed).toISOString(),
                relevance: file.relevance || null
              }))
            };
            
            // --- LONG-TERM CONTEXT ---
            // Fetch more items than we'll need so we can filter by relevance
            const milestones = await db.prepare(`
              SELECT id, title, description, importance, created_at
              FROM milestones
              ORDER BY created_at DESC
              LIMIT 10
            `).all();
            
            const decisions = await db.prepare(`
              SELECT id, title, content, reasoning, importance, created_at
              FROM decisions
              WHERE importance IN ('high', 'medium', 'critical')
              ORDER BY created_at DESC
              LIMIT 10
            `).all();
            
            const requirements = await db.prepare(`
              SELECT id, title, content, importance, created_at
              FROM requirements
              WHERE importance IN ('high', 'medium', 'critical')
              ORDER BY created_at DESC
              LIMIT 10
            `).all();
            
            // Score long-term items by relevance if we have a query vector
            let scoredMilestones = milestones;
            let scoredDecisions = decisions;
            let scoredRequirements = requirements;
            
            if (queryVector) {
              // Score each type of item
              scoredMilestones = await scoreItemsByRelevance(milestones, queryVector, 'milestone');
              scoredDecisions = await scoreItemsByRelevance(decisions, queryVector, 'decision');
              scoredRequirements = await scoreItemsByRelevance(requirements, queryVector, 'requirement');
              
              // Take top most relevant items
              scoredMilestones = scoredMilestones.slice(0, 3);
              scoredDecisions = scoredDecisions.slice(0, 3);
              scoredRequirements = scoredRequirements.slice(0, 3);
            } else {
              // Without a query, just take the most recent
              scoredMilestones = milestones.slice(0, 3);
              scoredDecisions = decisions.slice(0, 3);
              scoredRequirements = requirements.slice(0, 3);
            }
            
            context.longTerm = {
              milestones: scoredMilestones.map(m => ({
                ...m,
                created_at: new Date(m.created_at).toISOString(),
                relevance: m.relevance || null
              })),
              decisions: scoredDecisions.map(d => ({
                ...d,
                created_at: new Date(d.created_at).toISOString(),
                relevance: d.relevance || null
              })),
              requirements: scoredRequirements.map(r => ({
                ...r,
                created_at: new Date(r.created_at).toISOString(),
                relevance: r.relevance || null
              }))
            };
            
            // --- EPISODIC CONTEXT ---
            // Fetch episodes
            const episodes = await db.prepare(`
              SELECT id, actor, action, content, timestamp, importance, context
              FROM episodes
              ORDER BY timestamp DESC
              LIMIT 15
            `).all();
            
            // Score episodes by relevance if we have a query vector
            let scoredEpisodes = episodes;
            if (queryVector) {
              scoredEpisodes = await scoreItemsByRelevance(episodes, queryVector, 'episode');
              // Take top 5 most relevant episodes
              scoredEpisodes = scoredEpisodes.slice(0, 5);
            } else {
              // Without a query, just take the 5 most recent
              scoredEpisodes = episodes.slice(0, 5);
            }
            
            context.episodic = {
              recentEpisodes: scoredEpisodes.map(ep => ({
                ...ep,
                timestamp: new Date(ep.timestamp).toISOString(),
                relevance: ep.relevance || null
              }))
            };
            
            // Add semantically similar content if userMessage is provided
            if (userMessage && queryVector) {
              try {
                // Find similar messages with higher threshold for better quality matches
                const similarMessages = await findSimilarItems(queryVector, 'user_message', 'assistant_message', 3, 0.6);
                
                // Find similar code files
                const similarFiles = await findSimilarItems(queryVector, 'code_file', null, 2, 0.6);
                
                // Find similar code snippets
                const similarSnippets = await findSimilarItems(queryVector, 'code_snippet', null, 3, 0.6);
                
                // Group similar code snippets by file to reduce redundancy
                const groupedSnippets = groupSimilarSnippetsByFile(similarSnippets);
                
                // Add to context
                context.semantic = {
                  similarMessages,
                  similarFiles,
                  similarSnippets: groupedSnippets
                };
                
                log(`Added semantic context with ${similarMessages.length} messages, ${similarFiles.length} files, and ${groupedSnippets.length} snippet groups`);
              } catch (error) {
                log(`Error adding semantic context: ${error.message}`, "error");
                // Non-blocking error - we still return the basic context
                context.semantic = { error: error.message };
              }
            }
          } catch (error) {
            log(`Error building comprehensive context: ${error.message}`, "error");
            // Return minimal context in case of error
            context.error = error.message;
          }
          
          return context;
        }
        
        /**
         * Helper function to score items by relevance to a query vector
         * @param {Array} items - Array of items to score
         * @param {Float32Array} queryVector - Vector to compare against
         * @param {string} primaryType - Primary content type to look for
         * @param {string} secondaryType - Secondary content type to look for (optional)
         * @param {number} threshold - Minimum similarity score to include (default: 0.5)
         * @returns {Array} Items with relevance scores, sorted by relevance
         */
        async function scoreItemsByRelevance(items, queryVector, primaryType, secondaryType = null, threshold = 0.5) {
          if (!items || items.length === 0 || !queryVector) {
            return items;
          }
          
          try {
            // Get all vectors for these content types
            let sql = `
              SELECT content_id, content_type, vector 
              FROM vectors 
              WHERE content_type = ?
            `;
            let params = [primaryType];
            
            if (secondaryType) {
              sql = `
                SELECT content_id, content_type, vector 
                FROM vectors 
                WHERE content_type = ? OR content_type = ?
              `;
              params = [primaryType, secondaryType];
            }
            
            const vectors = await db.prepare(sql).all(...params);
            
            // Create a map of content_id to vector
            const vectorMap = new Map();
            vectors.forEach(v => {
              vectorMap.set(v.content_id, bufferToVector(v.vector));
            });
            
            // Score each item by comparing its vector to the query vector
            const scoredItems = items.map(item => {
              const id = item.id;
              let relevance = 0;
              
              // If we have a vector for this item, calculate similarity
              if (vectorMap.has(id)) {
                const itemVector = vectorMap.get(id);
                relevance = cosineSimilarity(queryVector, itemVector);
              }
              
              return {
                ...item,
                relevance
              };
            });
            
            // Filter by threshold and sort by relevance (highest first)
            return scoredItems
              .filter(item => item.relevance >= threshold)
              .sort((a, b) => b.relevance - a.relevance);
          } catch (error) {
            log(`Error scoring items by relevance: ${error.message}`, "error");
            return items;
          }
        }
        
        /**
         * Groups similar code snippets by file to reduce redundancy
         * @param {Array} snippets - Array of code snippets
         * @returns {Array} Grouped snippets by file
         */
        function groupSimilarSnippetsByFile(snippets) {
          if (!snippets || snippets.length === 0) {
            return [];
          }
          
          // Create a map to group snippets by file path
          const fileGroups = new Map();
          
          snippets.forEach(snippet => {
            const filePath = snippet.file_path;
            
            if (!fileGroups.has(filePath)) {
              fileGroups.set(filePath, {
                file_path: filePath,
                relevance: snippet.similarity,
                snippets: []
              });
            }
            
            // Add snippet to its file group
            const group = fileGroups.get(filePath);
            group.snippets.push(snippet);
            
            // Update group relevance to highest snippet similarity
            if (snippet.similarity > group.relevance) {
              group.relevance = snippet.similarity;
            }
          });
          
          // Convert map to array and sort by overall relevance
          return Array.from(fileGroups.values())
            .sort((a, b) => b.relevance - a.relevance);
        }
        
        /**
         * Helper function to find semantically similar items based on a query vector
         * @param {Float32Array} queryVector - The vector to compare against
         * @param {string} contentType - The type of content to search for
         * @param {string} alternativeType - Alternative content type to include (optional)
         * @param {number} limit - Maximum number of results
         * @param {number} threshold - Minimum similarity threshold
         * @returns {Promise<Array>} Array of similar items with their details
         */
        async function findSimilarItems(queryVector, contentType, alternativeType = null, limit = 3, threshold = 0.5) {
          try {
            let similarVectors;
            
            if (alternativeType) {
              // Find all items of either contentType or alternativeType
              const type1Results = await findSimilarVectors(queryVector, contentType, limit, threshold);
              const type2Results = await findSimilarVectors(queryVector, alternativeType, limit, threshold);
              
              // Combine and sort by similarity
              similarVectors = [...type1Results, ...type2Results]
                .sort((a, b) => b.similarity - a.similarity)
                .slice(0, limit);
            } else {
              // Just search for the specified content type
              similarVectors = await findSimilarVectors(queryVector, contentType, limit, threshold);
            }
            
            // Fetch detailed content for each vector based on content type
            const items = [];
            for (const vector of similarVectors) {
              try {
                let item = { 
                  id: vector.content_id, 
                  type: vector.content_type,
                  similarity: vector.similarity
                };
                
                // Fetch additional details based on content type
                if (vector.content_type === 'user_message' || vector.content_type === 'assistant_message') {
                  const message = await db.prepare(`
                    SELECT role, content, created_at, importance
                    FROM messages
                    WHERE id = ?
                  `).get(vector.content_id);
                  
                  if (message) {
                    item = {
                      ...item,
                      role: message.role,
                      content: message.content,
                      created_at: new Date(message.created_at).toISOString(),
                      importance: message.importance
                    };
                  }
                } else if (vector.content_type === 'code_file') {
                  const file = await db.prepare(`
                    SELECT file_path, language, last_indexed
                    FROM code_files
                    WHERE id = ?
                  `).get(vector.content_id);
                  
                  if (file) {
                    item = {
                      ...item,
                      path: file.file_path,
                      language: file.language,
                      last_indexed: new Date(file.last_indexed).toISOString()
                    };
                  }
                } else if (vector.content_type === 'code_snippet') {
                  const snippet = await db.prepare(`
                    SELECT cs.content, cs.start_line, cs.end_line, cs.symbol_type, cf.file_path
                    FROM code_snippets cs
                    JOIN code_files cf ON cs.file_id = cf.id
                    WHERE cs.id = ?
                  `).get(vector.content_id);
                  
                  if (snippet) {
                    item = {
                      ...item,
                      content: snippet.content,
                      file_path: snippet.file_path,
                      lines: `${snippet.start_line}-${snippet.end_line}`,
                      symbol_type: snippet.symbol_type
                    };
                  }
                }
                
                items.push(item);
              } catch (detailError) {
                log(`Error fetching details for ${vector.content_type} id ${vector.content_id}: ${detailError.message}`, "error");
                // Skip this item and continue with others
              }
            }
            
            return items;
          } catch (error) {
            log(`Error in findSimilarItems: ${error.message}`, "error");
            return [];
          }
        }
        
        switch (name) {
          case MEMORY_TOOLS.BANNER.name: {
            // Generate banner with memory system stats
            try {
              let memoryCount = 0;
              let lastAccessed = 'Never';
              let systemStatus = 'Active';
              let mode = '';
              
              if (useInMemory) {
                memoryCount = inMemoryStore.messages.length + 
                              inMemoryStore.milestones.length + 
                              inMemoryStore.decisions.length + 
                              inMemoryStore.requirements.length + 
                              inMemoryStore.episodes.length;
                
                mode = 'in-memory';
                if (inMemoryStore.messages.length > 0) {
                  const latestTimestamp = Math.max(
                    ...inMemoryStore.messages.map(m => m.created_at),
                    ...inMemoryStore.episodes.map(e => e.timestamp || 0)
                  );
                  lastAccessed = formatTimestamp(latestTimestamp);
                }
              } else {
                // Count all items
                const messageCnt = await db.prepare('SELECT COUNT(*) as count FROM messages').get();
                const milestoneCnt = await db.prepare('SELECT COUNT(*) as count FROM milestones').get();
                const decisionCnt = await db.prepare('SELECT COUNT(*) as count FROM decisions').get();
                const requirementCnt = await db.prepare('SELECT COUNT(*) as count FROM requirements').get();
                const episodeCnt = await db.prepare('SELECT COUNT(*) as count FROM episodes').get();
                
                memoryCount = (messageCnt?.count || 0) + 
                              (milestoneCnt?.count || 0) + 
                              (decisionCnt?.count || 0) + 
                              (requirementCnt?.count || 0) + 
                              (episodeCnt?.count || 0);
                
                mode = 'turso';
                
                // Get most recent timestamp across all tables
                const lastMsgTime = await db.prepare('SELECT MAX(created_at) as timestamp FROM messages').get();
                const lastEpisodeTime = await db.prepare('SELECT MAX(timestamp) as timestamp FROM episodes').get();
                
                const timestamps = [
                  lastMsgTime?.timestamp,
                  lastEpisodeTime?.timestamp
                ].filter(Boolean);
                
                if (timestamps.length > 0) {
                  lastAccessed = formatTimestamp(Math.max(...timestamps));
                }
              }
              
              // Create formatted banner
              const banner = [
                `🧠 Memory System: ${systemStatus}`,
                `🗂️ Total Memories: ${memoryCount}`,
                `🕚 Latest Memory: ${lastAccessed}`
              ].join('\n');
              
              // Also include the data for backward compatibility
              const result = {
                status: 'ok',
                formatted_banner: banner,
                memory_system: systemStatus.toLowerCase(),
                mode,
                memory_count: memoryCount,
                last_accessed: lastAccessed
              };
              
              return {
                content: [{ type: "text", text: JSON.stringify(result) }],
                isError: false
              };
            } catch (error) {
              log(`Error generating banner: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ 
                  status: 'error', 
                  error: error.message,
                  formatted_banner: "🧠 Memory System: Issue\n🗂️ Total Memories: Unknown\n🕚 Latest Memory: Unknown" 
                }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.HEALTH.name: {
            // Check health of memory system
            let result;
            if (useInMemory) {
              result = {
                status: 'ok',
                mode: 'in-memory',
                message_count: inMemoryStore.messages.length,
                active_files_count: inMemoryStore.activeFiles.length,
                current_directory: process.cwd(),
                timestamp: new Date().toISOString()
              };
            } else {
              // Test database connection
              const testResult = await db.prepare('SELECT 1 as test').get();
              
              result = {
                status: 'ok',
                mode: 'turso',
                message_count: (await db.prepare('SELECT COUNT(*) as count FROM messages').get())?.count || 0,
                active_files_count: (await db.prepare('SELECT COUNT(*) as count FROM active_files').get())?.count || 0,
                current_directory: process.cwd(),
                timestamp: new Date().toISOString()
              };
            }
            
            return {
              content: [{ type: "text", text: JSON.stringify(result) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.INIT_CONVERSATION.name: {
            // Store user message, generate banner, and retrieve context
            const { content, importance = 'low', metadata = null } = args;
            const now = Date.now();
            
            try {
              // Store user message
              if (useInMemory) {
                inMemoryStore.messages.push({
                  role: 'user',
                  content,
                  created_at: now,
                  importance,
                  metadata
                });
              } else {
                await db.prepare(`
                  INSERT INTO messages (role, content, created_at, importance, metadata)
                  VALUES ('user', ?, ?, ?, ?)
                `).run(content, now, importance, metadata ? JSON.stringify(metadata) : null);
              }
              
              log(`Stored user message: "${content.substring(0, 30)}..." with importance: ${importance}`);

              // Check if query is code-related and trigger background indexing if needed
              if (isCodeRelatedQuery(content)) {
                log(`Detected code-related query: "${content.substring(0, 30)}..."`);
                
                // Trigger background indexing process
                // We use setTimeout to ensure this doesn't block the main flow
                setTimeout(() => {
                  triggerCodeIndexing(content)
                    .catch(error => log(`Error triggering code indexing: ${error.message}`, "error"));
                }, 0);
              }
              
              // Generate banner data
              let memoryCount = 0;
              let lastAccessed = formatTimestamp(now); // Use current message time as default
              let systemStatus = 'Active';
              let mode = '';
              
              if (useInMemory) {
                memoryCount = inMemoryStore.messages.length + 
                              inMemoryStore.milestones.length + 
                              inMemoryStore.decisions.length + 
                              inMemoryStore.requirements.length + 
                              inMemoryStore.episodes.length;
                
                mode = 'in-memory';
              } else {
                // Count all items
                const messageCnt = await db.prepare('SELECT COUNT(*) as count FROM messages').get();
                const milestoneCnt = await db.prepare('SELECT COUNT(*) as count FROM milestones').get();
                const decisionCnt = await db.prepare('SELECT COUNT(*) as count FROM decisions').get();
                const requirementCnt = await db.prepare('SELECT COUNT(*) as count FROM requirements').get();
                const episodeCnt = await db.prepare('SELECT COUNT(*) as count FROM episodes').get();
                
                memoryCount = (messageCnt?.count || 0) + 
                              (milestoneCnt?.count || 0) + 
                              (decisionCnt?.count || 0) + 
                              (requirementCnt?.count || 0) + 
                              (episodeCnt?.count || 0);
                
                mode = 'turso';
              }
              
              // Create formatted banner
              const formattedBanner = [
                `🧠 Memory System: ${systemStatus}`,
                `🗂️ Total Memories: ${memoryCount}`,
                `🕚 Latest Memory: ${lastAccessed}`
              ].join('\n');
              
              // Create banner object for backward compatibility
              const bannerResult = {
                status: 'ok',
                formatted_banner: formattedBanner,
                memory_system: systemStatus.toLowerCase(),
                mode,
                memory_count: memoryCount,
                last_accessed: lastAccessed
              };
              
              // Retrieve context with semantic search based on user message
              const contextResult = await getComprehensiveContext(content);
              
              // Format the response with clear separation between banner and context
              return {
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({ 
                    status: 'ok', 
                    display: {
                      banner: bannerResult
                    },
                    internal: {
                      context: contextResult,
                      messageStored: true,
                      timestamp: now
                    }
                  }) 
                }],
                isError: false
              };
            } catch (error) {
              log(`Error in initConversation: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ 
                  status: 'error', 
                  error: error.message,
                  display: {
                    banner: {
                      formatted_banner: "🧠 Memory System: Issue\n🗂️ Total Memories: Unknown\n🕚 Latest Memory: Unknown"
                    }
                  }
                }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.STORE_USER_MESSAGE.name: {
            // Store user message
            const { content, importance = 'low', metadata = null } = args;
            const now = Date.now();
            let messageId; // Moved declaration here to fix scoping
            
            try {
              if (useInMemory) {
                inMemoryStore.messages.push({
                  role: 'user',
                  content,
                  created_at: now,
                  importance,
                  metadata
                });
                messageId = inMemoryStore.messages.length; // Simple ID for in-memory store
              } else {
                // Insert message into database
                const result = await db.prepare(`
                  INSERT INTO messages (role, content, created_at, importance, metadata)
                  VALUES ('user', ?, ?, ?, ?)
                `).run(content, now, importance, metadata ? JSON.stringify(metadata) : null);
                
                messageId = result.lastInsertRowid;
                
                // Generate and store embedding in the background without blocking
                setTimeout(async () => {
                  try {
                    // Generate vector embedding for the message
                    const messageVector = await createEmbedding(content);
                    
                    // Store the embedding with link to the message
                    await storeEmbedding(messageId, 'user_message', messageVector, {
                      importance,
                      timestamp: now,
                      role: 'user'
                    });
                    
                    logDebug(`Generated and stored embedding for user message ID ${messageId}`);
                  } catch (vectorError) {
                    log(`Error generating vector for user message: ${vectorError.message}`, "error");
                    // Non-blocking - we continue even if vector generation fails
                  }
                }, 0);
              }
            } catch (error) {
              log(`Error storing user message: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'error', error: error.message }) }],
                isError: true
              };
            }
            
            log(`Stored user message: "${content.substring(0, 30)}..." with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', messageId, timestamp: now }) }],
              isError: false
            };
          }

          case MEMORY_TOOLS.TRACK_ACTIVE_FILE.name: {
            // Track an active file
            const { filename, action, metadata = null } = args;
            const now = Date.now();
            
            try {
              if (useInMemory) {
                // Find existing or create new entry
                const existingFileIndex = inMemoryStore.activeFiles.findIndex(f => f.filename === filename);
                if (existingFileIndex >= 0) {
                  inMemoryStore.activeFiles[existingFileIndex] = {
                    ...inMemoryStore.activeFiles[existingFileIndex],
                    last_accessed: now,
                    action,
                    metadata
                  };
                } else {
                  inMemoryStore.activeFiles.push({
                    filename,
                    action,
                    last_accessed: now,
                    metadata
                  });
                }
                
                // Record in episodes
                inMemoryStore.episodes.push({
                  actor: 'user',
                  action,
                  content: filename,
                  timestamp: now,
                  importance: 'low',
                  context: 'file-tracking'
                });
              } else {
                // Upsert active file
                await db.prepare(`
                  INSERT INTO active_files (filename, last_accessed, metadata)
                  VALUES (?, ?, ?)
                  ON CONFLICT(filename) DO UPDATE SET
                    last_accessed = excluded.last_accessed,
                    metadata = excluded.metadata
                `).run(filename, now, metadata ? JSON.stringify(metadata) : null);
                
                // Record file action in episodes
                await db.prepare(`
                  INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                  VALUES ('user', ?, ?, ?, 'low', 'file-tracking', NULL)
                `).run(action, filename, now);
                
                // Start code indexing process in the background if this is a code file
                // Don't block the main operation - run this asynchronously
                setTimeout(async () => {
                  try {
                    await indexCodeFile(filename, action);
                  } catch (indexError) {
                    log(`Background code indexing error for ${filename}: ${indexError.message}`, "error");
                  }
                }, 0);
              }
              
              log(`Tracked file: ${filename} with action: ${action}`);
              
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'ok', filename, action, timestamp: now }) }],
                isError: false
              };
            } catch (error) {
              log(`Error tracking file ${filename}: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'error', error: error.message }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.GET_RECENT_MESSAGES.name: {
            // Get recent messages
            const { limit = 10, importance = null } = args || {};
            
            let messages;
            if (useInMemory) {
              // Filter by importance if specified
              let filtered = inMemoryStore.messages;
              if (importance) {
                filtered = filtered.filter(m => m.importance === importance);
              }
              
              // Sort by timestamp and take limit
              messages = filtered
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, limit)
                .map(msg => ({
                  ...msg,
                  created_at: new Date(msg.created_at).toISOString()
                }));
            } else {
              let query = `
                SELECT id, role, content, created_at, importance, metadata
                FROM messages
                ORDER BY created_at DESC
                LIMIT ?
              `;
              let params = [limit];
              
              if (importance) {
                query = `
                  SELECT id, role, content, created_at, importance, metadata
                  FROM messages
                  WHERE importance = ?
                  ORDER BY created_at DESC
                  LIMIT ?
                `;
                params = [importance, limit];
              }
              
              const rows = await db.prepare(query).all(...params);
              messages = rows.map(msg => ({
                ...msg,
                metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
                created_at: new Date(msg.created_at).toISOString()
              }));
            }

            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', messages }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.GET_ACTIVE_FILES.name: {
            // Get active files
            const { limit = 10 } = args || {};
            
            let files;
            if (useInMemory) {
              files = inMemoryStore.activeFiles
                .sort((a, b) => b.last_accessed - a.last_accessed)
                .slice(0, limit)
                .map(file => ({
                  ...file,
                  last_accessed: new Date(file.last_accessed).toISOString()
                }));
            } else {
              const rows = await db.prepare(`
                SELECT id, filename, last_accessed, metadata
                FROM active_files
                ORDER BY last_accessed DESC
                LIMIT ?
              `).all(limit);
              
              files = rows.map(file => ({
                ...file,
                metadata: file.metadata ? JSON.parse(file.metadata) : null,
                last_accessed: new Date(file.last_accessed).toISOString()
              }));
            }

            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', files }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.STORE_MILESTONE.name: {
            // Store a milestone
            const { title, description, importance = 'medium', metadata = null } = args;
            const now = Date.now();

            if (useInMemory) {
              inMemoryStore.milestones.push({
                title,
                description,
                importance,
                created_at: now,
                metadata
              });
              
              // Record milestone in episodes
              inMemoryStore.episodes.push({
                actor: 'system',
                action: 'milestone_created',
                content: title,
                timestamp: now,
                importance,
                context: 'milestone-tracking'
              });
            } else {
              await db.prepare(`
                INSERT INTO milestones (title, description, importance, created_at, metadata)
                VALUES (?, ?, ?, ?, ?)
              `).run(title, description, importance, now, metadata ? JSON.stringify(metadata) : null);
              
              // Record milestone in episodes
              await db.prepare(`
                INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                VALUES ('system', 'milestone_created', ?, ?, ?, 'milestone-tracking', NULL)
              `).run(title, now, importance);
            }
            
            log(`Stored milestone: "${title}" with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', title, timestamp: now }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.STORE_DECISION.name: {
            // Store a decision
            const { title, content, reasoning = null, importance = 'medium', metadata = null } = args;
            const now = Date.now();

            if (useInMemory) {
              inMemoryStore.decisions.push({
                title,
                content,
                reasoning,
                importance,
                created_at: now,
                metadata
              });
              
              // Record decision in episodes
              inMemoryStore.episodes.push({
                actor: 'system',
                action: 'decision_made',
                content: title,
                timestamp: now,
                importance,
                context: 'decision-tracking'
              });
            } else {
              await db.prepare(`
                INSERT INTO decisions (title, content, reasoning, importance, created_at, metadata)
                VALUES (?, ?, ?, ?, ?, ?)
              `).run(title, content, reasoning, importance, now, metadata ? JSON.stringify(metadata) : null);
              
              // Record decision in episodes
              await db.prepare(`
                INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                VALUES ('system', 'decision_made', ?, ?, ?, 'decision-tracking', NULL)
              `).run(title, now, importance);
            }
            
            log(`Stored decision: "${title}" with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', title, timestamp: now }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.STORE_REQUIREMENT.name: {
            // Store a requirement
            const { title, content, importance = 'medium', metadata = null } = args;
            const now = Date.now();

            if (useInMemory) {
              inMemoryStore.requirements.push({
                title,
                content,
                importance,
                created_at: now,
                metadata
              });
              
              // Record requirement in episodes
              inMemoryStore.episodes.push({
                actor: 'system',
                action: 'requirement_added',
                content: title,
                timestamp: now,
                importance,
                context: 'requirement-tracking'
              });
            } else {
              await db.prepare(`
                INSERT INTO requirements (title, content, importance, created_at, metadata)
                VALUES (?, ?, ?, ?, ?)
              `).run(title, content, importance, now, metadata ? JSON.stringify(metadata) : null);
              
              // Record requirement in episodes
              await db.prepare(`
                INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                VALUES ('system', 'requirement_added', ?, ?, ?, 'requirement-tracking', NULL)
              `).run(title, now, importance);
            }
            
            log(`Stored requirement: "${title}" with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', title, timestamp: now }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.RECORD_EPISODE.name: {
            // Record an episode
            const { actor, action, content, importance = 'low', context = null } = args;
            const now = Date.now();

            if (useInMemory) {
              inMemoryStore.episodes.push({
                actor,
                action,
                content,
                timestamp: now,
                importance,
                context
              });
            } else {
              await db.prepare(`
                INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                VALUES (?, ?, ?, ?, ?, ?, NULL)
              `).run(actor, action, content, now, importance, context);
            }
            
            log(`Recorded episode: ${actor} ${action} with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', actor, action, timestamp: now }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.GET_RECENT_EPISODES.name: {
            // Get recent episodes
            const { limit = 10, context = null } = args || {};
            
            let episodes;
            if (useInMemory) {
              // Filter by context if specified
              let filtered = inMemoryStore.episodes;
              if (context) {
                filtered = filtered.filter(e => e.context === context);
              }
              
              // Sort by timestamp and take limit
              episodes = filtered
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit)
                .map(ep => ({
                  ...ep,
                  timestamp: new Date(ep.timestamp).toISOString()
                }));
            } else {
              let query = `
                SELECT id, actor, action, content, timestamp, importance, context, metadata
                FROM episodes
                ORDER BY timestamp DESC
                LIMIT ?
              `;
              let params = [limit];
              
              if (context) {
                query = `
                  SELECT id, actor, action, content, timestamp, importance, context, metadata
                  FROM episodes
                  WHERE context = ?
                  ORDER BY timestamp DESC
                  LIMIT ?
                `;
                params = [context, limit];
              }
              
              const rows = await db.prepare(query).all(...params);
              episodes = rows.map(ep => ({
                ...ep,
                metadata: ep.metadata ? JSON.parse(ep.metadata) : null,
                timestamp: new Date(ep.timestamp).toISOString()
              }));
            }

            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', episodes }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.GET_COMPREHENSIVE_CONTEXT.name: {
            // Get comprehensive context from all memory subsystems
            try {
              // Check if a query parameter is provided for semantic search
              const { query = null } = args || {};
              const context = await getComprehensiveContext(query);

              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'ok', context }) }],
                isError: false
              };
            } catch (error) {
              log(`Error getting comprehensive context: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'error', error: error.message }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.GET_MEMORY_STATS.name: {
            // Get memory system statistics
            try {
              let stats;
              if (useInMemory) {
                stats = {
                  message_count: inMemoryStore.messages.length,
                  active_file_count: inMemoryStore.activeFiles.length,
                  milestone_count: inMemoryStore.milestones.length,
                  decision_count: inMemoryStore.decisions.length,
                  requirement_count: inMemoryStore.requirements.length,
                  episode_count: inMemoryStore.episodes.length,
                  oldest_memory: inMemoryStore.messages.length > 0 
                    ? new Date(Math.min(...inMemoryStore.messages.map(m => m.created_at))).toISOString()
                    : null,
                  newest_memory: inMemoryStore.messages.length > 0
                    ? new Date(Math.max(...inMemoryStore.messages.map(m => m.created_at))).toISOString()
                    : null
                };
              } else {
                // Count items in each table
                const messageCount = await db.prepare('SELECT COUNT(*) as count FROM messages').get();
                const fileCount = await db.prepare('SELECT COUNT(*) as count FROM active_files').get();
                const milestoneCount = await db.prepare('SELECT COUNT(*) as count FROM milestones').get();
                const decisionCount = await db.prepare('SELECT COUNT(*) as count FROM decisions').get();
                const requirementCount = await db.prepare('SELECT COUNT(*) as count FROM requirements').get();
                const episodeCount = await db.prepare('SELECT COUNT(*) as count FROM episodes').get();
                
                // Get oldest and newest timestamps
                const oldestMessage = await db.prepare('SELECT MIN(created_at) as timestamp FROM messages').get();
                const newestMessage = await db.prepare('SELECT MAX(created_at) as timestamp FROM messages').get();
                
                stats = {
                  message_count: messageCount?.count || 0,
                  active_file_count: fileCount?.count || 0,
                  milestone_count: milestoneCount?.count || 0,
                  decision_count: decisionCount?.count || 0,
                  requirement_count: requirementCount?.count || 0,
                  episode_count: episodeCount?.count || 0,
                  oldest_memory: oldestMessage?.timestamp 
                    ? new Date(oldestMessage.timestamp).toISOString() 
                    : null,
                  newest_memory: newestMessage?.timestamp 
                    ? new Date(newestMessage.timestamp).toISOString() 
                    : null
                };
              }

              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'ok', stats }) }],
                isError: false
              };
            } catch (error) {
              log(`Error getting memory stats: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'error', error: error.message }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.END_CONVERSATION.name: {
            // Handle ending a conversation with multiple operations
            try {
              const { 
                content, 
                milestone_title, 
                milestone_description, 
                importance = 'medium', 
                metadata = null 
              } = args;
              
              const now = Date.now();
              
              // 1. Store assistant message
              let messageId;
              if (useInMemory) {
                inMemoryStore.messages.push({
                  role: 'assistant',
                  content,
                  created_at: now,
                  importance,
                  metadata
                });
                messageId = inMemoryStore.messages.length;
              } else {
                const result = await db.prepare(`
                  INSERT INTO messages (role, content, created_at, importance, metadata)
                  VALUES ('assistant', ?, ?, ?, ?)
                `).run(content, now, importance, metadata ? JSON.stringify(metadata) : null);
                
                messageId = result.lastInsertRowid;
                
                // Generate and store embedding for the assistant message in the background
                setTimeout(async () => {
                  try {
                    // Generate vector embedding for the message
                    const messageVector = await createEmbedding(content);
                    
                    // Store the embedding with link to the message
                    await storeEmbedding(messageId, 'assistant_message', messageVector, {
                      importance,
                      timestamp: now,
                      role: 'assistant'
                    });
                    
                    logDebug(`Generated and stored embedding for assistant message ID ${messageId}`);
                    
                    // Check if the message contains code and process it
                    if (isCodeRelatedQuery(content)) {
                      log(`Detected code-related content in assistant message ID ${messageId}`);
                      
                      // Extract code snippets if present using regex patterns
                      const codeBlocks = extractCodeBlocks(content);
                      if (codeBlocks.length > 0) {
                        log(`Extracted ${codeBlocks.length} code blocks from assistant message`);
                        
                        // Store each code block with its own embedding
                        for (let i = 0; i < codeBlocks.length; i++) {
                          const block = codeBlocks[i];
                          const snippetVector = await createEmbedding(block.content);
                          
                          // Store as a specialized code snippet type
                          await storeEmbedding(messageId, 'assistant_code_snippet', snippetVector, {
                            snippet_index: i,
                            language: block.language || 'unknown',
                            message_id: messageId
                          });
                        }
                      }
                    }
                  } catch (vectorError) {
                    log(`Error generating vector for assistant message: ${vectorError.message}`, "error");
                    // Non-blocking - we continue even if vector generation fails
                  }
                }, 0);
              }
              
              log(`Stored assistant message: "${content.substring(0, 30)}..." with importance: ${importance}`);
              
              // 2. Store milestone
              if (useInMemory) {
                inMemoryStore.milestones.push({
                  title: milestone_title,
                  description: milestone_description,
                  created_at: now,
                  importance,
                  metadata
                });
              } else {
                await db.prepare(`
                  INSERT INTO milestones (title, description, created_at, importance, metadata)
                  VALUES (?, ?, ?, ?, ?)
                `).run(
                  milestone_title, 
                  milestone_description, 
                  now, 
                  importance, 
                  metadata ? JSON.stringify(metadata) : null
                );
              }
              
              log(`Stored milestone: "${milestone_title}" with importance: ${importance}`);
              
              // 3. Record episode
              if (useInMemory) {
                inMemoryStore.episodes.push({
                  actor: 'assistant',
                  action: 'completion',
                  content: `Completed: ${milestone_title}`,
                  timestamp: now,
                  importance,
                  context: 'conversation',
                  metadata
                });
              } else {
                // Use the same format as other tools (recordEpisode, storeMilestone, etc.)
                await db.prepare(`
                  INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                  VALUES ('assistant', 'completion', ?, ?, ?, 'conversation', ?)
                `).run(`Completed: ${milestone_title}`, now, importance, metadata ? JSON.stringify(metadata) : null);
              }
              
              log(`Recorded episode: "Completed: ${milestone_title}" with importance: ${importance}`);
              
              // Return success response with timestamps
              return {
                content: [{ 
                  type: "text", 
                  text: JSON.stringify({ 
                    status: 'ok', 
                    results: {
                      assistantMessage: {
                        stored: true,
                        timestamp: now
                      },
                      milestone: {
                        title: milestone_title,
                        stored: true,
                        timestamp: now
                      },
                      episode: {
                        action: 'completion',
                        stored: true,
                        timestamp: now
                      }
                    }
                  }) 
                }],
                isError: false
              };
            } catch (error) {
              log(`Error in endConversation: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ status: 'error', error: error.message }) }],
                isError: true
              };
            }
          }
          
          case MEMORY_TOOLS.MANAGE_VECTOR.name: {
            // Handle vector management operations
            try {
              const { operation, contentId, contentType, vector, metadata = null, vectorId, limit = 10, threshold = 0.7 } = args;
              
              if (!operation) {
                throw new Error("Operation is required for manageVector tool");
              }
              
              if (useInMemory) {
                throw new Error("Vector operations not supported in in-memory mode");
              }
              
              log(`Vector operation requested: ${operation}`);
              
              switch (operation) {
                case "store": {
                  // Validate parameters
                  if (!contentId || !contentType || !vector) {
                    throw new Error("contentId, contentType, and vector are required for store operation");
                  }
                  
                  // Convert array to Float32Array
                  let vectorArray;
                  if (Array.isArray(vector)) {
                    vectorArray = new Float32Array(vector);
                  } else {
                    throw new Error("Vector must be provided as an array");
                  }
                  
                  // Store the vector
                  const result = await storeEmbedding(contentId, contentType, vectorArray, metadata);
                  log(`Stored vector for ${contentType} with ID ${contentId}`);
                  
                  return {
                    content: [{ type: "text", text: JSON.stringify({ 
                      status: 'ok', 
                      operation: 'store',
                      result: {
                        contentId,
                        contentType,
                        vectorDimensions: vectorArray.length,
                        timestamp: Date.now()
                      }
                    }) }],
                    isError: false
                  };
                }
                
                case "search": {
                  // Validate parameters
                  if (!vector) {
                    throw new Error("Vector is required for search operation");
                  }
                  
                  // Convert array to Float32Array for the query
                  let queryVector;
                  if (Array.isArray(vector)) {
                    queryVector = new Float32Array(vector);
                  } else {
                    throw new Error("Vector must be provided as an array");
                  }
                  
                  // Perform the search
                  const similarVectors = await findSimilarVectors(queryVector, contentType, limit, threshold);
                  log(`Found ${similarVectors.length} similar vectors for ${contentType || 'all content types'}`);
                  
                  return {
                    content: [{ type: "text", text: JSON.stringify({ 
                      status: 'ok', 
                      operation: 'search',
                      results: similarVectors 
                    }) }],
                    isError: false
                  };
                }
                
                case "update": {
                  // Validate parameters
                  if (!vectorId || !vector) {
                    throw new Error("vectorId and vector are required for update operation");
                  }
                  
                  // Convert array to Float32Array
                  let vectorArray;
                  if (Array.isArray(vector)) {
                    vectorArray = new Float32Array(vector);
                  } else {
                    throw new Error("Vector must be provided as an array");
                  }
                  
                  // Check if vector exists
                  const existingVector = await db.prepare(`
                    SELECT id, content_id, content_type FROM vectors WHERE id = ?
                  `).get(vectorId);
                  
                  if (!existingVector) {
                    throw new Error(`Vector with ID ${vectorId} not found`);
                  }
                  
                  // Update the vector
                  const vectorBuffer = vectorToBuffer(vectorArray);
                  const now = Date.now();
                  
                  const result = await db.prepare(`
                    UPDATE vectors 
                    SET vector = ?, metadata = ?, created_at = ?
                    WHERE id = ?
                  `).run(
                    vectorBuffer,
                    metadata ? JSON.stringify(metadata) : null,
                    now,
                    vectorId
                  );
                  
                  log(`Updated vector with ID ${vectorId}`);
                  
                  return {
                    content: [{ type: "text", text: JSON.stringify({ 
                      status: 'ok', 
                      operation: 'update',
                      result: {
                        vectorId,
                        contentId: existingVector.content_id,
                        contentType: existingVector.content_type,
                        vectorDimensions: vectorArray.length,
                        timestamp: now
                      }
                    }) }],
                    isError: false
                  };
                }
                
                case "delete": {
                  // Validate parameters
                  if (!vectorId) {
                    throw new Error("vectorId is required for delete operation");
                  }
                  
                  // Check if vector exists
                  const existingVector = await db.prepare(`
                    SELECT id FROM vectors WHERE id = ?
                  `).get(vectorId);
                  
                  if (!existingVector) {
                    throw new Error(`Vector with ID ${vectorId} not found`);
                  }
                  
                  // Delete the vector
                  const result = await db.prepare(`
                    DELETE FROM vectors WHERE id = ?
                  `).run(vectorId);
                  
                  log(`Deleted vector with ID ${vectorId}`);
                  
                  return {
                    content: [{ type: "text", text: JSON.stringify({ 
                      status: 'ok', 
                      operation: 'delete',
                      result: {
                        vectorId,
                        deleted: true,
                        timestamp: Date.now()
                      }
                    }) }],
                    isError: false
                  };
                }
                
                default:
                  throw new Error(`Unknown operation: ${operation}. Supported operations are: store, search, update, delete`);
              }
            } catch (error) {
              log(`Error in manageVector tool: ${error.message}`, "error");
              return {
                content: [{ type: "text", text: JSON.stringify({ 
                  status: 'error', 
                  error: error.message 
                }) }],
                isError: true
              };
            }
          }
          
          default:
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'error', error: `Unknown tool: ${name}` }) }],
              isError: true
            };
        }
      } catch (error) {
        log(`Error executing tool: ${error.message}`, "error");
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              status: 'error',
              error: error instanceof Error ? error.message : String(error)
            })
          }],
          isError: true
        };
      }
    });

    // Create and connect to transport
    log('Creating StdioServerTransport...');
    const transport = new StdioServerTransport();
    
    log('Connecting server to transport...');
    serverInstance = await server.connect(transport);
    
    log('Memory System MCP server started and connected to transport');
    
    // Register signals for graceful termination
    process.on('SIGINT', () => {
      log('Received SIGINT signal, shutting down...');
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      log('Received SIGTERM signal, shutting down...');
      if (serverInstance) {
        serverInstance.close();
      }
      process.exit(0);
    });
    
  } catch (error) {
    log(`Failed to initialize server: ${error.message}`, "error");
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  log(`FATAL ERROR: ${error.message}`, "error");
  log(`Stack trace: ${error.stack}`, "error");
  
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (closeError) {
      log(`Error during server close: ${closeError.message}`, "error");
    }
  }
  
  process.exit(1);
});

// Start the server
main().catch(error => {
  log(`Fatal error during startup: ${error.message}`, "error");
  process.exit(1);
});

/**
 * Index a code file by extracting metadata, identifying language, and generating embeddings
 * This function handles the code indexing process triggered by file tracking
 * 
 * @param {string} filePath - Path to the file to index
 * @param {string} action - Action performed on the file (open, edit, close, etc.)
 * @returns {Promise<boolean>} Success status
 */
async function indexCodeFile(filePath, action) {
  try {
    // Skip if database is not available or if this is a close action
    if (!db || action === 'close') {
      return false;
    }
    
    log(`Starting code indexing for file: ${filePath}`);
    
    // Read the file to index
    let fileContent;
    try {
      fileContent = fs.readFileSync(filePath, 'utf8');
      if (!fileContent) {
        throw new Error("File is empty or could not be read");
      }
    } catch (readError) {
      log(`Could not read file for indexing: ${readError.message}`, "error");
      return false;
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    // Detect language based on file extension
    const extension = path.extname(filePath).toLowerCase();
    let language = 'text'; // Default to plain text
    
    // Simple language detection by extension
    const languageMap = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.rb': 'ruby',
      '.java': 'java',
      '.c': 'c',
      '.cpp': 'cpp',
      '.h': 'c',
      '.hpp': 'cpp',
      '.cs': 'csharp',
      '.go': 'go',
      '.rs': 'rust',
      '.php': 'php',
      '.html': 'html',
      '.css': 'css',
      '.json': 'json',
      '.md': 'markdown',
      '.sh': 'shell',
      '.sql': 'sql'
    };
    
    if (languageMap[extension]) {
      language = languageMap[extension];
    }
    
    // Create or update entry in code_files table
    let fileId;
    try {
      // Check if file already exists in database
      const existingFile = await db.prepare(`
        SELECT id FROM code_files WHERE file_path = ?
      `).get(filePath);
      
      if (existingFile) {
        // Update existing record
        await db.prepare(`
          UPDATE code_files
          SET language = ?, last_indexed = ?, size = ?
          WHERE id = ?
        `).run(language, Date.now(), fileSize, existingFile.id);
        fileId = existingFile.id;
        log(`Updated indexed file: ${filePath}`);
      } else {
        // Insert new record
        const result = await db.prepare(`
          INSERT INTO code_files (file_path, language, last_indexed, size)
          VALUES (?, ?, ?, ?)
        `).run(filePath, language, Date.now(), fileSize);
        fileId = result.lastInsertRowid;
        log(`Added new indexed file: ${filePath}`);
      }
      
      // Generate embedding for file content
      // Only use a sample of the file content if it's very large
      const contentToEmbed = fileContent.length > 10000 
        ? fileContent.substring(0, 5000) + "\n...\n" + fileContent.substring(fileContent.length - 5000) 
        : fileContent;
      
      const fileVector = await createEmbedding(contentToEmbed);
      
      // Store the embedding
      await storeEmbedding(fileId, 'code_file', fileVector, {
        language,
        size: fileSize,
        path: filePath
      });
      
      // Extract code snippets if it's a recognized code file
      if (language !== 'text' && language !== 'markdown') {
        await extractCodeSnippets(filePath, fileContent, fileId, language);
      }
      
      return true;
    } catch (dbError) {
      log(`Database error during file indexing: ${dbError.message}`, "error");
      return false;
    }
  } catch (error) {
    log(`Failed to index code file: ${error.message}`, "error");
    return false;
  }
}

/**
 * Extract and store code snippets from a file
 * Performs simple code structure analysis to identify functions, classes, etc.
 * 
 * @param {string} filePath - Path to the file
 * @param {string} content - File content
 * @param {number} fileId - ID of the file in code_files table
 * @param {string} language - Programming language
 * @returns {Promise<boolean>} Success status
 */
async function extractCodeSnippets(filePath, content, fileId, language) {
  try {
    log(`Extracting code snippets from ${filePath}`);
    
    // First, clear existing snippets for this file
    await db.prepare(`
      DELETE FROM code_snippets WHERE file_id = ?
    `).run(fileId);
    
    // Split content into lines
    const lines = content.split('\n');
    
    // Simple regex patterns for common code structures
    // This is a very basic implementation - a real system would use proper parsers
    const patterns = {
      // Function detection varies by language
      function: {
        javascript: /^\s*(async\s+)?function\s+(\w+)\s*\(/,
        typescript: /^\s*(async\s+)?function\s+(\w+)\s*\(/,
        python: /^\s*def\s+(\w+)\s*\(/,
        java: /^\s*(public|private|protected)?\s*(static)?\s*\w+\s+(\w+)\s*\(/,
        ruby: /^\s*def\s+(\w+)/,
        go: /^\s*func\s+(\w+)/,
        rust: /^\s*fn\s+(\w+)/
      },
      // Class detection
      class: {
        javascript: /^\s*class\s+(\w+)/,
        typescript: /^\s*class\s+(\w+)/,
        python: /^\s*class\s+(\w+)/,
        java: /^\s*(public|private|protected)?\s*class\s+(\w+)/,
        ruby: /^\s*class\s+(\w+)/,
        rust: /^\s*struct\s+(\w+)|impl\s+(\w+)/
      },
      // Variable declaration - very basic detection
      variable: {
        javascript: /^\s*(const|let|var)\s+(\w+)\s*=/,
        typescript: /^\s*(const|let|var)\s+(\w+)\s*:/,
        python: /^\s*(\w+)\s*=/,
        java: /^\s*(private|public|protected)?\s*\w+\s+(\w+)\s*=/
      }
    };
    
    // Use appropriate patterns based on language, fallback to javascript patterns
    const langPatterns = {
      function: patterns.function[language] || patterns.function.javascript,
      class: patterns.class[language] || patterns.class.javascript,
      variable: patterns.variable[language] || patterns.variable.javascript
    };
    
    // Track found snippets
    const snippets = [];
    
    // Scan through lines to identify code structures
    let currentSymbol = null;
    let currentStart = 0;
    let currentType = null;
    let currentContent = '';
    let braceCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for function, class, or variable declarations
      if (!currentSymbol) {
        for (const [type, pattern] of Object.entries(langPatterns)) {
          const match = line.match(pattern);
          if (match) {
            currentSymbol = match[match.length - 1];
            currentStart = i;
            currentType = type;
            currentContent = line;
            if (line.includes('{')) braceCount = 1;
            break;
          }
        }
      } else {
        // Inside a code block
        currentContent += '\n' + line;
        
        // Count braces to determine block end
        if (line.includes('{')) braceCount++;
        if (line.includes('}')) braceCount--;
        
        // Check if we've reached the end of the code block
        const isBlockEnd = 
          (braceCount === 0 && line.includes('}')) || // For brace languages
          (language === 'python' && line.match(/^\S/)); // For Python (indentation)
        
        if (isBlockEnd || i === lines.length - 1) {
          // Store the found snippet
          snippets.push({
            symbol: currentSymbol,
            type: currentType,
            start: currentStart,
            end: i,
            content: currentContent
          });
          
          // Reset for next block
          currentSymbol = null;
          currentStart = 0;
          currentType = null;
          currentContent = '';
          braceCount = 0;
        }
      }
    }
    
    // Store extracted snippets in database
    for (const snippet of snippets) {
      // Generate embedding for the snippet
      const snippetVector = await createEmbedding(snippet.content);
      
      // Insert snippet
      const result = await db.prepare(`
        INSERT INTO code_snippets (file_id, start_line, end_line, content, symbol_type, metadata)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        fileId,
        snippet.start,
        snippet.end,
        snippet.content,
        snippet.type,
        JSON.stringify({ symbol: snippet.symbol })
      );
      
      // Store embedding for the snippet
      await storeEmbedding(result.lastInsertRowid, 'code_snippet', snippetVector, {
        file_id: fileId,
        symbol: snippet.symbol,
        type: snippet.type
      });
    }
    
    log(`Extracted ${snippets.length} code snippets from ${filePath}`);
    return true;
  } catch (error) {
    log(`Error extracting code snippets: ${error.message}`, "error");
    return false;
  }
} 

// Define a simple background task queue to manage indexing operations
const backgroundTasks = {
  queue: [],
  isProcessing: false,
  
  /**
   * Add a task to the background queue
   * @param {Function} task - Function to execute
   * @param {...any} params - Parameters to pass to the function
   */
  addTask(task, ...params) {
    this.queue.push({ task, params });
    log(`Added task to background queue. Queue length: ${this.queue.length}`);
    
    // Start processing if not already running
    if (!this.isProcessing) {
      this.processQueue();
    }
  },
  
  /**
   * Process tasks in the queue one by one
   */
  async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return;
    
    this.isProcessing = true;
    log(`Starting background queue processing. Tasks: ${this.queue.length}`);
    
    try {
      const { task, params } = this.queue.shift();
      if (typeof task === 'function') {
        if (params.length === 0) {
          await task();
        } else if (params.length === 1) {
          await task(params[0]);
        } else {
          await task(...params);
        }
      } else {
        log(`Invalid task in background queue: ${typeof task}`, "error");
      }
    } catch (error) {
      log(`Error in background task: ${error.message}`, "error");
    } finally {
      this.isProcessing = false;
      
      // Continue processing if more tasks remain
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100); // Small delay between tasks
      }
    }
  }
};

/**
 * Detect if a query is code-related based on patterns and keywords
 * @param {string} query - The user's query text
 * @returns {boolean} Whether the query is likely code-related
 */
function isCodeRelatedQuery(query) {
  if (!query) return false;
  
  // Convert to lowercase for case-insensitive matching
  const text = query.toLowerCase();
  
  // Common code-related terms
  const codeTerms = [
    'code', 'function', 'class', 'method', 'variable', 'object',
    'array', 'string', 'number', 'boolean', 'interface', 'type',
    'implement', 'extend', 'import', 'export', 'module', 'package',
    'library', 'framework', 'api', 'component', 'property', 'attribute',
    'syntax', 'compiler', 'interpreter', 'runtime', 'debug', 'error',
    'exception', 'bug', 'fix', 'issue', 'pull request', 'commit',
    'branch', 'merge', 'git', 'repository', 'algorithm', 'data structure'
  ];
  
  // Programming language names
  const languages = [
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'ruby',
    'go', 'rust', 'php', 'swift', 'kotlin', 'scala', 'perl', 'r',
    'bash', 'shell', 'sql', 'html', 'css', 'jsx', 'tsx'
  ];
  
  // Check for presence of code terms or language names
  for (const term of [...codeTerms, ...languages]) {
    if (text.includes(term)) return true;
  }
  
  // Check for code patterns
  const codePatterns = [
    /\b(function|def|class|import|export|from|const|let|var)\b/i,
    /\b(if|else|for|while|switch|case|try|catch|async|await)\b/i,
    /\b(return|yield|throw|break|continue)\b/i,
    /[\[\]{}()<>]/g,  // Code symbols like brackets
    /\w+\.\w+\(/,     // Method calls like object.method()
    /\w+\([^)]*\)/,   // Function calls like func()
    /\s(===|!==|==|!=|>=|<=|&&|\|\|)\s/, // Comparison operators
    /`[^`]*`/,        // Template literals
    /\/\/|\/\*|\*\//  // Comments
  ];
  
  for (const pattern of codePatterns) {
    if (pattern.test(text)) return true;
  }
  
  return false;
}

/**
 * Trigger background indexing of recently active files that haven't been indexed yet
 * @param {string} query - The user query to determine which files might be relevant
 */
async function triggerCodeIndexing(query) {
  try {
    if (!db || useInMemory) return;
    
    // Get recently active files
    const activeFiles = await db.prepare(`
      SELECT filename, last_accessed 
      FROM active_files 
      ORDER BY last_accessed DESC 
      LIMIT 10
    `).all();
    
    if (!activeFiles || activeFiles.length === 0) {
      log('No active files found for background indexing');
      return;
    }
    
    // Check which files need indexing (not in code_files table or outdated)
    const filesToIndex = [];
    
    for (const file of activeFiles) {
      // Skip non-code files
      const ext = path.extname(file.filename).toLowerCase();
      if (!ext || ext === '.md' || ext === '.txt' || ext === '.json') continue;
      
      try {
        // Check if file exists in the code_files table
        const indexedFile = await db.prepare(`
          SELECT id, last_indexed, file_path 
          FROM code_files 
          WHERE file_path = ?
        `).get(file.filename);
        
        // Get file stats to check if file has been modified since last indexed
        try {
          const stats = fs.statSync(file.filename);
          const lastModified = stats.mtimeMs;
          
          // Add to indexing queue if file is not indexed or outdated
          if (!indexedFile || (indexedFile.last_indexed < lastModified)) {
            filesToIndex.push({
              filename: file.filename,
              action: 'update'
            });
          }
        } catch (fsError) {
          log(`Error checking file stats for ${file.filename}: ${fsError.message}`, 'error');
          // Skip this file
        }
      } catch (dbError) {
        log(`Error checking indexed status for ${file.filename}: ${dbError.message}`, 'error');
        // Skip this file
      }
    }
    
    if (filesToIndex.length > 0) {
      log(`Queuing ${filesToIndex.length} files for background indexing`);
      
      // Add indexing tasks to the background queue
      for (const file of filesToIndex) {
        backgroundTasks.addTask(indexCodeFile, file.filename, file.action);
      }
    } else {
      log('No files need indexing at this time');
    }
  } catch (error) {
    log(`Error in triggerCodeIndexing: ${error.message}`, 'error');
  }
}

/**
 * Extract code blocks from markdown-style text
 * @param {string} text - Text that may contain code blocks
 * @returns {Array} Array of extracted code blocks with language info
 */
function extractCodeBlocks(text) {
  if (!text) return [];
  
  const codeBlockRegex = /```([a-z]*)\n([\s\S]*?)```/g;
  const blocks = [];
  let match;
  
  while ((match = codeBlockRegex.exec(text)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      content: match[2].trim()
    });
  }
  
  // Also look for code patterns in regular text if no code blocks found
  if (blocks.length === 0 && isCodeRelatedQuery(text)) {
    // Split by lines and look for coherent code segments
    const lines = text.split('\n');
    let codeSegment = '';
    let inCode = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Simple heuristic: indented lines or lines with code-like symbols are likely code
      const isCodeLine = /^\s{2,}|[{}\[\]();]|function\s+\w+\s*\(|if\s*\(|for\s*\(/.test(line);
      
      if (isCodeLine) {
        if (!inCode) {
          inCode = true;
          codeSegment = line;
        } else {
          codeSegment += '\n' + line;
        }
      } else if (inCode && line === '') {
        // Empty line, might be within code block
        codeSegment += '\n';
      } else if (inCode) {
        // End of code segment
        if (codeSegment.length > 0) {
          blocks.push({
            language: 'text',
            content: codeSegment.trim()
          });
        }
        inCode = false;
        codeSegment = '';
      }
    }
    
    // Add final code segment if we ended while still in code
    if (inCode && codeSegment.length > 0) {
      blocks.push({
        language: 'text',
        content: codeSegment.trim()
      });
    }
  }
  
  return blocks;
}

/**
 * Performs maintenance of vector indexes and database optimization
 * Handles: rebuilding indexes, cleaning orphaned vectors, and optimizing storage
 * Designed to run periodically or during system idle time
 * 
 * @param {Object} options - Maintenance options
 * @param {boolean} options.forceRebuild - Force rebuild of indexes even if not needed
 * @param {boolean} options.cleanOrphans - Remove vectors without corresponding content
 * @param {boolean} options.optimizeStorage - Merge similar vectors to reduce storage
 * @returns {Promise<Object>} Maintenance results
 */
async function performVectorMaintenance(options = {}) {
  const defaults = {
    forceRebuild: false,
    cleanOrphans: true,
    optimizeStorage: true
  };
  
  const opts = { ...defaults, ...options };
  const results = {
    indexesRebuilt: false,
    orphansRemoved: 0,
    vectorsOptimized: 0,
    errors: []
  };
  
  log('Starting vector maintenance tasks');
  
  try {
    if (!db || useInMemory) {
      throw new Error('Database not available or using in-memory storage');
    }
    
    // 1. Check and rebuild vector indexes if needed
    if (opts.forceRebuild) {
      log('Force rebuilding vector indexes');
      try {
        // Drop existing vector index
        await db.prepare('DROP INDEX IF EXISTS idx_vectors_vector').run();
        log('Dropped existing vector index');
        
        // Recreate vector indexes
        await createVectorIndexes();
        results.indexesRebuilt = true;
        log('Vector indexes rebuilt successfully');
      } catch (rebuildError) {
        const errMsg = `Error rebuilding vector indexes: ${rebuildError.message}`;
        log(errMsg, 'error');
        results.errors.push(errMsg);
      }
    }
    
    // 2. Clean up orphaned vectors whose source content has been deleted
    if (opts.cleanOrphans) {
      log('Cleaning up orphaned vectors');
      try {
        // Find vectors referencing non-existent messages
        let deletedCount = 0;
        const orphanedMessageVectors = await db.prepare(`
          SELECT v.id, v.content_id, v.content_type 
          FROM vectors v
          LEFT JOIN messages m ON v.content_id = m.id AND v.content_type IN ('user_message', 'assistant_message', 'assistant_code_snippet')
          WHERE v.content_type IN ('user_message', 'assistant_message', 'assistant_code_snippet')
          AND m.id IS NULL
        `).all();
        
        if (orphanedMessageVectors.length > 0) {
          log(`Found ${orphanedMessageVectors.length} orphaned message vectors`);
          for (const vector of orphanedMessageVectors) {
            await db.prepare('DELETE FROM vectors WHERE id = ?').run(vector.id);
            deletedCount++;
          }
        }
        
        // Find vectors referencing non-existent code files
        const orphanedFileVectors = await db.prepare(`
          SELECT v.id, v.content_id, v.content_type 
          FROM vectors v
          LEFT JOIN code_files f ON v.content_id = f.id AND v.content_type = 'code_file'
          WHERE v.content_type = 'code_file'
          AND f.id IS NULL
        `).all();
        
        if (orphanedFileVectors.length > 0) {
          log(`Found ${orphanedFileVectors.length} orphaned code file vectors`);
          for (const vector of orphanedFileVectors) {
            await db.prepare('DELETE FROM vectors WHERE id = ?').run(vector.id);
            deletedCount++;
          }
        }
        
        // Find vectors referencing non-existent code snippets
        const orphanedSnippetVectors = await db.prepare(`
          SELECT v.id, v.content_id, v.content_type 
          FROM vectors v
          LEFT JOIN code_snippets s ON v.content_id = s.id AND v.content_type = 'code_snippet'
          WHERE v.content_type = 'code_snippet'
          AND s.id IS NULL
        `).all();
        
        if (orphanedSnippetVectors.length > 0) {
          log(`Found ${orphanedSnippetVectors.length} orphaned code snippet vectors`);
          for (const vector of orphanedSnippetVectors) {
            await db.prepare('DELETE FROM vectors WHERE id = ?').run(vector.id);
            deletedCount++;
          }
        }
        
        results.orphansRemoved = deletedCount;
        log(`Removed ${deletedCount} orphaned vectors`);
      } catch (cleanupError) {
        const errMsg = `Error cleaning up orphaned vectors: ${cleanupError.message}`;
        log(errMsg, 'error');
        results.errors.push(errMsg);
      }
    }
    
    // 3. Optimize vector storage by merging highly similar vectors for the same content
    if (opts.optimizeStorage) {
      log('Optimizing vector storage');
      try {
        // Find duplicate vectors for the same content (by content_id and content_type)
        // Keep the most recent one and remove others
        const duplicates = await db.prepare(`
          SELECT content_id, content_type, COUNT(*) as count
          FROM vectors
          GROUP BY content_id, content_type
          HAVING COUNT(*) > 1
        `).all();
        
        let optimizedCount = 0;
        
        for (const dup of duplicates) {
          // Get all vectors for this content, ordered by creation time (newest first)
          const vectors = await db.prepare(`
            SELECT id, created_at
            FROM vectors
            WHERE content_id = ? AND content_type = ?
            ORDER BY created_at DESC
          `).all(dup.content_id, dup.content_type);
          
          // Keep the newest one, delete the rest
          for (let i = 1; i < vectors.length; i++) {
            await db.prepare('DELETE FROM vectors WHERE id = ?').run(vectors[i].id);
            optimizedCount++;
          }
        }
        
        results.vectorsOptimized = optimizedCount;
        log(`Optimized storage by removing ${optimizedCount} redundant vectors`);
      } catch (optimizeError) {
        const errMsg = `Error optimizing vector storage: ${optimizeError.message}`;
        log(errMsg, 'error');
        results.errors.push(errMsg);
      }
    }
    
    log('Vector maintenance tasks completed');
    return results;
  } catch (error) {
    const errMsg = `Vector maintenance failed: ${error.message}`;
    log(errMsg, 'error');
    results.errors.push(errMsg);
    return results;
  }
}

/**
 * Schedule periodic vector maintenance to run at regular intervals
 * @param {number} intervalMinutes - Interval in minutes between maintenance runs
 */
function scheduleVectorMaintenance(intervalMinutes = 60) {
  // Don't schedule if we're in in-memory mode
  if (useInMemory) {
    log('Not scheduling vector maintenance for in-memory mode');
    return;
  }
  
  log(`Scheduling vector maintenance to run every ${intervalMinutes} minutes`);
  
  // Set up recurring maintenance
  const interval = intervalMinutes * 60 * 1000; // Convert to milliseconds
  
  setInterval(async () => {
    log('Running scheduled vector maintenance');
    try {
      // Add to background tasks queue to avoid blocking
      backgroundTasks.addTask(async () => {
        await performVectorMaintenance();
      });
    } catch (error) {
      log(`Error scheduling vector maintenance: ${error.message}`, 'error');
    }
  }, interval);
  
  // Also run once at startup after a delay to allow system to initialize
  setTimeout(() => {
    log('Running initial vector maintenance');
    backgroundTasks.addTask(async () => {
      await performVectorMaintenance();
    });
  }, 30000); // 30 seconds after startup
}

// Schedule vector maintenance when the system starts
scheduleVectorMaintenance();