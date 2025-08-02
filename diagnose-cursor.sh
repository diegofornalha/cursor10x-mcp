#!/bin/bash

echo "🔍 DIAGNÓSTICO DO CURSOR MCP TURSO"
echo "=================================="

echo ""
echo "📁 Verificando arquivos:"
echo "  ✅ start-turso-cursor.sh existe: $([ -f "start-turso-cursor.sh" ] && echo "SIM" || echo "NÃO")"
echo "  ✅ turso-mcp-server.js existe: $([ -f "turso-mcp-server.js" ] && echo "SIM" || echo "NÃO")"
echo "  ✅ env.hybrid existe: $([ -f "env.hybrid" ] && echo "SIM" || echo "NÃO")"

echo ""
echo "🔧 Testando script wrapper:"
echo "  Executando: ./start-turso-cursor.sh"
echo ""

# Testar o script wrapper
echo '{"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}' | ./start-turso-cursor.sh 2>&1 | head -20

echo ""
echo "🌐 Verificando servidor Turso:"
if curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    echo "  ✅ Servidor Turso local está rodando"
else
    echo "  ❌ Servidor Turso local NÃO está rodando"
    echo "  💡 Execute: turso dev"
fi

echo ""
echo "📋 Configuração MCP atual:"
echo "  Arquivo: .cursor/mcp.json"
echo "  Comando: ./cursor10x-mcp/start-turso-cursor.sh"

echo ""
echo "🚀 PRÓXIMOS PASSOS:"
echo "  1. Feche COMPLETAMENTE o Cursor"
echo "  2. Abra o Cursor novamente"
echo "  3. Verifique se o Turso MCP mostra as 12 ferramentas"
echo "  4. Se ainda não funcionar, execute: turso dev" 