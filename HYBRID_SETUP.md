# 🚀 Configuração Híbrida Turso - Cursor10x MCP

## 📋 Visão Geral

Este documento descreve como configurar um sistema híbrido para o Cursor10x MCP que permite usar tanto banco de dados local quanto remoto do Turso, com sincronização automática entre eles.

## 🏗️ Arquitetura Híbrida

### Componentes:
- **Banco Local** - Para desenvolvimento e testes
- **Banco Remoto** - Para produção e persistência
- **Sistema de Sincronização** - Para manter dados consistentes
- **Fallback Automático** - Para garantir disponibilidade

### Modos de Operação:
1. **Local** - Apenas banco local
2. **Remote** - Apenas banco remoto  
3. **Hybrid** - Ambos com sincronização

## 🔧 Configuração

### 1. Arquivo de Configuração (`env.hybrid`)

```bash
# Configuração de Ambiente
TURSO_MODE=hybrid                    # local, remote, hybrid
TURSO_HYBRID_PRIORITY=local_first    # local_first, remote_first, sync
TURSO_SYNC_INTERVAL=300              # Sincronização a cada 5 minutos
TURSO_FALLBACK_ENABLED=true          # Fallback automático

# Banco Local (Desenvolvimento)
TURSO_LOCAL_URL=libsql://127.0.0.1:8080
TURSO_LOCAL_AUTH_TOKEN=seu_token_local

# Banco Remoto (Produção)
TURSO_REMOTE_URL=libsql://cursor10x-memory-diegofornalha.aws-us-east-1.turso.io
TURSO_REMOTE_AUTH_TOKEN=seu_token_remoto
```

### 2. Script de Setup (`setup-hybrid.sh`)

```bash
# Executar configuração híbrida
chmod +x setup-hybrid.sh
./setup-hybrid.sh
```

O script irá:
- ✅ Verificar dependências
- ✅ Testar conexões com ambos os bancos
- ✅ Configurar modo baseado na disponibilidade
- ✅ Instalar dependências
- ✅ Criar scripts de sincronização
- ✅ Testar o sistema

## 🚀 Como Usar

### Configuração Inicial

```bash
# 1. Copiar configuração híbrida
cp env.hybrid .env

# 2. Executar setup
./setup-hybrid.sh

# 3. Verificar status
cat .env | grep TURSO_MODE
```

### Modos de Operação

#### Modo Local (Desenvolvimento)
```bash
# Configurar para modo local
sed -i 's/TURSO_MODE=hybrid/TURSO_MODE=local/' .env
./setup-hybrid.sh
```

#### Modo Remoto (Produção)
```bash
# Configurar para modo remoto
sed -i 's/TURSO_MODE=hybrid/TURSO_MODE=remote/' .env
./setup-hybrid.sh
```

#### Modo Híbrido (Recomendado)
```bash
# Configurar para modo híbrido
sed -i 's/TURSO_MODE=local/TURSO_MODE=hybrid/' .env
./setup-hybrid.sh
```

## 🔄 Sincronização

### Sincronização Automática

O sistema pode sincronizar automaticamente baseado no `TURSO_SYNC_INTERVAL`:

```bash
# Sincronização a cada 5 minutos
TURSO_SYNC_INTERVAL=300

# Sincronização a cada hora
TURSO_SYNC_INTERVAL=3600

# Desabilitar sincronização
TURSO_SYNC_INTERVAL=0
```

### Sincronização Manual

```bash
# Executar sincronização manual
./sync-databases.sh
```

### Estratégias de Sincronização

#### Prioridade Local First
- Escreve primeiro no banco local
- Sincroniza com remoto periodicamente
- Ideal para desenvolvimento

#### Prioridade Remote First
- Escreve primeiro no banco remoto
- Sincroniza com local periodicamente
- Ideal para produção

#### Modo Sync
- Escreve em ambos simultaneamente
- Maior latência, máxima consistência
- Ideal para dados críticos

## 🛠️ Troubleshooting

### Problemas Comuns

#### 1. Banco Local Não Disponível
```bash
# Verificar se Turso dev server está rodando
turso dev

# Ou iniciar manualmente
turso dev --port 8080
```

#### 2. Banco Remoto Não Acessível
```bash
# Verificar token
echo $TURSO_REMOTE_AUTH_TOKEN

# Testar conexão
curl -H "Authorization: Bearer $TURSO_REMOTE_AUTH_TOKEN" \
     "$TURSO_REMOTE_URL"
```

#### 3. Sincronização Falhando
```bash
# Verificar logs
tail -f logs/sync.log

# Executar sincronização manual
./sync-databases.sh
```

### Logs de Debug

```bash
# Habilitar logs detalhados
DEBUG_MODE=true

# Ver logs em tempo real
tail -f logs/cursor10x-mcp.log
```

## 📊 Monitoramento

### Status do Sistema

```bash
# Verificar status dos bancos
./check-status.sh

# Ver estatísticas de sincronização
./sync-stats.sh
```

### Métricas Importantes

- **Latência de Conexão** - Tempo para conectar com cada banco
- **Taxa de Sincronização** - Sucessos/falhas na sincronização
- **Tamanho dos Dados** - Espaço usado em cada banco
- **Performance** - Tempo de resposta das queries

## 🔒 Segurança

### Tokens de Acesso

```bash
# Gerar novo token para banco local
turso db tokens create cursor10x-local

# Gerar novo token para banco remoto
turso db tokens create cursor10x-memory-diegofornalha
```

### Rotação de Tokens

```bash
# Script para rotacionar tokens
./rotate-tokens.sh
```

## 🚀 Deploy

### Ambiente de Desenvolvimento

```bash
# Configurar para desenvolvimento
TURSO_MODE=local
./setup-hybrid.sh
```

### Ambiente de Produção

```bash
# Configurar para produção
TURSO_MODE=hybrid
TURSO_HYBRID_PRIORITY=remote_first
./setup-hybrid.sh
```

### Ambiente de Staging

```bash
# Configurar para staging
TURSO_MODE=hybrid
TURSO_HYBRID_PRIORITY=sync
./setup-hybrid.sh
```

## 📚 Referências

- [Documentação Turso](https://docs.turso.tech/)
- [Turso CLI](https://docs.turso.tech/cli)
- [LibSQL](https://github.com/libsql/libsql)
- [Cursor10x MCP](https://github.com/aurda012/devcontext)

## 🎯 Próximos Passos

1. **Implementar Sincronização Bidirecional** - Sincronizar mudanças em ambas as direções
2. **Adicionar Compressão** - Comprimir dados durante sincronização
3. **Implementar Backup Automático** - Backup periódico dos dados
4. **Adicionar Métricas** - Dashboard de monitoramento
5. **Implementar Cache** - Cache local para melhor performance

---

**🎉 Sistema Híbrido Turso configurado com sucesso!** 