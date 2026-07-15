# Ambiente local e OneDrive pessoal

Esta estrutura organiza artefatos locais do SECC sem torná-los candidatos à publicação no futuro
repositório GitHub. Os diretórios existem no workspace, mas seus conteúdos são ignorados pelo Git.

## Estrutura

```text
local/
|-- private/
|   |-- excel/
|   |   |-- oficial/       planilha mestre vigente; nunca compartilhar publicamente
|   |   |-- entrada/       versões recebidas para diff e revisão
|   |   `-- backups/       cópias anteriores às sincronizações
|   |-- database/          volumes e backups do PostgreSQL local
|   |-- evidencias/        documentos-fonte privados
|   `-- uploads/           quarentena de arquivos não confiáveis
`-- publicacao-onedrive/
    `-- excel-sanitizado/   cópias aprovadas, sanitizadas e próprias para leitura pública
```

## Regra de compartilhamento

Não divulgar o link da pasta `private/`, da planilha mestre ou do workspace `secc-app`. Quando houver
autorização de publicação, gerar uma cópia sanitizada na pasta `publicacao-onedrive/excel-sanitizado/`
e compartilhar somente essa pasta no OneDrive, com permissão de leitura.

Nenhuma planilha foi copiada ou acessada na criação desta estrutura.
