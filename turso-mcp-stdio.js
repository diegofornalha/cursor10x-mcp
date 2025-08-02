#!/usr/bin/env node

// Configuração do cliente Turso
const { createClient } = require("@libsql/client");

// Configurar dotenv sem output
require("dotenv").config({ silent: true });

let tursoClient = null;

function getTursoClient() {
  if (!tursoClient) {
    let url = process.env.TURSO_DATABASE_URL || "libsql://127.0.0.1:8080";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    if (url.includes('127.0.0.1')) {
      url = url.replace('libsql://', 'http://');
    }
    
    const config = { url };
    if (authToken && !url.includes('127.0.0.1')) {
      config.authToken = authToken;
    }
    
    tursoClient = createClient(config);
  }
  return tursoClient;
}

// Implementação das ferramentas
const tools = {
  async turso_execute_query(args) {
    const client = getTursoClient();
    const { query, params = [] } = args;
    return await client.execute(query, params);
  },
  
  async turso_list_tables() {
    const client = getTursoClient();
    return await client.execute(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `);
  },
  
  async turso_describe_table(args) {
    const client = getTursoClient();
    const { tableName } = args;
    return await client.execute(`PRAGMA table_info(${tableName})`);
  },
  
  async turso_create_table(args) {
    const client = getTursoClient();
    const { tableName, schema } = args;
    await client.execute(`CREATE TABLE ${tableName} (${schema})`);
    return { message: `Table ${tableName} created successfully` };
  },
  
  async turso_insert_data(args) {
    const client = getTursoClient();
    const { tableName, data } = args;
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map(() => "?").join(", ");
    
    const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
    const result = await client.execute(query, values);
    
    return { message: `Data inserted into ${tableName}`, result };
  },
  
  async turso_get_database_info() {
    const client = getTursoClient();
    const tables = await client.execute(`
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    return {
      tables: tables.rows,
      url: process.env.TURSO_DATABASE_URL || "libsql://127.0.0.1:8080",
    };
  }
};

// Servidor MCP principal
async function handleRequest(request) {
  try {
    const { method, params, id } = request;
    
    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "turso_execute_query",
              description: "Execute a SQL query on the Turso database",
              inputSchema: {
                type: "object",
                properties: {
                  query: { type: "string", description: "SQL query to execute" },
                  params: { type: "array", description: "Query parameters", items: { type: "string" } },
                },
                required: ["query"],
              },
            },
            {
              name: "turso_list_tables",
              description: "List all tables in the database",
              inputSchema: { type: "object", properties: {} },
            },
            {
              name: "turso_describe_table",
              description: "Get table schema and information",
              inputSchema: {
                type: "object",
                properties: {
                  tableName: { type: "string", description: "Name of the table to describe" },
                },
                required: ["tableName"],
              },
            },
            {
              name: "turso_create_table",
              description: "Create a new table in the database",
              inputSchema: {
                type: "object",
                properties: {
                  tableName: { type: "string", description: "Name of the table to create" },
                  schema: { type: "string", description: "SQL schema definition" },
                },
                required: ["tableName", "schema"],
              },
            },
            {
              name: "turso_insert_data",
              description: "Insert data into a table",
              inputSchema: {
                type: "object",
                properties: {
                  tableName: { type: "string", description: "Name of the table" },
                  data: { type: "object", description: "Data to insert", additionalProperties: true },
                },
                required: ["tableName", "data"],
              },
            },
            {
              name: "turso_get_database_info",
              description: "Get database information and statistics",
              inputSchema: { type: "object", properties: {} },
            },
          ],
        },
      };
    }
    
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      if (!tools[name]) {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      const result = await tools[name](args);
      
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      };
    }
    
    throw new Error(`Unknown method: ${method}`);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32603,
        message: error.message,
      },
    };
  }
}

// Processar entrada stdio
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.trim()) {
      try {
        const request = JSON.parse(line);
        const response = await handleRequest(request);
        process.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        // Ignorar erros silenciosamente
      }
    }
  }
});

// Capturar erros silenciosamente
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});