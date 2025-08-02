#!/bin/bash

# Script para remover MCP Turso do Claude Code
# Uso: ./remove-from-claude-code.sh

echo "🗑️  Removendo MCP Turso do Claude Code"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Cores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Verificar se o MCP está configurado
echo -e "${BLUE}🔍 Verificando configuração atual...${NC}"
claude mcp list | grep turso

if ! claude mcp list | grep -q "turso"; then
    echo -e "${YELLOW}⚠️  MCP Turso não estava configurado${NC}"
else
    # Remover MCP
    echo -e "${BLUE}🔄 Removendo servidor MCP...${NC}"
    claude mcp remove turso
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ MCP Turso removido com sucesso!${NC}"
    else
        echo -e "${RED}❌ Erro ao remover MCP${NC}"
    fi
fi

echo ""
echo -e "${BLUE}📊 Status atual dos servidores MCP:${NC}"
claude mcp list

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Para adicionar novamente: ./add-to-claude-code.sh${NC}"