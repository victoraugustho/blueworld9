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
