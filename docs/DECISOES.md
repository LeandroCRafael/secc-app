# Registro de decisões arquiteturais

## ADR-001 — Repositório público separado

**Decisão:** `secc-app/` será a raiz do repositório público.  
**Motivo:** o workspace pai contém segredos, fontes brutas, planilhas e backups.  
**Consequência:** somente código, documentação e dados expressamente sanitizados entram no repositório.

## ADR-002 — Excel como instrumento oficial sincronizado

**Decisão:** a planilha do Estevão continuará sendo a visão oficial de acompanhamento e poderá receber e originar alterações por um fluxo controlado.  
**Motivo:** preservar a forma de trabalho e a visibilidade executiva já adotadas no projeto.  
**Consequência:** o app não escreve diretamente em células a cada formulário; gera propostas, exige revisão, valida versão, cria backup e sincroniza em lote.

## ADR-003 — Base operacional no aplicativo

**Decisão:** o app usará banco relacional como registro operacional de propostas, revisões, aprovações, conflitos e sincronizações.  
**Motivo:** Excel isoladamente não oferece o nível necessário de concorrência, auditoria, autenticação e processamento de uploads.  
**Consequência:** não haverá dois mestres silenciosos: o banco governa o fluxo e o Excel permanece a visão oficial humana, reconciliada e versionada.

## ADR-004 — Score fora do MVP

**Decisão:** a primeira versão mostrará indicadores, trajetórias, cobertura, fontes e status.  
**Motivo:** ainda não existe metodologia de score validada.  
**Consequência:** nenhuma nota, rating ou probabilidade fictícia será exibida.

## ADR-005 — Tecnologia recomendada

**Decisão:** Next.js, TypeScript e Vercel na implementação, com banco relacional e armazenamento de objetos gerenciados.  
**Motivo:** aderência às rotas públicas e protegidas, interface navegável, ingestão de arquivos e publicação contínua.

## ADR-006 — Upload privado e publicação por aprovação

**Decisão:** arquivos recebidos ficam em armazenamento privado; seus dados extraídos entram como propostas.  
**Motivo:** XLSX, CSV e documentos podem conter erros, dados não publicáveis ou conteúdo malicioso.  
**Consequência:** tipo, tamanho, assinatura, hash, origem e resultado do processamento são registrados; nenhum upload é publicado automaticamente.

## ADR-007 — Curadoria protegida por papéis

**Decisão:** pesquisa, importação, revisão, aprovação e sincronização exigem autenticação e permissões.  
**Motivo:** separar consulta pública de alterações que afetam a base e a planilha oficial.  
**Consequência:** papéis mínimos: público, curador, revisor e administrador; aprovações críticas podem exigir quatro olhos.

## ADR-008 — Dois modos de integração com Excel

**Decisão:** usar Microsoft Graph quando a planilha estiver em OneDrive for Business ou SharePoint; caso contrário, usar intercâmbio de arquivo versionado.  
**Motivo:** a API de Excel do Microsoft Graph não oferece o mesmo suporte para OneDrive pessoal.  
**Consequência:** a arquitetura não depende da confirmação imediata do tipo de conta e preserva o mesmo contrato de sincronização nos dois modos.

## ADR-009 — Publicação por release imutável

**Decisão:** a área pública consome somente snapshots aprovados e sanitizados.  
**Motivo:** impedir que rascunhos, conflitos, arquivos privados ou alterações incompletas apareçam no site.  
**Consequência:** aprovação, sincronização com Excel e publicação são eventos separados e auditáveis.

## ADR-010 — Adaptadores locais na fundação vertical

**Decisão:** autenticação, repositório operacional, storage, publicação e Excel possuem contratos
explícitos e implementações locais, voláteis e marcadas como demonstração nesta entrega.  
**Motivo:** validar o fluxo sem contratar serviços, solicitar credenciais ou acessar a planilha oficial.  
**Consequência:** nenhum adaptador local é adequado para produção; os provedores serão selecionados
depois sem acoplar componentes visuais ao fornecedor.

## ADR-011 — Rotas canônicas do prompt com aliases legados

**Decisão:** usar `/comparar`, `/admin/pesquisa`, `/admin/revisoes` e `/admin/sincronizacao` como rotas
canônicas, preservando redirecionamentos de `/comparador`, `/admin/entrada`, `/admin/revisao` e
`/admin/excel`.  
**Motivo:** o prompt de implementação atualizou os nomes depois da documentação de arquitetura.  
**Consequência:** a navegação segue o contrato mais recente sem quebrar referências antigas.

## ADR-012 — OneDrive pessoal e intercâmbio de arquivo

**Decisão:** a planilha oficial está em OneDrive pessoal; a integração inicial seguirá o modo de
intercâmbio de XLSX versionado, sem Microsoft Graph.  
**Motivo:** o modo Graph para workbooks é recomendado para OneDrive for Business ou SharePoint e
exigiria credenciais e permissões ainda fora do escopo.  
**Consequência:** importação, diff, aprovação, backup e geração de nova versão ocorrerão localmente.

## ADR-013 — Um único administrador na etapa local

**Decisão:** somente o papel de administrador será provisionado nesta etapa.  
**Motivo:** reduzir complexidade operacional enquanto existe apenas um responsável pelo ambiente.  
**Consequência:** o administrador poderá criar e aprovar propostas, mas toda ação continuará auditada.
Os papéis de curador e revisor permanecem no contrato para ativação futura.

## ADR-014 — Persistência e arquivos locais

**Decisão:** banco, autenticação e storage permanecerão locais antes da publicação. A recomendação é
PostgreSQL local, autenticação de um administrador e filesystem privado em `local/private/`.  
**Motivo:** evitar contratação e credenciais externas sem abandonar a arquitetura relacional aprovada.  
**Consequência:** a migração futura para serviços gerenciados deverá ocorrer por adaptadores, sem alterar
o domínio. A planilha pública será uma cópia sanitizada separada do mestre.

## ADR-015 — PostgreSQL local conteinerizado

**Decisão:** executar PostgreSQL 18.4 em Docker Desktop, exposto somente em `127.0.0.1:5433`, com os
dados em volume Docker nomeado e cliente do Next.js inicializado apenas no servidor e sob demanda.  
**Motivo:** preservar a arquitetura relacional aprovada, evitar instalação nativa e impedir que arquivos
do banco sejam sincronizados pelo OneDrive.  
**Consequência:** credenciais permanecem em arquivos locais ignorados; a conexão pode ser substituída
por um serviço gerenciado sem acoplar componentes de interface ao fornecedor.

## ADR-016 — XLSX transitório e snapshot lógico persistido

**Decisão:** no modo OneDrive pessoal, o navegador envia a versão atual para prévia e novamente para
aplicação; o servidor valida o mesmo SHA-256, persiste somente metadados e células controladas e devolve
o XLSX completo na própria resposta.

**Motivo:** a Vercel não oferece filesystem persistente e o Incremento 4 não justifica contratar object
storage apenas para manter uma cópia transitória que o administrador já possui.

**Consequência:** backup e substituição do mestre são confirmações locais obrigatórias; hashes, versões,
itens, conflitos, decisões e auditoria permanecem duráveis no PostgreSQL. Uma futura integração Graph ou
Blob poderá reutilizar o contrato sem alterar o de-para e as regras de domínio.
