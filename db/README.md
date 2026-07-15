# Banco operacional local

PostgreSQL 18.4 é executado pelo `compose.yaml` em volume Docker nomeado. O volume não fica dentro do
OneDrive; `local/private/database/` será reservado para dumps e backups controlados.

Comandos, depois da instalação do Docker:

```powershell
.\scripts\setup-local-postgres.ps1
npm run db:status
npm run db:check
npm run db:migrate
npm run db:schema:check
npm run db:logs
npm run db:down
```

O banco armazenará propostas, revisões, aprovações, conflitos, auditoria, metadados e sincronizações.
Arquivos binários permanecem no filesystem privado. Nenhum dump, credencial ou dado privado deve ser
versionado.

O módulo `src/lib/database/postgres.ts` cria o cliente apenas quando uma rota de servidor solicita a
conexão. O diagnóstico em `/admin/banco` e `npm run db:check` retornam somente banco, usuário e versão;
o endereço e as credenciais nunca são registrados.

O SQL em `db/init/` é executado somente na primeira criação do volume. Mudanças posteriores deverão
usar migrations versionadas, não edição retroativa dos scripts de inicialização.

`db/migrations/0001-operational-core.sql` cria empresas, fontes, propostas, decisões de revisão e
eventos de auditoria. O executor registra checksum e recusa alterações retroativas em migrations já
aplicadas. A tabela de auditoria possui bloqueio de `UPDATE` e `DELETE` no próprio banco.

As operações `createCompany` e `submitProposal` do repositório PostgreSQL gravam o registro de domínio
e seu evento de auditoria na mesma transação. Falha em qualquer etapa desfaz todo o lote.
