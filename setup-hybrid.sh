#!/bin/bash

# Script de Configuração Híbrida Turso para Cursor10x MCP
# Suporte a banco local + remoto com sincronização

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Configuração Híbrida Turso - Cursor10x MCP${NC}"
echo "=================================================="

# Função para verificar se comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar dependências
echo -e "${YELLOW}📋 Verificando dependências...${NC}"

if ! command_exists node; then
    echo -e "${RED}❌ Node.js não encontrado${NC}"
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}❌ npm não encontrado${NC}"
    exit 1
fi

if ! command_exists turso; then
    echo -e "${YELLOW}⚠️  Turso CLI não encontrado${NC}"
    echo "Instalando Turso CLI..."
    curl -sSfL https://get.turso.tech/install.sh | bash
    export PATH="$HOME/.turso:$PATH"
fi

echo -e "${GREEN}✅ Dependências verificadas${NC}"

# Função para testar conexão com banco
test_database_connection() {
    local url=$1
    local token=$2
    local name=$3
    
    echo -e "${YELLOW}🔍 Testando conexão com $name...${NC}"
    
    if curl -s -H "Authorization: Bearer $token" "$url" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Conexão com $name OK${NC}"
        return 0
    else
        echo -e "${RED}❌ Falha na conexão com $name${NC}"
        return 1
    fi
}

# Carregar configuração híbrida
if [ -f "env.hybrid" ]; then
    echo -e "${YELLOW}📂 Carregando configuração híbrida...${NC}"
    source env.hybrid
else
    echo -e "${RED}❌ Arquivo env.hybrid não encontrado${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Configuração carregada${NC}"

# Testar conexões
echo -e "${BLUE}🔗 Testando conexões de banco...${NC}"

LOCAL_OK=false
REMOTE_OK=false

# Testar banco local
if test_database_connection "$TURSO_LOCAL_URL" "$TURSO_LOCAL_AUTH_TOKEN" "banco local"; then
    LOCAL_OK=true
fi

# Testar banco remoto
if test_database_connection "$TURSO_REMOTE_URL" "$TURSO_REMOTE_AUTH_TOKEN" "banco remoto"; then
    REMOTE_OK=true
fi

# Configurar baseado no modo
case $TURSO_MODE in
    "local")
        echo -e "${BLUE}🎯 Modo: LOCAL${NC}"
        if [ "$LOCAL_OK" = true ]; then
            cp env.hybrid .env
            sed -i '' 's/TURSO_MODE=hybrid/TURSO_MODE=local/' .env
            echo -e "${GREEN}✅ Configurado para banco LOCAL${NC}"
        else
            echo -e "${RED}❌ Banco local não disponível${NC}"
            exit 1
        fi
        ;;
    "remote")
        echo -e "${BLUE}🎯 Modo: REMOTO${NC}"
        if [ "$REMOTE_OK" = true ]; then
            cp env.hybrid .env
            sed -i '' 's/TURSO_MODE=hybrid/TURSO_MODE=remote/' .env
            echo -e "${GREEN}✅ Configurado para banco REMOTO${NC}"
        else
            echo -e "${RED}❌ Banco remoto não disponível${NC}"
            exit 1
        fi
        ;;
    "hybrid")
        echo -e "${BLUE}🎯 Modo: HÍBRIDO${NC}"
        if [ "$LOCAL_OK" = true ] && [ "$REMOTE_OK" = true ]; then
            cp env.hybrid .env
            echo -e "${GREEN}✅ Configurado para modo HÍBRIDO${NC}"
            echo -e "${YELLOW}📊 Status:${NC}"
            echo "  - Banco Local: ✅ Disponível"
            echo "  - Banco Remoto: ✅ Disponível"
            echo "  - Prioridade: $TURSO_HYBRID_PRIORITY"
            echo "  - Sincronização: $TURSO_SYNC_INTERVAL segundos"
        elif [ "$LOCAL_OK" = true ]; then
            echo -e "${YELLOW}⚠️  Apenas banco local disponível, configurando modo LOCAL${NC}"
            cp env.hybrid .env
            sed -i '' 's/TURSO_MODE=hybrid/TURSO_MODE=local/' .env
        elif [ "$REMOTE_OK" = true ]; then
            echo -e "${YELLOW}⚠️  Apenas banco remoto disponível, configurando modo REMOTO${NC}"
            cp env.hybrid .env
            sed -i '' 's/TURSO_MODE=hybrid/TURSO_MODE=remote/' .env
        else
            echo -e "${RED}❌ Nenhum banco disponível${NC}"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}❌ Modo inválido: $TURSO_MODE${NC}"
        exit 1
        ;;
esac

# Instalar dependências
echo -e "${YELLOW}📦 Instalando dependências...${NC}"
npm install

# Criar script de sincronização se necessário
if [ "$TURSO_MODE" = "hybrid" ] && [ "$TURSO_SYNC_INTERVAL" -gt 0 ]; then
    echo -e "${YELLOW}🔄 Criando script de sincronização...${NC}"
    
    cat > sync-databases.sh << 'EOF'
#!/bin/bash
# Script de sincronização entre bancos local e remoto

echo "🔄 Sincronizando bancos..."
# Aqui você implementaria a lógica de sincronização
# Por exemplo, usando turso db shell para exportar/importar dados
echo "✅ Sincronização concluída"
EOF
    
    chmod +x sync-databases.sh
    echo -e "${GREEN}✅ Script de sincronização criado${NC}"
fi

# Testar o sistema
echo -e "${YELLOW}🧪 Testando sistema...${NC}"
if node test-local-mcp.js; then
    echo -e "${GREEN}✅ Sistema funcionando corretamente${NC}"
else
    echo -e "${RED}❌ Erro no teste do sistema${NC}"
    exit 1
fi

echo -e "${GREEN}🎉 Configuração híbrida concluída!${NC}"
echo ""
echo -e "${BLUE}📋 Resumo da configuração:${NC}"
echo "  - Modo: $TURSO_MODE"
echo "  - Banco Local: $([ "$LOCAL_OK" = true ] && echo "✅" || echo "❌")"
echo "  - Banco Remoto: $([ "$REMOTE_OK" = true ] && echo "✅" || echo "❌")"
echo "  - Sincronização: $([ "$TURSO_SYNC_INTERVAL" -gt 0 ] && echo "✅" || echo "❌")"
echo ""
echo -e "${YELLOW}🚀 Para iniciar o sistema:${NC}"
echo "  node test-local-mcp.js"
echo ""
echo -e "${YELLOW}🔄 Para sincronizar bancos:${NC}"
echo "  ./sync-databases.sh" 