# Escolas e inventário BlueWorld9

## Escopo e segurança de implantação

Módulo independente para escolas, vínculos de professores e turmas, inventários, solicitações, modelos e auditoria. Os itens cadastrados representam recursos sob domínio da BlueWorld9.

- Desligado por padrão: não aparece no menu e sua API retorna 404.
- A migração `scripts/046_schools_inventory.sql` cria somente oito tabelas novas com prefixo `bw_`. Não altera dados, colunas ou índices dos módulos existentes.
- A evolução `scripts/047_inventory_units_and_categories.sql` acrescenta categorias e unidades físicas, e complementa apenas tabelas deste módulo. Preserva IDs, quantidades, observações e códigos antigos; não altera notas, agendas, alunos, professores ou permissões legadas.
- A evolução `scripts/048_inventory_kit_components.sql` acrescenta composição descritiva a itens e solicitações. Cadastros existentes recebem composição vazia; IDs, quantidades e saldos permanecem iguais.
- Nenhuma rota cria tabelas ou executa reconciliação, migração ou preenchimento retroativo. GETs fazem apenas consultas.
- Turmas existentes são vinculadas pelo UUID. Nomes iguais não unificam turmas, aulas, alunos ou notas.
- A aplicação não precisa de `ENABLE_RUNTIME_SCHEMA_WRITES=true` para este módulo.
- Não foram executados comandos no banco do portal durante o desenvolvimento ou os testes. Testes usam PostgreSQL em memória, sem ler `DATABASE_URL`.

Não existe garantia de risco zero. Os testes isolados devem ser complementados pelo aceite em homologação com a configuração real de autenticação, proxy, PostgreSQL e implantação antes de liberar produção.

## Ativação

1. Faça backup do banco correto e confira a restauração em ambiente separado.
2. Na conexão de homologação, confirme `SELECT current_database(), current_user;`.
3. Verifique os pré-requisitos com a consulta abaixo. Os dois nomes devem existir. Se o módulo já estiver ativo, configure `SCHOOLS_MODULE_ENABLED=false`, reinicie a aplicação e confirme API 404 antes de iniciar a manutenção.
4. Execute integralmente `scripts/046_schools_inventory.sql`, `scripts/047_inventory_units_and_categories.sql` e `scripts/048_inventory_kit_components.sql`, nessa ordem. Se 046/047 já estiverem instaladas, aplique apenas 048. As transações usam limite de espera por bloqueios de cinco segundos; uma falha deve ser investigada, não ignorada. Instale as migrações antes de disponibilizar a versão nova do módulo.
5. Faça o deploy da versão nova com o módulo ainda desativado. Só depois de confirmar o deploy e as migrações, configure a variável abaixo e reinicie a aplicação. A mesma variável pode permanecer ausente ou `false` em produção enquanto homologa.
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

**Atualização de instalações já ativas:** a versão anterior à evolução do inventário não preenche as novas referências e os saldos exigidos por 047. Não mantenha processos antigos gravando durante ou após essa migração. Drene operações em andamento e mantenha o módulo desativado durante o SQL e o redeploy. Em caso de falha, deixe o módulo desligado e publique uma correção compatível; não reative a versão antiga para gravar no esquema novo e não apague tabelas/colunas para tentar desfazer a atualização. Essa janela de manutenção é do módulo de escolas, não uma migração da agenda ou das notas.

## Regras e permissões

| Operação | Admin | Professor |
| --- | --- | --- |
| Criar, editar e desativar escola | Sim | Não |
| Excluir escola sem vínculos e sem histórico de inventário | Sim, com confirmação | Não |
| Vincular professores e turmas existentes | Sim | Não |
| Ver escola e equipe | Todas | Apenas escolas ativas às quais está vinculado |
| Ver inventário em preparação | Sim | Não |
| Ver inventário publicado | Sim | Apenas escola vinculada |
| Criar e editar cadastro de itens | Sim | Não |
| Registrar entrada, baixa ou individualização | Sim, com motivo e confirmação | Não |
| Atualizar localização e observações | Sim | Escola vinculada e inventário publicado |
| Alterar condição de uma unidade ou quantidade específica | Sim | Escola vinculada e inventário publicado |
| Gerenciar categorias e seus padrões | Sim | Não |
| Informar item existente ou solicitar novo equipamento | Sim | Escola vinculada |
| Consultar solicitações | Todas da escola | Apenas suas próprias |
| Aprovar, recusar ou confirmar recebimento | Sim | Não |
| Criar, editar, excluir e aplicar modelos | Sim | Não |
| Publicar inventário inicial | Sim, com confirmação | Não |
| Consultar auditoria detalhada | Sim | Não |
| Consultar histórico de movimentações de um item | Sim | Escola vinculada e inventário publicado |

A autorização segue `role`, com a compatibilidade já existente para contas sem role. Roles futuras desconhecidas não recebem acesso automaticamente. Sessão válida, aprovação e situação ativa continuam sendo verificadas pelo autenticador do portal. O vínculo escolar não altera permissões de materiais, projetos, blog ou notas.

Um professor pode participar de várias escolas. Uma turma pertence a no máximo uma escola. Ao escolher uma turma, a interface também seleciona seu professor. O servidor confirma essa relação, mesmo se a requisição vier de fora da interface.

Transferências de turmas do módulo antigo não concedem automaticamente acesso ao inventário para o novo professor. O admin deve revisar os vínculos da escola após a transferência. Isso evita ampliar permissões silenciosamente.

## Inventário e solicitações

### Categorias e identificação

Categorias são pré-cadastradas e administradas separadamente, com nome/descrição em PT e ES, situação ativa, unidade padrão e controle padrão. Categorias iniciais: Geral, Computadores e tablets, Circuitos, Robótica, Ferramentas e Materiais de consumo. Classificações antigas de itens/modelos são importadas durante 047, sem apagar os textos históricos. A categoria Geral é reservada e não pode ser excluída/desativada.

Ao reexecutar 047, somente referências/campos ausentes são completados: linhas já configuradas de um modelo misto mantêm categoria por ID, controle individual e composição. Nomes históricos de cadastros já vinculados não recriam categorias renomeadas.

Itens, solicitações e modelos vinculam categorias por UUID, não pelo nome. Renomear uma categoria não perde seus vínculos. Categoria em uso não pode ser excluída; a desativação impede novas associações, mas preserva cadastros existentes. Solicitações já aprovadas podem ser recebidas mesmo depois da desativação de sua categoria. Um modelo com categoria inativa não pode ser aplicado para gerar novos itens até revisão/reativação.

O formulário gera códigos automaticamente: `ESC-…` para escolas, `INV-…` para cadastros de itens e `BW9-…` para unidades físicas. São imutáveis nos formulários e não dependem de nomes. Códigos de escolas existentes são preservados. Sequências podem conter intervalos por rollback; isso é esperado e não representa perda de equipamentos. Compatibilidade da API com código antigo da escola e patrimônio legado é mantida.

### Controle individual ou por quantidade

**Individual:** destinado a notebooks, tablets, placas e outros equipamentos que precisam de identidade própria. Cadastrar 12 notebooks gera 12 unidades físicas, cada uma com código automático, condição, série, localização e observações. Ao danificar uma unidade, o resultado é **12 no total, 11 disponíveis, 1 danificada**. Uma baixa administrativa retira apenas a unidade selecionada e preserva seu registro/histórico.

**Por quantidade:** destinado a itens agrupados. O saldo é dividido em disponível, manutenção, danificado e não localizado. A operação informa condição de origem, destino, quantidade afetada e motivo. Alterar 1 unidade de um lote com 12 não altera as outras 11. O total não muda ao alterar condições. Entrada/baixa administrativa altera o total de forma explícita, com motivo.

- Unidades contáveis: unidades (`un`), kits (`kit`), caixas (`cx`) e conjuntos (`cj`). O sistema não mistura contagem inteira com medidas fracionárias. Unidades textuais antigas podem ser mantidas nos cadastros existentes.
- Cadastro individual: até 1.000 unidades por operação. Modelo: até 200 linhas e até 2.000 unidades individuais por aplicação. Novas entradas individuais também são limitadas a 1.000 unidades por envio.
- Saldo total por item: de 0 a 100.000. O banco valida que os quatro saldos são não negativos e somam exatamente o total.
- Cadastro e organização não alteram mais quantidade ou a condição de um lote inteiro. O servidor recusa essas alterações, mesmo fora da interface.
- Itens antigos continuam por quantidade. **Identificar unidades** converte explicitamente um item de até 1.000 unidades, preservando cada saldo e gerando códigos. Não há conversão automática nem retorno para lote pela interface.
- Patrimônio legado com etiqueta individual e quantidade até 1 mantém sua referência. Novas unidades devem entrar em outro cadastro, evitando diluir a identificação original.
- Remoção de item e baixas são lógicas e exigem motivo. Equipamentos baixados nunca são reutilizados como se fossem novos.
- Escola com inventário ou solicitações não pode ser apagada: deve ser desativada.

### Gestão visual

A tela separa cadastro, movimentação e unidades. Exibe totais gerais dos itens ativos da escola, saldos por condição em cada linha, filtros por categoria/condição e busca por nome, código, série ou localização. Os filtros afetam somente a listagem e sua contagem/paginação: os indicadores gerais continuam mostrando todos os saldos da escola, mesmo quando a pesquisa não encontra itens. Clicar em um indicador filtra a lista e destaca a condição selecionada, sem zerar ou esconder os demais indicadores. **Ver unidades** abre a lista de equipamentos; **Histórico** mostra ator, data, motivo e valores anteriores/posteriores. Listas são paginadas e responsivas, evitando carregar todo o patrimônio de uma vez.

A busca também encontra o patrimônio e o número de série legados do cadastro principal, mesmo que o item ainda esteja por quantidade. Não é necessário individualizar um item antigo apenas para localizá-lo.

### Kits e composição

O botão **Criar kit** abre o cadastro com quantidade 1, unidade kit e identificação individual. Informe nome, categoria e composição por kit: nome do componente, quantidade inteira positiva e unidade (`un`, `cx` ou `cj`). São permitidos até 100 tipos de componentes por kit; kits aninhados não são aceitos.

Exemplo: Kit Arduino com 1 Arduino UNO, 1 cabo USB, 1 protoboard e 10 jumpers. O inventário registra **1 kit**, não 13 itens. Cadastrar 3 kits registra 3 kits, e a composição continua sendo a de cada kit. A quantidade de componentes é descritiva: não cria patrimônios avulsos, não consome estoque existente e não rastreia automaticamente perdas de peças internas. Alterações de condição e baixas continuam acontecendo no kit/unidade ou na quantidade afetada, não em todos os kits de uma vez.

Na listagem, a composição começa recolhida e abre pelo botão **Composição**. Linhas compactas alinham nome, categoria/código, saldos, quantidade e ações. Ações principais usam ícones com nomes acessíveis; entrada/baixa, individualização e remoção ficam em **Mais ações**. Filtros, pesquisa e paginação continuam disponíveis.

Admin pode editar a composição, com confirmação ao alterar um kit já composto. Professores consultam a composição e podem informar componentes ao solicitar um kit; não podem alterar a composição do inventário diretamente. Modelos preservam/copiam a composição por kit; solicitações mantêm os componentes no recebimento. Composição omitida por clientes antigos não apaga a existente. Atualizações antigas de modelos com identificação ambígua de kits são recusadas, evitando atribuir componentes ao kit errado.

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
- `/portal/dashboard/escolas/categorias`: categorias e padrões de controle, exclusivo do admin.
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

Listas de itens, snapshots e resultados de comandos são enviados ao driver como valores JSON nativos, sem conversão prévia para texto. Isso impede dupla serialização no `postgres.js`. Snapshots e respostas antigas que tenham sido gravados como strings JSON são interpretados na leitura, sem migração nem regravação desses registros.

Atualizações recebem `version`; edições com versão antiga retornam 409, sem sobrescrever dados. Escritas da mesma escola são serializadas por bloqueio transacional. Cada envio tem `Idempotency-Key` UUID, evitando duplicação em repetição de rede. Reutilizar a chave com outro conteúdo/ator gera conflito, e a repetição de professor revalida seu acesso atual.

Os dados operacionais e a auditoria estão separados. Não há interface para apagar auditoria. Uma política futura de retenção e acesso de banco deve ser definida antes de introduzir limpeza automática.

## API

Endpoint autenticado: `/api/portal/schools`. Respostas não são compartilhadas por cache.

### GET

Parâmetros: `view`, `schoolId` UUID quando aplicável, `search` (até 160 caracteres) e `page` (a partir de 1). Listas têm 50 registros por página. Inventário aceita `categoryId` UUID e `condition` (`good`, `maintenance`, `damaged`, `missing`). Unidades e movimentações exigem `itemId` UUID, validado contra a escola selecionada.

| view | Retorno |
| --- | --- |
| `schools` | `{ rows, total }`, filtrado por acesso e busca |
| `detail` | `{ school, teachers, classes }` |
| `inventory` | `{ rows, total, summary }`: linhas/total filtrados e quatro saldos gerais da escola independentes dos filtros; professor recebe lista vazia enquanto rascunho |
| `assets` | `{ item, rows, total }`, unidades físicas do item; aceita busca/condição |
| `movements` | `{ item, rows, total }`, histórico do item/unidades; sem solicitações de terceiros |
| `categories` | `{ rows, total }`, administração paginada de categorias |
| `catalog` | `{ rows, total }`, opções de categoria (até 1.000), incluindo inativas para filtros/histórico |
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
    "category_id": "b9000000-0000-4000-8000-000000000003",
    "tracking_mode": "individual",
    "quantity": 5,
    "unit": "un",
    "reason": "Novas atividades de circuitos"
  }
}
```

Comandos: `school.create/update/delete`, `links.replace`, `inventory.publish`, `item.create/update/organize/delete`, `request.create/review`, `template.create/update/delete/apply`.

Novos comandos:

| Ação | Campos além de `action` |
| --- | --- |
| `category.create` | `data`: name, name_es, description, description_es, default_tracking, default_unit, active |
| `category.update` | id, version, data |
| `category.delete` | id, version; impede exclusão da Geral e de categorias em uso |
| `item.condition` | schoolId, id, version, from, to, quantity, reason |
| `item.adjust` | schoolId, id, version, direction (`entry`/`exit`), condition, quantity, reason |
| `item.individualize` | schoolId, id, version, reason |
| `asset.update` | schoolId, id (da unidade), version (da unidade), data: condition, location, notes, reason; serial_number opcional, alteração só pelo admin |
| `asset.retire` | schoolId, id (da unidade), version (da unidade), reason; exclusivo admin |

Nos novos formulários, itens, linhas de modelos e solicitações informam `category_id` e `tracking_mode`. O campo textual `category` permanece compatível nas APIs antigas, mas só resolve uma categoria previamente cadastrada; não cria categorias silenciosamente. `item.update` precisa manter quantidade, condição legada e modo de controle atuais; movimentações usam os comandos específicos. `item.organize` atualiza apenas localização/observações.

Itens, linhas de modelos e solicitações aceitam `components` opcional, como array JSON nativo. Uma composição não vazia exige `unit: "kit"`. Exemplo:

```json
{
  "unit": "kit",
  "quantity": 1,
  "components": [
    { "name": "Arduino UNO", "quantity": 1, "unit": "un" },
    { "name": "Jumpers", "quantity": 10, "unit": "un" }
  ]
}
```

Omitir `components` preserva a composição de um item existente; enviar `[]` explicitamente remove sua composição, sem alterar a quantidade. Não envie strings JSON pré-serializadas. Os retornos de inventário/solicitações incluem `components` como array.

Erros: 400 validação; 401 sessão ausente/expirada; 403 permissão/origem; 404 módulo desligado ou registro ausente; 409 conflito de versão, vínculo ou transição; 413 corpo excessivo; 503 migração ausente. Erros inesperados retornam mensagem genérica e são registrados no log do servidor, sem expor SQL ao cliente.

## Arquitetura

| Arquivo | Responsabilidade |
| --- | --- |
| `lib/schools/contracts.ts` | Validação, estados e contratos |
| `lib/schools/service.ts` | Regras de negócio, escopo e transações; banco injetável |
| `lib/schools/inventory.ts` | Categorias, unidades, movimentações e recomposição de saldos |
| `lib/schools/server.ts` | Adaptador postgres.js e flag |
| `lib/schools/audit.ts` | Espelho append-only na auditoria geral, sem manutenção do legado |
| `app/api/portal/schools/route.ts` | Sessão, HTTP, limites e mapeamento de erros |
| `app/(protected)/portal/dashboard/escolas/[[...path]]/page.tsx` | Autorização da página e localização |
| `components/schools/SchoolsClient.tsx` | Interface e formulários |
| `components/schools/InventoryWorkspace.tsx` | Painel de estoque, filtros, unidades e histórico por item |
| `components/schools/KitComponentsEditor.tsx` | Editor reutilizável de composição por kit |
| `scripts/046_schools_inventory.sql` | Migração explícita e aditiva |
| `scripts/047_inventory_units_and_categories.sql` | Evolução explícita, preservação de saldos antigos e categorias |
| `scripts/048_inventory_kit_components.sql` | Composição descritiva, sem alteração de estoque |

## Homologação automatizada

```sh
npm run test:schools
npm run test:schools:ui
npm run check:utf8
npx tsc --noEmit
npm run build
```

`test:schools` usa PostgreSQL real compilado para WebAssembly (PGlite) em memória e contratos HTTP com autenticação simulada. Inclui uma regressão que conecta o `postgres.js` e o adaptador real do portal a um servidor PostgreSQL isolado em localhost, validando a serialização pelo protocolo usado na aplicação. `test:schools:ui` abre Chromium headless com componente e serviço reais, API interceptada e banco em memória. Não sobe o portal nem lê `.env`. No Windows procura Chrome/Edge instalado; alternativamente, instale o navegador com `npx playwright install chromium` ou indique `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

Cobertura: isolamento por escola/professor, roles, leitura sem DDL/DML, migrações reexecutáveis, preservação de saldos antigos, categorias por ID, 12 equipamentos com apenas 1 danificado, conversão/baixa/entrada, limites e saldos negativos, versões, idempotência, confirmação/recebimento, rollback na falha da auditoria incluindo unidades, preservação do legado, formulários, descarte protegido, publicação, viewport 360px e espanhol. Kits são testados em cadastros, modelos e solicitações, com preservação de composição, contagem sem inflação e dropdown/edição. O driver real também testa JSONB de composição, geração de unidades e recomposição dos saldos.

O build foi executado com `DATABASE_URL` substituída por um endereço local sem banco, e escritas de esquema desabilitadas. Os avisos de tracing em rotas preexistentes de arquivos de projetos não foram alterados por este módulo.

## Checklist de aceite em homologação

- [ ] Confirmar backup restaurável e identificação correta do banco.
- [ ] Se o módulo estiver ativo, desativá-lo e drenar operações em andamento antes do SQL. Mantê-lo desativado até todas as instâncias executarem o código novo.
- [ ] Aplicar 046/047/048 em ordem; verificar dez tabelas deste módulo, categorias, saldos e composição; nenhuma nota/turma antiga alterada.
- [ ] Com flag desligada, menu ausente e API 404; agenda, notas, materiais e projetos continuam funcionando.
- [ ] Com flag ligada, admin cria duas escolas e vincula professores/turmas homônimas por IDs distintos.
- [ ] Professor vê apenas escola vinculada; URL direta de outra escola é recusada.
- [ ] Modelo gera inventário em preparação; professor só consulta itens após publicação.
- [ ] Admin confirma publicação e movimenta estoque; professor organiza localização/observações e altera só a unidade/quantidade afetada.
- [ ] Cadastrar 12 notebooks, marcar um danificado e conferir total 12, disponíveis 11 e danificados 1.
- [ ] Cadastrar 1 Kit Arduino com 10 jumpers e outros componentes; conferir total 1 kit e composição recolhida por padrão. Verificar dropdown, edição, modelo e recebimento, sem criação/consumo de estoque avulso.
- [ ] Marcar 1 unidade de um lote como manutenção; verificar que as outras continuam disponíveis e que saldo negativo é recusado.
- [ ] Individualizar item antigo e comparar saldos antes/depois; dar baixa em uma unidade e conferir histórico.
- [ ] Renomear categoria e confirmar que itens continuam vinculados. Categoria em uso não pode ser excluída.
- [ ] Em homologação, reexecutar 047 com um modelo misto e verificar que categoria, controle individual e composição das linhas modernas não mudam; categorias renomeadas não reaparecem com o nome antigo.
- [ ] Pesquisar um patrimônio e uma série antigos e confirmar que o cadastro aparece sem conversão de controle.
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

### Conferência de saldos (somente leitura)

As duas consultas abaixo devem retornar **zero linhas**. Códigos não precisam ser consecutivos. Faça também a comparação de IDs/quantidades antes e depois de 047 em homologação.

```sql
SELECT id,code,quantity,good_quantity,maintenance_quantity,damaged_quantity,missing_quantity
FROM public.bw_inventory_items
WHERE quantity<>good_quantity+maintenance_quantity+damaged_quantity+missing_quantity
 OR LEAST(good_quantity,maintenance_quantity,damaged_quantity,missing_quantity)<0;

SELECT i.id,i.code,i.quantity,
 COUNT(a.id)::int AS unidades,
 COUNT(a.id) FILTER (WHERE a.condition='good')::int AS disponiveis
FROM public.bw_inventory_items i
LEFT JOIN public.bw_inventory_assets a ON a.item_id=i.id AND a.active
WHERE i.active AND i.tracking_mode='individual'
GROUP BY i.id
HAVING i.quantity<>COUNT(a.id)
 OR i.good_quantity<>COUNT(a.id) FILTER (WHERE a.condition='good')
 OR i.maintenance_quantity<>COUNT(a.id) FILTER (WHERE a.condition='maintenance')
 OR i.damaged_quantity<>COUNT(a.id) FILTER (WHERE a.condition='damaged')
 OR i.missing_quantity<>COUNT(a.id) FILTER (WHERE a.condition='missing');
```
