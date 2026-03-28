# Blog no Portal - Arquitetura Premium, Plano e API

## 1) Objetivo
- Criar uma sessao de gerenciamento de blog dentro do portal, acessivel apenas para admins.
- Usar o mesmo banco para portal e site (modelo headless CMS).
- Expor API publica estavel para o site consumir com performance e SEO.
- Permitir editor rico com imagens no meio do texto, galerias, embeds, tabelas, quotes e mais.

## 2) Direcao Tecnica Recomendada

### 2.1 Modelo headless (recomendado)
- Portal = painel de administracao e publicacao.
- Site = cliente de leitura (consome so API publica).
- Banco = fonte unica de verdade.

### 2.2 Principios de qualidade
- Conteudo estruturado por blocos (nao apenas markdown puro).
- Versionamento de post (historico e rollback).
- Workflow editorial (draft, review, scheduled, published, archived).
- Midia centralizada (assets com metadados, variacoes e reutilizacao).
- API com paginacao, filtros, cache e contrato estavel.

## 3) Melhor Estrutura de Conteudo para o Blog

Para suportar "texto + imagens no meio + componentes ricos", o melhor padrao e salvar:

1. `content_json` (JSONB): fonte canonica para editor e renderizacao.
2. `content_html` (TEXT): HTML sanitizado gerado no publish (ou no save), para leitura rapida no site.
3. `content_text` (TEXT): texto limpo para busca full-text e calculo de tempo de leitura.

### 3.1 Blocos suportados (modelo recomendado)
- `heading` (h1-h4)
- `paragraph`
- `list` (ordered/unordered)
- `image` (imagem unica com alt/caption/alinhamento)
- `gallery` (varias imagens)
- `quote`
- `code_block`
- `table`
- `divider`
- `embed` (YouTube, Instagram, etc)
- `callout` (destaque informativo)
- `cta` (chamada para acao)

### 3.2 Exemplo de `content_json`
```json
{
  "version": 1,
  "blocks": [
    { "type": "heading", "level": 2, "text": "Introducao" },
    {
      "type": "paragraph",
      "children": [
        { "text": "Este post mostra como usar " },
        { "text": "imagens no meio do texto", "marks": ["bold"] },
        { "text": " com total controle." }
      ]
    },
    {
      "type": "image",
      "asset_id": "a2c4d7f1-0f20-4b26-b5a2-c64b8a9d99b1",
      "alt": "Professora em sala de aula",
      "caption": "Exemplo de imagem inline",
      "align": "center",
      "width": "wide"
    },
    {
      "type": "paragraph",
      "children": [
        { "text": "A imagem acima fica no meio do artigo sem quebrar o layout." }
      ]
    },
    {
      "type": "gallery",
      "layout": "2-cols",
      "items": [
        { "asset_id": "uuid-1", "alt": "Imagem 1" },
        { "asset_id": "uuid-2", "alt": "Imagem 2" }
      ]
    },
    {
      "type": "embed",
      "provider": "youtube",
      "url": "https://www.youtube.com/watch?v=xxxx"
    }
  ]
}
```

## 4) Modelagem de Banco (Proposta Otima)

## 4.1 Tabelas principais

### `blog_posts`
- `id UUID PK`
- `title TEXT NOT NULL`
- `slug TEXT NOT NULL`
- `excerpt TEXT NULL`
- `content_json JSONB NOT NULL`
- `content_html TEXT NULL`
- `content_text TEXT NULL`
- `cover_asset_id UUID NULL REFERENCES blog_assets(id)`
- `language TEXT NOT NULL DEFAULT 'pt-BR'` (`pt-BR|es`)
- `status TEXT NOT NULL DEFAULT 'draft'` (`draft|review|scheduled|published|archived`)
- `published_at TIMESTAMPTZ NULL`
- `scheduled_at TIMESTAMPTZ NULL`
- `first_published_at TIMESTAMPTZ NULL`
- `author_id UUID NOT NULL REFERENCES teachers(id)`
- `created_by UUID NOT NULL REFERENCES teachers(id)`
- `updated_by UUID NULL REFERENCES teachers(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `deleted_at TIMESTAMPTZ NULL`
- `seo_title TEXT NULL`
- `seo_description TEXT NULL`
- `seo_image_asset_id UUID NULL REFERENCES blog_assets(id)`
- `canonical_url TEXT NULL`
- `noindex BOOLEAN NOT NULL DEFAULT FALSE`
- `read_time_minutes SMALLINT NULL`

Indices recomendados:
- `UNIQUE(slug, language)`
- `INDEX(status, published_at DESC)`
- `INDEX(language, published_at DESC)`
- `INDEX(created_at DESC)`
- `GIN(to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content_text,'')))`

### `blog_post_revisions`
- `id UUID PK`
- `post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE`
- `revision_number INT NOT NULL`
- `snapshot JSONB NOT NULL` (estado completo do post)
- `created_by UUID NOT NULL REFERENCES teachers(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indices:
- `UNIQUE(post_id, revision_number)`
- `INDEX(post_id, created_at DESC)`

### `blog_assets`
- `id UUID PK`
- `storage_key TEXT NOT NULL` (path no storage)
- `public_url TEXT NOT NULL`
- `mime_type TEXT NOT NULL`
- `size_bytes BIGINT NOT NULL`
- `width INT NULL`
- `height INT NULL`
- `alt_default TEXT NULL`
- `caption_default TEXT NULL`
- `focal_x NUMERIC(5,2) NULL`
- `focal_y NUMERIC(5,2) NULL`
- `created_by UUID NOT NULL REFERENCES teachers(id)`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indices:
- `INDEX(created_at DESC)`
- `INDEX(mime_type)`

### `blog_asset_variants`
- `id UUID PK`
- `asset_id UUID NOT NULL REFERENCES blog_assets(id) ON DELETE CASCADE`
- `variant TEXT NOT NULL` (`thumb|small|medium|large|og`)
- `mime_type TEXT NOT NULL`
- `width INT NOT NULL`
- `height INT NOT NULL`
- `size_bytes BIGINT NOT NULL`
- `public_url TEXT NOT NULL`

Indices:
- `UNIQUE(asset_id, variant, mime_type)`

### `blog_categories`
- `id SERIAL PK`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL`
- `description TEXT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### `blog_tags`
- `id SERIAL PK`
- `name TEXT NOT NULL`
- `slug TEXT NOT NULL`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

### `blog_post_categories` (N:N)
- `post_id UUID`
- `category_id INT`
- `PRIMARY KEY(post_id, category_id)`

### `blog_post_tags` (N:N)
- `post_id UUID`
- `tag_id INT`
- `PRIMARY KEY(post_id, tag_id)`

### `blog_post_assets` (mapa de uso no conteudo)
- `post_id UUID`
- `asset_id UUID`
- `usage_type TEXT` (`cover|inline|gallery|seo`)
- `PRIMARY KEY(post_id, asset_id, usage_type)`

## 4.2 Regras de publicacao
- API publica retorna apenas:
  - `status = 'published'`
  - `published_at <= NOW()`
  - `deleted_at IS NULL`
- `scheduled` pode virar `published` via job de 1 minuto.
- Sempre gerar revision ao salvar e ao publicar.

## 5) Estrategia de Midia (Imagens no meio do texto)

### 5.1 Upload recomendado
- Endpoint admin `POST /api/admin/blog/assets/upload` (multipart/form-data) para MVP.
- Para escala maior, evoluir para `POST /api/admin/blog/assets/presign` + upload direto em object storage.

### 5.2 Processamento de imagem
- Gerar variantes automaticamente: `thumb`, `small`, `medium`, `large`, `og`.
- Salvar `width`, `height`, `size_bytes`, `mime_type`.
- Exigir `alt` para acessibilidade.

### 5.3 Render no site
- Bloco `image` pode usar `srcset` com variantes.
- Bloco `gallery` suporta grid responsivo.
- Bloco `embed` permite midias externas com whitelist de provedores.

## 6) API do Blog (documentacao para consumo do site)

## 6.1 API Admin (somente admin)

### `GET /api/admin/blog/posts`
Query:
- `page` (default 1)
- `page_size` (default 20, max 100)
- `status` (`draft|review|scheduled|published|archived`)
- `language` (`pt-BR|es`)
- `q` (titulo, excerpt, content_text)
- `category_id`
- `tag_id`
- `author_id`

Resposta 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Titulo",
      "slug": "titulo",
      "status": "draft",
      "language": "pt-BR",
      "published_at": null,
      "scheduled_at": null,
      "read_time_minutes": 6,
      "category_ids": [1],
      "tag_ids": [2, 3],
      "created_at": "2026-03-24T10:00:00Z",
      "updated_at": "2026-03-24T10:00:00Z"
    }
  ],
  "page": 1,
  "page_size": 20,
  "total": 1
}
```

### `POST /api/admin/blog/posts`
Body (exemplo completo):
```json
{
  "title": "Como usar IA em sala",
  "slug": "como-usar-ia-em-sala",
  "excerpt": "Guia pratico para docentes.",
  "content_json": { "version": 1, "blocks": [] },
  "cover_asset_id": "uuid",
  "language": "pt-BR",
  "status": "draft",
  "scheduled_at": null,
  "category_ids": [1],
  "tag_ids": [2, 3],
  "seo_title": "Como usar IA em sala",
  "seo_description": "Guia pratico para docentes.",
  "seo_image_asset_id": "uuid",
  "canonical_url": null,
  "noindex": false
}
```

### `GET /api/admin/blog/posts/[id]`
Retorna post completo (incluindo `content_json`, `content_html`, categorias, tags, assets usados).

### `PUT /api/admin/blog/posts/[id]`
Atualiza todos os campos editaveis.

### `PATCH /api/admin/blog/posts/[id]/status`
Body:
```json
{
  "status": "published",
  "published_at": "2026-03-24T12:00:00Z"
}
```

### `POST /api/admin/blog/posts/[id]/restore-revision`
Body:
```json
{ "revision_id": "uuid" }
```

### `GET /api/admin/blog/posts/[id]/revisions`
Lista historico para rollback.

### `DELETE /api/admin/blog/posts/[id]`
Soft delete.

### `GET /api/admin/blog/categories`
### `POST /api/admin/blog/categories`
### `PUT /api/admin/blog/categories/[id]`
### `DELETE /api/admin/blog/categories/[id]`

### `GET /api/admin/blog/tags`
### `POST /api/admin/blog/tags`
### `PUT /api/admin/blog/tags/[id]`
### `DELETE /api/admin/blog/tags/[id]`

### `POST /api/admin/blog/assets/upload`
Upload de imagem/video leve para o blog.
Resposta:
```json
{
  "id": "uuid",
  "public_url": "https://...",
  "mime_type": "image/webp",
  "width": 1600,
  "height": 900,
  "variants": [
    { "variant": "thumb", "url": "https://..." },
    { "variant": "large", "url": "https://..." }
  ]
}
```

### `GET /api/admin/blog/assets`
Lista assets com filtros (`q`, `mime_type`, `page`, `page_size`).

## 6.2 API Publica (site)

### `GET /api/public/blog/posts`
Query:
- `page` (default 1)
- `page_size` (default 10, max 50)
- `language` (`pt-BR|es`)
- `category` (slug)
- `tag` (slug)
- `q` (busca em titulo/excerpt)
- `sort` (`newest|oldest`)

Resposta 200:
```json
{
  "items": [
    {
      "id": "uuid",
      "title": "Titulo",
      "slug": "titulo",
      "excerpt": "Resumo",
      "cover": {
        "url": "https://...",
        "width": 1600,
        "height": 900
      },
      "language": "pt-BR",
      "published_at": "2026-03-24T12:00:00Z",
      "read_time_minutes": 6,
      "categories": [{ "id": 1, "name": "Educacao", "slug": "educacao" }],
      "tags": [{ "id": 2, "name": "IA", "slug": "ia" }]
    }
  ],
  "page": 1,
  "page_size": 10,
  "total": 1
}
```

### `GET /api/public/blog/posts/[slug]?language=pt-BR&format=html`
- `format=html` (default): retorna `content_html` pronto para render rapido.
- `format=json`: retorna `content_json` para renderer custom do site.

Resposta 200:
```json
{
  "id": "uuid",
  "title": "Titulo",
  "slug": "titulo",
  "excerpt": "Resumo",
  "content_html": "<h2>...</h2><p>...</p>",
  "content_json": null,
  "language": "pt-BR",
  "published_at": "2026-03-24T12:00:00Z",
  "seo": {
    "title": "SEO title",
    "description": "SEO description",
    "image_url": "https://...",
    "canonical_url": null,
    "noindex": false
  },
  "categories": [{ "id": 1, "name": "Educacao", "slug": "educacao" }],
  "tags": [{ "id": 2, "name": "IA", "slug": "ia" }]
}
```

### `GET /api/public/blog/categories`
Lista categorias com `post_count` publicado.

### `GET /api/public/blog/tags`
Lista tags com `post_count` publicado.

### `GET /api/public/blog/search?q=...&language=pt-BR`
Busca publica dedicada (opcional, recomendado para UX).

## 6.3 Cache e desempenho (public API)
- `Cache-Control: public, s-maxage=60, stale-while-revalidate=300`
- ETag por resposta.
- Revalidacao por webhook apos publish/update.

## 6.4 Erros padrao
- `400` validacao
- `401` nao autenticado (admin API)
- `403` sem permissao (admin API)
- `404` nao encontrado
- `409` conflito (slug duplicado)
- `422` payload invalido
- `500` erro interno

Formato:
```json
{ "error": "Mensagem de erro" }
```

## 7) Plano de Implementacao Otimizado (Fases)

## Fase 1 - Base de dados e contrato
1. Criar migracao `021_blog_schema.sql` com tabelas, constraints e indices.
2. Criar migracao `022_blog_revisions_and_assets.sql`.
3. Definir contratos de API no codigo (tipos TS + validacao de payload).

## Fase 2 - API Admin e Publica
1. CRUD de posts/categorias/tags.
2. Upload e biblioteca de assets.
3. Revisoes e rollback.
4. Endpoints publicos com cache e filtros.

## Fase 3 - Sessao Blog no Portal (admin)
1. Menu admin `Blog`.
2. Listagem de posts com filtros e indicadores de status.
3. Editor rico por blocos (com drag-and-drop de blocos e imagens inline).
4. Fluxo editorial: draft -> review -> scheduled/published -> archived.

## Fase 4 - Integracao no Site
1. Lista de posts, detalhe por slug, pagina de categoria/tag, busca.
2. SEO completo (metadata, JSON-LD Article, sitemap, robots).
3. Render resiliente de blocos e midia responsiva.

## Fase 5 - Hardening
1. Rate limit na API publica.
2. Observabilidade (tempo de resposta, erro por endpoint, cache-hit).
3. Testes E2E (publicar, agendar, rollback, render no site).
4. Backup e estrategia de restauracao de conteudo.

## 8) Checklist de qualidade para considerar "pronto"
- [ ] Inserir imagem no meio do texto sem quebrar layout desktop/mobile.
- [ ] Criar galeria com legenda e alt text.
- [ ] Publicar, despublicar e agendar sem inconsistencias.
- [ ] Site renderizar post em menos de 200ms na API (cache hit).
- [ ] SEO completo por post (title, description, OG image, canonical).
- [ ] Rollback de revisao funcionando.
- [ ] API publica estavel e documentada para o time do site.

## 9) Decisoes finais (recomendacao pratica)
- Editor: Tiptap (ProseMirror) com schema de blocos custom.
- Armazenamento de imagem: comecar local se necessario, mas planejar migracao para object storage.
- Contrato publico: manter versao (`/api/public/v1/blog/...`) assim que o site entrar em producao.
- Seguranca: sanitizar HTML sempre no servidor antes de salvar `content_html`.
