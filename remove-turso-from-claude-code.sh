#!/bin/bash

# Script para remover MCP Turso do Claude Code
# Uso: ./remove-turso-from-claude-code.sh

echo "🗑️  Removendo MCP Turso do Claude Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Remover o servidor MCP
echo -e "${BLUE}🔄 Removendo servidor MCP...${NC}"
claude mcp remove mcp-turso

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ MCP Turso removido com sucesso!${NC}"
else
    echo -e "${YELLOW}⚠️  MCP Turso não estava configurado ou já foi removido.${NC}"
fi

# Mostrar status atualizado
echo ""
echo -e "${BLUE}📊 Status dos servidores MCP:${NC}"
claude mcp list

echo ""
echo -e "${GREEN}Para adicionar novamente: ./add-turso-to-claude-code.sh${NC}"