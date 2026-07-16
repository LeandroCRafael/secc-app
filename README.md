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

A aplicação estará disponível em `http://localhost:3000`. Nenhuma variável é necessária para o modo
demo volátil. A persistência PostgreSQL usa `.env.docker` e `.env.local`, gerados localmente pelo script
de configuração e nunca versionados.

## Publicação interna

A versão de produção mantém as rotas informacionais e também pode habilitar o dashboard `/admin` para
uso interno. O acesso exige autenticação HTTP configurada na Vercel e consome um snapshot comprimido
armazenado como variável protegida; a base da planilha não é versionada no GitHub. O snapshot publicado
é somente leitura. PostgreSQL, planilha, uploads e operações de curadoria permanecem locais nesta etapa.

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
- diagnóstico por empresa calculado diretamente da planilha mestre, com cobertura financeira,
  qualitativa e de mercado persistida sem copiar os valores para a área pública;
- pesquisa no cadastro oficial da CVM e coleta de um exercício da DFP em propostas idempotentes,
  sempre submetidas à fila de revisão;
- formulário manual validado por schema e fila de revisão persistida no PostgreSQL;
- aprovação/rejeição com justificativa, versão esperada e auditoria atômica; prévia de release ainda demonstrativa;
- upload local de CSV/XLSX com allowlist, limite, MIME e assinatura, sem persistência;
- intercâmbio local com leitura de XLSX, backup da origem, staging de propostas aprovadas,
  deduplicação por proposta e download de uma nova versão para conferência;
- contratos separados entre domínio operacional, importação, Excel e publicação.
- schema PostgreSQL versionado e repositório operacional server-only para empresas, propostas,
  decisões e auditoria.
- entrada manual de empresas e propostas por Server Actions, com validação no servidor e auditoria
  gravada na mesma transação.

## Limitações deliberadas

- a autenticação ainda usa adaptador local de um único administrador; cadastro, proposta, revisão e
  auditoria já persistem no PostgreSQL, sempre separados da publicação;
- a sincronização escreve somente na aba controlada `SECC_App_Staging`; o de-para para as nove abas
  da planilha oficial ainda depende da validação do arquivo e do mapeamento usados pelo Estevão;
- o estado da vitrine pública demonstrativa é volátil; o diagnóstico local persiste no PostgreSQL;
- o GitHub contém somente código e estruturas sanitizadas; o snapshot interno é mantido fora do repositório;
- o dashboard interno publicado é um espelho de leitura e não possui persistência nem serviços de escrita;
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
