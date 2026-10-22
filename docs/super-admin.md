# SuperAdmin e coordenação

## Configuração exclusiva do servidor

Use no `.env` do ambiente onde o portal é executado:

```dotenv
# UUID de uma conta que já é admin, aprovada e ativa.
SUPER_ADMIN_ID=UUID_DO_SEU_USUARIO_ADMIN

# Opcional: outros admins autorizados, separados por vírgula.
# SUPER_ADMIN_IDS=UUID_DE_OUTRO_ADMIN,UUID_DE_MAIS_UM_ADMIN
```

Substitua os exemplos pelos UUIDs reais, sem nomes, e-mails ou aspas adicionais. Configure todas as instâncias com a mesma lista e reinicie/reimplante a aplicação após mudar a configuração. Não use `NEXT_PUBLIC_`: a lista é lida somente no servidor. Não é preciso alterar variáveis de projetos ou notificações.

Sem IDs válidos, ninguém recebe a gestão de coordenação. Estar na lista não aprova o cadastro e não transforma um professor em admin automaticamente. O primeiro SuperAdmin precisa ser uma conta administrativa já existente; essa regra evita criar privilégios implicitamente ao configurar o ambiente.

Não existe um novo role `superadmin` no banco. O role de coordenador continua sendo `admin`, e o de professor é `teacher`. A autorização adicional de SuperAdmin é derivada somente do ID no `.env`.

## URL pública e proxy de produção

A validação reutiliza a variável já existente do portal, sem criar outra configuração de URL:

```dotenv
NEXT_PUBLIC_SITE_URL=https://portal.bw9global.com
```

Use o domínio real de acesso, com protocolo e porta se não for a padrão. A origem do navegador precisa corresponder à origem dessa URL, mesmo quando o Next.js recebe HTTP por uma URL interna do contêiner. Se a variável já estiver correta, não é necessário alterá-la: basta publicar o código corrigido. Caso o valor seja alterado, faça novo build/deploy, pois variáveis `NEXT_PUBLIC_` podem ser incorporadas ao código durante o build. Sem essa variável, a comparação usa a origem da requisição recebida pelo Next.js, preservando o acesso direto local.

Uma configuração inválida é recusada, sem liberar qualquer origem como fallback. Não informe listas, curingas nem credenciais nessa URL. A rota não confia em `X-Forwarded-Host` ou `X-Forwarded-Proto` para autorizar a origem. Domínios externos, `Origin: null` e requisições identificadas pelo navegador como cross-site continuam bloqueados. Chamadas sem `Origin` e sem indicação de acesso entre sites mantêm compatibilidade com clientes não navegadores, sempre exigindo autenticação e SuperAdmin.

## Utilização

Em **Gerenciar Professores**, o SuperAdmin verá, nas linhas elegíveis:

- **Tornar coordenador**: apenas para professores aprovados e ativos.
- **Remover coordenação**: para coordenadores, inclusive contas que estejam desativadas.
- Um modal explica o efeito e solicita confirmação antes do envio.
- Uma identificação distingue coordenadores e SuperAdmins na lista.

Admins comuns e professores não recebem esses botões. A API também verifica a autorização, independentemente da interface. A resposta da lista fornece somente a capacidade do usuário autenticado e indicadores por conta, sem enviar a configuração do ambiente.

## Regras de segurança

- A mudança sincroniza `role` e `is_admin`, preservando compatibilidade com o sistema atual.
- O usuário que executa a operação e sua sessão são revalidados dentro da transação.
- O papel esperado é obrigatório, evitando inverter uma alteração feita por outra pessoa ou repetir um envio sem atualizar a lista.
- Não é possível alterar o próprio papel nem o papel de qualquer ID protegido no `.env` por essa ação.
- Contas protegidas não podem ser excluídas, desativadas ou desaprovadas pelos controles administrativos. Admins comuns também não podem alterar seus dados de cadastro, inclusive o e-mail usado para recuperação de senha.
- Um SuperAdmin pode editar dados de uma conta protegida, mas deve mantê-la aprovada e ativa.
- Papéis futuros, diferentes de `teacher` e `admin`, são recusados por essa operação.
- As sessões do usuário cujo papel mudou são revogadas. Ele deverá entrar novamente; os próximos acessos passam pela autenticação já existente.
- A atualização, revogação das sessões e auditoria `admin.teachers.role.change` são atômicas. Se qualquer uma falhar, toda a operação é desfeita.
- A mudança aparece como uma operação crítica na auditoria administrativa, inclusive quando bem-sucedida.
- Não há execução de DDL, migrações, limpeza de auditoria ou atualização retroativa de contas.

Alunos, turmas, escolas, notas, materiais, vínculos e permissões de professor não são apagados ou redefinidos. Ao remover a coordenação, voltam a valer as permissões de professor já cadastradas. Tornar coordenador não libera a gestão de blog, projetos ou notificações que já dependam de outras listas/IDs específicos.

As proteções administrativas se aplicam aos IDs configurados: retirar um ID do `.env` remove sua proteção adicional após a atualização da configuração. Essa manutenção precisa ser feita por quem opera o servidor, fora da interface do portal.

## API

`PATCH /api/admin/teachers/{id}/role`

```json
{ "role": "admin", "expected_role": "teacher" }
```

Para remover: `{ "role": "teacher", "expected_role": "admin" }`.

Respostas: 200 sucesso; 400 entrada inválida; 401 sessão expirada; 403 sem autorização/origem inválida; 404 usuário ausente; 409 conta protegida, papel desatualizado/incompatível ou cadastro não aprovado/ativo; 413 corpo excessivo; 500 falha transacional. Sem mudança efetiva, retorna `changed: false` e não revoga sessões nem gera uma auditoria de mudança.

## Diagnóstico de recusas e falhas

Todas as respostas da rota incluem `X-Request-ID` e `Cache-Control: private, no-store`. Os erros tratados também incluem `code` e `request_id` no JSON. O modal mostra o motivo, o código e a referência para localizar o evento no servidor.

- `SUPER_ADMIN_REQUIRED`: a conta autenticada não é admin autorizado na lista do servidor, ou a autorização foi alterada durante a operação. Verifique o ID da pessoa logada, não o ID da pessoa que receberá a coordenação, e a configuração de todas as instâncias.
- `ORIGIN`: a origem do navegador não corresponde à URL pública configurada. Confira `NEXT_PUBLIC_SITE_URL`, o domínio usado no navegador e o proxy.
- `ORIGIN_CONFIG_INVALID`: a URL configurada não é uma URL HTTP/HTTPS válida sem credenciais.
- `ROLE_CHANGE_FAILED`: a transação foi desfeita; nenhuma mudança de papel ou revogação de sessão foi confirmada.

Recusas e falhas geram logs estruturados com os prefixos `[admin.teachers.role.denied]` ou `[admin.teachers.role.failed]`, contendo código, referência, status HTTP e origens normalizadas, sem corpo da requisição, cookies, tokens, senhas ou lista do `.env`.

Tentativas de admins autenticados também geram uma auditoria `admin.teachers.role.change`, com `status: failed`, código e referência em `metadata`. Na tela de auditoria, filtre por **Falha** e pela ação. Esse registro é feito após o rollback, sem DDL nem limpeza de histórico. Se o banco ou a auditoria estiverem indisponíveis, o registro não poderá ser persistido: o servidor emitirá `[admin.teachers.role.audit.failed]` com a mesma referência e manterá a recusa original. Requisições sem autenticação administrativa validada geram somente log do servidor, evitando escritas anônimas no banco.

Os avisos `[runtime-schema] mutation skipped` não indicam por si só a causa de um `403`; não habilite alterações de esquema para resolver uma recusa de autorização.

Após implantar esta versão, um `403` sem `X-Request-ID` pode indicar uma resposta anterior à rota (proxy/middleware) ou uma instância ainda executando a versão antiga. Confira a resposta no painel Network do navegador e o deploy de todas as instâncias antes de mudar permissões.

## Banco e homologação

Não há migração nova. São usadas as colunas de autenticação já existentes em `teachers`, `teacher_sessions` e a auditoria de `scripts/009_audit_logs.sql`. A auditoria precisa estar instalada; em caso de ausência ou falha, a operação é recusada sem confirmar a mudança de privilégios. Não habilite escritas de esquema em runtime para contornar erros.

Testes isolados:

```sh
node --test tests/teacher-roles.test.cjs
node --test tests/teacher-roles-ui.browser.cjs
node --test tests/*.test.cjs
npm run check:utf8
npx tsc --noEmit
```

O teste de API usa postgres.js e PostgreSQL em memória, sem ler `.env` ou `DATABASE_URL`. O de interface usa navegador real e API interceptada. Em homologação, valide também a sessão real, a configuração do proxy/Origin, a auditoria e a necessidade de novo login do usuário afetado antes de liberar produção.
