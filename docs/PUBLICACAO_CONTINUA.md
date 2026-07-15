# Publicação contínua da prévia

## Objetivo

Disponibilizar uma URL pública para apresentar a evolução do SECC sem expor administração, banco local,
planilha oficial, uploads, evidências ou credenciais.

**Produção:** `https://secc-app.vercel.app`  
**Repositório:** `https://github.com/LeandroCRafael/secc-app`

## Ambientes

- **Local:** aplicação completa de desenvolvimento, PostgreSQL em Docker e curadoria demonstrativa.
- **GitHub:** código, documentação e estruturas sanitizadas do produto.
- **Vercel:** prévia pública construída a partir da branch `main`, sem banco ou credenciais privadas.

Em produção, `NODE_ENV=production` ativa o modo público seguro. A navegação de curadoria é removida e
qualquer rota `/admin` redireciona para `/construindo`. `PUBLIC_PREVIEW=true` permite reproduzir esse
comportamento em outro ambiente.

## Fluxo de atualização

1. implementar e validar localmente;
2. executar lint, TypeScript, testes e build;
3. revisar arquivos e segredos antes do commit;
4. enviar a branch validada ao GitHub;
5. a integração Git da Vercel gera um novo deploy;
6. verificar a URL e os logs antes de considerar a atualização concluída.

Persistência pública e autenticação real exigirão uma decisão posterior sobre serviços gerenciados. Até
essa aprovação, nenhuma função administrativa será habilitada na Vercel.
