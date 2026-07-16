# Scripts operacionais locais

## Instalação inicial no Windows

1. Execute `install-wsl-prerequisites.ps1` como administrador.
2. Reinicie o Windows.
3. Execute `install-docker-desktop.ps1` em PowerShell comum.
4. Abra o Docker Desktop uma vez e aguarde o engine iniciar.
5. Execute `setup-local-postgres.ps1` na raiz do projeto.

O script de PostgreSQL gera senha aleatória, cria `.env.docker` e `.env.local` — ambos ignorados pelo
Git — e solicita a subida do container. Ele interrompe se encontrar arquivos existentes para evitar
sobrescrita silenciosa de credenciais.

Os scripts futuros de exportação, manifesto e backup devem aceitar caminhos por configuração e nunca
embutir caminhos pessoais, tokens ou credenciais.

## Migração para o banco gerenciado

`migrate-operational-data.mjs` copia cadastro, cobertura, fontes, propostas, decisões e auditoria entre
dois bancos PostgreSQL. A origem é informada por `SOURCE_DATABASE_URL`; o destino usa
`TARGET_DATABASE_URL`, `DATABASE_URL_UNPOOLED` ou `DATABASE_URL`. O script interrompe se o destino não
estiver vazio e reconcilia as contagens após a transação.
