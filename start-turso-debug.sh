#!/bin/bash

# Script de debug para MCP Turso
cd "$(dirname "$0")"

# Configurar ambiente
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_LOCAL_URL="libsql://127.0.0.1:8080"
export TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDczNDY1MzksImlkIjoiNDc4ZDI2ODYtYTEyZS00NmU3LWI3ZTAtZDBjZTljNjNmNDA1IiwicmlkIjoiZjY5OWI1YTYtY2VjYi00ODhkLTkwN2QtOGY4MWFmZmFmMGU4In0._cYEfLVtROFlfKkjfiRMsBt12tvKPTvrLfDdEwtOj86PDqPwkIujWoHke7HbraJieqFvAcuiOwbk0BTEswSQAw"
export TURSO_LOCAL_AUTH_TOKEN="$TURSO_AUTH_TOKEN"
export TURSO_MODE="local"

# Log para debug
echo "Starting Turso MCP Server..." >&2
echo "URL: $TURSO_DATABASE_URL" >&2
echo "Mode: $TURSO_MODE" >&2
echo "Directory: $(pwd)" >&2

# Verificar se o servidor está instalado
if [ ! -f "turso-mcp-server.js" ]; then
    echo "ERROR: turso-mcp-server.js not found!" >&2
    exit 1
fi

# Verificar servidor local
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    echo "Local server not running, starting turso dev..." >&2
    turso dev &
    sleep 3
fi

# Iniciar com log de erros
exec node turso-mcp-server.js 2>&1