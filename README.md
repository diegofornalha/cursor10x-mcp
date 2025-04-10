# Cursor10x Memory System

A comprehensive memory system for Cursor using the Model Context Protocol (MCP) to provide persistent contextual awareness across conversations.

## Overview

The Cursor10x Memory System creates a persistent memory layer for AI assistants (specifically Claude), enabling them to retain and recall:

- Recent messages and conversation history
- Active files currently being worked on
- Important project milestones and decisions
- Technical requirements and specifications
- Chronological sequences of actions and events (episodes)

This memory system bridges the gap between stateless AI interactions and continuous development workflows, allowing for more productive and contextually aware assistance.

## System Architecture

The memory system is built on three core components:

1. **MCP Server**: Implements the Model Context Protocol to register tools and process requests
2. **Memory Database**: Uses Turso database for persistent storage across sessions
3. **Memory Subsystems**: Organizes memory into specialized systems with distinct purposes

### Memory Types

The system implements three complementary memory types:

1. **Short-Term Memory (STM)**
   - Stores recent messages and active files
   - Provides immediate context for current interactions
   - Automatically prioritizes by recency and importance

2. **Long-Term Memory (LTM)**
   - Stores permanent project information like milestones and decisions
   - Maintains architectural and design context
   - Preserves high-importance information indefinitely

3. **Episodic Memory**
   - Records chronological sequences of events
   - Maintains causal relationships between actions
   - Provides temporal context for project history

## Features

- **Persistent Context**: Maintains conversation and project context across multiple sessions
- **Importance-Based Storage**: Prioritizes information based on configurable importance levels
- **Multi-Dimensional Memory**: Combines short-term, long-term, and episodic memory systems
- **Comprehensive Retrieval**: Provides unified context from all memory subsystems
- **Health Monitoring**: Includes built-in diagnostics and status reporting
- **Banner Generation**: Creates informative context banners for conversation starts
- **Database Persistence**: Stores all memory data in Turso database with automatic schema creation

## Tool Documentation

### System Tools

#### `mcp_cursor10x_generateBanner`

Generates a banner with memory system statistics and status information.

**Parameters:**
- None required

**Returns:**
- Object with memory system status and statistics

**Example:**
```javascript
// Generate a memory system banner
const banner = await mcp_cursor10x_generateBanner({});
// Result: {
//   "status": "ok",
//   "memory_system": "active",
//   "mode": "turso",
//   "message_count": 42,
//   "active_files_count": 3,
//   "last_accessed": "4/15/2023, 2:30:45 PM"
// }
```

#### `mcp_cursor10x_checkHealth`

Checks the health of the memory system and its database connection.

**Parameters:**
- None required

**Returns:**
- Object with health status and diagnostics

**Example:**
```javascript
// Check memory system health
const health = await mcp_cursor10x_checkHealth({});
// Result: {
//   "status": "ok",
//   "mode": "turso",
//   "message_count": 42,
//   "active_files_count": 3,
//   "current_directory": "/users/project",
//   "timestamp": "2023-04-15T14:30:45.123Z"
// }
```

#### `mcp_cursor10x_getMemoryStats`

Retrieves detailed statistics about the memory system.

**Parameters:**
- None required

**Returns:**
- Object with comprehensive memory statistics

**Example:**
```javascript
// Get memory statistics
const stats = await mcp_cursor10x_getMemoryStats({});
// Result: {
//   "status": "ok",
//   "stats": {
//     "message_count": 42,
//     "active_file_count": 3,
//     "milestone_count": 7,
//     "decision_count": 12,
//     "requirement_count": 15,
//     "episode_count": 87,
//     "oldest_memory": "2023-03-10T09:15:30.284Z",
//     "newest_memory": "2023-04-15T14:30:45.123Z"
//   }
// }
```

#### `mcp_cursor10x_getComprehensiveContext`

Retrieves a unified context from all memory subsystems, combining short-term, long-term, and episodic memory.

**Parameters:**
- None required

**Returns:**
- Object with consolidated context from all memory systems

**Example:**
```javascript
// Get comprehensive context
const context = await mcp_cursor10x_getComprehensiveContext({});
// Result: {
//   "status": "ok",
//   "context": {
//     "shortTerm": {
//       "recentMessages": [...],
//       "activeFiles": [...]
//     },
//     "longTerm": {
//       "milestones": [...],
//       "decisions": [...],
//       "requirements": [...]
//     },
//     "episodic": {
//       "recentEpisodes": [...]
//     },
//     "system": {
//       "healthy": true,
//       "timestamp": "2023-04-15T14:30:45.123Z"
//     }
//   }
// }
```

### Short-Term Memory Tools

#### `mcp_cursor10x_storeUserMessage`

Stores a user message in the short-term memory system.

**Parameters:**
- `content` (string, required): Content of the message
- `importance` (string, optional): Importance level ("low", "medium", "high", "critical"), defaults to "low"
- `metadata` (object, optional): Additional metadata for the message

**Returns:**
- Object with status and timestamp

**Example:**
```javascript
// Store a user message
const result = await mcp_cursor10x_storeUserMessage({
  content: "We need to implement authentication for our API",
  importance: "high",
  metadata: {
    topic: "authentication",
    priority: 1
  }
});
// Result: {
//   "status": "ok",
//   "timestamp": 1681567845123
// }
```

#### `mcp_cursor10x_storeAssistantMessage`

Stores an assistant message in the short-term memory system.

**Parameters:**
- `content` (string, required): Content of the message
- `importance` (string, optional): Importance level ("low", "medium", "high", "critical"), defaults to "low"
- `metadata` (object, optional): Additional metadata for the message

**Returns:**
- Object with status and timestamp

**Example:**
```javascript
// Store an assistant message
const result = await mcp_cursor10x_storeAssistantMessage({
  content: "I recommend implementing JWT authentication with refresh tokens",
  importance: "medium",
  metadata: {
    topic: "authentication",
    contains_recommendation: true
  }
});
// Result: {
//   "status": "ok",
//   "timestamp": 1681567870456
// }
```

#### `mcp_cursor10x_trackActiveFile`

Tracks an active file being accessed or modified by the user.

**Parameters:**
- `filename` (string, required): Path to the file being tracked
- `action` (string, required): Action performed on the file (open, edit, close, etc.)
- `metadata` (object, optional): Additional metadata for the tracking event

**Returns:**
- Object with status, filename, action and timestamp

**Example:**
```javascript
// Track an active file
const result = await mcp_cursor10x_trackActiveFile({
  filename: "src/auth/jwt.js",
  action: "edit",
  metadata: {
    changes: "Added refresh token functionality"
  }
});
// Result: {
//   "status": "ok",
//   "filename": "src/auth/jwt.js",
//   "action": "edit",
//   "timestamp": 1681567900789
// }
```

#### `mcp_cursor10x_getRecentMessages`

Retrieves recent messages from the short-term memory.

**Parameters:**
- `limit` (number, optional): Maximum number of messages to retrieve, defaults to 10
- `importance` (string, optional): Filter by importance level

**Returns:**
- Object with status and array of messages

**Example:**
```javascript
// Get recent high importance messages
const messages = await mcp_cursor10x_getRecentMessages({
  limit: 5,
  importance: "high"
});
// Result: {
//   "status": "ok",
//   "messages": [
//     {
//       "id": 42,
//       "role": "user",
//       "content": "We need to implement authentication for our API",
//       "created_at": "2023-04-15T14:30:45.123Z",
//       "importance": "high",
//       "metadata": {"topic": "authentication", "priority": 1}
//     },
//     ...
//   ]
// }
```

#### `mcp_cursor10x_getActiveFiles`

Retrieves active files from the short-term memory.

**Parameters:**
- `limit` (number, optional): Maximum number of files to retrieve, defaults to 10

**Returns:**
- Object with status and array of active files

**Example:**
```javascript
// Get recent active files
const files = await mcp_cursor10x_getActiveFiles({
  limit: 3
});
// Result: {
//   "status": "ok",
//   "files": [
//     {
//       "id": 15,
//       "filename": "src/auth/jwt.js",
//       "last_accessed": "2023-04-15T14:30:45.123Z",
//       "metadata": {"changes": "Added refresh token functionality"}
//     },
//     ...
//   ]
// }
```

### Long-Term Memory Tools

#### `mcp_cursor10x_storeMilestone`

Stores a project milestone in the long-term memory.

**Parameters:**
- `title` (string, required): Title of the milestone
- `description` (string, required): Description of the milestone
- `importance` (string, optional): Importance level, defaults to "medium"
- `metadata` (object, optional): Additional metadata for the milestone

**Returns:**
- Object with status, title, and timestamp

**Example:**
```javascript
// Store a project milestone
const result = await mcp_cursor10x_storeMilestone({
  title: "Authentication System Implementation",
  description: "Implemented JWT authentication with refresh tokens and proper error handling",
  importance: "high",
  metadata: {
    version: "1.0.0",
    files_affected: ["src/auth/jwt.js", "src/middleware/auth.js"]
  }
});
// Result: {
//   "status": "ok",
//   "title": "Authentication System Implementation",
//   "timestamp": 1681568000123
// }
```

#### `mcp_cursor10x_storeDecision`

Stores a project decision in the long-term memory.

**Parameters:**
- `title` (string, required): Title of the decision
- `content` (string, required): Content of the decision
- `reasoning` (string, optional): Reasoning behind the decision
- `importance` (string, optional): Importance level, defaults to "medium"
- `metadata` (object, optional): Additional metadata for the decision

**Returns:**
- Object with status, title, and timestamp

**Example:**
```javascript
// Store a project decision
const result = await mcp_cursor10x_storeDecision({
  title: "JWT for Authentication",
  content: "Use JWT tokens for API authentication with refresh token rotation",
  reasoning: "JWTs provide stateless authentication with good security and performance characteristics",
  importance: "high",
  metadata: {
    alternatives_considered: ["Session-based auth", "OAuth2"],
    decision_date: "2023-04-15"
  }
});
// Result: {
//   "status": "ok",
//   "title": "JWT for Authentication",
//   "timestamp": 1681568100456
// }
```

#### `mcp_cursor10x_storeRequirement`

Stores a project requirement in the long-term memory.

**Parameters:**
- `title` (string, required): Title of the requirement
- `content` (string, required): Content of the requirement
- `importance` (string, optional): Importance level, defaults to "medium"
- `metadata` (object, optional): Additional metadata for the requirement

**Returns:**
- Object with status, title, and timestamp

**Example:**
```javascript
// Store a project requirement
const result = await mcp_cursor10x_storeRequirement({
  title: "Secure Authentication",
  content: "System must implement secure authentication with password hashing, rate limiting, and token rotation",
  importance: "critical",
  metadata: {
    source: "security audit",
    compliance: ["OWASP Top 10", "GDPR"]
  }
});
// Result: {
//   "status": "ok",
//   "title": "Secure Authentication",
//   "timestamp": 1681568200789
// }
```

### Episodic Memory Tools

#### `mcp_cursor10x_recordEpisode`

Records an episode (action) in the episodic memory.

**Parameters:**
- `actor` (string, required): Actor performing the action (user, assistant, system)
- `action` (string, required): Type of action performed
- `content` (string, required): Content or details of the action
- `importance` (string, optional): Importance level, defaults to "low"
- `context` (string, optional): Context for the episode

**Returns:**
- Object with status, actor, action, and timestamp

**Example:**
```javascript
// Record an episode
const result = await mcp_cursor10x_recordEpisode({
  actor: "assistant",
  action: "implementation",
  content: "Created JWT authentication middleware with token verification",
  importance: "medium",
  context: "authentication"
});
// Result: {
//   "status": "ok",
//   "actor": "assistant",
//   "action": "implementation",
//   "timestamp": 1681568300123
// }
```

#### `mcp_cursor10x_getRecentEpisodes`

Retrieves recent episodes from the episodic memory.

**Parameters:**
- `limit` (number, optional): Maximum number of episodes to retrieve, defaults to 10
- `context` (string, optional): Filter by context

**Returns:**
- Object with status and array of episodes

**Example:**
```javascript
// Get recent episodes in the authentication context
const episodes = await mcp_cursor10x_getRecentEpisodes({
  limit: 5,
  context: "authentication"
});
// Result: {
//   "status": "ok",
//   "episodes": [
//     {
//       "id": 87,
//       "actor": "assistant",
//       "action": "implementation",
//       "content": "Created JWT authentication middleware with token verification",
//       "timestamp": "2023-04-15T14:45:00.123Z",
//       "importance": "medium",
//       "context": "authentication"
//     },
//     ...
//   ]
// }
```

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Turso database account or SQLite for local development

### Setting Up Turso Database

The memory system uses Turso (LibSQL) for database storage. To set up your Turso database:

1. **Create a Turso account**
   
   Sign up at [Turso.tech](https://turso.tech) if you don't have an account.

2. **Install the Turso CLI**
   
   ```bash
   curl -sSfL https://get.turso.tech/install.sh | bash
   ```

3. **Login to Turso**
   
   ```bash
   turso auth login
   ```

4. **Create a database**
   
   ```bash
   turso db create cursor10x-mcp
   ```

5. **Get your database URL**
   
   ```bash
   turso db show cursor10x-mcp --url
   ```

6. **Create an authentication token**
   
   ```bash
   turso db tokens create cursor10x-mcp
   ```

Save both the database URL and authentication token for use in the configuration.

### Step-by-Step Installation

1. **Install the package from npm**
   ```bash
   npm install -g cursor10x-mcp
   ```

2. **Create the Cursor MCP configuration**
   
   Create or edit the `.cursor/mcp.json` file in your home directory:
   
   ```bash
   mkdir -p ~/.cursor
   touch ~/.cursor/mcp.json
   ```
   
   Add the following configuration to the file:
   
   ```json
   {
     "mcpServers": {
       "cursor10x-mcp": {
         "command": "npx",
         "args": [
           "cursor10x-mcp"
         ],
         "enabled": true,
         "env": {
           "TURSO_DATABASE_URL": "your-turso-database-url",
           "TURSO_AUTH_TOKEN": "your-turso-auth-token"
         }
       }
     }
   }
   ```
   
   Make sure to use your actual Turso credentials.

3. **Restart Cursor**
   
   After saving the configuration, restart Cursor to load the memory system.

4. **Verify Installation**
   
   Test the installation by asking Claude to run the `mcp_cursor10x_generateBanner` tool.

### For Developers

If you want to work on cursor10x-mcp development:

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/cursor10x-mcp.git
   cd cursor10x-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a .env.local file with your Turso credentials**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your actual credentials
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

5. **Build and publish to npm**
   ```bash
   # Update package.json with your information
   npm run build
   npm publish
   ```

## Configuration

### Environment Variables

The memory system can be configured using the following environment variables:

- `TURSO_DATABASE_URL`: URL for the Turso database connection (required)
- `TURSO_AUTH_TOKEN`: Authentication token for Turso database access (required)
- `MCP_LOG_LEVEL`: Logging level ("error", "warn", "info", "debug"), defaults to "info"
- `MCP_PORT`: Port for the MCP server if using HTTP transport, defaults to 3000

### Configuration in Cursor

Add the memory system configuration to your `.cursor/mcp.json` file:

```json
{
  "mcpServers": {
    "cursor10x-mcp": {
      "command": "node",
      "args": [
        "/path/to/your/cursor10x-mcp/index.js"
      ],
      "enabled": true,
      "env": {
        "TURSO_DATABASE_URL": "your-turso-database-url",
        "TURSO_AUTH_TOKEN": "your-turso-auth-token"
      }
    }
  }
}
```

Make sure to:
1. Replace `/path/to/your/cursor10x-mcp/index.js` with the actual path to your index.js file
2. Replace `your-turso-database-url` with your Turso database URL
3. Replace `your-turso-auth-token` with your Turso authentication token
4. Create the `.cursor` directory in your home directory if it doesn't exist yet

You can verify the configuration by checking if Claude can access the memory tools after restarting Cursor.

## Database Schema

The memory system automatically creates and maintains the following database tables:

- `messages`: Stores user and assistant messages
  - `id`: Unique identifier
  - `timestamp`: Creation timestamp
  - `role`: Message role (user/assistant)
  - `content`: Message content
  - `importance`: Importance level
  - `archived`: Whether the message is archived

- `active_files`: Tracks file activity
  - `id`: Unique identifier
  - `filename`: Path to the file
  - `action`: Last action performed
  - `last_accessed`: Timestamp of last access

- `milestones`: Records project milestones
  - `id`: Unique identifier
  - `title`: Milestone title
  - `description`: Detailed description
  - `timestamp`: Creation timestamp
  - `importance`: Importance level

- `decisions`: Stores project decisions
  - `id`: Unique identifier
  - `title`: Decision title
  - `content`: Decision content
  - `reasoning`: Decision reasoning
  - `timestamp`: Creation timestamp
  - `importance`: Importance level

- `requirements`: Maintains project requirements
  - `id`: Unique identifier
  - `title`: Requirement title
  - `content`: Requirement content
  - `timestamp`: Creation timestamp
  - `importance`: Importance level

- `episodes`: Chronicles actions and events
  - `id`: Unique identifier
  - `timestamp`: Creation timestamp
  - `actor`: Actor performing the action
  - `action`: Type of action
  - `content`: Action details
  - `importance`: Importance level
  - `context`: Action context

## Usage Examples

### Starting a New Session

```javascript
// At the beginning of a conversation, generate a banner and get context
async function startSession() {
  // Generate a memory banner to display status
  const banner = await mcp_cursor10x_generateBanner({});
  console.log("Memory System Status:", banner);
  
  // Get comprehensive context from all memory systems
  const context = await mcp_cursor10x_getComprehensiveContext({});
  console.log("Current Context:", context);
  
  // Check system health
  const health = await mcp_cursor10x_checkHealth({});
  console.log("System Health:", health);
}
```

### Working with Short-Term Memory

```javascript
// Store and retrieve short-term memory information
async function manageShortTermMemory() {
  // Store a user message
  await mcp_cursor10x_storeUserMessage({
    content: "We need to implement a new feature for user profiles",
    importance: "high"
  });
  
  // Store an assistant response
  await mcp_cursor10x_storeAssistantMessage({
    content: "I'll help you implement user profiles with customizable fields and validation",
    importance: "medium"
  });
  
  // Track an active file
  await mcp_cursor10x_trackActiveFile({
    filename: "src/models/User.js",
    action: "edit"
  });
  
  // Get recent messages filtered by importance
  const messages = await mcp_cursor10x_getRecentMessages({
    limit: 5,
    importance: "high"
  });
  
  // Get currently active files
  const files = await mcp_cursor10x_getActiveFiles({
    limit: 3
  });
}
```

### Working with Long-Term Memory

```javascript
// Store and manage long-term memory items
async function manageLongTermMemory() {
  // Record a project milestone
  await mcp_cursor10x_storeMilestone({
    title: "User Profile Feature",
    description: "Implemented user profiles with custom fields, validation, and avatar uploads",
    importance: "high"
  });
  
  // Record a project decision
  await mcp_cursor10x_storeDecision({
    title: "Profile Data Storage",
    content: "Store profile data in PostgreSQL with file uploads in S3",
    reasoning: "This provides scalability and performance for both structured data and binary content",
    importance: "high"
  });
  
  // Record a project requirement
  await mcp_cursor10x_storeRequirement({
    title: "Profile Privacy Controls",
    content: "Users must be able to control visibility of profile fields with granular permissions",
    importance: "medium"
  });
}
```

### Working with Episodic Memory

```javascript
// Record and retrieve episodic memory
async function manageEpisodicMemory() {
  // Record user action
  await mcp_cursor10x_recordEpisode({
    actor: "user",
    action: "request",
    content: "Requested implementation of user profile feature",
    importance: "medium",
    context: "user-profiles"
  });
  
  // Record assistant action
  await mcp_cursor10x_recordEpisode({
    actor: "assistant",
    action: "implementation",
    content: "Created User model with customizable fields",
    importance: "medium",
    context: "user-profiles"
  });
  
  // Get recent episodes filtered by context
  const episodes = await mcp_cursor10x_getRecentEpisodes({
    limit: 5,
    context: "user-profiles"
  });
}
```

### Comprehensive Memory Operations

```javascript
// Combining multiple memory operations for a complex workflow
async function completeFeatureImplementation() {
  // Record the overall milestone
  await mcp_cursor10x_storeMilestone({
    title: "Authentication System",
    description: "Complete implementation of JWT authentication with refresh tokens",
    importance: "high"
  });
  
  // Store the implementation decision
  await mcp_cursor10x_storeDecision({
    title: "Authentication Method",
    content: "Use JWT with refresh token rotation",
    reasoning: "Provides secure, stateless authentication with protection against token theft",
    importance: "high"
  });
  
  // Track the files being edited
  await mcp_cursor10x_trackActiveFile({
    filename: "src/auth/jwt.js",
    action: "edit"
  });
  
  await mcp_cursor10x_trackActiveFile({
    filename: "src/middleware/auth.js",
    action: "create"
  });
  
  // Record the implementation episode
  await mcp_cursor10x_recordEpisode({
    actor: "assistant",
    action: "implementation",
    content: "Implemented JWT authentication middleware",
    importance: "medium",
    context: "authentication"
  });
  
  // Get current memory statistics
  const stats = await mcp_cursor10x_getMemoryStats({});
  console.log("Memory Stats:", stats);
}
```

## Troubleshooting

### Common Issues

1. **Database Connection Problems**
   - Verify your Turso database URL and authentication token are correct
   - Check network connectivity to the Turso service
   - Verify firewall settings allow the connection

2. **Missing Data**
   - Check that data was stored with appropriate importance level
   - Verify the retrieval query parameters (limit, filters)
   - Check the database health with `mcp_cursor10x_checkHealth()`

3. **Performance Issues**
   - Monitor memory statistics with `mcp_cursor10x_getMemoryStats()`
   - Consider archiving old data if database grows too large
   - Optimize retrieval by using more specific filters

### Diagnostic Steps

1. Check system health:
   ```javascript
   const health = await mcp_cursor10x_checkHealth({});
   console.log("System Health:", health);
   ```

2. Verify memory statistics:
   ```javascript
   const stats = await mcp_cursor10x_getMemoryStats({});
   console.log("Memory Stats:", stats);
   ```

3. Generate a status banner:
   ```javascript
   const banner = await mcp_cursor10x_generateBanner({});
   console.log("Memory Banner:", banner);
   ```

## Importance Levels

When storing items in memory, use appropriate importance levels:

- **low**: General information, routine operations, everyday conversations
- **medium**: Useful context, standard work items, regular features
- **high**: Critical decisions, major features, important architecture elements
- **critical**: Core architecture, security concerns, data integrity issues

## License

MIT
