#!/bin/bash

# Script para adicionar MCP Turso ao Cursor
# Uso: ./add-to-cursor.sh

echo "🚀 Adicionando MCP Turso ao Cursor"
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

# Criar diretório .cursor se não existir
CURSOR_DIR="../.cursor"
if [ ! -d "$CURSOR_DIR" ]; then
    echo -e "${BLUE}📁 Criando diretório .cursor...${NC}"
    mkdir -p "$CURSOR_DIR"
fi

# Fazer backup do mcp.json se existir
if [ -f "$CURSOR_DIR/mcp.json" ]; then
    echo -e "${BLUE}💾 Fazendo backup do mcp.json existente...${NC}"
    cp "$CURSOR_DIR/mcp.json" "$CURSOR_DIR/mcp.json.backup.$(date +%Y%m%d-%H%M%S)"
fi

# Criar ou atualizar mcp.json
echo -e "${BLUE}📝 Configurando mcp.json...${NC}"

# Se o arquivo existe, precisamos fazer merge
if [ -f "$CURSOR_DIR/mcp.json" ]; then
    # Usar jq para fazer merge mantendo outras configurações
    if command -v jq &> /dev/null; then
        jq '.mcpServers.turso = {
            "type": "stdio",
            "command": "/Users/agents/Desktop/context-engineering-intro/cursor10x-mcp/start-turso-cursor.sh",
            "args": []
        }' "$CURSOR_DIR/mcp.json" > "$CURSOR_DIR/mcp.json.tmp" && \
        mv "$CURSOR_DIR/mcp.json.tmp" "$CURSOR_DIR/mcp.json"
    else
        # Fallback manual se jq não estiver disponível
        echo -e "${YELLOW}⚠️  jq não encontrado. Criando configuração manual...${NC}"
        cat > "$CURSOR_DIR/mcp.json" << EOF
{
  "mcpServers": {
    "turso": {
      "type": "stdio",
      "command": "/Users/agents/Desktop/context-engineering-intro/cursor10x-mcp/start-turso-cursor.sh",
      "args": []
    }
  }
}
EOF
    fi
else
    # Criar novo arquivo
    cat > "$CURSOR_DIR/mcp.json" << EOF
{
  "mcpServers": {
    "turso": {
      "type": "stdio",
      "command": "/Users/agents/Desktop/context-engineering-intro/cursor10x-mcp/start-turso-cursor.sh",
      "args": []
    }
  }
}
EOF
fi

echo -e "${GREEN}✅ Configuração salva em $CURSOR_DIR/mcp.json${NC}"

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

# Verificar configuração
echo ""
echo -e "${BLUE}📊 Configuração atual:${NC}"
if command -v jq &> /dev/null; then
    jq '.mcpServers.turso' "$CURSOR_DIR/mcp.json" 2>/dev/null
else
    grep -A3 "turso" "$CURSOR_DIR/mcp.json"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 MCP Turso adicionado ao Cursor com sucesso!${NC}"
echo ""
echo -e "${BLUE}📚 Próximos passos:${NC}"
echo "  1. Reinicie o Cursor para carregar o MCP"
echo "  2. Verifique se o MCP aparece no Cursor"
echo "  3. Use as ferramentas com o prefixo mcp__turso__"
echo ""
echo -e "${BLUE}🧪 Para testar:${NC}"
echo "  ./test-turso.sh"
echo ""
echo -e "${BLUE}📊 Para monitorar:${NC}"
echo "  ./monitor-turso.sh"
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