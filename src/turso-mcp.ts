import { createClient } from "@libsql/client";
import { CallToolRequest, CallToolResult, ContentType, ListToolsResult } from "./pdk";
import * as dotenv from "dotenv";

// Carregar variáveis de ambiente
dotenv.config();

// Configuração do cliente Turso
let tursoClient: any = null;

function getTursoClient() {
  if (!tursoClient) {
    const url = process.env.TURSO_LOCAL_URL || process.env.TURSO_REMOTE_URL;
    const authToken = process.env.TURSO_LOCAL_AUTH_TOKEN || process.env.TURSO_REMOTE_AUTH_TOKEN;
    
    if (!url || !authToken) {
      throw new Error("Turso URL and Auth Token must be configured");
    }
    
    tursoClient = createClient({
      url,
      authToken,
    });
  }
  return tursoClient;
}

/**
 * Implementação das ferramentas MCP para Turso
 */
export async function callImpl(input: CallToolRequest): Promise<CallToolResult> {
  const toolName = input.params.arguments?.name;
  if (!toolName) {
    throw new Error("Tool name must be provided");
  }

  try {
    const client = getTursoClient();
    
    switch (toolName) {
      case "turso_execute_query":
        return await executeQuery(client, input.params.arguments);
      
      case "turso_execute_batch":
        return await executeBatch(client, input.params.arguments);
      
      case "turso_list_tables":
        return await listTables(client);
      
      case "turso_describe_table":
        return await describeTable(client, input.params.arguments);
      
      case "turso_backup_database":
        return await backupDatabase(client, input.params.arguments);
      
      case "turso_restore_database":
        return await restoreDatabase(client, input.params.arguments);
      
      case "turso_get_database_info":
        return await getDatabaseInfo(client);
      
      case "turso_optimize_database":
        return await optimizeDatabase(client);
      
      case "turso_create_table":
        return await createTable(client, input.params.arguments);
      
      case "turso_drop_table":
        return await dropTable(client, input.params.arguments);
      
      case "turso_insert_data":
        return await insertData(client, input.params.arguments);
      
      case "turso_update_data":
        return await updateData(client, input.params.arguments);
      
      case "turso_delete_data":
        return await deleteData(client, input.params.arguments);
      
      case "turso_search_data":
        return await searchData(client, input.params.arguments);
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: ContentType.Text,
          text: `Error executing ${toolName}: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}

/**
 * Descrição das ferramentas MCP para Turso
 */
export function describeImpl(): ListToolsResult {
  return {
    tools: [
      {
        name: "turso_execute_query",
        description: "Execute a SQL query on the Turso database",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "SQL query to execute",
            },
            params: {
              type: "array",
              description: "Query parameters",
              items: { type: "string" },
            },
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
            statements: {
              type: "array",
              description: "Array of SQL statements",
              items: { type: "string" },
            },
          },
          required: ["statements"],
        },
      },
      {
        name: "turso_list_tables",
        description: "List all tables in the database",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "turso_describe_table",
        description: "Get table schema and information",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "Name of the table to describe",
            },
          },
          required: ["tableName"],
        },
      },
      {
        name: "turso_backup_database",
        description: "Create a backup of the database",
        inputSchema: {
          type: "object",
          properties: {
            backupPath: {
              type: "string",
              description: "Path where to save the backup",
            },
          },
          required: ["backupPath"],
        },
      },
      {
        name: "turso_restore_database",
        description: "Restore database from backup",
        inputSchema: {
          type: "object",
          properties: {
            backupPath: {
              type: "string",
              description: "Path to the backup file",
            },
          },
          required: ["backupPath"],
        },
      },
      {
        name: "turso_get_database_info",
        description: "Get database information and statistics",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "turso_optimize_database",
        description: "Optimize database performance",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "turso_create_table",
        description: "Create a new table in the database",
        inputSchema: {
          type: "object",
          properties: {
            tableName: {
              type: "string",
              description: "Name of the table to create",
            },
            schema: {
              type: "string",
              description: "SQL schema definition",
            },
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
            tableName: {
              type: "string",
              description: "Name of the table to drop",
            },
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
            tableName: {
              type: "string",
              description: "Name of the table",
            },
            data: {
              type: "object",
              description: "Data to insert",
              additionalProperties: true,
            },
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
            tableName: {
              type: "string",
              description: "Name of the table",
            },
            where: {
              type: "object",
              description: "WHERE conditions",
              additionalProperties: true,
            },
            data: {
              type: "object",
              description: "Data to update",
              additionalProperties: true,
            },
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
            tableName: {
              type: "string",
              description: "Name of the table",
            },
            where: {
              type: "object",
              description: "WHERE conditions",
              additionalProperties: true,
            },
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
            tableName: {
              type: "string",
              description: "Name of the table",
            },
            searchTerm: {
              type: "string",
              description: "Search term",
            },
            columns: {
              type: "array",
              description: "Columns to search in",
              items: { type: "string" },
            },
            limit: {
              type: "number",
              description: "Maximum number of results",
              default: 10,
            },
          },
          required: ["tableName", "searchTerm"],
        },
      },
    ],
  };
}

// Implementações das ferramentas
async function executeQuery(client: any, args: any): Promise<CallToolResult> {
  const { query, params = [] } = args;
  const result = await client.execute(query, params);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function executeBatch(client: any, args: any): Promise<CallToolResult> {
  const { statements } = args;
  const results = [];
  
  for (const statement of statements) {
    const result = await client.execute(statement);
    results.push(result);
  }
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(results, null, 2),
      },
    ],
  };
}

async function listTables(client: any): Promise<CallToolResult> {
  const result = await client.execute(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name NOT LIKE 'sqlite_%'
    ORDER BY name
  `);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function describeTable(client: any, args: any): Promise<CallToolResult> {
  const { tableName } = args;
  const result = await client.execute(`PRAGMA table_info(${tableName})`);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

async function backupDatabase(client: any, args: any): Promise<CallToolResult> {
  const { backupPath } = args;
  // Implementar backup usando turso CLI ou API
  const result = await client.execute("VACUUM INTO ?", [backupPath]);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Database backed up to ${backupPath}`,
      },
    ],
  };
}

async function restoreDatabase(client: any, args: any): Promise<CallToolResult> {
  const { backupPath } = args;
  // Implementar restore usando turso CLI ou API
  const result = await client.execute("RESTORE FROM ?", [backupPath]);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Database restored from ${backupPath}`,
      },
    ],
  };
}

async function getDatabaseInfo(client: any): Promise<CallToolResult> {
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
  
  const info = {
    tables: tables.rows,
    statistics: stats.rows[0],
    url: process.env.TURSO_LOCAL_URL || process.env.TURSO_REMOTE_URL,
  };
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(info, null, 2),
      },
    ],
  };
}

async function optimizeDatabase(client: any): Promise<CallToolResult> {
  await client.execute("VACUUM");
  await client.execute("ANALYZE");
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: "Database optimized successfully",
      },
    ],
  };
}

async function createTable(client: any, args: any): Promise<CallToolResult> {
  const { tableName, schema } = args;
  const result = await client.execute(`CREATE TABLE ${tableName} (${schema})`);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Table ${tableName} created successfully`,
      },
    ],
  };
}

async function dropTable(client: any, args: any): Promise<CallToolResult> {
  const { tableName } = args;
  const result = await client.execute(`DROP TABLE ${tableName}`);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Table ${tableName} dropped successfully`,
      },
    ],
  };
}

async function insertData(client: any, args: any): Promise<CallToolResult> {
  const { tableName, data } = args;
  const columns = Object.keys(data);
  const values = Object.values(data);
  const placeholders = columns.map(() => "?").join(", ");
  
  const query = `INSERT INTO ${tableName} (${columns.join(", ")}) VALUES (${placeholders})`;
  const result = await client.execute(query, values);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Data inserted into ${tableName}: ${JSON.stringify(result)}`,
      },
    ],
  };
}

async function updateData(client: any, args: any): Promise<CallToolResult> {
  const { tableName, where, data } = args;
  const setClause = Object.keys(data).map(key => `${key} = ?`).join(", ");
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
  
  const query = `UPDATE ${tableName} SET ${setClause} WHERE ${whereClause}`;
  const params = [...Object.values(data), ...Object.values(where)];
  
  const result = await client.execute(query, params);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Data updated in ${tableName}: ${JSON.stringify(result)}`,
      },
    ],
  };
}

async function deleteData(client: any, args: any): Promise<CallToolResult> {
  const { tableName, where } = args;
  const whereClause = Object.keys(where).map(key => `${key} = ?`).join(" AND ");
  
  const query = `DELETE FROM ${tableName} WHERE ${whereClause}`;
  const params = Object.values(where);
  
  const result = await client.execute(query, params);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: `Data deleted from ${tableName}: ${JSON.stringify(result)}`,
      },
    ],
  };
}

async function searchData(client: any, args: any): Promise<CallToolResult> {
  const { tableName, searchTerm, columns = [], limit = 10 } = args;
  
  let query = `SELECT * FROM ${tableName}`;
  const params = [];
  
  if (columns.length > 0) {
    const searchConditions = columns.map((col: string) => `${col} LIKE ?`);
    query += ` WHERE ${searchConditions.join(" OR ")}`;
    params.push(...columns.map(() => `%${searchTerm}%`));
  } else {
    // Busca em todas as colunas de texto
    const tableInfo = await client.execute(`PRAGMA table_info(${tableName})`);
    const textColumns = tableInfo.rows
      .filter((row: any) => row.type.toLowerCase().includes('text'))
      .map((row: any) => row.name);
    
    if (textColumns.length > 0) {
      const searchConditions = textColumns.map((col: string) => `${col} LIKE ?`);
      query += ` WHERE ${searchConditions.join(" OR ")}`;
      params.push(...textColumns.map(() => `%${searchTerm}%`));
    }
  }
  
  query += ` LIMIT ${limit}`;
  
  const result = await client.execute(query, params);
  
  return {
    content: [
      {
        type: ContentType.Text,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
} 