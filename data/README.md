# Dados do aplicativo

Esta pasta contém apenas contratos, exemplos sanitizados e artefatos públicos versionáveis. A base
operacional de produção ficará no banco relacional e os arquivos enviados ficarão no armazenamento
privado, nunca neste diretório do GitHub.

- `schemas/operational/`: contratos das entidades e estados internos.
- `schemas/imports/`: formatos aceitos e regras de mapeamento.
- `schemas/excel/`: de-para e metadados de sincronização da planilha.
- `schemas/public/`: contratos dos snapshots públicos.
- `public/`: releases aprovadas e sanitizadas que podem ser consumidas pelo site.
- `generated/`: saídas locais temporárias; não publicar antes da validação.

Nenhum arquivo migra de `generated/` para `public/` sem manifesto, aprovação e controles de
privacidade, proveniência e reconciliação.

