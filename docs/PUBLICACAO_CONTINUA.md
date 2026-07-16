# Publicação contínua interna

## Objetivo

Disponibilizar uma URL interna para acompanhar a evolução do SECC sem expor banco local, planilha oficial,
uploads, evidências ou credenciais no GitHub.

**Produção:** `https://secc-app.vercel.app`  
**Repositório:** `https://github.com/LeandroCRafael/secc-app`

## Ambientes

- **Local:** aplicação completa de desenvolvimento, PostgreSQL em Docker e curadoria demonstrativa.
- **GitHub:** código, documentação e estruturas sanitizadas do produto.
- **Vercel:** aplicação construída a partir da branch `main`, com dashboard protegido e snapshot privado de leitura.

Em produção, o modo público seguro continua sendo o padrão. `INTERNAL_DASHBOARD_ENABLED=true` habilita
`/admin` somente quando também existem credenciais HTTP e o snapshot protegido. `PUBLIC_PREVIEW=true`
força novamente o redirecionamento para `/construindo`.

## Fluxo de atualização

1. implementar e validar localmente;
2. executar lint, TypeScript, testes e build;
3. revisar arquivos e segredos antes do commit;
4. enviar a branch validada ao GitHub;
5. a integração Git da Vercel gera um novo deploy;
6. verificar a URL e os logs antes de considerar a atualização concluída.

O dashboard publicado é somente leitura. Persistência remota, usuários individuais e ações administrativas
exigirão uma decisão posterior sobre banco e autenticação gerenciados.
