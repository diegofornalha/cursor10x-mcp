#!/bin/bash

# Script simplificado para debug
cd "$(dirname "$0")"

# Carregar configurações mínimas
export TURSO_DATABASE_URL="libsql://127.0.0.1:8080"
export TURSO_AUTH_TOKEN="eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3NDczNDY1MzksImlkIjoiNDc4ZDI2ODYtYTEyZS00NmU3LWI3ZTAtZDBjZTljNjNmNDA1IiwicmlkIjoiZjY5OWI1YTYtY2VjYi00ODhkLTkwN2QtOGY4MWFmZmFmMGU4In0._cYEfLVtROFlfKkjfiRMsBt12tvKPTvrLfDdEwtOj86PDqPwkIujWoHke7HbraJieqFvAcuiOwbk0BTEswSQAw"
export TURSO_MODE="local"

# Verificar servidor local
if ! curl -s http://127.0.0.1:8080 >/dev/null 2>&1; then
    turso dev &
    sleep 3
fi

# Iniciar servidor
exec node turso-mcp-server.js