# Módulo de Projetos (Professor + Admin)

## 1) Objetivo
- Criar uma nova aba de **Projetos** para professores.
- Criar uma área de **Projetos (Admin)** para criação e gestão.
- Suportar conteúdo dinâmico em blocos, galeria de imagens, documentos, links, comentários e observações.
- Exigir versões em **Português** e **Espanhol**.

## 2) Banco de dados
- Migração: `scripts/031_projects_module.sql`
- Tabelas principais:
  - `teacher_projects`
  - `teacher_project_sections`
  - `teacher_project_assets`
  - `teacher_project_links`
  - `teacher_project_comments`
  - `teacher_project_teacher_notes`
  - `teacher_project_revisions`

## 3) Permissões por ID (.env)
- Apenas admins autorizados por ID podem gerenciar projetos.
- Variáveis suportadas:
  - `PROJECTS_ADMIN_IDS` (lista separada por vírgula)
  - `PROJECTS_ADMIN_ID_1`
  - `PROJECTS_ADMIN_ID_2`

## 4) Limites de upload (.env)
- `PROJECT_MAX_IMAGE_MB` (padrão: `20`)
- `PROJECT_MAX_DOCUMENT_MB` (padrão: `50`)

## 5) Persistência de arquivos (volume)
- Uploads do módulo de projetos são salvos em:
  - `/app/public/uploads/projects`
- Estrutura criada automaticamente por ano/mês:
  - `/app/public/uploads/projects/YYYY/MM`
- Recomendação de volume no servidor:
  - Host: diretório persistente
  - Container: `/app/public/uploads`

## 6) Rotas principais
- Admin:
  - `GET/POST /api/admin/projects`
  - `GET/PUT/DELETE /api/admin/projects/[id]`
  - `GET /api/admin/projects/options`
  - `POST /api/admin/projects/assets/upload`
  - `GET /api/admin/projects/[id]/revisions`
  - `POST /api/admin/projects/[id]/restore-revision`
- Professor:
  - `GET /api/portal/projects`
  - `GET /api/portal/projects/[id]`
  - `GET/POST /api/portal/projects/[id]/comments`
  - `GET/PUT /api/portal/projects/[id]/note`

