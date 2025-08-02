#!/bin/bash

# Script para adicionar Turso MCP ao Claude Code
echo "🔧 Adicionando Turso MCP ao Claude Code..."

# Remover versões anteriores
echo "🧹 Removendo versões anteriores..."
claude mcp remove mcp-turso 2>/dev/null || true

# Adicionar nova versão
SCRIPT_PATH="$(cd "$(dirname "$0")" && pwd)/start-turso-claude-final.sh"

echo "📦 Adicionando servidor MCP..."
claude mcp add mcp-turso bash "$SCRIPT_PATH"

echo "✅ Turso MCP adicionado ao Claude Code!"
echo ""
echo "📝 Para usar, reinicie o Claude Code e procure pelas ferramentas:"
echo "   - mcp__mcp-turso__turso_execute_query"
echo "   - mcp__mcp-turso__turso_list_tables"
echo "   - mcp__mcp-turso__turso_create_table"
echo "   - etc."
echo ""
echo "🔍 Para monitorar: ./monitor-turso-claude.sh"