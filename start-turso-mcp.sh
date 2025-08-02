#!/bin/bash

# Script de inicialização para MCP Turso
# Configura e inicia o servidor MCP para Turso

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Iniciando MCP Turso Server${NC}"
echo "=================================="

# Mudar para o diretório do script
cd "$(dirname "$0")"

# Carregar configuração híbrida se existir
if [ -f "env.hybrid" ]; then
    echo -e "${YELLOW}📂 Carregando configuração híbrida...${NC}"
    source env.hybrid
    echo -e "${GREEN}✅ Configuração carregada${NC}"
elif [ -f ".env" ]; then
    echo -e "${YELLOW}📂 Carregando configuração .env...${NC}"
    source .env
    echo -e "${GREEN}✅ Configuração carregada${NC}"
else
    echo -e "${RED}❌ Nenhum arquivo de configuração encontrado${NC}"
    echo "Crie um arquivo .env ou env.hybrid com as configurações do Turso"
    exit 1
fi

# Verificar se as variáveis necessárias estão definidas
if [ -z "$TURSO_LOCAL_URL" ] && [ -z "$TURSO_REMOTE_URL" ]; then
    echo -e "${RED}❌ TURSO_LOCAL_URL ou TURSO_REMOTE_URL não definidos${NC}"
    exit 1
fi

if [ -z "$TURSO_LOCAL_AUTH_TOKEN" ] && [ -z "$TURSO_REMOTE_AUTH_TOKEN" ]; then
    echo -e "${RED}❌ TURSO_LOCAL_AUTH_TOKEN ou TURSO_REMOTE_AUTH_TOKEN não definidos${NC}"
    exit 1
fi

# Definir variáveis de ambiente para o MCP
export TURSO_LOCAL_URL
export TURSO_REMOTE_URL
export TURSO_LOCAL_AUTH_TOKEN
export TURSO_REMOTE_AUTH_TOKEN
export TURSO_MODE=${TURSO_MODE:-hybrid}
export TURSO_HYBRID_PRIORITY=${TURSO_HYBRID_PRIORITY:-local_first}

echo -e "${YELLOW}🔧 Configuração do Turso:${NC}"
echo "  - Modo: $TURSO_MODE"
echo "  - Prioridade: $TURSO_HYBRID_PRIORITY"
echo "  - Local URL: ${TURSO_LOCAL_URL:-'não configurado'}"
echo "  - Remote URL: ${TURSO_REMOTE_URL:-'não configurado'}"

# Verificar se o projeto foi compilado
if [ ! -d "dist" ]; then
    echo -e "${YELLOW}🔨 Compilando projeto...${NC}"
    npm run build
    echo -e "${GREEN}✅ Projeto compilado${NC}"
fi

# Verificar se o arquivo compilado existe
if [ ! -f "dist/plugin.wasm" ]; then
    echo -e "${YELLOW}🔨 Compilando plugin WASM...${NC}"
    npm run build
    echo -e "${GREEN}✅ Plugin WASM compilado${NC}"
fi

echo -e "${GREEN}🚀 Iniciando servidor MCP Turso...${NC}"
echo -e "${YELLOW}📋 Ferramentas disponíveis:${NC}"
echo "  - turso_execute_query"
echo "  - turso_execute_batch"
echo "  - turso_list_tables"
echo "  - turso_describe_table"
echo "  - turso_backup_database"
echo "  - turso_restore_database"
echo "  - turso_get_database_info"
echo "  - turso_optimize_database"
echo "  - turso_create_table"
echo "  - turso_drop_table"
echo "  - turso_insert_data"
echo "  - turso_update_data"
echo "  - turso_delete_data"
echo "  - turso_search_data"
echo ""

# Iniciar o servidor MCP
exec node turso-mcp-server.js 