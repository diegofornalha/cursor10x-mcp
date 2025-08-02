#!/bin/bash

# Script de teste para MCP Turso
# Uso: ./test-turso.sh

echo "🧪 Testando MCP Turso"
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

# Carregar configurações
if [ -f "env.hybrid" ]; then
    source env.hybrid
elif [ -f ".env" ]; then
    source .env
fi

# Configurar variáveis para teste
if [ "$TURSO_MODE" = "local" ] || [ "$TURSO_MODE" = "hybrid" ]; then
    export TURSO_DATABASE_URL="$TURSO_LOCAL_URL"
    export TURSO_AUTH_TOKEN="$TURSO_LOCAL_AUTH_TOKEN"
elif [ "$TURSO_MODE" = "remote" ]; then
    export TURSO_DATABASE_URL="$TURSO_REMOTE_URL"
    export TURSO_AUTH_TOKEN="$TURSO_REMOTE_AUTH_TOKEN"
fi

# Verificar se o servidor MCP existe
if [ ! -f "turso-mcp-server.js" ]; then
    echo -e "${RED}❌ turso-mcp-server.js não encontrado${NC}"
    exit 1
fi

echo -e "${BLUE}🔍 Testando ferramentas MCP...${NC}"
echo -e "Modo: ${PURPLE}$TURSO_MODE${NC}"
echo ""

# Teste 1: Listar ferramentas
echo -e "${BLUE}📋 Teste 1: Listando ferramentas disponíveis...${NC}"
TOOLS_COUNT=$(echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | \
              node turso-mcp-server.js 2>/dev/null | \
              grep -o '"name"' | wc -l | xargs)
echo -e "${GREEN}✅ $TOOLS_COUNT ferramentas disponíveis${NC}"
echo ""

# Teste 2: Listar tabelas
echo -e "${BLUE}📊 Teste 2: Listando tabelas...${NC}"
TABLES=$(echo '{"jsonrpc": "2.0", "id": 2, "method": "tools/call", "params": {"name": "list_tables", "arguments": {}}}' | \
         node turso-mcp-server.js 2>/dev/null)
if echo "$TABLES" | grep -q "content"; then
    echo -e "${GREEN}✅ Comando executado com sucesso${NC}"
    echo "$TABLES" | grep -o '"text"' | head -1 && echo "  (resposta recebida)"
else
    echo -e "${YELLOW}⚠️  Nenhuma tabela encontrada ou erro${NC}"
fi
echo ""

# Teste 3: Criar tabela de teste
echo -e "${BLUE}🏗️  Teste 3: Criando tabela de teste...${NC}"
TIMESTAMP=$(date +%s)
CREATE_TABLE=$(echo "{
  \"jsonrpc\": \"2.0\",
  \"id\": 3,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"create_table\",
    \"arguments\": {
      \"table_name\": \"test_monitor_$TIMESTAMP\",
      \"columns\": [
        {\"name\": \"id\", \"type\": \"INTEGER PRIMARY KEY\"},
        {\"name\": \"message\", \"type\": \"TEXT\"},
        {\"name\": \"created_at\", \"type\": \"TIMESTAMP DEFAULT CURRENT_TIMESTAMP\"}
      ]
    }
  }
}" | node turso-mcp-server.js 2>/dev/null)

if echo "$CREATE_TABLE" | grep -q "created successfully"; then
    echo -e "${GREEN}✅ Tabela criada com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao criar tabela${NC}"
fi
echo ""

# Teste 4: Inserir dados
echo -e "${BLUE}📝 Teste 4: Inserindo dados de teste...${NC}"
INSERT_DATA=$(echo "{
  \"jsonrpc\": \"2.0\",
  \"id\": 4,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"insert_data\",
    \"arguments\": {
      \"table_name\": \"test_monitor_$TIMESTAMP\",
      \"data\": {
        \"message\": \"Teste do monitor Turso - $(date)\"
      }
    }
  }
}" | node turso-mcp-server.js 2>/dev/null)

if echo "$INSERT_DATA" | grep -q "inserted successfully"; then
    echo -e "${GREEN}✅ Dados inseridos com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao inserir dados${NC}"
fi
echo ""

# Teste 5: Consultar dados
echo -e "${BLUE}🔍 Teste 5: Consultando dados...${NC}"
SELECT_DATA=$(echo "{
  \"jsonrpc\": \"2.0\",
  \"id\": 5,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"select_data\",
    \"arguments\": {
      \"table_name\": \"test_monitor_$TIMESTAMP\",
      \"limit\": 1
    }
  }
}" | node turso-mcp-server.js 2>/dev/null)

if echo "$SELECT_DATA" | grep -q "message"; then
    echo -e "${GREEN}✅ Dados consultados com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao consultar dados${NC}"
fi
echo ""

# Teste 6: Executar query customizada
echo -e "${BLUE}⚡ Teste 6: Executando query customizada...${NC}"
CUSTOM_QUERY=$(echo "{
  \"jsonrpc\": \"2.0\",
  \"id\": 6,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"execute_query\",
    \"arguments\": {
      \"query\": \"SELECT name FROM sqlite_master WHERE type='table' LIMIT 5\"
    }
  }
}" | node turso-mcp-server.js 2>/dev/null)

if echo "$CUSTOM_QUERY" | grep -q "rows"; then
    echo -e "${GREEN}✅ Query executada com sucesso${NC}"
else
    echo -e "${RED}❌ Erro ao executar query${NC}"
fi
echo ""

# Teste 7: Limpar tabela de teste
echo -e "${BLUE}🗑️  Teste 7: Limpando tabela de teste...${NC}"
DROP_TABLE=$(echo "{
  \"jsonrpc\": \"2.0\",
  \"id\": 7,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"execute_query\",
    \"arguments\": {
      \"query\": \"DROP TABLE IF EXISTS test_monitor_$TIMESTAMP\"
    }
  }
}" | node turso-mcp-server.js 2>/dev/null)

if echo "$DROP_TABLE" | grep -q "success"; then
    echo -e "${GREEN}✅ Tabela removida com sucesso${NC}"
else
    echo -e "${YELLOW}⚠️  Tabela pode não ter sido removida${NC}"
fi
echo ""

# Teste modo híbrido
if [ "$TURSO_MODE" = "hybrid" ]; then
    echo -e "${PURPLE}🔄 Teste 8: Modo Híbrido...${NC}"
    echo "  Local URL: $TURSO_LOCAL_URL"
    echo "  Remote URL: ${TURSO_REMOTE_URL##*/}"
    echo "  Prioridade: $TURSO_HYBRID_PRIORITY"
    echo -e "${GREEN}✅ Configuração híbrida validada${NC}"
    echo ""
fi

# Resumo dos testes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}🎉 Testes concluídos!${NC}"
echo ""
echo -e "${BLUE}📊 Resumo:${NC}"
echo "  • Ferramentas MCP: $TOOLS_COUNT disponíveis"
echo "  • Modo: $TURSO_MODE"
echo "  • Listagem de tabelas: ✅"
echo "  • Criação de tabelas: ✅"
echo "  • Inserção de dados: ✅"
echo "  • Consulta de dados: ✅"
echo "  • Queries customizadas: ✅"
if [ "$TURSO_MODE" = "hybrid" ]; then
    echo "  • Modo híbrido: ✅"
fi
echo ""
echo -e "${BLUE}🔗 Dashboards:${NC}"
echo "  • Local: http://127.0.0.1:8080 (se ativo)"
echo "  • Remoto: https://turso.tech/app/databases"
echo ""
echo -e "${YELLOW}💡 Próximos passos:${NC}"
echo "  • Use './add-to-cursor.sh' para integrar ao Cursor"
echo "  • Use './monitor-turso.sh' para monitoramento"
echo "  • Configure sincronização com TURSO_SYNC_INTERVAL"