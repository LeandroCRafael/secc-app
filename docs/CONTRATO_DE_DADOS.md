# Contratos de dados — versão 2

## 1. Objetivo

Separar quatro contratos que possuem finalidades diferentes:

1. contrato operacional do aplicativo;
2. contrato de importação e upload;
3. contrato de sincronização com a planilha;
4. contrato de publicação.

O front-end e as integrações não devem depender diretamente de números de linha ou coluna do Excel.
O de-para da planilha fica isolado no módulo de sincronização.

## 2. Contrato operacional

### Entidades de domínio

- `Company`: empresa, Tier, setor, identificação e evento de reestruturação.
- `Period`: ano, posição relativa e janela de coleta.
- `DataPoint`: variável, valor tipado, unidade e estado de disponibilidade.
- `Source`: fonte, organização, URL, documento, página e data.
- `EvidenceLink`: vínculo entre dado e evidência.
- `Coverage`: cobertura calculada por empresa, período e bloco.

### Entidades de governança

- `Proposal`: alteração proposta por formulário, pesquisa, upload ou Excel.
- `Revision`: versão estruturada de um registro.
- `ReviewDecision`: aprovação, rejeição ou pedido de ajuste.
- `Conflict`: divergência entre versões ou fontes.
- `AuditEvent`: quem fez o quê, quando e por qual motivo.
- `PublicationRelease`: conjunto aprovado disponibilizado ao público.

### Entidades de ingestão

- `FileAsset`: arquivo, tipo, tamanho, hash, localização privada e usuário.
- `ImportBatch`: lote, origem, schema, status, contagens e erros.
- `ImportRow`: linha ou registro recebido e seu resultado de validação.
- `ExtractionResult`: campos propostos por parser ou processo assistido.

### Entidades de Excel

- `WorkbookConnection`: modo Graph ou intercâmbio de arquivo, localização e permissões.
- `WorkbookSnapshot`: hash, versão, data e metadados da planilha lida.
- `ExcelMapping`: de-para entre campos de domínio e abas/colunas/tabelas.
- `SyncBatch`: conjunto de revisões aprovadas para aplicar.
- `SyncRun`: execução, versão de origem, versão resultante, células afetadas e resultado.

## 3. Estado de cada dado

Um valor deve possuir estado explícito:

- `available`: valor disponível;
- `not_researched`: ainda não pesquisado;
- `unavailable`: pesquisado e indisponível;
- `not_applicable`: conceito não aplicável;
- `future_period`: período ainda não encerrado;
- `withheld`: coletado, mas retido por decisão metodológica;
- `under_review`: aguardando conferência;
- `conflicted`: fontes ou versões divergentes;
- `rejected`: proposta rejeitada.

Zero só pode ser gravado como valor quando a fonte registrar zero. Ausência nunca vira zero.

## 4. Ciclo de vida

```text
draft -> submitted -> processing -> mapped -> under_review
      -> approved -> synchronized -> published
      -> changes_requested
      -> rejected
      -> conflicted
```

`approved`, `synchronized` e `published` são estados diferentes. Um dado pode estar aprovado no app,
aguardando sincronização com o Excel e ainda não autorizado para divulgação pública.

## 5. Contrato de importação

Todo lote recebido deve informar:

- origem: formulário, pesquisa, XLSX, CSV, documento, Excel oficial ou conector;
- usuário e data;
- empresa e período, quando identificáveis;
- schema e versão do parser;
- hash do arquivo;
- linhas recebidas, válidas, inválidas, duplicadas e conflitantes;
- mapeamentos aplicados;
- erros e alertas;
- vínculo com o arquivo original.

Nenhuma importação atualiza dados aprovados diretamente. Ela gera propostas revisáveis.

## 6. Contrato de sincronização com Excel

Cada execução deve conter:

- `syncBatchId` e chave de idempotência;
- `workbookId` e `sourceWorkbookVersion`;
- hash ou ETag esperado;
- revisões aprovadas incluídas;
- de-para utilizado e sua versão;
- backup ou snapshot anterior;
- lista de abas, tabelas e células afetadas;
- resultado por registro;
- `resultWorkbookVersion`;
- usuário solicitante, aprovador e horário;
- status: preparado, bloqueado, aplicado, parcial, revertido ou falhou.

Se a versão atual da planilha divergir da versão esperada, a execução é bloqueada e gera conflito.

## 7. Contrato público

Arquivos ou endpoints públicos previstos:

```text
data/public/
|-- manifest.json
|-- companies.json
|-- financials.json
|-- qualitatives.json
|-- market.json
|-- macro.json
|-- sources.json
`-- quality.json
```

O `manifest.json` registra versão, data de referência, data de geração, contagens, hashes, schema,
limitações e release de origem. Apenas registros `approved` e autorizados para publicação entram no
snapshot.

## 8. Campos principais públicos

### Company

- `id`, `slug`, `name`, `tier`, `entityType`;
- `sector`, `sectorCode`, `ticker`;
- `eventType`, `eventYear`, `windowStart`, `windowEnd`;
- `publicationStatus`, `coverageSummary`, `notesPublic`.

### FinancialAnnual

Chave: `companyId + year`.

- posição relativa;
- DRE, balanço, DFC e DVA em R$ milhões;
- headcount;
- identificação de campos derivados;
- estado de disponibilidade e validação;
- referências públicas de proveniência.

### QualitativeAnnual, MarketAnnual e MacroAnnual

Mantêm as variáveis definidas na planilha, acrescidas de estado, data de referência, revisão e
fonte pública.

## 9. Regras de validação

- chaves únicas e ids estáveis;
- anos dentro da janela ou exceção documentada;
- reconciliações financeiras;
- unidades e tipos válidos;
- fonte obrigatória para valores aprovados;
- segregação entre consolidado e individual;
- arquivo original com hash e metadados;
- nenhuma atualização sem autor e trilha de auditoria;
- conflitos explícitos, nunca resolvidos por overwrite silencioso;
- nenhuma referência pública a storage privado, caminho local ou segredo;
- contagens reconciliadas com o manifesto e com o lote de sincronização.

## 10. Score futuro

Campos de score não pertencem aos contratos atuais. Quando aprovados, devem possuir contrato próprio
com versão do modelo, data, universo, componentes, tratamento de ausentes, validação e limitações.
