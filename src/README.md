# Organização do código futuro

- `app/`: rotas públicas e protegidas, layouts e endpoints.
- `components/`: componentes visuais reutilizáveis.
- `features/`: módulos de negócio, incluindo intake, importação, revisão, sincronização e auditoria.
- `lib/auth/`: autenticação, autorização e papéis.
- `lib/database/`: acesso transacional ao banco operacional.
- `lib/storage/`: uploads e arquivos privados.
- `lib/parsers/`: leitura e validação de formatos recebidos.
- `lib/excel/`: de-para, comparação e integração com a planilha.
- `styles/`: tokens, estilos globais e temas.
- `types/`: tipos do domínio e contratos de integração.

O código será criado na próxima etapa, após a mudança para o modo Code.

