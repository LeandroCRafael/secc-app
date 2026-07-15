# AGENTS.md — SECC App

## Escopo

Este diretório é a fronteira pública do produto SECC. Trabalhos de interface, exportação pública,
testes, documentação do produto e configuração de publicação devem permanecer aqui.

Não acessar ou copiar dados do workspace pai para arquivos públicos sem passar pelas regras de
sanitização e pelo contrato de dados.

## Objetivo do produto

Construir uma aplicação web executiva, navegável e responsiva para:

- explorar o portfólio de empresas;
- acompanhar indicadores financeiros em torno do evento de reestruturação;
- comparar empresas e trajetórias;
- visualizar qualidade, cobertura, fonte e limitações;
- explicar a metodologia de forma auditável;
- receber pesquisas, formulários e arquivos em uma área protegida;
- permitir revisão, aprovação e rastreamento das alterações;
- sincronizar dados aprovados com a planilha de acompanhamento do Estevão;
- receber futuramente um motor de score versionado e validado.

## Diretrizes técnicas para a etapa de código

- Preferência: Next.js com App Router, TypeScript e publicação no Vercel.
- Usar componentes acessíveis, responsivos e testáveis.
- Separar apresentação, regras de domínio e acesso aos dados.
- Usar banco relacional como base operacional para dados, revisões, status e auditoria.
- Armazenar arquivos enviados em object storage; manter metadados e vínculos no banco.
- A área pública consome somente registros aprovados ou snapshots em `data/public/`.
- Integrar o Excel por um serviço de sincronização controlada, nunca por escrita direta dispersa
  nos componentes da interface.
- Antes de gravar no Excel, validar versão do arquivo, criar backup, aplicar lote idempotente e
  registrar resultado da sincronização.
- Alterações importadas do Excel devem gerar diff e revisão antes de atualizar registros aprovados.
- Não incluir segredos no navegador nem no repositório.
- Proteger todas as ações de escrita e atribuí-las a um usuário autenticado.
- Implementar papéis mínimos: leitor público, curador, revisor e administrador.
- Tratar uploads como não confiáveis: limitar tipo e tamanho, validar conteúdo, armazenar em área
  privada e impedir publicação automática.
- Datas, moedas, percentuais e estados de ausência devem ser tipados e formatados de modo
  consistente.
- Gráficos devem expor unidade, período, fonte e lacunas.

## Linguagem e posicionamento

- Português do Brasil.
- Tom executivo, analítico e sóbrio.
- Não usar linguagem promocional, alarmista ou conclusões além das evidências.
- Informar que o projeto tem finalidade acadêmica e informacional.
- Não apresentar indicadores como recomendação de crédito ou investimento.

## Critérios de conclusão da primeira versão

- Build de produção aprovado.
- Navegação funcional nas rotas definidas.
- Área protegida com entrada manual, upload, fila de revisão e aprovação.
- Sincronização com Excel testada com backup, diff, idempotência e conflito.
- Dados públicos validados contra o manifesto.
- Estados de carregamento, vazio e erro tratados.
- Acessibilidade e responsividade verificadas.
- Nenhum segredo ou arquivo bruto no histórico do repositório.
- Trilha de auditoria para toda inclusão, alteração, aprovação e sincronização.
- Metodologia, fontes, data de atualização e limitações visíveis.
