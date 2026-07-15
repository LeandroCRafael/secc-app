# Roadmap de execução

## Fase 0 — Arquitetura e organização

Status: concluída nesta rodada.

- separar o workspace privado do futuro repositório público;
- atualizar o contexto do projeto;
- definir o papel do app, da base operacional e da planilha do Estevão;
- desenhar ingestão, revisão, sincronização e publicação;
- criar a estrutura inicial de pastas e as regras de segurança.

## Fase 1 — Reconciliação e desenho da integração

- reconciliar planilha, staging, JSONs e cadastro de empresas;
- confirmar se a planilha oficial está em OneDrive for Business/SharePoint ou OneDrive pessoal — **confirmado: OneDrive pessoal**;
- versionar o de-para entre campos do domínio e abas/colunas do Excel;
- definir metadados de versão e protocolo de conflitos;
- definir whitelist de campos publicáveis;
- fechar schemas operacional, de importação, sincronização e publicação.

## Fase 2 — Fundação operacional

- inicializar Next.js e TypeScript — **concluído localmente**;
- configurar autenticação e papéis — **decidido: somente administrador na etapa local**;
- provisionar banco relacional compatível com Postgres — **concluído: PostgreSQL 18.4 local em Docker, com conexão server-only validada**;
- provisionar armazenamento privado de arquivos — **decidido: filesystem local privado; estrutura criada**;
- implementar empresas, períodos, dados, fontes, revisões e trilha de auditoria — **núcleo operacional consolidado no PostgreSQL**;
- separar rotas públicas e protegidas — **fundação demo concluída; entrada manual protegida e persistente; provedor real pendente**.

Marco de 15/07/2026: fundação vertical local entregue com rotas, contratos, fluxo fictício de proposta,
revisão, auditoria, release, upload seguro e sincronização simulada. A infraestrutura PostgreSQL e sua
conexão com o app foram validadas; persistência dos fluxos, provedores externos e processamento
assíncrono permanecem nas fases seguintes.

## Fase 3 — Entrada de dados e curadoria

- criar formulários de pesquisa e input manual;
- conectar cadastro de empresa e proposta ao PostgreSQL com auditoria atômica — **concluído**;
- receber XLSX e CSV estruturados;
- armazenar documentos-fonte como evidência;
- validar, mapear e apresentar prévia antes da importação;
- implementar fila de revisão, conflitos, aprovação e rejeição — **fila, aprovação e rejeição concluídas; tratamento especializado de conflitos pendente**;
- impedir publicação automática de qualquer upload.

## Fase 4 — Sincronização com Excel

- manter Microsoft Graph fora do escopo enquanto a planilha estiver em OneDrive pessoal;
- implementar o modo de intercâmbio de arquivo versionado — **modo selecionado**;
- criar backup, comparação de versões e idempotência;
- atualizar o Excel em lote somente com dados aprovados;
- importar alterações do Excel como propostas para revisão;
- disponibilizar painel de status da sincronização para o Estevão.

## Fase 5 — Interface pública navegável

- definir identidade visual e sistema de componentes;
- criar portfólio, lista de empresas e Empresa 360;
- criar comparador, metodologia, dados e sobre;
- exibir somente releases aprovados e sanitizados;
- tratar cobertura, ausentes, erros e fontes;
- validar responsividade, acessibilidade e desempenho.

## Fase 6 — GitHub e Vercel

- revisar conteúdo, arquivos e variáveis do repositório público — **concluído para a prévia inicial**;
- inicializar o Git dentro de `secc-app/` — **concluído**;
- criar o repositório no GitHub — **concluído: `LeandroCRafael/secc-app`**;
- configurar serviços e ambientes na Vercel — **concluído para a prévia pública sem backend operacional**;
- publicar a versão inicial — **concluído em `https://secc-app.vercel.app`**;
- documentar atualização, monitoramento e rollback — **fluxo inicial documentado; observabilidade evolutiva pendente**.

## Fase 7 — Metodologia de score

- formular objetivo e variável-alvo;
- definir amostra, janelas e prevenção de vazamento de informação;
- selecionar variáveis e tratamento de ausentes;
- criar baseline e validação temporal;
- definir calibração, faixas e limitações;
- versionar metodologia e resultados;
- incorporar ao produto somente após aprovação.
