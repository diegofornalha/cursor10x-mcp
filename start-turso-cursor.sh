#!/bin/bash

# Script wrapper para Turso MCP
# Garante que as variáveis de ambiente sejam carregadas corretamente

# Mudar para o diretório do script
cd "$(dirname "$0")"

# Carregar configuração híbrida se existir
if [ -f "env.hybrid" ]; then
    echo "Carregando configuração híbrida..." >&2
    source env.hybrid
elif [ -f ".env" ]; then
    echo "Carregando configuração .env..." >&2
    source .env
else
    echo "Nenhum arquivo de configuração encontrado" >&2
    exit 1
fi

# Definir variáveis de ambiente diretamente
export TURSO_DATABASE_URL
export TURSO_AUTH_TOKEN
export TURSO_LOCAL_URL
export TURSO_REMOTE_URL
export TURSO_LOCAL_AUTH_TOKEN
export TURSO_REMOTE_AUTH_TOKEN
export TURSO_MODE=${TURSO_MODE:-hybrid}
export TURSO_HYBRID_PRIORITY=${TURSO_HYBRID_PRIORITY:-local_first}

# Definir TURSO_DATABASE_URL baseado no modo
if [ "$TURSO_MODE" = "local" ] || [ "$TURSO_MODE" = "hybrid" ]; then
    export TURSO_DATABASE_URL="$TURSO_LOCAL_URL"
    export TURSO_AUTH_TOKEN="$TURSO_LOCAL_AUTH_TOKEN"
elif [ "$TURSO_MODE" = "remote" ]; then
    export TURSO_DATABASE_URL="$TURSO_REMOTE_URL"
    export TURSO_AUTH_TOKEN="$TURSO_REMOTE_AUTH_TOKEN"
fi

echo "DEBUG: TURSO_DATABASE_URL = $TURSO_DATABASE_URL" >&2
echo "DEBUG: TURSO_MODE = $TURSO_MODE" >&2
echo "DEBUG: TURSO_LOCAL_URL = $TURSO_LOCAL_URL" >&2
echo "DEBUG: TURSO_REMOTE_URL = $TURSO_REMOTE_URL" >&2
echo "DEBUG: Diretório = $(pwd)" >&2

# Verificar se o servidor Turso está rodando (se local)
if [[ "$TURSO_DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo "Verificando servidor Turso local..." >&2
    if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
        echo "Servidor Turso local não está rodando. Iniciando..." >&2
        turso dev &
        sleep 3
    fi
fi

# Iniciar o servidor MCP Turso
echo "Iniciando MCP Turso server..." >&2
exec node turso-mcp-server.js 