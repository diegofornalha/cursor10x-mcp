#!/usr/bin/env node

// Turso MCP Server - Versão final para Claude Code
// Sem dependência de dotenv para evitar mensagens indesejadas

const { createClient } = require("@libsql/client");

// Cliente Turso
let tursoClient = null;

function getTursoClient() {
  if (!tursoClient) {
    // Usar variáveis de ambiente ou valores padrão
    let url = process.env.TURSO_DATABASE_URL || "libsql://127.0.0.1:8080";
    const authToken = process.env.TURSO_AUTH_TOKEN;
    
    // Converter libsql para http para servidor local
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

// Funções das ferramentas
const toolImplementations = {
  async turso_execute_query(args) {
    const client = getTursoClient();
    const { query, params = [] } = args;
    return await client.execute(query, params);
  },
  
  async turso_execute_batch(args) {
    const client = getTursoClient();
    const { statements } = args;
    const results = [];
    
    for (const statement of statements) {
      const result = await client.execute(statement);
      results.push(result);
    }
    
    return results;
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
  
  async turso_get_database_info() {
    const client = getTursoClient();
    const tables = await client.execute(`
      SELECT name, sql FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    const stats = await client.execute(`
      SELECT 
        COUNT(*) as table_count,
        SUM(length(sql)) as total_schema_size
      FROM sqlite_master 
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
    `);
    
    return {
      tables: tables.rows,
      statistics: stats.rows[0],
      url: process.env.TURSO_DATABASE_URL || "libsql://127.0.0.1:8080",
    };
  },
  
  async turso_optimize_database() {
    const client = getTursoClient();
    await client.execute("VACUUM");
    await client.execute("ANALYZE");
    return { message: "Database optimized successfully" };
  },
  
  async turso_create_table(args) {
    const client = getTursoClient();
    const { tableName, schema } = args;
    await client.execute(`CREATE TABLE ${tableName} (${schema})`);
    return { message: `Table ${tableName} created successfully` };
  },
  
  async turso_drop_table(args) {
    const client = getTursoClient();
    const { tableName } = args;
    await client.execute(`DROP TABLE ${tableName}`);
    return { message: `Table ${tableName} dropped successfully` };
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
  
  async turso_update_data(args) {
    const client = getTursoClient();
    const { tableName, where, data } = args;
    const setClause = Object.keys(data).map(key => `${key} = ?`).join(", ");
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
    
    const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
    const params = [...Object.values(data), ...Object.values(where)];
    
    const result = await client.execute(query, params);
    
    return { message: `Data updated in ${tableName}`, result };
  },
  
  async turso_delete_data(args) {
    const client = getTursoClient();
    const { tableName, where } = args;
    const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
    
    const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
    const params = Object.values(where);
    
    const result = await client.execute(query, params);
    
    return { message: `Data deleted from ${tableName}`, result };
  },
  
  async turso_search_data(args) {
    const client = getTursoClient();
    const { tableName, searchTerm, columns = [], limit = 10 } = args;
    
    let query = `SELECT * FROM ${tableName}`;
    const params = [];
    
    if (columns.length > 0) {
      const searchConditions = columns.map(col => `${col} LIKE ?`);
      query += ` WHERE ${searchConditions.join(" OR ")}`;
      params.push(...columns.map(() => `%${searchTerm}%`));
    } else {
      // Busca em todas as colunas de texto
      const tableInfo = await client.execute(`PRAGMA table_info(${tableName})`);
      const textColumns = tableInfo.rows
        .filter(row => row.type && row.type.toLowerCase().includes('text'))
        .map(row => row.name);
      
      if (textColumns.length > 0) {
        const searchConditions = textColumns.map(col => `${col} LIKE ?`);
        query += ` WHERE ${searchConditions.join(" OR ")}`;
        params.push(...textColumns.map(() => `%${searchTerm}%`));
      }
    }
    
    query += ` LIMIT ${limit}`;
    
    const result = await client.execute(query, params);
    return result;
  }
};

// Definições das ferramentas
const toolDefinitions = [
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
    name: "turso_execute_batch",
    description: "Execute multiple SQL statements in a batch",
    inputSchema: {
      type: "object",
      properties: {
        statements: { type: "array", description: "Array of SQL statements", items: { type: "string" } },
      },
      required: ["statements"],
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
    name: "turso_get_database_info",
    description: "Get database information and statistics",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "turso_optimize_database",
    description: "Optimize database performance",
    inputSchema: { type: "object", properties: {} },
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
    name: "turso_drop_table",
    description: "Drop a table from the database",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Name of the table to drop" },
      },
      required: ["tableName"],
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
    name: "turso_update_data",
    description: "Update data in a table",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Name of the table" },
        where: { type: "object", description: "WHERE conditions", additionalProperties: true },
        data: { type: "object", description: "Data to update", additionalProperties: true },
      },
      required: ["tableName", "where", "data"],
    },
  },
  {
    name: "turso_delete_data",
    description: "Delete data from a table",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Name of the table" },
        where: { type: "object", description: "WHERE conditions", additionalProperties: true },
      },
      required: ["tableName", "where"],
    },
  },
  {
    name: "turso_search_data",
    description: "Search data in a table with full-text search",
    inputSchema: {
      type: "object",
      properties: {
        tableName: { type: "string", description: "Name of the table" },
        searchTerm: { type: "string", description: "Search term" },
        columns: { type: "array", description: "Columns to search in", items: { type: "string" } },
        limit: { type: "number", description: "Maximum number of results", default: 10 },
      },
      required: ["tableName", "searchTerm"],
    },
  },
];

// Handler de requisições MCP
async function handleRequest(request) {
  try {
    const { method, params, id } = request;
    
    if (method === "tools/list") {
      return {
        jsonrpc: "2.0",
        id,
        result: {
          tools: toolDefinitions,
        },
      };
    }
    
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      
      if (!toolImplementations[name]) {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      const result = await toolImplementations[name](args);
      
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
        // Silenciar erros
      }
    }
  }
});

// Capturar erros silenciosamente
process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});