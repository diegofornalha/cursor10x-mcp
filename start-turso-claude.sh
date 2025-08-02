#!/bin/bash

# Script wrapper para Turso MCP no Claude Code
# Garante que as variáveis de ambiente sejam carregadas corretamente

cd "$(dirname "$0")"

# Carregar configurações
if [ -f "env.hybrid" ]; then
    echo "Carregando configuração híbrida..." >&2
    set -a
    source env.hybrid
    set +a
elif [ -f ".env" ]; then
    echo "Carregando configuração .env..." >&2
    set -a
    source .env
    set +a
else
    echo "Nenhum arquivo de configuração encontrado" >&2
    exit 1
fi

# Exportar variáveis necessárias
export TURSO_DATABASE_URL
export TURSO_AUTH_TOKEN
export TURSO_LOCAL_URL
export TURSO_REMOTE_URL
export TURSO_LOCAL_AUTH_TOKEN
export TURSO_REMOTE_AUTH_TOKEN
export TURSO_MODE=${TURSO_MODE:-hybrid}
export TURSO_HYBRID_PRIORITY=${TURSO_HYBRID_PRIORITY:-local_first}

# Define TURSO_DATABASE_URL based on mode
if [ "$TURSO_MODE" = "local" ] || [ "$TURSO_MODE" = "hybrid" ]; then
    export TURSO_DATABASE_URL="$TURSO_LOCAL_URL"
    export TURSO_AUTH_TOKEN="$TURSO_LOCAL_AUTH_TOKEN"
elif [ "$TURSO_MODE" = "remote" ]; then
    export TURSO_DATABASE_URL="$TURSO_REMOTE_URL"
    export TURSO_AUTH_TOKEN="$TURSO_REMOTE_AUTH_TOKEN"
fi

echo "DEBUG: TURSO_DATABASE_URL = $TURSO_DATABASE_URL" >&2
echo "DEBUG: TURSO_MODE = $TURSO_MODE" >&2

# Verificar servidor local se necessário
if [[ "$TURSO_DATABASE_URL" == *"127.0.0.1"* ]]; then
    echo "Verificando servidor Turso local..." >&2
    if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
        echo "Servidor Turso local não está rodando. Iniciando..." >&2
        turso dev &
        sleep 3
    fi
fi

echo "Iniciando MCP Turso server..." >&2
exec node turso-mcp-server.js