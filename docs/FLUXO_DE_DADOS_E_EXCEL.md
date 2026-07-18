# Fluxo de dados e integração com Excel

## 1. Decisão de governança

A planilha do Estevão permanece como instrumento oficial de acompanhamento, consulta e trabalho.
O aplicativo passa a organizar entradas, evidências, revisões, aprovações e histórico. A integração
entre os dois é bidirecional, controlada e auditável.

Isso evita dois riscos opostos:

- abandonar a planilha e romper o processo atual de acompanhamento;
- permitir que app e Excel alterem os mesmos dados sem controle de versão.

## 2. Responsabilidades

| Componente | Responsabilidade |
|---|---|
| Documento ou arquivo original | Evidência primária |
| Banco operacional | Propostas, revisões, aprovações, conflitos e auditoria |
| Planilha oficial | Visão executiva, acompanhamento do Estevão e input controlado |
| Snapshot público | Dados aprovados e sanitizados consumidos pelo site |

## 3. Entrada pelo aplicativo

1. O curador pesquisa ou envia um arquivo.
2. O app registra a origem e cria uma proposta.
3. Validações identificam erros, duplicidades e divergências.
4. O revisor aprova, rejeita ou solicita correção.
5. O dado aprovado entra no banco operacional.
6. Um lote de sincronização atualiza a planilha oficial.
7. Quando autorizado, uma release pública é gerada.

## 4. Entrada pela planilha

1. O sistema lê uma nova versão da planilha.
2. Compara o conteúdo com o último snapshot sincronizado.
3. Alterações feitas no Excel são convertidas em propostas identificadas.
4. O revisor avalia diferenças, inclusive fórmulas, vazios e `N/D`.
5. Dados aprovados atualizam o banco e passam a compor a próxima versão reconciliada.

Alterações vindas do Excel nunca sobrescrevem silenciosamente um registro aprovado no app.

## 5. Controle de concorrência

Cada sincronização deve registrar:

- identificador e versão da planilha;
- hash ou ETag esperado;
- versão do de-para de campos;
- lote, usuário e aprovador;
- backup anterior;
- células ou tabelas afetadas;
- versão resultante e resultado por registro.

Se a planilha mudar entre leitura e gravação, a sincronização é bloqueada. O sistema apresenta o
conflito para escolha explícita, sem aplicar a regra “última gravação vence”.

## 6. Modos de integração

### Modo A — Microsoft Graph

Preferencial quando a planilha estiver em OneDrive for Business ou SharePoint. O app opera sobre o
arquivo hospedado, com autenticação, sessões de workbook, leitura e escrita em lote e controle de
versão.

### Modo B — Intercâmbio de arquivo

Alternativa para OneDrive pessoal ou quando não houver autorização para integração direta:

1. o usuário envia a versão atual da planilha;
2. o app valida estrutura, versão e diferenças;
3. as alterações passam pela revisão;
4. o app gera uma nova versão do XLSX, preservando abas, fórmulas e formatação;
5. a nova versão fica disponível para substituição controlada do arquivo oficial.

Este é o modo selecionado para a etapa local, pois a planilha oficial está em OneDrive pessoal.

### Implementação vigente do modo B

- limite de 4 MB e aceitação exclusiva de XLSX sem macros;
- validação dos cabeçalhos e do de-para `secc-map-v1` antes de criar o lote;
- snapshot lógico das células controladas, sem persistir o arquivo bruto no servidor;
- prévia separando escrita direta, valor já conciliado, conflito e item sem de-para;
- backup baixado pelo administrador antes de liberar a aplicação;
- reenvio do mesmo arquivo na aplicação e bloqueio se o SHA-256 diferir da prévia;
- aba técnica `SECC_App_Sync` muito oculta, com lote, versões e contagens;
- geração de nova versão para download, sem alterar o arquivo selecionado no lugar.

### Publicação no OneDrive

O arquivo oficial não será compartilhado publicamente. Quando houver autorização, o pipeline gerará
uma cópia sanitizada, sem dados privados, rascunhos, conflitos, caminhos locais ou vínculos internos.
Somente a pasta dessa cópia poderá receber link público de leitura no OneDrive. Criar o link permanece
um evento de publicação externo e exige revisão final específica.

## 7. Metadados mínimos

O protocolo deve manter, mesmo que parte fique fora das células visíveis:

- `workbookId`;
- `workbookVersion`;
- `dataVersion`;
- `mappingVersion`;
- `lastSyncAt`;
- `lastSyncBatchId`;
- hash do arquivo;
- responsável pela sincronização.

## 8. Regras específicas do SECC

- preservar as nove abas, fórmulas, estilos e conteúdos válidos;
- diferenciar vazio, zero e `N/D`;
- manter valores em R$ milhões conforme o protocolo;
- preservar fonte, data de referência e observação;
- impedir escrita em linhas sem cadastro correspondente;
- validar totais, sinais, unidades, janelas e reconciliações antes de concluir o lote;
- oferecer ao Estevão status por empresa, bloco, ano, pendência e última atualização.

## 9. Referências técnicas

- Microsoft Graph, recurso Excel: <https://learn.microsoft.com/pt-br/graph/api/resources/excel>
- Microsoft Graph, gravação em workbook: <https://learn.microsoft.com/en-us/graph/excel-write-to-workbook>
