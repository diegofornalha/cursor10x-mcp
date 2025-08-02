#!/usr/bin/env node

// Suprimir mensagens do dotenv
const originalLog = console.log;
console.log = function() {};

const { createClient } = require("@libsql/client");
const dotenv = require("dotenv");

// Restaurar console.log após dotenv
dotenv.config();
console.log = originalLog;

// Configuração do cliente Turso
let tursoClient = null;

function getTursoClient() {
  if (!tursoClient) {
    let url = process.env.TURSO_DATABASE_URL || process.env.TURSO_LOCAL_URL || process.env.TURSO_REMOTE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_LOCAL_AUTH_TOKEN || process.env.TURSO_REMOTE_AUTH_TOKEN;
    
    if (!url) {
      throw new Error("Turso URL must be configured");
    }
    
    // Para servidor local, usar HTTP
    if (url.includes('127.0.0.1')) {
      url = url.replace('libsql://', 'http://');
    }
    
    const config = { url };
    
    // Para servidor local, não usar token
    if (authToken && !url.includes('127.0.0.1')) {
      config.authToken = authToken;
    }
    
    tursoClient = createClient(config);
  }
  return tursoClient;
}

// Funções MCP para Turso
async function executeQuery(client, args) {
  const { query, params = [] } = args;
  const result = await client.execute(query, params);
  return result;
}

async function executeBatch(client, args) {
  const { statements } = args;
  const results = [];
  
  for (const statement of statements) {
    const result = await client.execute(statement);
    results.push(result);
  }
  
  return results;
}

async function listTables(client) {
  const result = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  return result;
}

async function describeTable(client, args) {
  const { tableName } = args;
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  return result;
}

async function getDatabaseInfo(client) {
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
    url: process.env.TURSO_LOCAL_URL || process.env.TURSO_REMOTE_URL,
  };
}

async function optimizeDatabase(client) {
  await client.execute("VACUUM");
  await client.execute("ANALYZE");
  return { message: "Database optimized successfully" };
}

async function createTable(client, args) {
  const { tableName, schema } = args;
  const result = await client.execute(`CREATE TABLE ${tableName} (${schema})`);
  return { message: `Table ${tableName} created successfully` };
}

async function dropTable(client, args) {
  const { tableName } = args;
  const result = await client.execute(`DROP TABLE ${tableName}`);
  return { message: `Table ${tableName} dropped successfully` };
}

async function insertData(client, args) {
  const { tableName, data } = args;
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");
  
  const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const result = await client.execute(query, values);
  
  return { message: `Data inserted into ${tableName}`, result };
}

async function updateData(client, args) {
  const { tableName, where, data } = args;
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(", ");
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
  
  const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
  const params = [...Object.values(data), ...Object.values(where)];
  
  const result = await client.execute(query, params);
  
  return { message: `Data updated in ${tableName}`, result };
}

async function deleteData(client, args) {
  const { tableName, where } = args;
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
  
  const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
  const params = Object.values(where);
  
  const result = await client.execute(query, params);
  
  return { message: `Data deleted from ${tableName}`, result };
}

async function searchData(client, args) {
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
      .filter(row => row.type.toLowerCase().includes('text'))
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

// Mapeamento de ferramentas
const tools = {
  turso_execute_query: executeQuery,
  turso_execute_batch: executeBatch,
  turso_list_tables: listTables,
  turso_describe_table: describeTable,
  turso_get_database_info: getDatabaseInfo,
  turso_optimize_database: optimizeDatabase,
  turso_create_table: createTable,
  turso_drop_table: dropTable,
  turso_insert_data: insertData,
  turso_update_data: updateData,
  turso_delete_data: deleteData,
  turso_search_data: searchData,
};

// Servidor MCP simples
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
          ],
        },
      };
    }
    
    if (method === "tools/call") {
      const { name, arguments: args } = params;
      const client = getTursoClient();
      
      if (!tools[name]) {
        throw new Error(`Unknown tool: ${name}`);
      }
      
      const result = await tools[name](client, args);
      
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

// Ler entrada stdin e processar
process.stdin.setEncoding('utf8');
let buffer = '';

process.stdin.on('data', async (chunk) => {
  buffer += chunk;
  
  try {
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.trim()) {
        const request = JSON.parse(line);
        const response = await handleRequest(request);
        console.log(JSON.stringify(response));
      }
    }
  } catch (error) {
    // Silenciar erros para não interferir com stdout
  }
});

// Não enviar nada para stderr
process.on('uncaughtException', (error) => {
  // Silenciar
});

process.on('unhandledRejection', (error) => {
  // Silenciar
});