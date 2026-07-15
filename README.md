# SECC App

Fundação técnica navegável do SECC, uma plataforma acadêmica e informacional para organizar
evidências de empresas brasileiras em estresse e reestruturação. A versão atual usa somente dados
fictícios marcados como demonstração. Não apresenta score, rating ou probabilidade de default.

## Pré-requisitos

- Node.js 20.9 ou superior;
- npm 11 ou superior recomendado.
- para persistência local: WSL 2 e Docker Desktop.

## Execução reproduzível

```powershell
npm install
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`. Nenhuma variável é necessária para o modo
demo volátil. A persistência PostgreSQL usa `.env.docker` e `.env.local`, gerados localmente pelo script
de configuração e nunca versionados.

## Prévia pública

A versão de produção é uma vitrine segura do trabalho em andamento. Ela publica as rotas informacionais
e a visão `/construindo`, mas remove o acesso à curadoria e redireciona `/admin`. Banco PostgreSQL,
planilha, uploads e filesystem privado permanecem exclusivamente locais nesta etapa.

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

## Controles de qualidade

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

## Escopo implementado

- rotas públicas `/`, `/empresas`, `/empresas/[slug]`, `/comparar`, `/metodologia`, `/dados` e `/sobre`;
- área de curadoria em `/admin`, protegida por adaptador local explicitamente demo;
- formulário manual validado por schema e fila de revisão persistida no PostgreSQL;
- aprovação/rejeição com justificativa, versão esperada e auditoria atômica; prévia de release ainda demonstrativa;
- upload local de CSV/XLSX com allowlist, limite, MIME e assinatura, sem persistência;
- adaptador Excel local com backup planejado, conflito otimista e idempotência;
- contratos separados entre domínio operacional, importação, Excel e publicação.
- schema PostgreSQL versionado e repositório operacional server-only para empresas, propostas,
  decisões e auditoria.
- entrada manual de empresas e propostas por Server Actions, com validação no servidor e auditoria
  gravada na mesma transação.

## Limitações deliberadas

- a autenticação ainda usa adaptador local de um único administrador; cadastro, proposta, revisão e
  auditoria já persistem no PostgreSQL, sempre separados da publicação;
- o adaptador Excel é simulado e não acessa qualquer planilha;
- o estado interativo da demonstração é volátil e reinicia ao recarregar;
- o GitHub contém apenas a fronteira pública sanitizada; o deploy não habilita serviços operacionais;
- a prévia pública não possui persistência nem administração; sua finalidade é demonstrar produto,
  arquitetura e evolução;
- a planilha está em OneDrive pessoal; o modo selecionado é intercâmbio de arquivo versionado.

## Segurança e dados

Não copie arquivos do workspace pai para esta pasta. Uploads nunca atualizam registros aprovados ou
releases automaticamente. A área pública futura consumirá somente snapshots aprovados e sanitizados
em `data/public/`.

Os artefatos operacionais locais são organizados em `local/private/`. A planilha oficial, entradas,
backups, evidências e uploads permanecem privados e ignorados pelo Git. Uma eventual divulgação pelo
OneDrive deve usar exclusivamente a cópia sanitizada em `local/publicacao-onedrive/excel-sanitizado/`,
nunca o mestre oficial.

Infraestrutura definida para a próxima etapa: PostgreSQL local, um administrador local e filesystem
privado. Consulte `docs/RECOMENDACAO_AMBIENTE_LOCAL.md` antes de configurar persistência.

Leitura arquitetural obrigatória: `PROMPT_CODE.md`, `AGENTS.md` e os documentos em `docs/`.
