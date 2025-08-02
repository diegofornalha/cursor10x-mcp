#!/bin/bash
cd "$(dirname "$0")"
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_LOCAL_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Verificar se o Turso local está rodando
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    turso dev >/dev/null 2>&1 &
    sleep 2
fi

exec node turso-mcp-clean.js 2>/dev/null