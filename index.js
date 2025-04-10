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
      properties: {}
    }
  },
  GET_MEMORY_STATS: {
    name: "getMemoryStats",
    description: "Retrieves statistics about the memory system",
    inputSchema: {
      type: "object",
      properties: {}
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
      context TEXT
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
        async function getComprehensiveContext() {
          const context = {
            shortTerm: {},
            longTerm: {},
            episodic: {},
            system: { healthy: true, timestamp: new Date().toISOString() }
          };
          
          if (useInMemory) {
            // Get short-term context
            context.shortTerm = {
              recentMessages: inMemoryStore.messages
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 5)
                .map(msg => ({
                  ...msg,
                  created_at: new Date(msg.created_at).toISOString()
                })),
              activeFiles: inMemoryStore.activeFiles
                .sort((a, b) => b.last_accessed - a.last_accessed)
                .slice(0, 5)
                .map(file => ({
                  ...file,
                  last_accessed: new Date(file.last_accessed).toISOString()
                }))
            };
            
            // Get long-term context
            context.longTerm = {
              milestones: inMemoryStore.milestones
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 3)
                .map(m => ({
                  ...m,
                  created_at: new Date(m.created_at).toISOString()
                })),
              decisions: inMemoryStore.decisions
                .filter(d => ['high', 'medium'].includes(d.importance))
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 3)
                .map(d => ({
                  ...d,
                  created_at: new Date(d.created_at).toISOString()
                })),
              requirements: inMemoryStore.requirements
                .filter(r => ['high', 'medium'].includes(r.importance))
                .sort((a, b) => b.created_at - a.created_at)
                .slice(0, 3)
                .map(r => ({
                  ...r,
                  created_at: new Date(r.created_at).toISOString()
                }))
            };
            
            // Get episodic context
            context.episodic = {
              recentEpisodes: inMemoryStore.episodes
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, 5)
                .map(ep => ({
                  ...ep,
                  timestamp: new Date(ep.timestamp).toISOString()
                }))
            };
          } else {
            // Get short-term context
            const messages = await db.prepare(`
              SELECT role, content, created_at
              FROM messages
              ORDER BY created_at DESC
              LIMIT 5
            `).all();
            
            const files = await db.prepare(`
              SELECT filename, last_accessed
              FROM active_files
              ORDER BY last_accessed DESC
              LIMIT 5
            `).all();
            
            context.shortTerm = {
              recentMessages: messages.map(msg => ({
                ...msg,
                created_at: new Date(msg.created_at).toISOString()
              })),
              activeFiles: files.map(file => ({
                ...file,
                last_accessed: new Date(file.last_accessed).toISOString()
              }))
            };
            
            // Get long-term context
            const milestones = await db.prepare(`
              SELECT title, description, importance
              FROM milestones
              ORDER BY created_at DESC
              LIMIT 3
            `).all();
            
            const decisions = await db.prepare(`
              SELECT title, content, reasoning
              FROM decisions
              WHERE importance IN ('high', 'medium')
              ORDER BY created_at DESC
              LIMIT 3
            `).all();
            
            const requirements = await db.prepare(`
              SELECT title, content
              FROM requirements
              WHERE importance IN ('high', 'medium')
              ORDER BY created_at DESC
              LIMIT 3
            `).all();
            
            context.longTerm = {
              milestones,
              decisions,
              requirements
            };
            
            // Get episodic context
            const episodes = await db.prepare(`
              SELECT actor, action, content, timestamp
              FROM episodes
              ORDER BY timestamp DESC
              LIMIT 5
            `).all();
            
            context.episodic = {
              recentEpisodes: episodes.map(ep => ({
                ...ep,
                timestamp: new Date(ep.timestamp).toISOString()
              }))
            };
          }
          
          return context;
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
              
              // Retrieve context
              const contextResult = await getComprehensiveContext();
              
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

            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', timestamp: now }) }],
              isError: false
            };
          }
          
          case MEMORY_TOOLS.STORE_ASSISTANT_MESSAGE.name: {
            // Store assistant message
            const { content, importance = 'low', metadata = null } = args;
            const now = Date.now();

            if (useInMemory) {
              inMemoryStore.messages.push({
                role: 'assistant',
                content,
                created_at: now,
                importance,
                metadata
              });
            } else {
              await db.prepare(`
                INSERT INTO messages (role, content, created_at, importance, metadata)
                VALUES ('assistant', ?, ?, ?, ?)
              `).run(content, now, importance, metadata ? JSON.stringify(metadata) : null);
            }
            
            log(`Stored assistant message: "${content.substring(0, 30)}..." with importance: ${importance}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', timestamp: now }) }],
              isError: false
            };
          }

          case MEMORY_TOOLS.TRACK_ACTIVE_FILE.name: {
            // Track an active file
            const { filename, action, metadata = null } = args;
            const now = Date.now();
            
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
                INSERT INTO episodes (actor, action, content, timestamp, importance, context)
                VALUES ('user', ?, ?, ?, 'low', 'file-tracking')
              `).run(action, filename, now);
            }
            
            log(`Tracked file: ${filename} with action: ${action}`);
            
            return {
              content: [{ type: "text", text: JSON.stringify({ status: 'ok', filename, action, timestamp: now }) }],
              isError: false
            };
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
                INSERT INTO episodes (actor, action, content, timestamp, importance, context)
                VALUES ('system', 'milestone_created', ?, ?, ?, 'milestone-tracking')
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
                INSERT INTO episodes (actor, action, content, timestamp, importance, context)
                VALUES ('system', 'decision_made', ?, ?, ?, 'decision-tracking')
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
                INSERT INTO episodes (actor, action, content, timestamp, importance, context)
                VALUES ('system', 'requirement_added', ?, ?, ?, 'requirement-tracking')
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
                INSERT INTO episodes (actor, action, content, timestamp, importance, context)
                VALUES (?, ?, ?, ?, ?, ?)
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
                SELECT id, actor, action, content, timestamp, importance, context
                FROM episodes
                ORDER BY timestamp DESC
                LIMIT ?
              `;
              let params = [limit];
              
              if (context) {
                query = `
                  SELECT id, actor, action, content, timestamp, importance, context
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
              const context = await getComprehensiveContext();

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
              if (useInMemory) {
                inMemoryStore.messages.push({
                  role: 'assistant',
                  content,
                  created_at: now,
                  importance,
                  metadata
                });
              } else {
                await db.prepare(`
                  INSERT INTO messages (role, content, created_at, importance, metadata)
                  VALUES ('assistant', ?, ?, ?, ?)
                `).run(content, now, importance, metadata ? JSON.stringify(metadata) : null);
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
                await db.prepare(`
                  INSERT INTO episodes (actor, action, content, timestamp, importance, context, metadata)
                  VALUES (?, ?, ?, ?, ?, ?, ?)
                `).run(
                  'assistant', 
                  'completion', 
                  `Completed: ${milestone_title}`, 
                  now, 
                  importance, 
                  'conversation', 
                  metadata ? JSON.stringify(metadata) : null
                );
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