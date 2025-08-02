#!/bin/bash

# Script para MCP Turso no Claude Code
cd "$(dirname "$0")"

# Configurar ambiente mínimo
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_LOCAL_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Não enviar logs para stderr
exec node turso-mcp-server.js 2>/dev/null