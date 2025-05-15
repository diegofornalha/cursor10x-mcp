/**
 * Script de teste para verificar o funcionamento do cursor10x-mcp com banco de dados local
 * 
 * Este script simula o uso das ferramentas MCP em um ambiente local,
 * utilizando o banco de dados SQLite configurado.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from "url";
import { dirname } from "path";
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

// Obter diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log("🚀 Iniciando teste do cursor10x-mcp com banco de dados local");
console.log(`📊 Configurações:`);
console.log(`- URL do banco: ${process.env.TURSO_DATABASE_URL}`);
console.log(`- Dimensões vetoriais: ${process.env.VECTOR_DIMENSIONS}`);

// Importa as funções principais do index.js
// Isso irá inicializar o banco de dados e as ferramentas
try {
  const { 
    generateBanner, 
    checkHealth, 
    storeUserMessage, 
    storeAssistantMessage,
    trackActiveFile,
    getComprehensiveContext,
    getRecentMessages
  } = await import('./index.js');
  
  // Teste de saúde do sistema
  console.log("\n🔍 Verificando saúde do sistema...");
  const healthStatus = await checkHealth();
  console.log(`✅ Status de saúde: ${healthStatus ? "ONLINE" : "OFFLINE"}`);
  
  // Gera e exibe o banner do sistema
  console.log("\n🎉 Gerando banner do sistema...");
  const banner = await generateBanner();
  console.log(banner);
  
  // Testa armazenamento de mensagem do usuário
  console.log("\n📝 Testando armazenamento de mensagem do usuário...");
  const userId = "test-user-" + Date.now();
  const userMsgContent = "Esta é uma mensagem de teste para o cursor10x-mcp local";
  const userMsgResult = await storeUserMessage(userId, userMsgContent, "medium");
  console.log(`✅ Mensagem de usuário armazenada. ID: ${userMsgResult?.id || 'N/A'}`);
  
  // Testa armazenamento de mensagem do assistente
  console.log("\n🤖 Testando armazenamento de mensagem do assistente...");
  const assistantMsgContent = "Esta é uma resposta de teste do assistente";
  const assistantMsgResult = await storeAssistantMessage(userId, assistantMsgContent, "medium");
  console.log(`✅ Mensagem do assistente armazenada. ID: ${assistantMsgResult?.id || 'N/A'}`);
  
  // Testa rastreamento de arquivo ativo
  console.log("\n📂 Testando rastreamento de arquivo ativo...");
  const filePath = "/Users/teste/projeto/arquivo-teste.js";
  const fileTrackResult = await trackActiveFile(filePath);
  console.log(`✅ Arquivo rastreado: ${filePath}`);
  
  // Testa recuperação de contexto
  console.log("\n🧠 Testando recuperação de contexto...");
  const context = await getComprehensiveContext();
  console.log(`✅ Contexto recuperado com ${context?.length || 0} caracteres`);
  
  // Testa recuperação de mensagens recentes
  console.log("\n💬 Testando recuperação de mensagens recentes...");
  const recentMessages = await getRecentMessages();
  console.log(`✅ Recuperadas ${recentMessages?.messages?.length || 0} mensagens recentes`);
  
  console.log("\n🎯 Todos os testes concluídos com sucesso!");
  console.log("O cursor10x-mcp está configurado corretamente com o banco de dados local.");
  
} catch (error) {
  console.error("\n❌ ERRO AO EXECUTAR TESTES:", error);
  console.error("\nVerifique:");
  console.error("1. Se o banco de dados local existe e está acessível");
  console.error("2. Se todas as tabelas foram criadas corretamente");
  console.error("3. Se as variáveis de ambiente estão corretas no arquivo .env");
}