# Prompt de transição para o ChatGPT Code — SECC App

Você está assumindo a implementação do **SECC App**, uma plataforma de pesquisa e acompanhamento de
empresas brasileiras em estresse financeiro e reestruturação. Trabalhe em português do Brasil e
trate este projeto como produto financeiro com exigência de rastreabilidade, governança e qualidade
de dados.

## 1. Diretório de trabalho

Abra a pasta `secc-app/` como workspace independente e trabalhe exclusivamente nela. Essa pasta será
a raiz do futuro repositório público no GitHub e do projeto publicado na Vercel.
Não inicialize Git, não publique no GitHub e não faça deploy até receber autorização expressa.

O diretório pai é um workspace privado. Não mova, copie, publique ou versione arquivos desse nível,
especialmente planilhas, backups, documentos, ZIPs, dados brutos, segredos ou caminhos locais.

## 2. Leitura obrigatória antes de alterar arquivos

Leia integralmente e nesta ordem:

1. `AGENTS.md`
2. `README.md`
3. `docs/CONTEXTO_DO_PRODUTO.md`
4. `docs/ARQUITETURA.md`
5. `docs/CONTRATO_DE_DADOS.md`
6. `docs/FLUXO_DE_DADOS_E_EXCEL.md`
7. `docs/UPLOADS_E_CURADORIA.md`
8. `docs/DECISOES.md`
9. `docs/ROADMAP.md`
10. `data/README.md`
11. `src/README.md`

Depois da leitura, inspecione toda a estrutura existente e apresente um plano curto de implementação.
Não substitua decisões documentadas por convenções genéricas sem registrar e justificar a mudança.

## 3. Objetivo desta etapa

Construir a fundação técnica navegável do SECC App, preparando:

- área pública de consulta;
- área protegida de pesquisa e curadoria;
- entrada manual de dados;
- upload controlado de arquivos;
- revisão e aprovação;
- base operacional versionada;
- futura sincronização bidirecional com a planilha oficial do Estevão;
- publicação futura no GitHub e na Vercel.

Não implementar score, rating, probabilidade de default ou classificação de crédito. A metodologia
ainda não foi validada.

## 4. Premissa central sobre o Excel

A planilha do Estevão não será descartada. Ela continuará sendo instrumento oficial de
acompanhamento e poderá originar ou receber dados.

Responsabilidades:

- documentos originais são evidências;
- o banco operacional controla propostas, revisões, aprovações, conflitos e auditoria;
- o Excel é a visão oficial humana e um canal controlado de entrada e saída;
- a área pública consome somente releases aprovadas e sanitizadas.

Não crie escrita direta e dispersa em células a partir de formulários. Toda alteração deve seguir:

`entrada -> proposta -> validação -> revisão -> aprovação -> banco -> sincronização -> publicação`

Aprovação, sincronização com Excel e publicação são eventos distintos.

## 5. Tecnologia-base

Use como padrão, salvo incompatibilidade técnica demonstrada:

- Next.js com App Router;
- TypeScript em modo estrito;
- React;
- Tailwind CSS;
- componentes acessíveis e reutilizáveis;
- banco relacional compatível com Postgres;
- armazenamento privado de objetos para uploads;
- validação de entrada com schema;
- testes unitários, de integração, segurança e sincronização.

Antes de instalar dependências, verifique as versões estáveis atuais e compatibilidade entre elas.
Evite bibliotecas sem necessidade concreta. Não provisione serviços pagos nem crie recursos externos
sem autorização.

## 6. Primeira entrega de código

Implemente uma fundação vertical, pequena e verificável, nesta sequência:

### 6.1 Inicialização e qualidade

- inicializar o projeto dentro da estrutura existente, sem apagar a documentação;
- configurar TypeScript estrito, lint, formatação e testes;
- manter `.env.example` apenas com nomes e descrições, nunca valores reais;
- criar comandos claros para desenvolvimento, build, lint, typecheck e testes;
- atualizar o README com instruções reproduzíveis.

### 6.2 Shell visual e navegação

Criar uma identidade visual sóbria, executiva e própria para análise financeira. Evitar aparência de
template genérico ou painel administrativo excessivamente carregado.

Rotas iniciais públicas:

- `/`
- `/empresas`
- `/empresas/[slug]`
- `/comparar`
- `/metodologia`
- `/dados`
- `/sobre`

Rotas protegidas estruturadas, mesmo que inicialmente usem dados locais de demonstração:

- `/admin`
- `/admin/pesquisa`
- `/admin/importacoes`
- `/admin/revisoes`
- `/admin/conflitos`
- `/admin/sincronizacao`
- `/admin/auditoria`

O público deve distinguir claramente dado confirmado, vazio, `N/D`, não aplicável, período futuro,
em revisão e conflito. Ausência nunca pode ser exibida como zero.

### 6.3 Domínio e contratos

- implementar tipos e schemas a partir de `docs/CONTRATO_DE_DADOS.md`;
- separar domínio operacional, importação, Excel e publicação;
- criar interfaces de repositório para não acoplar componentes visuais ao provedor de banco;
- criar adaptadores explícitos para storage, autenticação e Excel;
- manter o de-para de Excel isolado de páginas e componentes.

### 6.4 Demonstração segura do fluxo

Criar um fluxo local demonstrável, usando dados fictícios claramente identificados como demo:

1. cadastrar uma proposta manual;
2. validar campos, unidade, período e fonte;
3. colocar a proposta na fila de revisão;
4. aprovar ou rejeitar;
5. registrar evento de auditoria;
6. exibir a alteração aprovada em uma prévia de sincronização;
7. gerar uma prévia de release pública sem incluir registros não aprovados.

Dados de demonstração não podem ser confundidos com dados reais do SECC e devem ser fáceis de
remover.

## 7. Uploads

Prepare a arquitetura para:

- formulário manual com fonte obrigatória;
- XLSX e CSV estruturados;
- PDF e documentos usados como evidência;
- importação da planilha oficial.

Nesta primeira entrega, priorize formulário manual e uma prévia segura de XLSX/CSV. Não prometa
extração automática confiável de documentos livres.

Uploads devem ter allowlist de tipos, limites de tamanho e quantidade, validação de MIME e assinatura,
hash, nome interno, armazenamento privado e estado de processamento. Nenhum upload atualiza dados
aprovados ou públicos automaticamente.

## 8. Integração com a planilha

Crie o contrato e a interface do adaptador, mas não conecte uma planilha real sem confirmar primeiro
se o arquivo oficial está em:

- OneDrive pessoal;
- OneDrive for Business; ou
- SharePoint.

Modos previstos:

- Microsoft Graph para OneDrive for Business ou SharePoint;
- intercâmbio de XLSX versionado como fallback.

Implemente inicialmente um adaptador local simulado que permita testar diff, idempotência, conflito
de versão, backup e resultado do lote. Não use a planilha real nem credenciais nesta fase.

## 9. Segurança e governança

- separar rotas públicas e protegidas;
- prever papéis `public`, `curator`, `reviewer` e `admin`;
- validar autorização no servidor, não apenas na interface;
- tratar todos os uploads como não confiáveis;
- impedir exposição de storage privado, caminhos locais e segredos;
- não colocar dados privados em logs;
- registrar autor, horário, versão anterior, proposta, decisão, justificativa e origem;
- impedir overwrite silencioso e usar controle de versão otimista;
- tornar operações repetíveis idempotentes;
- garantir que somente registros aprovados e autorizados entrem na release pública.

Não copie nenhum arquivo real do diretório pai para criar exemplos ou fixtures.

## 10. Experiência visual

A interface deve comunicar análise, confiança e transparência. Priorize:

- leitura executiva;
- hierarquia visual clara;
- títulos conclusivos;
- navegação simples;
- boa visualização de séries históricas e status;
- estados vazios e mensagens de erro úteis;
- responsividade e acessibilidade;
- proveniência visível perto do dado;
- distinção clara entre área pública e ambiente de curadoria.

Antes de consolidar o visual, monte uma primeira direção com tokens de cor, tipografia, espaçamento,
componentes-base e dois exemplos de página: home pública e caixa de revisões.

## 11. Forma de trabalho

- preserve todos os arquivos válidos já existentes;
- faça mudanças incrementais e verificáveis;
- registre novas decisões relevantes em `docs/DECISOES.md`;
- mantenha o roadmap atualizado;
- não esconda limitações com mocks ou números inventados;
- use premissas razoáveis quando reversíveis e documente-as;
- pare e peça decisão apenas quando a escolha for material, irreversível ou exigir serviço externo;
- ao concluir cada marco, execute lint, typecheck, testes e build;
- faça uma verificação visual real das rotas implementadas.

## 12. Critérios de aceite da primeira entrega

A primeira entrega estará concluída quando:

- o projeto instalar, executar e compilar de forma reproduzível;
- rotas públicas e protegidas tiverem navegação coerente;
- o fluxo demonstrativo de proposta, revisão, aprovação e auditoria funcionar;
- registros não aprovados não aparecerem na prévia pública;
- a prévia de sincronização detectar conflito de versão e repetição de lote;
- schemas e tipos estiverem separados por contrato;
- uploads inválidos forem rejeitados de forma segura;
- estados de disponibilidade forem exibidos corretamente;
- testes, lint, typecheck e build passarem;
- não houver planilhas, documentos, dados privados, segredos ou caminhos locais no conteúdo
  versionável;
- documentação e decisões estiverem atualizadas.

## 13. Entrega esperada ao final do trabalho

Apresente:

1. o que foi construído;
2. as principais decisões técnicas e visuais;
3. os testes e verificações executados;
4. limitações e riscos remanescentes;
5. arquivos principais alterados;
6. próximos passos priorizados;
7. decisões que ainda dependem de Leandro, especialmente o local e o tipo da conta da planilha.

Comece agora pela leitura obrigatória, inspeção da estrutura e apresentação do plano. Em seguida,
implemente a primeira entrega sem publicar externamente e sem acessar a planilha real.
