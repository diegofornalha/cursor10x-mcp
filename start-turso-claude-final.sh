#!/bin/bash

# Script final para MCP Turso no Claude Code
cd "$(dirname "$0")"

# Configurar ambiente para modo local
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_LOCAL_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Executar servidor sem enviar nada para stderr
exec node turso-mcp-claude.js 2>/dev/null