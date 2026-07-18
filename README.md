# SECC App

Fundação técnica navegável do SECC, uma plataforma acadêmica e informacional para organizar
evidências de empresas brasileiras em estresse e reestruturação. A área pública usa dados
fictícios marcados como demonstração; a área local protegida pode ler a planilha mestre sem publicar
seus dados. Não apresenta score, rating ou probabilidade de default.

## Pré-requisitos

- Node.js 20.9 ou superior;
- npm 11 ou superior recomendado.
- para persistência local: WSL 2 e Docker Desktop.

## Execução reproduzível

```powershell
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`. A persistência pode usar o Docker local ou a
conexão Neon sincronizada pela Vercel em `.env.local`; arquivos de ambiente nunca são versionados.

## Publicação interna

A versão de produção mantém as rotas informacionais e habilita `/admin` para uso interno. O acesso exige
autenticação HTTP configurada na Vercel e usa PostgreSQL gerenciado como base operacional persistente.
Um snapshot comprimido permanece como contingência de leitura; a planilha não é versionada no GitHub.
Arquivos-fonte e backups continuam fora do deploy.

URL permanente da prévia: [secc-app.vercel.app](https://secc-app.vercel.app).

O fluxo de GitHub e Vercel está documentado em `docs/PUBLICACAO_CONTINUA.md`.

## PostgreSQL local

Depois de instalar e iniciar o Docker Desktop:

```powershell
.\scripts\setup-local-postgres.ps1
npm run db:status
npm run db:check
npm run db:migrate
npm run db:schema:check
```

O `compose.yaml` fixa PostgreSQL 18.4, expõe a porta apenas em `127.0.0.1:5433` e grava os dados em
volume Docker nomeado, fora da sincronização do OneDrive.
O cliente da aplicação é criado somente no servidor e sob demanda; o diagnóstico protegido fica em
`/admin/banco`.

## PostgreSQL gerenciado

Produção, preview e desenvolvimento recebem `DATABASE_URL` pela integração Neon do Marketplace da
Vercel. As migrações de schema continuam versionadas em `db/migrations/`. A carga inicial entre bancos
usa `scripts/migrate-operational-data.mjs`, exige origem e destino distintos e só aceita destino vazio;
ao final, reconcilia as contagens de todas as tabelas operacionais.

## Controles de qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Escopo implementado

- rotas públicas `/`, `/empresas`, `/empresas/[slug]`, `/comparar`, `/metodologia`, `/dados` e `/sobre`;
- área de curadoria em `/admin`, protegida por credencial interna compartilhada em produção;
- diagnóstico por empresa calculado diretamente da planilha mestre, com cobertura financeira,
  qualitativa e de mercado persistida sem copiar os valores para a área pública;
- estação operacional por empresa em `/admin/empresas/[id]`, reunindo diagnóstico, pesquisa CVM,
  entrada manual, histórico de propostas, contexto de fonte e rastreabilidade;
- Empresa 360 protegida sobre a mesma rota, com coorte piloto dinâmica, séries da última linha de base
  controlada, indicadores derivados, períodos relativos ao evento, fontes, lacunas e mudanças em fluxo;
- comparador executivo protegido em `/admin/comparar`, com seleção de até quatro empresas, cobertura
  lado a lado, indicadores derivados e trajetórias alinhadas de `t-2` a `t+2` sem converter lacunas em zero;
- pesquisa no cadastro oficial da CVM e coleta de um exercício da DFP em propostas idempotentes,
  sempre submetidas à fila de revisão;
- formulário manual validado por schema e fila de revisão persistida no PostgreSQL;
- aprovação/rejeição com justificativa, versão esperada e auditoria atômica; prévia de release ainda demonstrativa;
- importação estruturada de CSV/XLSX com allowlist, limite, MIME, assinatura, prévia persistida,
  validação por linha, idempotência e envio controlado de propostas à revisão;
- sincronização bidirecional do XLSX mestre com prévia por célula, SHA-256, versão do de-para,
  backup obrigatório, resolução explícita de conflitos e geração de uma nova versão completa;
- alterações feitas no Excel detectadas contra o último snapshot e enviadas como propostas
  idempotentes à fila de revisão, sem sobrescrever registros aprovados;
- contratos separados entre domínio operacional, importação, Excel e publicação.
- coletor CVM compatível com os formatos decimais da DFP e atualização idempotente de propostas que
  ainda estão em revisão; valores com escala materialmente suspeita ficam fora dos indicadores.
- schema PostgreSQL versionado e repositório operacional server-only para empresas, propostas,
  decisões e auditoria.
- entrada manual de empresas e propostas por Server Actions, com validação no servidor e auditoria
  gravada na mesma transação.

## Limitações deliberadas

- a autenticação ainda usa um único administrador compartilhado; cadastro, proposta, revisão e
  auditoria já persistem no PostgreSQL, sempre separados da publicação;
- o de-para v1 cobre as abas de dados financeiros, qualitativos e de mercado da planilha mestre;
  macro, fontes, glossário e campos de observação ainda não recebem escrita automática;
- por se tratar de OneDrive pessoal, o backup e a substituição da planilha oficial continuam como
  atos manuais do administrador; o servidor não armazena o XLSX bruto nem depende de filesystem persistente;
- a importação estruturada persiste hash, metadados e linhas normalizadas; o arquivo bruto é processado
  de forma transitória e ainda não é mantido em object storage;
- a vitrine pública demonstrativa permanece separada; o diagnóstico interno persiste no PostgreSQL gerenciado;
- o GitHub contém somente código e estruturas sanitizadas; o snapshot interno é mantido fora do repositório;
- o dashboard interno usa persistência gerenciada; ações de escrita continuam sujeitas a proposta, revisão e auditoria;
- a planilha está em OneDrive pessoal; o modo selecionado é intercâmbio de arquivo versionado.

## Segurança e dados

Não copie arquivos do workspace pai para esta pasta. Uploads nunca atualizam registros aprovados ou
releases automaticamente. A área pública futura consumirá somente snapshots aprovados e sanitizados
em `data/public/`.

Os artefatos operacionais locais são organizados em `local/private/`. A planilha oficial, entradas,
backups, evidências e uploads permanecem privados e ignorados pelo Git. Uma eventual divulgação pelo
OneDrive deve usar exclusivamente a cópia sanitizada em `local/publicacao-onedrive/excel-sanitizado/`,
nunca o mestre oficial.

Infraestrutura atual: PostgreSQL gerenciado em produção, PostgreSQL local para desenvolvimento e
filesystem privado para arquivos-fonte. Consulte `docs/RECOMENDACAO_AMBIENTE_LOCAL.md` para o ambiente local.

Leitura arquitetural obrigatória: `PROMPT_CODE.md`, `AGENTS.md` e os documentos em `docs/`.
