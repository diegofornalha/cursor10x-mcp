#!/bin/bash

# MCP Turso Server - Versão otimizada para Claude Code
# Similar ao Sentry MCP que funciona corretamente

cd "$(dirname "$0")"

# Configurar variáveis de ambiente
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Verificar se o servidor Turso local está rodando
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    turso dev >/dev/null 2>&1 &
    sleep 2
fi

# Iniciar servidor MCP no modo stdio
exec node turso-mcp-final.js