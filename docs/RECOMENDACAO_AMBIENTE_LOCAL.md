# Recomendação de infraestrutura local

Status: recomendação aprovada em princípio; implementação da persistência ainda pendente.  
Data: 15/07/2026.

## Recomendação executiva

Manter a próxima etapa integralmente local, sem contratar banco, autenticação ou storage.

| Componente | Recomendação | Motivo principal |
|---|---|---|
| Banco operacional | PostgreSQL local, preferencialmente em Docker | Preserva a arquitetura aprovada e facilita migração futura |
| Autenticação | Um administrador local, com senha somente como hash Argon2id | Atende o escopo sem provedor externo |
| Sessão | Cookie seguro, `httpOnly`, `sameSite=strict` e segredo local | Mantém autorização no servidor |
| Arquivos | Filesystem em `local/private/`, fora de `public/` e ignorado pelo Git | Simplicidade e privacidade local |
| Excel | Intercâmbio de arquivo versionado | OneDrive pessoal não é o cenário recomendado para Excel via Graph |
| Publicação Excel | Cópia sanitizada em pasta separada | Impede exposição do mestre e de dados não aprovados |

## Alternativas avaliadas

### SQLite

É mais simples para um usuário, mas criaria divergência em relação ao banco compatível com PostgreSQL
já aprovado. Não é a recomendação para o SECC.

### PostgreSQL instalado diretamente no Windows

É tecnicamente válido. Docker é preferível pela reversibilidade e isolamento; a instalação nativa deve
ser usada se Docker não estiver disponível ou não for desejado.

### Autenticação terceirizada

Clerk, Auth0, Descope ou equivalente podem ser reconsiderados quando houver mais usuários. Contratar
agora adicionaria dependência e custo sem benefício material para um único administrador.

## Controles antes de persistir dados reais

1. Definir a identidade do administrador e gerar o hash de senha fora do código.
2. Configurar `.env.local`, nunca versionado.
3. Criar volume e política de backup do PostgreSQL.
4. Restringir `local/private/` ao usuário responsável no Windows.
5. Validar hash, extensão, MIME, tamanho e assinatura de todo upload.
6. Gerar release pública por processo determinístico, sem copiar a planilha mestre.

Quando houver mais de um usuário, deverão ser reavaliados os papéis de curador e revisor e a segregação
de funções. Até lá, o administrador acumula as ações, mantendo trilha de auditoria obrigatória.
