# Uploads, pesquisa e curadoria

## 1. Canais de entrada

O app deverá aceitar quatro caminhos, todos submetidos ao mesmo processo de validação:

1. **Pesquisa e input manual:** formulário estruturado, com fonte e data obrigatórias.
2. **Arquivo estruturado:** XLSX ou CSV com mapeamento de colunas e prévia da importação.
3. **Documento-fonte:** PDF ou documento armazenado como evidência, com extração assistida futura.
4. **Planilha oficial:** mudanças detectadas na versão do Excel usada pelo Estevão.

Conectores com fontes externas podem ser adicionados depois sem alterar o contrato de propostas.

## 2. Escopo recomendado para o primeiro produto

- formulário manual de dados financeiros, qualitativos e referências;
- upload de XLSX e CSV com template conhecido;
- armazenamento privado de PDF e outros documentos como evidência;
- prévia, validação e aprovação humana;
- extração automática de documentos livres somente em fase posterior.

Essa sequência entrega controle operacional sem pressupor que qualquer documento possa ser lido com
precisão suficiente para atualizar a base sem revisão.

## 3. Segurança dos arquivos

Todo upload é não confiável até validação. O sistema deve:

- permitir apenas extensões e tipos necessários;
- validar extensão, MIME e assinatura do arquivo;
- aplicar limites de tamanho, quantidade e frequência;
- calcular hash para duplicidade e rastreabilidade;
- armazenar o original em área privada;
- gerar nomes internos, sem usar o nome recebido como caminho;
- registrar usuário, data, origem e finalidade;
- bloquear macros e conteúdo ativo quando não forem indispensáveis;
- nunca expor URL privada no dataset público;
- permitir quarentena, rejeição e exclusão governada.

## 4. Processo de ingestão

```text
recebido -> validando -> mapeado -> prévia -> em revisão
         -> aprovado -> incorporado -> sincronizado
         -> requer ajuste | rejeitado | em conflito
```

O usuário deve ver contagens de registros recebidos, válidos, inválidos, duplicados e conflitantes,
além de uma comparação entre valor anterior, valor proposto e evidência.

## 5. Pesquisa manual

O formulário de pesquisa deve exigir:

- empresa e período;
- variável e valor tipado;
- unidade e estado de disponibilidade;
- fonte, URL ou documento;
- data de referência e data de coleta;
- observação e premissa, quando aplicável;
- identificação do pesquisador.

Salvar o formulário cria uma proposta; não altera imediatamente a versão aprovada.

## 6. Importação estruturada

Antes da confirmação, o app apresenta:

- aba e cabeçalho identificados;
- de-para aplicado;
- erros de tipo, unidade e chave;
- empresas ou anos sem cadastro;
- campos ignorados;
- diferenças contra a base atual;
- impacto previsto na planilha oficial.

Templates desconhecidos podem ser enviados, mas permanecem bloqueados até o mapeamento ser aprovado.

## 7. Papéis

- **Público:** consulta releases publicadas.
- **Curador:** pesquisa, envia arquivos e corrige propostas.
- **Revisor:** aprova, rejeita e resolve conflitos.
- **Administrador:** gerencia usuários, schemas, integrações e rollback.

Para mudanças materiais, a mesma pessoa não deve criar e aprovar a proposta. Essa segregação pode
ser configurada por tipo de dado e fase do projeto.

## 8. Auditoria

Cada decisão mantém autor, horário, versão anterior, versão proposta, justificativa, fonte, arquivo
de origem, validações executadas e destino da alteração. Reprocessar o mesmo lote com a mesma chave
não pode duplicar dados nem gerar uma segunda escrita no Excel.

