#!/bin/bash

# Script para adicionar MCP Turso ao Claude Code
# Uso: ./add-turso-to-claude-code.sh

echo "🚀 Adicionando MCP Turso ao Claude Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env não encontrado. Criando com configurações padrão...${NC}"
    cat > .env << 'EOF'
# Configuração para modo híbrido (local + remoto)
TURSO_MODE=hybrid

# Configuração local
TURSO_LOCAL_URL=libsql://127.0.0.1:8080
TURSO_LOCAL_AUTH_TOKEN=eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDczNDY1MzksImlkIjoiNDc4ZDI2ODYtYTEyZS00NmU3LWI3ZTAtZDBjZTljNjNmNDA1IiwicmlkIjoiZjY5OWI1YTYtY2VjYi00ODhkLTkwN2QtOGY4MWFmZmFmMGU4In0._cYEfLVtROFlfKkjfiRMsBt12tvKPTvrLfDdEwtOj86PDqPwkIujWoHke7HbraJieqFvAcuiOwbk0BTEswSQAw

# Configuração remota (adicione suas credenciais)
TURSO_REMOTE_URL=
TURSO_REMOTE_AUTH_TOKEN=

# URL padrão (começar com local)
TURSO_DATABASE_URL=libsql://127.0.0.1:8080
EOF
    echo -e "${GREEN}✅ Arquivo .env criado${NC}"
fi

# Verificar se o servidor Turso local está rodando
echo -e "${BLUE}🔍 Verificando servidor Turso local...${NC}"
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Servidor Turso local não está rodando.${NC}"
    echo -e "${BLUE}🚀 Iniciando turso dev...${NC}"
    turso dev &
    sleep 3
    if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
        echo -e "${RED}❌ Não foi possível iniciar o servidor Turso local.${NC}"
        echo -e "${YELLOW}   Execute 'turso dev' manualmente em outro terminal.${NC}"
    else
        echo -e "${GREEN}✅ Servidor Turso local iniciado${NC}"
    fi
else
    echo -e "${GREEN}✅ Servidor Turso local está rodando${NC}"
fi

# Verificar se o servidor MCP existe
if [ ! -f "turso-mcp-clean.js" ]; then
    echo -e "${RED}❌ Arquivo turso-mcp-clean.js não encontrado!${NC}"
    echo -e "${YELLOW}   Execute os scripts de setup primeiro.${NC}"
    exit 1
fi

# Verificar se o script de inicialização existe
if [ ! -f "start-turso-claude-final.sh" ]; then
    echo -e "${RED}❌ Arquivo start-turso-claude-final.sh não encontrado!${NC}"
    echo -e "${YELLOW}   Execute os scripts de setup primeiro.${NC}"
    exit 1
fi

# Tornar scripts executáveis
chmod +x start-turso-claude-final.sh turso-mcp-clean.js

# Remover servidor existente se houver
echo -e "${BLUE}🔄 Verificando configuração existente...${NC}"
claude mcp remove mcp-turso 2>/dev/null

# Adicionar o servidor MCP
echo -e "${BLUE}📍 Adicionando servidor MCP...${NC}"
FULL_PATH="$SCRIPT_DIR/start-turso-claude-final.sh"
claude mcp add mcp-turso bash "$FULL_PATH"

# Verificar se foi adicionado com sucesso
echo ""
echo -e "${BLUE}🔍 Verificando status...${NC}"
claude mcp get mcp-turso

# Mostrar status geral
echo ""
echo -e "${BLUE}📊 Status dos servidores MCP:${NC}"
claude mcp list

echo ""
echo -e "${GREEN}✅ MCP Turso adicionado com sucesso!${NC}"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${BLUE}📚 Ferramentas disponíveis:${NC}"
echo "  • mcp__mcp-turso__turso_execute_query - Executa queries SQL"
echo "  • mcp__mcp-turso__turso_execute_batch - Executa múltiplas queries"
echo "  • mcp__mcp-turso__turso_list_tables - Lista tabelas"
echo "  • mcp__mcp-turso__turso_describe_table - Descreve estrutura"
echo "  • mcp__mcp-turso__turso_create_table - Cria tabelas"
echo "  • mcp__mcp-turso__turso_drop_table - Remove tabelas"
echo "  • mcp__mcp-turso__turso_insert_data - Insere dados"
echo "  • mcp__mcp-turso__turso_update_data - Atualiza dados"
echo "  • mcp__mcp-turso__turso_delete_data - Remove dados"
echo "  • mcp__mcp-turso__turso_search_data - Busca full-text"
echo "  • mcp__mcp-turso__turso_get_database_info - Info do banco"
echo "  • mcp__mcp-turso__turso_optimize_database - Otimiza banco"
echo ""
echo -e "${BLUE}💡 Como usar:${NC}"
echo '  No Claude Code, peça: "Use a ferramenta mcp__mcp-turso__turso_list_tables"'
echo ""
echo -e "${YELLOW}⚠️  Configuração:${NC}"
echo "  Modo: ${TURSO_MODE:-local}"
echo "  URL Local: 127.0.0.1:8080"
if [ -n "$TURSO_REMOTE_URL" ]; then
    echo "  URL Remota: Configurada"
fi
echo ""
echo -e "${GREEN}Para monitorar: ./monitor-turso-claude.sh${NC}"
echo -e "${GREEN}Para remover: ./remove-turso-from-claude-code.sh${NC}"