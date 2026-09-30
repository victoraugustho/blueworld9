# Escolas e inventário BlueWorld9

## Escopo e segurança de implantação

Módulo independente para escolas, vínculos de professores e turmas, inventários, solicitações, modelos e auditoria. Os itens cadastrados representam recursos sob domínio da BlueWorld9.

- Desligado por padrão: não aparece no menu e sua API retorna 404.
- A migração `scripts/046_schools_inventory.sql` cria somente oito tabelas novas com prefixo `bw_`. Não altera dados, colunas ou índices dos módulos existentes.
- Nenhuma rota cria tabelas ou executa reconciliação, migração ou preenchimento retroativo. GETs fazem apenas consultas.
- Turmas existentes são vinculadas pelo UUID. Nomes iguais não unificam turmas, aulas, alunos ou notas.
- A aplicação não precisa de `ENABLE_RUNTIME_SCHEMA_WRITES=true` para este módulo.
- Não foram executados comandos no banco do portal durante o desenvolvimento ou os testes. Testes usam PostgreSQL em memória, sem ler `DATABASE_URL`.

Não existe garantia de risco zero. Os testes isolados devem ser complementados pelo aceite em homologação com a configuração real de autenticação, proxy, PostgreSQL e implantação antes de liberar produção.

## Ativação

1. Faça backup do banco correto e confira a restauração em ambiente separado.
2. Na conexão de homologação, confirme `SELECT current_database(), current_user;`.
3. Verifique os pré-requisitos com a consulta abaixo. Os dois nomes devem existir.
4. Execute integralmente `scripts/046_schools_inventory.sql`. A transação usa limite de espera por bloqueios de cinco segundos; uma falha deve ser investigada, não ignorada.
5. Configure a variável abaixo e reinicie a aplicação. A mesma variável pode permanecer ausente ou `false` em produção enquanto homologa.
6. Execute o checklist funcional deste documento com admin e professor de teste.
7. Só após aceite, aplique o mesmo SQL e a variável em produção, com backup e janela controlada.

```sql
SELECT
  to_regclass('public.teachers') AS professores,
  to_regclass('public.teacher_classes') AS turmas;
```

```dotenv
# Ativar somente depois da migração e do aceite em homologação.
SCHOOLS_MODULE_ENABLED=true
```

O SQL é reexecutável no mesmo esquema. `IF NOT EXISTS` não corrige uma tabela criada manualmente com estrutura divergente. Se isso ocorrer, compare os esquemas antes de prosseguir; não apague dados para resolver.

Para desativar, configure `SCHOOLS_MODULE_ENABLED=false` e reinicie. Os dados ficam preservados, e os demais módulos continuam independentes. Não há necessidade de remover tabelas para reverter a ativação.

## Regras e permissões

| Operação | Admin | Professor |
| --- | --- | --- |
| Criar, editar e desativar escola | Sim | Não |
| Excluir escola sem vínculos e sem histórico de inventário | Sim, com confirmação | Não |
| Vincular professores e turmas existentes | Sim | Não |
| Ver escola e equipe | Todas | Apenas escolas ativas às quais está vinculado |
| Ver inventário em preparação | Sim | Não |
| Ver inventário publicado | Sim | Apenas escola vinculada |
| Criar e editar itens e quantidades diretamente | Sim | Não |
| Atualizar localização, condição e observações | Sim | Escola vinculada e inventário publicado |
| Informar item existente ou solicitar novo equipamento | Sim | Escola vinculada |
| Consultar solicitações | Todas da escola | Apenas suas próprias |
| Aprovar, recusar ou confirmar recebimento | Sim | Não |
| Criar, editar, excluir e aplicar modelos | Sim | Não |
| Publicar inventário inicial | Sim, com confirmação | Não |
| Consultar auditoria detalhada | Sim | Não |

A autorização segue `role`, com a compatibilidade já existente para contas sem role. Roles futuras desconhecidas não recebem acesso automaticamente. Sessão válida, aprovação e situação ativa continuam sendo verificadas pelo autenticador do portal. O vínculo escolar não altera permissões de materiais, projetos, blog ou notas.

Um professor pode participar de várias escolas. Uma turma pertence a no máximo uma escola. Ao escolher uma turma, a interface também seleciona seu professor. O servidor confirma essa relação, mesmo se a requisição vier de fora da interface.

Transferências de turmas do módulo antigo não concedem automaticamente acesso ao inventário para o novo professor. O admin deve revisar os vínculos da escola após a transferência. Isso evita ampliar permissões silenciosamente.

## Inventário e solicitações

Cada item possui nome, categoria livre, quantidade inteira, unidade, patrimônio individual opcional, série, localização, condição e observações. Condições: bom estado, manutenção, danificado e não localizado.

- Lotes: quantidade de 0 a 100.000, sem patrimônio individual.
- Patrimônio individual: quantidade 0 ou 1 e código único entre itens ativos, independentemente de maiúsculas/minúsculas.
- Baixa: remoção lógica com motivo obrigatório. Não apaga histórico.
- Escola com inventário ou solicitações não pode ser apagada: deve ser desativada.

### Inventário inicial

1. Admin cadastra um modelo com até 200 linhas de itens.
2. Na escola com inventário vazio e em preparação, aplica o modelo.
3. Itens são copiados e podem ser ajustados individualmente antes da publicação.
4. Admin confirma a publicação, liberando a consulta para a equipe vinculada.

Editar ou excluir o modelo depois não altera inventários que já o utilizaram. A aplicação de modelo não é permitida sobre inventário com histórico de itens nem após a publicação, evitando duplicações. A publicação não impede correções administrativas posteriores, que continuam auditadas.

### Item existente

`Pendente → conferência e aprovação do admin → incorporado ao inventário`.

O professor informa o item, mas não altera o estoque diretamente. Se recusado, a justificativa fica disponível sem criar estoque.

### Novo equipamento

`Pendente → aprovado, aguardando recebimento → incorporado ao inventário`.

Aprovação não significa recebimento físico. O admin confirma o recebimento em uma segunda operação, que cria o item exatamente uma vez. O módulo registra solicitações, não realiza compras nem pagamentos.

## Navegação e experiência

- Menu comum de admin/professor: **Escolas e inventário**.
- `/portal/dashboard/escolas`: escolas em lista, busca e paginação.
- `/portal/dashboard/escolas/modelos`: modelos, exclusivo do admin.
- `/portal/dashboard/escolas/historico`: histórico geral, incluindo modelos e escolas excluídas.
- `/portal/dashboard/escolas/{id}/inventory`: itens e preparação/publicação.
- `/portal/dashboard/escolas/{id}/requests`: solicitações e decisões.
- `/portal/dashboard/escolas/{id}/links`: professores e turmas.
- `/portal/dashboard/escolas/{id}/audit`: histórico específico da escola.

Telas adaptadas para português e espanhol, acompanhando a localização do portal. Listas compactas, identificação das turmas por UUID e horário na seleção, estados vazios, mensagens de erro e confirmação de ações sensíveis. Formulários não fecham ao clicar fora; ao fechar com alterações, há confirmação de descarte. O navegador também alerta ao recarregar/sair com alterações não salvas. Não há salvamento de rascunho automático local.

## Auditoria e consistência

`bw_school_audit` é o registro autoritativo: ator e nome, ação, escola, entidade, valores anteriores/posteriores e data. A mutação e seu evento são gravados na mesma transação: falha ao auditar implica rollback da alteração.

O registro é preservado quando modelos, escolas vazias ou contas são excluídos. Exclusões legadas de professor removem apenas seu vínculo, anulam referências operacionais opcionais nas solicitações e mantêm o nome histórico do solicitante. Exclusões legadas de turma removem apenas o vínculo escolar. O módulo não adiciona bloqueios a essas operações já existentes.

Também existe um espelho resumido na auditoria geral (`schools.*`), idempotente pelo identificador do comando. Essa integração apenas insere: não chama rotinas legadas de migração, reparação de esquema ou limpeza de logs. Se o esquema legado estiver indisponível, registra a falha no servidor sem desfazer o comando confirmado. Para detalhes antes/depois use `bw_school_audit`, que permanece autoritativa e transacional.

Atualizações recebem `version`; edições com versão antiga retornam 409, sem sobrescrever dados. Escritas da mesma escola são serializadas por bloqueio transacional. Cada envio tem `Idempotency-Key` UUID, evitando duplicação em repetição de rede. Reutilizar a chave com outro conteúdo/ator gera conflito, e a repetição de professor revalida seu acesso atual.

Os dados operacionais e a auditoria estão separados. Não há interface para apagar auditoria. Uma política futura de retenção e acesso de banco deve ser definida antes de introduzir limpeza automática.

## API

Endpoint autenticado: `/api/portal/schools`. Respostas não são compartilhadas por cache.

### GET

Parâmetros: `view`, `schoolId` UUID quando aplicável, `search` (até 160 caracteres) e `page` (a partir de 1). Listas têm 50 registros por página.

| view | Retorno |
| --- | --- |
| `schools` | `{ rows, total }`, filtrado por acesso e busca |
| `detail` | `{ school, teachers, classes }` |
| `inventory` | `{ rows, total }`; professor recebe lista vazia enquanto rascunho |
| `requests` | `{ rows, total }`, limitado ao próprio solicitante para professor |
| `audit` | `{ rows, total }`; sem `schoolId`, histórico geral administrativo |
| `templates` | `{ rows, total }`, admin |
| `options` | `{ teachers, classes }`, opções administrativas de vínculos |

A busca textual aplica-se a escolas, itens e modelos. As telas de solicitações e histórico usam paginação cronológica. Opções de vínculos carregam a seleção completa e oferecem busca local; a escrita limita cada lista a 1.000 vínculos por envio.

### POST

Headers: `Content-Type: application/json`, `Idempotency-Key: <UUID novo por intenção de alteração>`. Quando presente, `Origin` precisa coincidir com a origem do portal. Integrações devem preservar o Host/origem correto atrás do proxy. Corpo limitado a 150.000 bytes pela rota.

O contrato completo, validado estritamente, está em `lib/schools/contracts.ts`. Campos adicionais não previstos são recusados.

```json
{
  "action": "request.create",
  "schoolId": "UUID-DA-ESCOLA",
  "data": {
    "kind": "new",
    "name": "Arduino Uno",
    "quantity": 5,
    "unit": "un",
    "reason": "Novas atividades de circuitos"
  }
}
```

Comandos: `school.create/update/delete`, `links.replace`, `inventory.publish`, `item.create/update/organize/delete`, `request.create/review`, `template.create/update/delete/apply`.

Erros: 400 validação; 401 sessão ausente/expirada; 403 permissão/origem; 404 módulo desligado ou registro ausente; 409 conflito de versão, vínculo ou transição; 413 corpo excessivo; 503 migração ausente. Erros inesperados retornam mensagem genérica e são registrados no log do servidor, sem expor SQL ao cliente.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/schools/contracts.ts` | Validação, estados e contratos |
| `lib/schools/service.ts` | Regras de negócio, escopo e transações; banco injetável |
| `lib/schools/server.ts` | Adaptador postgres.js e flag |
| `lib/schools/audit.ts` | Espelho append-only na auditoria geral, sem manutenção do legado |
| `app/api/portal/schools/route.ts` | Sessão, HTTP, limites e mapeamento de erros |
| `app/(protected)/portal/dashboard/escolas/[[...path]]/page.tsx` | Autorização da página e localização |
| `components/schools/SchoolsClient.tsx` | Interface e formulários |
| `scripts/046_schools_inventory.sql` | Migração explícita e aditiva |

## Homologação automatizada

```sh
npm run test:schools
npm run test:schools:ui
npm run check:utf8
npx tsc --noEmit
npm run build
```

`test:schools` usa PostgreSQL real compilado para WebAssembly (PGlite) em memória e contratos HTTP com autenticação simulada. `test:schools:ui` abre Chromium headless com componente e serviço reais, API interceptada e banco em memória. Não sobe o portal nem lê `.env`. No Windows procura Chrome/Edge instalado; alternativamente, instale o navegador com `npx playwright install chromium` ou indique `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Cobertura: isolamento por escola/professor, roles, leitura sem DDL/DML, migração reexecutável, identidade das turmas, versões, idempotência, confirmação/recebimento, estados inválidos, unicidade de patrimônio, rollback na falha da auditoria, preservação do legado, acesso revogado, exclusões legadas, formulários, descarte protegido, publicação, viewport 360px e espanhol.

O build foi executado com `DATABASE_URL` substituída por um endereço local sem banco, e escritas de esquema desabilitadas. Os avisos de tracing em rotas preexistentes de arquivos de projetos não foram alterados por este módulo.

## Checklist de aceite em homologação

- [ ] Confirmar backup restaurável e identificação correta do banco.
- [ ] Aplicar SQL e verificar as oito tabelas novas; nenhuma nota/turma antiga alterada.
- [ ] Com flag desligada, menu ausente e API 404; agenda, notas, materiais e projetos continuam funcionando.
- [ ] Com flag ligada, admin cria duas escolas e vincula professores/turmas homônimas por IDs distintos.
- [ ] Professor vê apenas escola vinculada; URL direta de outra escola é recusada.
- [ ] Modelo gera inventário em preparação; professor só consulta itens após publicação.
- [ ] Admin edita quantidades e confirma publicação; professor organiza condição/localização/observações.
- [ ] Solicitação de item existente exige conferência antes de aumentar inventário.
- [ ] Solicitação nova aprovada não aumenta estoque; recebimento aumenta exatamente uma vez.
- [ ] Duas abas editando o mesmo item produzem conflito, não sobrescrita silenciosa.
- [ ] Remover vínculo revoga acesso; desativar escola preserva dados e bloqueia professor.
- [ ] Histórico exibe ator e antes/depois; exclusão/baixa exige confirmação.
- [ ] Sessão expirada segue o fluxo de reautenticação já existente no portal, sem gravação indevida.
- [ ] Validar dispositivos reais, navegação por teclado, PT/ES e proxy/Host de homologação.
- [ ] Conferir que agenda, aulas, alunos e notas permanecem iguais antes/depois.
- [ ] Registrar responsável, data, evidências e aceite antes da ativação em produção.

Os testes locais não substituem os itens acima que dependem da infraestrutura real. A implantação e o aceite de produção não foram executados automaticamente.
