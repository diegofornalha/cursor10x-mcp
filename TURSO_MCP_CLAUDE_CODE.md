# 🚀 Turso MCP para Claude Code

Servidor MCP que integra o Turso Database com o Claude Code, fornecendo 12 ferramentas para gerenciamento de banco de dados SQL.

## 📦 Instalação Rápida

```bash
# 1. Adicionar ao Claude Code
./add-turso-to-claude-code.sh

# 2. Reiniciar o Claude Code
# O servidor aparecerá como "mcp-turso" com status ✓ Connected
```

## 🛠️ Ferramentas Disponíveis

### Operações SQL
- `mcp__mcp-turso__turso_execute_query` - Executa queries SQL
- `mcp__mcp-turso__turso_execute_batch` - Executa múltiplas queries em batch

### Gerenciamento de Tabelas
- `mcp__mcp-turso__turso_list_tables` - Lista todas as tabelas
- `mcp__mcp-turso__turso_describe_table` - Mostra estrutura da tabela
- `mcp__mcp-turso__turso_create_table` - Cria nova tabela
- `mcp__mcp-turso__turso_drop_table` - Remove tabela

### Manipulação de Dados
- `mcp__mcp-turso__turso_insert_data` - Insere dados
- `mcp__mcp-turso__turso_update_data` - Atualiza dados
- `mcp__mcp-turso__turso_delete_data` - Remove dados
- `mcp__mcp-turso__turso_search_data` - Busca full-text

### Administração
- `mcp__mcp-turso__turso_get_database_info` - Informações do banco
- `mcp__mcp-turso__turso_optimize_database` - Otimiza performance

## 💡 Exemplos de Uso

### Criar uma tabela
```
Use a ferramenta mcp__mcp-turso__turso_create_table para criar uma tabela users com id, nome e email
```

### Listar tabelas
```
Use mcp__mcp-turso__turso_list_tables para mostrar todas as tabelas
```

### Executar query
```
Use mcp__mcp-turso__turso_execute_query para executar: SELECT * FROM users LIMIT 10
```

## 🔧 Configuração

### Modo Local (padrão)
- URL: `libsql://127.0.0.1:8080`
- Não requer autenticação
- Ideal para desenvolvimento

### Modo Remoto
Edite `.env` para adicionar credenciais:
```env
TURSO_REMOTE_URL=libsql://seu-banco.turso.io
TURSO_REMOTE_AUTH_TOKEN=seu-token-aqui
TURSO_MODE=remote
```

### Modo Híbrido
Alterna entre local e remoto:
```env
TURSO_MODE=hybrid
```

## 📊 Monitoramento

```bash
# Monitor em tempo real
./monitor-turso-claude.sh
```

## 🗑️ Remoção

```bash
# Remover do Claude Code
./remove-turso-from-claude-code.sh
```

## 📁 Arquivos do Projeto

- `turso-mcp-claude.js` - Servidor MCP otimizado para Claude Code
- `start-turso-claude-final.sh` - Script de inicialização
- `add-turso-to-claude-code.sh` - Instalador
- `remove-turso-from-claude-code.sh` - Desinstalador
- `monitor-turso-claude.sh` - Monitor de status
- `.env` - Configurações (criado automaticamente)

## 🐛 Troubleshooting

### "Failed to connect"
1. Verifique se `turso dev` está rodando:
   ```bash
   curl http://127.0.0.1:8080
   ```

2. Teste o servidor diretamente:
   ```bash
   ./test-turso-claude.sh
   ```

### Servidor não aparece
1. Remova e adicione novamente:
   ```bash
   ./remove-turso-from-claude-code.sh
   ./add-turso-to-claude-code.sh
   ```

2. Reinicie o Claude Code

## 📝 Notas

- O servidor foi otimizado para não enviar logs para stderr
- Compatível com Claude Code via stdio
- Suporta modos local, remoto e híbrido
- Inclui 12 ferramentas completas para SQL