# 🚀 MCP Turso para Cursor - Model Context Protocol Server

Um servidor MCP completo para integração com Turso Database no Cursor, oferecendo gerenciamento de banco de dados local e remoto com modo híbrido.

## ✨ Características

- **Modo Híbrido**: Suporte para local, remoto ou ambos
- **Fallback Automático**: Troca entre local/remoto se um falhar
- **Sincronização**: Sync automático entre bases (configurável)
- **Monitor em Tempo Real**: Script de monitoramento incluído
- **Suporte Vetorial**: Dimensões configuráveis para embeddings
- **Ferramentas Completas**: CRUD + queries customizadas

## 🛠️ Instalação Rápida

### 1. Pré-requisitos
```bash
# Instalar Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Instalar dependências Node
npm install
```

### 2. Configure o Ambiente
```bash
# Edite env.hybrid com suas configurações
nano env.hybrid
```

### 3. Adicione ao Cursor
```bash
./add-to-cursor.sh
```

## 📚 Scripts Disponíveis

### 🚀 Inicialização
- `./start-turso-cursor.sh` - Script principal para Cursor
- `./add-to-cursor.sh` - Adiciona ao Cursor automaticamente

### 🧪 Testes e Monitoramento
- `./test-turso.sh` - Executa suite completa de testes
- `./monitor-turso.sh` - Monitor em tempo real com estatísticas

## ⚙️ Modos de Operação

### Local Only
```bash
TURSO_MODE=local
# Usa apenas banco local (127.0.0.1:8080)
```

### Remote Only
```bash
TURSO_MODE=remote
# Usa apenas banco remoto (Turso Cloud)
```

### Hybrid (Recomendado)
```bash
TURSO_MODE=hybrid
TURSO_HYBRID_PRIORITY=local_first
# Tenta local primeiro, fallback para remoto
```

## 🎯 Ferramentas Disponíveis

No Cursor, use o prefixo `mcp__turso__`:

### Operações Básicas
- `mcp__turso__execute_query` - Executa SQL customizado
- `mcp__turso__create_table` - Cria tabelas
- `mcp__turso__insert_data` - Insere dados
- `mcp__turso__select_data` - Consulta dados
- `mcp__turso__update_data` - Atualiza registros
- `mcp__turso__delete_data` - Remove registros

### Gerenciamento
- `mcp__turso__list_tables` - Lista todas as tabelas
- `mcp__turso__describe_table` - Mostra estrutura da tabela
- `mcp__turso__create_index` - Cria índices
- `mcp__turso__vacuum` - Otimiza banco

### Vetorial
- `mcp__turso__store_embedding` - Armazena embeddings
- `mcp__turso__search_similar` - Busca por similaridade

## 💡 Exemplos de Uso

### Criar Tabela
```javascript
await mcp__turso__create_table({
  table_name: "users",
  columns: [
    { name: "id", type: "INTEGER PRIMARY KEY" },
    { name: "name", type: "TEXT NOT NULL" },
    { name: "email", type: "TEXT UNIQUE" },
    { name: "created_at", type: "TIMESTAMP DEFAULT CURRENT_TIMESTAMP" }
  ]
});
```

### Inserir Dados
```javascript
await mcp__turso__insert_data({
  table_name: "users",
  data: {
    name: "João Silva",
    email: "joao@example.com"
  }
});
```

### Query Customizada
```javascript
await mcp__turso__execute_query({
  query: "SELECT * FROM users WHERE created_at > datetime('now', '-7 days')"
});
```

## 📊 Monitor em Tempo Real

Execute o monitor para acompanhar:
```bash
./monitor-turso.sh
```

O monitor exibe:
- Status dos servidores (local/remoto)
- Modo de operação atual
- Número de tabelas
- Uso de recursos (CPU/Memória)
- Configurações vetoriais
- Status de sincronização

## 🧪 Testes

Execute a suite completa:
```bash
./test-turso.sh
```

Testa:
- Listagem de ferramentas
- Criação de tabelas
- Inserção de dados
- Consultas
- Queries customizadas
- Modo híbrido (se ativo)

## 🔍 Troubleshooting

### Servidor local não inicia
```bash
# Iniciar manualmente
turso dev

# Verificar se está rodando
curl http://127.0.0.1:8080
```

### Erro de autenticação
```bash
# Verificar tokens em env.hybrid
cat env.hybrid | grep AUTH_TOKEN

# Testar conexão
turso db shell <URL> --auth-token=<TOKEN>
```

### Monitor não conecta
```bash
# Verificar processo
ps aux | grep turso-mcp-server

# Reiniciar no Cursor
```

## 📝 Configuração (env.hybrid)

```bash
# Modo de operação
TURSO_MODE=hybrid

# Banco Local
TURSO_LOCAL_URL=libsql://127.0.0.1:8080
TURSO_LOCAL_AUTH_TOKEN=<seu-token-local>

# Banco Remoto
TURSO_REMOTE_URL=libsql://seu-banco.turso.io
TURSO_REMOTE_AUTH_TOKEN=<seu-token-remoto>

# Configurações Híbridas
TURSO_HYBRID_PRIORITY=local_first
TURSO_SYNC_INTERVAL=300
TURSO_FALLBACK_ENABLED=true

# Vetorial
VECTOR_DIMENSIONS=128
VECTOR_VACUUM=true
```

## 🎯 Casos de Uso

### 1. Desenvolvimento Local
- Use modo `local` para desenvolvimento
- Sem latência de rede
- Dados isolados

### 2. Produção
- Use modo `remote` para produção
- Backup automático
- Alta disponibilidade

### 3. Híbrido (Recomendado)
- Desenvolvimento com fallback
- Cache local de produção
- Sincronização automática

## 🔗 Links Úteis

- [Documentação Turso](https://docs.turso.tech)
- [MCP SDK](https://github.com/modelcontextprotocol/sdk)
- [Dashboard Turso](https://turso.tech/app)

## 📄 Licença

MIT

---

Desenvolvido com ❤️ para Cursor