#!/bin/bash

# Script para adicionar MCP Turso ao Claude Code
# Uso: ./add-to-claude-code.sh

echo "🚀 Adicionando MCP Turso ao Claude Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
NC='\033[0m'

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Verificar dependências
echo -e "${BLUE}📦 Verificando dependências...${NC}"

# Verificar se o node está instalado
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js não está instalado${NC}"
    exit 1
fi

# Verificar se o arquivo do servidor existe
if [ ! -f "turso-mcp-server.js" ]; then
    echo -e "${RED}❌ turso-mcp-server.js não encontrado${NC}"
    exit 1
fi

# Verificar se turso CLI está instalado
if ! command -v turso &> /dev/null; then
    echo -e "${YELLOW}⚠️  Turso CLI não está instalado${NC}"
    echo "  Instale com: curl -sSfL https://get.tur.so/install.sh | bash"
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}📦 Instalando dependências...${NC}"
    npm install
fi

# Adicionar ao Claude Code
echo -e "${BLUE}📝 Adicionando ao Claude Code...${NC}"

# Usar o caminho completo do script
FULL_PATH="$SCRIPT_DIR/start-turso-claude.sh"

# Adicionar usando Claude CLI
claude mcp add turso "$FULL_PATH"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MCP Turso adicionado com sucesso!${NC}"
else
    echo -e "${RED}❌ Erro ao adicionar MCP${NC}"
    exit 1
fi

# Verificar modo de operação
if [ -f "env.hybrid" ]; then
    source env.hybrid
    echo ""
    echo -e "${PURPLE}⚙️  Modo de Operação: $TURSO_MODE${NC}"
    if [ "$TURSO_MODE" = "hybrid" ]; then
        echo -e "  • Local: ${TURSO_LOCAL_URL}"
        echo -e "  • Remoto: ${TURSO_REMOTE_URL##*/}"
        echo -e "  • Prioridade: $TURSO_HYBRID_PRIORITY"
    fi
fi

# Verificar servidor local
if [ "$TURSO_MODE" = "local" ] || [ "$TURSO_MODE" = "hybrid" ]; then
    echo ""
    echo -e "${BLUE}🏠 Verificando servidor Turso local...${NC}"
    if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Servidor local não está rodando${NC}"
        echo "  Execute: turso dev"
    else
        echo -e "${GREEN}✅ Servidor local está ativo${NC}"
    fi
fi

# Verificar status
echo ""
echo -e "${BLUE}📊 Verificando status...${NC}"
claude mcp list | grep turso

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 MCP Turso configurado para Claude Code!${NC}"
echo ""
echo -e "${BLUE}📚 Próximos passos:${NC}"
echo "  1. O MCP já está disponível no Claude Code"
echo "  2. Use as ferramentas com o prefixo mcp__turso__"
echo ""
echo -e "${BLUE}🧪 Para testar:${NC}"
echo "  ./test-turso-claude.sh"
echo ""
echo -e "${BLUE}📊 Para monitorar:${NC}"
echo "  ./monitor-turso-claude.sh"
echo ""
echo -e "${YELLOW}💡 Ferramentas disponíveis:${NC}"
echo "  • mcp__turso__execute_query - Executa SQL"
echo "  • mcp__turso__create_table - Cria tabelas"
echo "  • mcp__turso__insert_data - Insere dados"
echo "  • mcp__turso__select_data - Consulta dados"
echo "  • mcp__turso__update_data - Atualiza dados"
echo "  • mcp__turso__delete_data - Deleta dados"
echo "  • mcp__turso__list_tables - Lista tabelas"
echo "  • mcp__turso__describe_table - Descreve estrutura"
echo "  • E mais..."