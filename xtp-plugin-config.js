/**
 * Configuração do plugin cursor10x-mcp para XTP
 * 
 * Este arquivo define a interface e funcionalidades do plugin cursor10x-mcp
 * para implantação na plataforma XTP.
 */

import * as cursor10xMemory from './index.js';
import dotenv from 'dotenv';

// Carrega variáveis de ambiente
dotenv.config();

/**
 * Define as ferramentas que serão expostas pelo plugin
 */
export const tools = [
  {
    name: "generateBanner",
    description: "Gera um banner informativo com estatísticas do sistema de memória",
    parameters: {},
    handler: async () => {
      return await cursor10xMemory.generateBanner();
    }
  },
  {
    name: "checkHealth",
    description: "Verifica a saúde do sistema de memória e conexões com o banco de dados",
    parameters: {},
    handler: async () => {
      return await cursor10xMemory.checkHealth();
    }
  },
  {
    name: "storeUserMessage",
    description: "Armazena uma mensagem do usuário no sistema de memória",
    parameters: {
      userId: { type: "string", description: "ID do usuário" },
      content: { type: "string", description: "Conteúdo da mensagem" },
      importance: { type: "string", description: "Nível de importância (low, medium, high, critical)", default: "low" }
    },
    handler: async (params) => {
      return await cursor10xMemory.storeUserMessage(
        params.userId,
        params.content,
        params.importance || "low"
      );
    }
  },
  {
    name: "storeAssistantMessage",
    description: "Armazena uma mensagem do assistente no sistema de memória",
    parameters: {
      userId: { type: "string", description: "ID do usuário associado à conversa" },
      content: { type: "string", description: "Conteúdo da mensagem do assistente" },
      importance: { type: "string", description: "Nível de importância (low, medium, high, critical)", default: "low" }
    },
    handler: async (params) => {
      return await cursor10xMemory.storeAssistantMessage(
        params.userId,
        params.content,
        params.importance || "low"
      );
    }
  },
  {
    name: "getRecentMessages",
    description: "Recupera mensagens recentes do sistema de memória",
    parameters: {
      userId: { type: "string", description: "ID do usuário para filtrar mensagens", required: false },
      limit: { type: "number", description: "Número máximo de mensagens a recuperar", default: 10 }
    },
    handler: async (params) => {
      return await cursor10xMemory.getRecentMessages(
        params.userId || null,
        params.limit || 10
      );
    }
  },
  {
    name: "trackActiveFile",
    description: "Registra um arquivo ativo para acompanhamento pelo sistema de memória",
    parameters: {
      filePath: { type: "string", description: "Caminho do arquivo a ser rastreado" },
      userId: { type: "string", description: "ID do usuário associado ao arquivo", required: false }
    },
    handler: async (params) => {
      return await cursor10xMemory.trackActiveFile(
        params.filePath,
        params.userId || null
      );
    }
  },
  {
    name: "getActiveFiles",
    description: "Recupera a lista de arquivos ativos no sistema de memória",
    parameters: {
      limit: { type: "number", description: "Número máximo de arquivos a recuperar", default: 10 }
    },
    handler: async (params) => {
      return await cursor10xMemory.getActiveFiles(params.limit || 10);
    }
  },
  {
    name: "storeMilestone",
    description: "Armazena um marco importante do projeto na memória de longo prazo",
    parameters: {
      title: { type: "string", description: "Título do marco" },
      description: { type: "string", description: "Descrição detalhada do marco", required: false }
    },
    handler: async (params) => {
      return await cursor10xMemory.storeMilestone(
        params.title,
        params.description || null
      );
    }
  },
  {
    name: "storeDecision",
    description: "Armazena uma decisão importante na memória de longo prazo",
    parameters: {
      title: { type: "string", description: "Título da decisão" },
      description: { type: "string", description: "Descrição da decisão", required: false },
      rationale: { type: "string", description: "Justificativa para a decisão", required: false }
    },
    handler: async (params) => {
      return await cursor10xMemory.storeDecision(
        params.title,
        params.description || null,
        params.rationale || null
      );
    }
  },
  {
    name: "storeRequirement",
    description: "Armazena um requisito do projeto na memória de longo prazo",
    parameters: {
      title: { type: "string", description: "Título do requisito" },
      description: { type: "string", description: "Descrição detalhada do requisito", required: false },
      priority: { type: "string", description: "Prioridade (low, medium, high, critical)", default: "medium" }
    },
    handler: async (params) => {
      return await cursor10xMemory.storeRequirement(
        params.title,
        params.description || null,
        params.priority || "medium"
      );
    }
  },
  {
    name: "recordEpisode",
    description: "Registra um episódio ou evento no sistema de memória",
    parameters: {
      actionType: { type: "string", description: "Tipo de ação (ex: edit_file, commit, search)" },
      description: { type: "string", description: "Descrição do episódio" },
      metadata: { type: "object", description: "Metadados adicionais sobre o episódio", required: false }
    },
    handler: async (params) => {
      return await cursor10xMemory.recordEpisode(
        params.actionType,
        params.description,
        params.metadata || null
      );
    }
  },
  {
    name: "getComprehensiveContext",
    description: "Recupera contexto abrangente com informações de todos os sistemas de memória",
    parameters: {
      maxItems: { type: "number", description: "Número máximo de itens a incluir de cada tipo", default: 5 }
    },
    handler: async (params) => {
      return await cursor10xMemory.getComprehensiveContext(params.maxItems || 5);
    }
  },
  {
    name: "initConversation",
    description: "Inicializa uma conversa e retorna contexto inicial",
    parameters: {
      userId: { type: "string", description: "ID do usuário" },
      message: { type: "string", description: "Mensagem inicial do usuário" }
    },
    handler: async (params) => {
      const banner = await cursor10xMemory.generateBanner();
      await cursor10xMemory.storeUserMessage(params.userId, params.message);
      const context = await cursor10xMemory.getComprehensiveContext(5);
      
      return {
        banner,
        userId: params.userId,
        context
      };
    }
  }
];

// Configuração para o XTP
export default {
  name: "cursor10x-mcp",
  description: "Sistema de memória persistente para assistentes AI usando MCP",
  version: "1.0.0",
  tools
};