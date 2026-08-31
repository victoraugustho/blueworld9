# Permissões V2: implantação segura

## Objetivo

A política V2 simplifica o acesso aos materiais sem alterar automaticamente nenhum material já publicado.

- `materials.access_policy IS NULL`: mantém integralmente a regra legada de idioma + categoria + ano/turma + professores específicos.
- `materials.access_policy.version = 2`: usa o novo controle geral, dinâmico ou específico.
- Inclusões individuais podem liberar professores de outro idioma.
- Exclusões individuais sempre têm prioridade.
- Projetos continuam independentes dos materiais e usam a hierarquia projeto → categoria descrita abaixo.

## Ordem recomendada em produção

1. Faça um backup lógico do banco.
2. Execute [043_material_access_policy_v2.sql](../scripts/043_material_access_policy_v2.sql).
3. Confirme a coluna e a quantidade de materiais legados com as consultas abaixo.
4. Implante o código da aplicação.
5. Converta materiais antigos individualmente, somente após conferir a pré-visualização de professores.

Não execute atualização em massa de `access_policy`. O valor `NULL` é intencional e protege o comportamento atual.

## Checklist após o SQL

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'materials'
  AND column_name = 'access_policy';

SELECT
  COUNT(*) FILTER (WHERE access_policy IS NULL) AS materiais_legados,
  COUNT(*) FILTER (WHERE access_policy IS NOT NULL) AS materiais_v2
FROM public.materials;

SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'public.materials'::regclass
  AND conname = 'materials_access_policy_v2_check';
```

Resultado esperado logo após a migração:

- A coluna existe como `jsonb` e aceita `NULL`.
- Todos os materiais anteriores continuam em `materiais_legados`.
- O total de materiais antes e depois da migração é idêntico.
- Nenhuma linha de `material_teacher_access`, `teacher_categories` ou `teacher_student_years` é alterada.

## Compatibilidade de implantação

O código verifica se a coluna existe antes de ativar a V2. Se a aplicação for implantada antes do SQL:

- as páginas dos professores continuam lendo pelas regras legadas;
- materiais existentes continuam editáveis no modo legado;
- a criação ou conversão para grupos dinâmicos responde com erro controlado `503`, indicando o script necessário;
- nenhuma gravação parcial é realizada.

## Reversão

Em caso de reversão do código, mantenha a coluna no banco. Ela é aditiva e não interfere nas versões anteriores. Não remova a coluna enquanto houver materiais V2, pois isso eliminaria suas políticas.

## Acesso aos projetos por categoria

O script `044_project_category_access.sql` adiciona uma política independente às categorias de projetos.

Hierarquia aplicada em todas as rotas de projeto, incluindo anexos, imagens, comentários e observações:

1. Projeto `Segmentado`: usa somente a regra do próprio projeto.
2. Projeto `Para todos`: herda a regra da categoria.
3. Categoria `Sem restrição`: permite todos os professores ativos.
4. Categoria `Segmentada`: permite o professor quando ele atende a qualquer uma das condições de professor específico, país/região ou idioma da conta.

O idioma cadastrado no projeto ou na categoria identifica o idioma do conteúdo. Ele não restringe a visualização por conta própria.

### Ordem segura em produção

1. Faça um backup lógico do banco.
2. Execute [044_project_category_access.sql](../scripts/044_project_category_access.sql).
3. Execute as consultas de verificação abaixo.
4. Implante o código.
5. Configure as categorias desejadas pelo painel administrativo.

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'teacher_project_categories'
  AND column_name IN (
    'access_scope',
    'target_teacher_ids',
    'target_countries',
    'target_locales'
  )
ORDER BY column_name;

SELECT
  access_scope,
  COUNT(*)::int AS categorias
FROM public.teacher_project_categories
WHERE deleted_at IS NULL
GROUP BY access_scope
ORDER BY access_scope;

SELECT COUNT(*)::int AS projetos_sem_categoria
FROM public.teacher_projects
WHERE deleted_at IS NULL
  AND category_id IS NULL;
```

Resultado esperado logo após o SQL:

- As quatro colunas existem.
- Todas as categorias anteriores permanecem com `access_scope = 'all'`.
- Nenhum projeto, anexo, comentário ou vínculo é alterado.
- O total de categorias e projetos permanece idêntico ao total anterior à migração.

Se o código for implantado antes do SQL, a leitura usa a categoria como “sem restrição” e continua funcionando. O painel retorna um erro controlado `503` ao tentar salvar uma política de categoria até que o script seja aplicado.
