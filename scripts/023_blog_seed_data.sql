BEGIN;

-- =========================================================
-- Seed idempotente para BLOG (categorias, tags e posts)
-- Compatível com:
--   021_blog_schema.sql
--   022_blog_revisions_and_assets.sql
-- =========================================================

-- 1) Categorias
INSERT INTO public.blog_categories (name, slug, description)
VALUES
  ('Tecnologia Educacional', 'tecnologia-educacional', 'Conteudos sobre tecnologia aplicada ao ensino.'),
  ('Metodologias Ativas', 'metodologias-ativas', 'Praticas para aumentar protagonismo e participacao.'),
  ('Planejamento Pedagogico', 'planejamento-pedagogico', 'Organizacao de trilhas, objetivos e avaliacao.')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- 2) Tags
INSERT INTO public.blog_tags (name, slug)
VALUES
  ('IA', 'ia'),
  ('Sala de Aula', 'sala-de-aula'),
  ('Projetos', 'projetos'),
  ('Avaliacao', 'avaliacao'),
  ('Aprendizaje Activo', 'aprendizaje-activo')
ON CONFLICT (slug) DO UPDATE
SET
  name = EXCLUDED.name;

-- 3) Autor padrão do seed:
--    tenta admin aprovado/ativo; se não existir, grava NULL.
WITH actor AS (
  SELECT (
    SELECT t.id
    FROM public.teachers t
    WHERE (t.is_admin = TRUE OR t.role = 'admin')
      AND t.approved = TRUE
      AND t.active = TRUE
    ORDER BY t.created_at ASC
    LIMIT 1
  ) AS id
)

-- 3.1) Post publicado PT-BR com imagem no meio
INSERT INTO public.blog_posts (
  title,
  slug,
  excerpt,
  content_json,
  content_html,
  content_text,
  language,
  status,
  published_at,
  scheduled_at,
  first_published_at,
  author_id,
  created_by,
  updated_by,
  seo_title,
  seo_description,
  canonical_url,
  noindex,
  read_time_minutes
)
SELECT
  'Como usar IA na sala de aula sem perder o foco pedagogico',
  'como-usar-ia-na-sala-de-aula',
  'Guia pratico para aplicar IA com intencionalidade pedagógica.',
  $${
    "version": 1,
    "blocks": [
      { "type": "heading", "level": 2, "text": "Contexto" },
      {
        "type": "paragraph",
        "children": [
          { "text": "A IA pode acelerar planejamento e personalizacao, desde que o objetivo pedagógico esteja claro." }
        ]
      },
      {
        "type": "image",
        "url": "https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&w=1600&auto=format&fit=crop",
        "alt": "Professor e alunos em sala com notebook",
        "caption": "Exemplo de imagem inserida no meio do texto"
      },
      {
        "type": "paragraph",
        "children": [
          { "text": "Defina criterio de sucesso antes de escolher qualquer ferramenta." }
        ]
      }
    ]
  }$$::jsonb,
  '<h2>Contexto</h2><p>A IA pode acelerar planejamento e personalizacao, desde que o objetivo pedagogico esteja claro.</p><figure><img src="https://images.unsplash.com/photo-1509062522246-3755977927d7?q=80&amp;w=1600&amp;auto=format&amp;fit=crop" alt="Professor e alunos em sala com notebook" loading="lazy" /><figcaption>Exemplo de imagem inserida no meio do texto</figcaption></figure><p>Defina criterio de sucesso antes de escolher qualquer ferramenta.</p>',
  'A IA pode acelerar planejamento e personalizacao, desde que o objetivo pedagogico esteja claro. Defina criterio de sucesso antes de escolher qualquer ferramenta.',
  'pt-BR',
  'published',
  NOW() - INTERVAL '3 days',
  NULL,
  NOW() - INTERVAL '3 days',
  actor.id,
  actor.id,
  actor.id,
  'Como usar IA na sala de aula',
  'Guia pratico para aplicar IA com intencionalidade pedagogica.',
  NULL,
  FALSE,
  3
FROM actor
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blog_posts p
  WHERE p.slug = 'como-usar-ia-na-sala-de-aula'
    AND p.language = 'pt-BR'
    AND p.deleted_at IS NULL
);

-- 3.2) Post publicado PT-BR (projetos)
WITH actor AS (
  SELECT (
    SELECT t.id
    FROM public.teachers t
    WHERE (t.is_admin = TRUE OR t.role = 'admin')
      AND t.approved = TRUE
      AND t.active = TRUE
    ORDER BY t.created_at ASC
    LIMIT 1
  ) AS id
)
INSERT INTO public.blog_posts (
  title,
  slug,
  excerpt,
  content_json,
  content_html,
  content_text,
  language,
  status,
  published_at,
  scheduled_at,
  first_published_at,
  author_id,
  created_by,
  updated_by,
  seo_title,
  seo_description,
  canonical_url,
  noindex,
  read_time_minutes
)
SELECT
  'Planejamento de aula com projetos em 4 etapas',
  'planejamento-de-aula-com-projetos',
  'Estrutura objetiva para planejar projetos com objetivos claros.',
  $${
    "version": 1,
    "blocks": [
      { "type": "heading", "level": 2, "text": "Etapas" },
      {
        "type": "list",
        "ordered": true,
        "items": [
          "Problema norteador",
          "Objetivos e competencias",
          "Evidencias de aprendizagem",
          "Fechamento e devolutiva"
        ]
      },
      {
        "type": "paragraph",
        "children": [
          { "text": "Com esse fluxo, o projeto fica previsivel e avaliavel." }
        ]
      }
    ]
  }$$::jsonb,
  '<h2>Etapas</h2><ol><li>Problema norteador</li><li>Objetivos e competencias</li><li>Evidencias de aprendizagem</li><li>Fechamento e devolutiva</li></ol><p>Com esse fluxo, o projeto fica previsivel e avaliavel.</p>',
  'Problema norteador. Objetivos e competencias. Evidencias de aprendizagem. Fechamento e devolutiva. Com esse fluxo, o projeto fica previsivel e avaliavel.',
  'pt-BR',
  'published',
  NOW() - INTERVAL '2 days',
  NULL,
  NOW() - INTERVAL '2 days',
  actor.id,
  actor.id,
  actor.id,
  'Planejamento de aula com projetos',
  'Estrutura objetiva para planejar projetos com objetivos claros.',
  NULL,
  FALSE,
  4
FROM actor
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blog_posts p
  WHERE p.slug = 'planejamento-de-aula-com-projetos'
    AND p.language = 'pt-BR'
    AND p.deleted_at IS NULL
);

-- 3.3) Post publicado ES
WITH actor AS (
  SELECT (
    SELECT t.id
    FROM public.teachers t
    WHERE (t.is_admin = TRUE OR t.role = 'admin')
      AND t.approved = TRUE
      AND t.active = TRUE
    ORDER BY t.created_at ASC
    LIMIT 1
  ) AS id
)
INSERT INTO public.blog_posts (
  title,
  slug,
  excerpt,
  content_json,
  content_html,
  content_text,
  language,
  status,
  published_at,
  scheduled_at,
  first_published_at,
  author_id,
  created_by,
  updated_by,
  seo_title,
  seo_description,
  canonical_url,
  noindex,
  read_time_minutes
)
SELECT
  'Aprendizaje activo con tecnologia en clase',
  'aprendizaje-activo-con-tecnologia',
  'Buenas practicas para dinamizar la participacion estudiantil.',
  $${
    "version": 1,
    "blocks": [
      { "type": "heading", "level": 2, "text": "Claves practicas" },
      {
        "type": "paragraph",
        "children": [
          { "text": "La tecnologia debe servir a la metodologia, no al reves." }
        ]
      },
      {
        "type": "quote",
        "text": "Primero el objetivo didactico, luego la herramienta."
      }
    ]
  }$$::jsonb,
  '<h2>Claves practicas</h2><p>La tecnologia debe servir a la metodologia, no al reves.</p><blockquote>Primero el objetivo didactico, luego la herramienta.</blockquote>',
  'La tecnologia debe servir a la metodologia, no al reves. Primero el objetivo didactico, luego la herramienta.',
  'es',
  'published',
  NOW() - INTERVAL '1 day',
  NULL,
  NOW() - INTERVAL '1 day',
  actor.id,
  actor.id,
  actor.id,
  'Aprendizaje activo con tecnologia',
  'Buenas practicas para dinamizar la participacion estudiantil.',
  NULL,
  FALSE,
  2
FROM actor
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blog_posts p
  WHERE p.slug = 'aprendizaje-activo-con-tecnologia'
    AND p.language = 'es'
    AND p.deleted_at IS NULL
);

-- 3.4) Post rascunho PT-BR (para testar admin)
WITH actor AS (
  SELECT (
    SELECT t.id
    FROM public.teachers t
    WHERE (t.is_admin = TRUE OR t.role = 'admin')
      AND t.approved = TRUE
      AND t.active = TRUE
    ORDER BY t.created_at ASC
    LIMIT 1
  ) AS id
)
INSERT INTO public.blog_posts (
  title,
  slug,
  excerpt,
  content_json,
  content_html,
  content_text,
  language,
  status,
  published_at,
  scheduled_at,
  first_published_at,
  author_id,
  created_by,
  updated_by,
  seo_title,
  seo_description,
  canonical_url,
  noindex,
  read_time_minutes
)
SELECT
  'Guia de avaliacao formativa com rubricas',
  'guia-de-avaliacao-formativa',
  'Rascunho para testes de fluxo editorial no portal.',
  $${
    "version": 1,
    "blocks": [
      { "type": "heading", "level": 2, "text": "Rascunho de estrutura" },
      {
        "type": "paragraph",
        "children": [
          { "text": "Este post esta em rascunho para validar a edicao e publicacao." }
        ]
      }
    ]
  }$$::jsonb,
  '<h2>Rascunho de estrutura</h2><p>Este post esta em rascunho para validar a edicao e publicacao.</p>',
  'Este post esta em rascunho para validar a edicao e publicacao.',
  'pt-BR',
  'draft',
  NULL,
  NULL,
  NULL,
  actor.id,
  actor.id,
  actor.id,
  'Guia de avaliacao formativa',
  'Rascunho para testes de fluxo editorial no portal.',
  NULL,
  FALSE,
  2
FROM actor
WHERE NOT EXISTS (
  SELECT 1
  FROM public.blog_posts p
  WHERE p.slug = 'guia-de-avaliacao-formativa'
    AND p.language = 'pt-BR'
    AND p.deleted_at IS NULL
);

-- 4) Relacoes post x categoria
INSERT INTO public.blog_post_categories (post_id, category_id)
SELECT p.id, c.id
FROM public.blog_posts p
JOIN public.blog_categories c ON c.slug = 'tecnologia-educacional'
WHERE p.slug = 'como-usar-ia-na-sala-de-aula'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, category_id) DO NOTHING;

INSERT INTO public.blog_post_categories (post_id, category_id)
SELECT p.id, c.id
FROM public.blog_posts p
JOIN public.blog_categories c ON c.slug = 'planejamento-pedagogico'
WHERE p.slug = 'planejamento-de-aula-com-projetos'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, category_id) DO NOTHING;

INSERT INTO public.blog_post_categories (post_id, category_id)
SELECT p.id, c.id
FROM public.blog_posts p
JOIN public.blog_categories c ON c.slug = 'metodologias-ativas'
WHERE p.slug = 'aprendizaje-activo-con-tecnologia'
  AND p.language = 'es'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, category_id) DO NOTHING;

INSERT INTO public.blog_post_categories (post_id, category_id)
SELECT p.id, c.id
FROM public.blog_posts p
JOIN public.blog_categories c ON c.slug = 'planejamento-pedagogico'
WHERE p.slug = 'guia-de-avaliacao-formativa'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, category_id) DO NOTHING;

-- 5) Relacoes post x tags
INSERT INTO public.blog_post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM public.blog_posts p
JOIN public.blog_tags t ON t.slug IN ('ia', 'sala-de-aula')
WHERE p.slug = 'como-usar-ia-na-sala-de-aula'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, tag_id) DO NOTHING;

INSERT INTO public.blog_post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM public.blog_posts p
JOIN public.blog_tags t ON t.slug IN ('projetos', 'avaliacao')
WHERE p.slug = 'planejamento-de-aula-com-projetos'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, tag_id) DO NOTHING;

INSERT INTO public.blog_post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM public.blog_posts p
JOIN public.blog_tags t ON t.slug IN ('aprendizaje-activo', 'sala-de-aula')
WHERE p.slug = 'aprendizaje-activo-con-tecnologia'
  AND p.language = 'es'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, tag_id) DO NOTHING;

INSERT INTO public.blog_post_tags (post_id, tag_id)
SELECT p.id, t.id
FROM public.blog_posts p
JOIN public.blog_tags t ON t.slug IN ('avaliacao')
WHERE p.slug = 'guia-de-avaliacao-formativa'
  AND p.language = 'pt-BR'
  AND p.deleted_at IS NULL
ON CONFLICT (post_id, tag_id) DO NOTHING;

COMMIT;
