# Estratégia de testes

Testes futuros devem cobrir contrato e manifesto, reconciliações financeiras, estados de ausência,
rotas essenciais, acessibilidade, responsividade, ausência de segredos e build de produção.

As verificações locais do banco são executadas com `npm run db:check` e `npm run db:schema:check`.
Elas não exibem credenciais nem inserem dados. O build valida a leitura do repositório na rota dinâmica
`/admin/banco`.

Os schemas de entrada manual possuem testes unitários. Server Actions repetem a validação no servidor,
exigem papel de administrador e usam operações transacionais do repositório.
