#!/bin/bash
cd "$(dirname "$0")"

# Verificar servidor Turso local
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    turso dev >/dev/null 2>&1 &
    sleep 2
fi

# Configurar variáveis
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Executar servidor
exec node turso-mcp-stdio.js