#!/bin/bash

# Script para testar o servidor Turso MCP
cd "$(dirname "$0")"

echo "🧪 Testando servidor Turso MCP para Claude Code..."
echo ""

# Configurar ambiente
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_LOCAL_URL="libsql://127.0.0.1:8080"
export TURSO_MODE="local"

# Testar com o servidor corrigido
echo "📝 Testando turso-mcp-claude.js..."

# Teste 1: Listar ferramentas
echo '{"jsonrpc":"2.0","method":"tools/list","id":1}' | node turso-mcp-claude.js | head -n 1 | jq '.'

echo ""
echo "✅ Se você viu a lista de ferramentas JSON acima, o servidor está funcionando!"
echo ""
echo "🚀 Para adicionar ao Claude Code, execute:"
echo "   ./add-turso-claude-final.sh"