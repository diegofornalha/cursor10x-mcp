#!/bin/bash

# Script de monitoramento para MCP Turso (Cursor)
# Uso: ./monitor-turso.sh

echo "📊 Monitor MCP Turso (Cursor)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Verificar se estamos no diretório correto
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Carregar configurações
if [ -f "env.hybrid" ]; then
    source env.hybrid
elif [ -f ".env" ]; then
    source .env
fi

# Função para verificar status do servidor local
check_local_server() {
    if curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Ativo${NC}"
        return 0
    else
        echo -e "${RED}❌ Inativo${NC}"
        return 1
    fi
}

# Função para verificar status do servidor remoto
check_remote_server() {
    if [ -n "$TURSO_REMOTE_URL" ] && [ -n "$TURSO_REMOTE_AUTH_TOKEN" ]; then
        # Tentar uma query simples
        if turso db shell "$TURSO_REMOTE_URL" "SELECT 1" --auth-token="$TURSO_REMOTE_AUTH_TOKEN" >/dev/null 2>&1; then
            echo -e "${GREEN}✅ Ativo${NC}"
            return 0
        else
            echo -e "${RED}❌ Inativo${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠️  Não configurado${NC}"
        return 1
    fi
}

# Função para contar tabelas
count_tables() {
    local url=$1
    local token=$2
    local count=0
    
    if [ -n "$url" ] && [ -n "$token" ]; then
        count=$(echo "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';" | \
                node -e "
                const Database = require('libsql');
                const db = new Database('$url', { authToken: '$token' });
                process.stdin.on('data', async (query) => {
                    try {
                        const result = await db.execute(query.toString().trim());
                        console.log(result.rows[0][0] || 0);
                    } catch (e) {
                        console.log(0);
                    }
                    process.exit();
                });
                " 2>/dev/null || echo "0")
    fi
    echo ${count:-0}
}

# Função para exibir estatísticas
show_stats() {
    clear
    echo -e "${BLUE}📊 MCP Turso Monitor (Cursor) - $(date)${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    # Status do servidor MCP
    echo -e "${BLUE}🔍 Status do Servidor MCP:${NC}"
    if pgrep -f "node turso-mcp-server.js" > /dev/null; then
        echo -e "  ${GREEN}✅ Servidor MCP: Ativo${NC}"
        PID=$(pgrep -f "node turso-mcp-server.js")
        echo -e "  ${BLUE}📝 PID: $PID${NC}"
    else
        echo -e "  ${RED}❌ Servidor MCP: Inativo${NC}"
    fi
    
    # Verificar configuração no Cursor
    if [ -f "../.cursor/mcp.json" ]; then
        if grep -q "cursor10x-mcp" "../.cursor/mcp.json"; then
            echo -e "  ${GREEN}✅ Configurado no Cursor${NC}"
        else
            echo -e "  ${YELLOW}⚠️  Não configurado no Cursor${NC}"
        fi
    fi
    echo ""
    
    # Modo de operação
    echo -e "${BLUE}⚙️  Modo de Operação:${NC}"
    echo -e "  Modo: ${PURPLE}$TURSO_MODE${NC}"
    if [ "$TURSO_MODE" = "hybrid" ]; then
        echo -e "  Prioridade: ${CYAN}$TURSO_HYBRID_PRIORITY${NC}"
        echo -e "  Sincronização: ${CYAN}${TURSO_SYNC_INTERVAL}s${NC}"
        echo -e "  Fallback: ${CYAN}${TURSO_FALLBACK_ENABLED}${NC}"
    fi
    echo ""
    
    # Status do Turso Local
    echo -e "${BLUE}🏠 Turso Local (127.0.0.1:8080):${NC}"
    echo -n "  Status: "
    local_status=$(check_local_server)
    echo "$local_status"
    
    if [[ "$local_status" == *"Ativo"* ]]; then
        local_tables=$(count_tables "$TURSO_LOCAL_URL" "$TURSO_LOCAL_AUTH_TOKEN")
        echo -e "  Tabelas: ${GREEN}$local_tables${NC}"
        
        # Verificar processo turso dev
        if pgrep -f "turso dev" > /dev/null; then
            TURSO_PID=$(pgrep -f "turso dev")
            echo -e "  ${BLUE}📝 Turso Dev PID: $TURSO_PID${NC}"
        fi
    fi
    echo ""
    
    # Status do Turso Remoto
    echo -e "${BLUE}☁️  Turso Remoto (aws-us-east-1):${NC}"
    echo -n "  Status: "
    remote_status=$(check_remote_server)
    echo "$remote_status"
    
    if [[ "$remote_status" == *"Ativo"* ]]; then
        remote_tables=$(count_tables "$TURSO_REMOTE_URL" "$TURSO_REMOTE_AUTH_TOKEN")
        echo -e "  Tabelas: ${GREEN}$remote_tables${NC}"
        echo -e "  URL: ${CYAN}${TURSO_REMOTE_URL##*/}${NC}"
    fi
    echo ""
    
    # Ferramentas disponíveis
    echo -e "${BLUE}🔧 Ferramentas MCP:${NC}"
    if [ -f "turso-mcp-server.js" ]; then
        # Contar ferramentas definidas no servidor
        TOOLS_COUNT=$(grep -c "name:" turso-mcp-server.js | head -1)
        echo -e "  Total: ${GREEN}~$TOOLS_COUNT ferramentas disponíveis${NC}"
        echo -e "  Prefixo: ${CYAN}mcp__turso__${NC}"
    fi
    echo ""
    
    # Configurações vetoriais
    echo -e "${BLUE}🔢 Configurações Vetoriais:${NC}"
    echo -e "  Dimensões: ${CYAN}$VECTOR_DIMENSIONS${NC}"
    echo -e "  Vacuum: ${CYAN}$VECTOR_VACUUM${NC}"
    echo ""
    
    # Uso de memória
    if [ -n "$PID" ]; then
        echo -e "${BLUE}💾 Uso de Recursos:${NC}"
        MEM_USAGE=$(ps -p $PID -o %mem= 2>/dev/null | xargs)
        CPU_USAGE=$(ps -p $PID -o %cpu= 2>/dev/null | xargs)
        echo -e "  CPU: ${GREEN}${CPU_USAGE}%${NC}"
        echo -e "  Memória: ${GREEN}${MEM_USAGE}%${NC}"
        echo ""
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${YELLOW}Pressione Ctrl+C para sair | Atualização a cada 30s${NC}"
}

# Função para testar conexão
test_connection() {
    echo ""
    echo -e "${BLUE}🧪 Testando conexões...${NC}"
    
    # Teste local
    echo -n "  Local: "
    if [ "$TURSO_MODE" = "local" ] || [ "$TURSO_MODE" = "hybrid" ]; then
        echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
        TURSO_DATABASE_URL="$TURSO_LOCAL_URL" TURSO_AUTH_TOKEN="$TURSO_LOCAL_AUTH_TOKEN" \
        node turso-mcp-server.js 2>/dev/null | grep -q "tools" && \
        echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ Falhou${NC}"
    else
        echo -e "${YELLOW}Desabilitado${NC}"
    fi
    
    # Teste remoto
    echo -n "  Remoto: "
    if [ "$TURSO_MODE" = "remote" ] || [ "$TURSO_MODE" = "hybrid" ]; then
        echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
        TURSO_DATABASE_URL="$TURSO_REMOTE_URL" TURSO_AUTH_TOKEN="$TURSO_REMOTE_AUTH_TOKEN" \
        node turso-mcp-server.js 2>/dev/null | grep -q "tools" && \
        echo -e "${GREEN}✅ OK${NC}" || echo -e "${RED}❌ Falhou${NC}"
    else
        echo -e "${YELLOW}Desabilitado${NC}"
    fi
}

# Loop de monitoramento
echo -e "${BLUE}Iniciando monitoramento...${NC}"
test_connection

while true; do
    show_stats
    sleep 30
done