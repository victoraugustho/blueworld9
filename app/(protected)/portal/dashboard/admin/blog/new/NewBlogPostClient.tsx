"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

type BlogStatus = "draft" | "review" | "scheduled" | "published" | "archived"
type BlogLanguage = "pt-BR" | "es"
type BlockType = "heading" | "paragraph" | "image" | "embed" | "list" | "quote" | "divider"

type BlogCategory = { id: number; name: string }
type BlogTag = { id: number; name: string }
type BlogAsset = {
  id: string
  public_url: string
  storage_key?: string | null
  alt_default?: string | null
  caption_default?: string | null
}
type BlogPost = {
  id: string
  title: string
  slug: string
  excerpt?: string | null
  language: BlogLanguage
  status: BlogStatus
  content_json: any
  category_ids?: number[]
  tag_ids?: number[]
  cover_asset_id?: string | null
  seo_image_asset_id?: string | null
  cover_image_url?: string | null
  seo_image_url?: string | null
  author_id?: string | null
  scheduled_at?: string | null
}

type BlogRevision = {
  id: string
  revision_number: number
  created_at: string
  created_by_name?: string | null
  created_by_email?: string | null
}

type Block = {
  id: string
  type: BlockType
  level?: number
  text?: string
  ordered?: boolean
  itemsText?: string
  asset_id?: string
  url?: string
  alt?: string
  caption?: string
  provider?: "youtube" | "generic" | "video"
}

function id() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
}

function toIso(local: string) {
  const raw = String(local ?? "").trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateTime(value?: string | null) {
  if (!value) return "-"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return "-"
  return parsed.toLocaleString("pt-BR")
}

function toggleInt(list: number[], value: number) {
  const set = new Set(list)
  if (set.has(value)) set.delete(value)
  else set.add(value)
  return Array.from(set).sort((a, b) => a - b)
}

function newBlock(type: BlockType): Block {
  if (type === "heading") return { id: id(), type, level: 2, text: "" }
  if (type === "paragraph") return { id: id(), type, text: "" }
  if (type === "image") return { id: id(), type, asset_id: "", url: "", alt: "", caption: "" }
  if (type === "embed") return { id: id(), type, provider: "youtube", url: "" }
  if (type === "list") return { id: id(), type, ordered: false, itemsText: "" }
  if (type === "quote") return { id: id(), type, text: "" }
  return { id: id(), type }
}

function parseContentInput(content: any) {
  if (typeof content === "string") {
    try {
      return JSON.parse(content)
    } catch {
      return { version: 1, blocks: [] }
    }
  }
  if (content && typeof content === "object") return content
  return { version: 1, blocks: [] }
}

function contentToBlocks(content: any): Block[] {
  const parsed = parseContentInput(content)
  const input = Array.isArray(parsed?.blocks) ? parsed.blocks : []
  const mapped = input
    .map((item: any) => {
      const type = String(item?.type ?? "").trim()
      if (type === "heading") {
        return {
          id: id(),
          type: "heading",
          level: Math.min(4, Math.max(1, Number(item?.level) || 2)),
          text: String(item?.text ?? ""),
        } satisfies Block
      }
      if (type === "paragraph") {
        const children = Array.isArray(item?.children) ? item.children : []
        const text = children.map((child: any) => String(child?.text ?? "")).join(" ").trim() || String(item?.text ?? "")
        return { id: id(), type: "paragraph", text } satisfies Block
      }
      if (type === "image") {
        return {
          id: id(),
          type: "image",
          asset_id: String(item?.asset_id ?? ""),
          url: String(item?.url ?? ""),
          alt: String(item?.alt ?? ""),
          caption: String(item?.caption ?? ""),
        } satisfies Block
      }
      if (type === "embed") {
        const provider = item?.provider === "generic" || item?.provider === "video" ? item.provider : "youtube"
        return { id: id(), type: "embed", provider, url: String(item?.url ?? "") } satisfies Block
      }
      if (type === "list") {
        const items = Array.isArray(item?.items) ? item.items.map((entry: any) => String(entry ?? "").trim()).filter(Boolean) : []
        return { id: id(), type: "list", ordered: item?.ordered === true, itemsText: items.join("\n") } satisfies Block
      }
      if (type === "quote") return { id: id(), type: "quote", text: String(item?.text ?? "") } satisfies Block
      if (type === "divider") return { id: id(), type: "divider" } satisfies Block
      return null
    })
    .filter(Boolean) as Block[]

  return mapped.length > 0 ? mapped : [newBlock("paragraph")]
}

function blocksToContent(blocks: Block[]) {
  const raw = blocks.map((b) => {
    if (b.type === "heading") {
      return {
        type: "heading",
        level: Math.min(4, Math.max(1, Number(b.level) || 2)),
        text: String(b.text ?? "").trim(),
      }
    }
    if (b.type === "paragraph") return { type: "paragraph", children: [{ text: String(b.text ?? "") }] }
    if (b.type === "image") {
      const item: any = { type: "image" }
      if (String(b.asset_id ?? "").trim()) item.asset_id = String(b.asset_id).trim()
      if (String(b.url ?? "").trim()) item.url = String(b.url).trim()
      if (String(b.alt ?? "").trim()) item.alt = String(b.alt).trim()
      if (String(b.caption ?? "").trim()) item.caption = String(b.caption).trim()
      return item
    }
    if (b.type === "embed") {
      const provider = b.provider === "generic" || b.provider === "video" ? b.provider : "youtube"
      return { type: "embed", provider, url: String(b.url ?? "").trim() }
    }
    if (b.type === "list") {
      const items = String(b.itemsText ?? "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean)
      return { type: "list", ordered: b.ordered === true, items }
    }
    if (b.type === "quote") return { type: "quote", text: String(b.text ?? "").trim() }
    return { type: "divider" }
  })

  const blocksFiltered = raw.filter((b: any) => {
    if (b.type === "heading" || b.type === "quote") return String(b.text ?? "").trim().length > 0
    if (b.type === "paragraph") return String(b.children?.[0]?.text ?? "").trim().length > 0
    if (b.type === "image") return String(b.asset_id ?? "").trim().length > 0 || String(b.url ?? "").trim().length > 0
    if (b.type === "embed") return String(b.url ?? "").trim().length > 0
    if (b.type === "list") return Array.isArray(b.items) && b.items.length > 0
    return true
  })

  return { version: 1, blocks: blocksFiltered }
}

function blockLabel(type: BlockType) {
  if (type === "heading") return "Titulo/Subtitulo"
  if (type === "paragraph") return "Texto"
  if (type === "image") return "Imagem"
  if (type === "embed") return "Video/Embed"
  if (type === "list") return "Lista"
  if (type === "quote") return "Citacao"
  return "Divisor"
}

export default function NewBlogPostClient({ postId }: { postId?: string } = {}) {
  const router = useRouter()
  const isEditMode = String(postId ?? "").trim().length > 0

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewSaving, setPreviewSaving] = useState(false)
  const [uploadingBlockId, setUploadingBlockId] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [uploadingSeo, setUploadingSeo] = useState(false)
  const [savedPostId, setSavedPostId] = useState<string | null>(isEditMode ? String(postId).trim() : null)

  const [categories, setCategories] = useState<BlogCategory[]>([])
  const [tags, setTags] = useState<BlogTag[]>([])
  const [assets, setAssets] = useState<BlogAsset[]>([])
  const [revisions, setRevisions] = useState<BlogRevision[]>([])
  const [revisionsLoading, setRevisionsLoading] = useState(false)
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [slug, setSlug] = useState("")
  const [excerpt, setExcerpt] = useState("")
  const [language, setLanguage] = useState<BlogLanguage>("pt-BR")
  const [status, setStatus] = useState<BlogStatus>("draft")
  const [scheduledLocal, setScheduledLocal] = useState("")

  const [categoryIds, setCategoryIds] = useState<number[]>([])
  const [tagIds, setTagIds] = useState<number[]>([])

  const [coverAssetId, setCoverAssetId] = useState("")
  const [seoAssetId, setSeoAssetId] = useState("")
  const [coverDirectUrl, setCoverDirectUrl] = useState<string | null>(null)
  const [seoDirectUrl, setSeoDirectUrl] = useState<string | null>(null)

  const [blocks, setBlocks] = useState<Block[]>([newBlock("paragraph")])

  const applyPostData = useCallback((postData: BlogPost | Record<string, any>) => {
    setSavedPostId(String(postData?.id ?? "").trim() || null)
    setTitle(String(postData?.title ?? ""))
    setSlug(String(postData?.slug ?? ""))
    setExcerpt(String(postData?.excerpt ?? ""))
    setLanguage((postData?.language as BlogLanguage) || "pt-BR")
    setStatus((postData?.status as BlogStatus) || "draft")
    setScheduledLocal(toDateTimeLocal(postData?.scheduled_at))
    setCategoryIds(
      Array.isArray(postData?.category_ids)
        ? postData.category_ids
            .map((item: any) => Number(item))
            .filter((item: number) => Number.isInteger(item) && item > 0)
        : []
    )
    setTagIds(
      Array.isArray(postData?.tag_ids)
        ? postData.tag_ids
            .map((item: any) => Number(item))
            .filter((item: number) => Number.isInteger(item) && item > 0)
        : []
    )
    setCoverAssetId(String(postData?.cover_asset_id ?? ""))
    setSeoAssetId(String(postData?.seo_image_asset_id ?? ""))
    setCoverDirectUrl(String(postData?.cover_image_url ?? "").trim() || null)
    setSeoDirectUrl(String(postData?.seo_image_url ?? "").trim() || null)
    setBlocks(contentToBlocks(postData?.content_json))
  }, [])

  const loadRevisions = useCallback(async (targetPostId: string) => {
    const idValue = String(targetPostId ?? "").trim()
    if (!idValue) {
      setRevisions([])
      return
    }

    setRevisionsLoading(true)
    try {
      const res = await fetch(`/api/admin/blog/posts/${idValue}/revisions?page=1&page_size=25`, {
        cache: "no-store",
      })
      if (!res.ok) {
        setRevisions([])
        return
      }
      const data = await res.json().catch(() => ({}))
      setRevisions(Array.isArray(data?.items) ? data.items : [])
    } finally {
      setRevisionsLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        setLoading(true)
        const requests: Promise<Response>[] = [
          fetch("/api/admin/blog/categories", { cache: "no-store" }),
          fetch("/api/admin/blog/tags", { cache: "no-store" }),
          fetch("/api/admin/blog/assets?page=1&page_size=120", { cache: "no-store" }),
        ]
        if (isEditMode && postId) {
          requests.push(fetch(`/api/admin/blog/posts/${postId}`, { cache: "no-store" }))
        }

        const [categoriesRes, tagsRes, assetsRes, postRes] = await Promise.all(requests as any)

        const categoriesData = await categoriesRes.json().catch(() => [])
        const tagsData = await tagsRes.json().catch(() => [])
        const assetsData = await assetsRes.json().catch(() => ({}))
        const postData = postRes ? ((await postRes.json().catch(() => null)) as BlogPost | null) : null

        if (!active) return
        if (isEditMode && postRes && !postRes.ok) {
          alert("Post nao encontrado.")
          router.push("/portal/dashboard/admin/blog/posts")
          return
        }

        setCategories(Array.isArray(categoriesData) ? categoriesData : [])
        setTags(Array.isArray(tagsData) ? tagsData : [])
        setAssets(Array.isArray(assetsData?.items) ? assetsData.items : [])

        if (postData && isEditMode) {
          applyPostData(postData)
          const loadedPostId = String(postData.id ?? "").trim()
          if (loadedPostId) void loadRevisions(loadedPostId)
        } else if (!isEditMode) {
          setRevisions([])
        }
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => {
      active = false
    }
  }, [applyPostData, isEditMode, loadRevisions, postId, router])

  const coverImageUrl = useMemo(() => {
    if (!coverAssetId) return coverDirectUrl
    return assets.find((a) => a.id === coverAssetId)?.public_url ?? coverDirectUrl ?? null
  }, [assets, coverAssetId, coverDirectUrl])

  const seoImageUrl = useMemo(() => {
    if (!seoAssetId) return seoDirectUrl
    return assets.find((a) => a.id === seoAssetId)?.public_url ?? seoDirectUrl ?? null
  }, [assets, seoAssetId, seoDirectUrl])

  function resolveBlockImageUrl(block: Block) {
    const direct = String(block.url ?? "").trim()
    if (direct) return direct
    const assetId = String(block.asset_id ?? "").trim()
    if (!assetId) return null
    return assets.find((item) => item.id === assetId)?.public_url ?? null
  }

  function updateBlock(idValue: string, patch: Partial<Block>) {
    setBlocks((prev) => prev.map((b) => (b.id === idValue ? { ...b, ...patch } : b)))
  }

  function addBlock(type: BlockType) {
    setBlocks((prev) => [...prev, newBlock(type)])
  }

  function removeBlock(idValue: string) {
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== idValue)
      return next.length > 0 ? next : [newBlock("paragraph")]
    })
  }

  function moveBlock(idValue: string, dir: "up" | "down") {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === idValue)
      if (idx < 0) return prev
      const target = dir === "up" ? idx - 1 : idx + 1
      if (target < 0 || target >= prev.length) return prev
      const copy = [...prev]
      const [item] = copy.splice(idx, 1)
      copy.splice(target, 0, item)
      return copy
    })
  }

  async function uploadAsset(
    file: File | null,
    options?: {
      alt_default?: string
      caption_default?: string
    }
  ) {
    if (!file) return null
    const form = new FormData()
    form.set("file", file)

    const altDefault = String(options?.alt_default ?? "").trim()
    const captionDefault = String(options?.caption_default ?? "").trim()
    if (altDefault) form.set("alt_default", altDefault)
    if (captionDefault) form.set("caption_default", captionDefault)

    const res = await fetch("/api/admin/blog/assets/upload", { method: "POST", body: form })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Falha no upload da imagem")
      return null
    }

    const created = (await res.json().catch(() => null)) as BlogAsset | null
    if (!created?.id) return null

    setAssets((prev) => [created, ...prev.filter((item) => item.id !== created.id)])
    return created
  }

  async function uploadImageForBlock(blockId: string, file: File | null) {
    if (!file) return

    const block = blocks.find((item) => item.id === blockId)
    setUploadingBlockId(blockId)
    try {
      const created = await uploadAsset(file, {
        alt_default: String(block?.alt ?? "").trim(),
        caption_default: String(block?.caption ?? "").trim(),
      })
      if (!created?.id) return

      setBlocks((prev) =>
        prev.map((item) => {
          if (item.id !== blockId) return item
          return {
            ...item,
            asset_id: String(created.id),
            url: "",
            alt: String(item.alt ?? "").trim() || String(created.alt_default ?? ""),
            caption: String(item.caption ?? "").trim() || String(created.caption_default ?? ""),
          }
        })
      )
    } finally {
      setUploadingBlockId(null)
    }
  }

  async function uploadCoverImage(file: File | null) {
    if (!file) return
    setUploadingCover(true)
    try {
      const created = await uploadAsset(file)
      if (!created?.id) return
      setCoverAssetId(String(created.id))
      setCoverDirectUrl(String(created.public_url ?? "").trim() || null)
    } finally {
      setUploadingCover(false)
    }
  }

  async function uploadSeoImage(file: File | null) {
    if (!file) return
    setUploadingSeo(true)
    try {
      const created = await uploadAsset(file)
      if (!created?.id) return
      setSeoAssetId(String(created.id))
      setSeoDirectUrl(String(created.public_url ?? "").trim() || null)
    } finally {
      setUploadingSeo(false)
    }
  }

  async function restoreRevision(revisionId: string) {
    const targetPostId = String(savedPostId ?? "").trim()
    if (!targetPostId) return
    if (!window.confirm("Restaurar esta revisao? O conteudo atual sera substituido.")) return

    setRestoringRevisionId(revisionId)
    try {
      const res = await fetch(`/api/admin/blog/posts/${targetPostId}/restore-revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision_id: revisionId }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err?.error ?? "Falha ao restaurar revisao")
        return
      }

      const data = await res.json().catch(() => ({}))
      if (data?.post) {
        applyPostData(data.post)
        await loadRevisions(targetPostId)
        alert("Revisao restaurada com sucesso.")
      }
    } finally {
      setRestoringRevisionId(null)
    }
  }

  function validateBaseData() {
    const titleValue = title.trim()
    if (!titleValue) {
      alert("Informe o titulo")
      return null
    }

    const content_json = blocksToContent(blocks)
    if (!Array.isArray(content_json.blocks) || content_json.blocks.length === 0) {
      alert("Adicione blocos com conteudo")
      return null
    }

    return { titleValue, content_json }
  }

  function buildPayload(targetStatus: BlogStatus) {
    const base = validateBaseData()
    if (!base) return null

    const scheduled_at = targetStatus === "scheduled" ? toIso(scheduledLocal) : null
    if (targetStatus === "scheduled" && !scheduled_at) {
      alert("Informe data/hora para agendar")
      return null
    }

    return {
      title: base.titleValue,
      slug: slugify(slug || base.titleValue),
      excerpt: excerpt.trim() || null,
      language,
      status: targetStatus,
      scheduled_at,
      category_ids: categoryIds,
      tag_ids: tagIds,
      cover_asset_id: coverAssetId || null,
      seo_image_asset_id: seoAssetId || null,
      content_json: base.content_json,
    }
  }

  async function persistPost(options: { forPreview?: boolean }) {
    const forPreview = options.forPreview === true

    const previewStatus: BlogStatus = savedPostId ? status : "draft"
    const payload = buildPayload(forPreview ? previewStatus : status)
    if (!payload) return null

    const url = savedPostId ? `/api/admin/blog/posts/${savedPostId}` : "/api/admin/blog/posts"
    const method = savedPostId ? "PUT" : "POST"

    if (forPreview) setPreviewSaving(true)
    else setSaving(true)

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })

    if (forPreview) setPreviewSaving(false)
    else setSaving(false)

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      alert(err?.error ?? "Erro ao salvar post")
      return null
    }

    const data = await res.json().catch(() => null)
    const idValue = String(data?.post?.id ?? savedPostId ?? "").trim()
    if (idValue) {
      setSavedPostId(idValue)
      void loadRevisions(idValue)
    }
    return idValue || null
  }

  async function createPost() {
    const idValue = await persistPost({ forPreview: false })
    if (idValue) {
      router.push(`/portal/dashboard/admin/blog/${idValue}`)
      return
    }
    router.push("/portal/dashboard/admin/blog")
  }

  async function openPreview() {
    const base = validateBaseData()
    if (!base) return

    const persistedId = await persistPost({ forPreview: true })
    if (!persistedId) return

    const payload = {
      post_id: persistedId,
      title: base.titleValue,
      slug: slugify(slug || base.titleValue),
      excerpt: excerpt.trim(),
      language,
      status,
      scheduled_at: toIso(scheduledLocal),
      cover_asset_id: coverAssetId || null,
      cover_image_url: coverImageUrl,
      content_json: base.content_json,
      asset_map: Object.fromEntries(assets.map((a) => [a.id, a.public_url])),
      generated_at: new Date().toISOString(),
    }

    const token = id()
    localStorage.setItem(`blog_preview_${token}`, JSON.stringify(payload))
    const url = `/portal/dashboard/admin/blog/preview?draft=${encodeURIComponent(token)}`
    const popup = window.open(url, "_blank")
    if (!popup) router.push(url)
  }

  if (loading) return <div className="p-6 text-white">Carregando editor...</div>

  return (
    <div className="p-4 md:p-6 text-white space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">{isEditMode ? "Editar Post (Editor de Blocos)" : "Novo Post (Editor de Blocos)"}</h1>
          <p className="text-sm text-slate-300">Titulo, subtitulo, texto, imagem e video no estilo blocos.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link href="/portal/dashboard/admin/blog">
            <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Voltar</Button>
          </Link>
          <Link href="/portal/dashboard/admin/blog#taxonomias">
            <Button className="bg-white/10 hover:bg-white/15 border border-white/10">Categorias/Tags</Button>
          </Link>
          <Button className="bg-indigo-600 hover:bg-indigo-700" onClick={openPreview} disabled={previewSaving}>
            {previewSaving ? "Salvando..." : "Abrir Preview"}
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={createPost} disabled={saving}>
            {saving ? "Salvando..." : savedPostId ? "Salvar Alteracoes" : "Criar Post"}
          </Button>
        </div>
      </div>

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Dados do Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-white">Titulo</Label>
              <Input className="mt-1 bg-slate-800/60 border-slate-700 text-white" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div>
              <Label className="text-white">Slug (opcional)</Label>
              <Input className="mt-1 bg-slate-800/60 border-slate-700 text-white" value={slug} onChange={(e) => setSlug(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="text-white">Resumo</Label>
            <Textarea className="mt-1 bg-slate-800/60 border-slate-700 text-white" rows={3} value={excerpt} onChange={(e) => setExcerpt(e.target.value)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            <div>
              <Label className="text-white">Idioma</Label>
              <select className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2" value={language} onChange={(e) => setLanguage(e.target.value as BlogLanguage)}>
                <option value="pt-BR">Portugues (BR)</option>
                <option value="es">Espanol</option>
              </select>
            </div>
            <div>
              <Label className="text-white">Status</Label>
              <select className="mt-1 w-full rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2" value={status} onChange={(e) => setStatus(e.target.value as BlogStatus)}>
                <option value="draft">Rascunho</option>
                <option value="review">Revisao</option>
                <option value="scheduled">Agendado</option>
                <option value="published">Publicado</option>
                {isEditMode && <option value="archived">Arquivado</option>}
              </select>
            </div>
            <div>
              <Label className="text-white">Agendar para</Label>
              {status === "scheduled" ? (
                <Input type="datetime-local" className="mt-1 bg-slate-800/60 border-slate-700 text-white" value={scheduledLocal} onChange={(e) => setScheduledLocal(e.target.value)} />
              ) : (
                <p className="mt-2 text-xs text-slate-400">Ative o status "Agendado" para definir data e hora.</p>
              )}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/5 p-3">
            <p className="text-sm text-white font-semibold">Autor</p>
            <p className="text-xs text-slate-300">Sempre definido automaticamente como o usuario logado.</p>
          </div>
        </CardContent>
      </Card>

      {isEditMode ? (
        <Card className="bg-slate-900/20 border border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Revisoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {!savedPostId ? (
              <p className="text-sm text-slate-300">Salve o post para habilitar revisoes.</p>
            ) : revisionsLoading ? (
              <p className="text-sm text-slate-300">Carregando revisoes...</p>
            ) : revisions.length === 0 ? (
              <p className="text-sm text-slate-300">Nenhuma revisao disponivel ainda.</p>
            ) : (
              <div className="space-y-2">
                {revisions.map((revision) => (
                  <div
                    key={revision.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/5 p-3 flex-wrap"
                  >
                    <div>
                      <p className="text-sm font-semibold text-white">Revisao #{revision.revision_number}</p>
                      <p className="text-xs text-slate-300">
                        {formatDateTime(revision.created_at)} por{" "}
                        {revision.created_by_name || revision.created_by_email || "Usuario"}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="bg-cyan-600 hover:bg-cyan-700"
                      onClick={() => void restoreRevision(revision.id)}
                      disabled={restoringRevisionId === revision.id}
                    >
                      {restoringRevisionId === revision.id ? "Restaurando..." : "Restaurar"}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Categorias, Tags e Imagens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 p-3">
              <Label className="text-white text-sm">Categorias</Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {categories.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={categoryIds.includes(item.id)} onChange={() => setCategoryIds((prev) => toggleInt(prev, item.id))} />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-white/10 p-3">
              <Label className="text-white text-sm">Tags</Label>
              <div className="mt-2 max-h-32 overflow-y-auto space-y-1">
                {tags.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-slate-200">
                    <input type="checkbox" checked={tagIds.includes(item.id)} onChange={() => setTagIds((prev) => toggleInt(prev, item.id))} />
                    {item.name}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <Label className="text-white">Imagem de capa</Label>
              <p className="text-xs text-slate-300">
                Recomendado: 1600x900 (16:9). Minimo: 1200x675. Formatos: JPG, PNG, WebP, GIF, AVIF (ate 10MB).
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="cover-upload"
                  className="inline-flex h-10 cursor-pointer items-center rounded-md border border-cyan-300/40 bg-cyan-500/20 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  Enviar ficheiro
                </label>
                <input
                  id="cover-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void uploadCoverImage(file)
                    e.currentTarget.value = ""
                  }}
                />
                {coverAssetId ? (
                  <Button
                    size="sm"
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={() => {
                      setCoverAssetId("")
                      setCoverDirectUrl(null)
                    }}
                  >
                    Remover capa
                  </Button>
                ) : null}
              </div>
              {uploadingCover ? <p className="text-xs text-cyan-300">Enviando capa...</p> : null}
              {coverImageUrl ? (
                <img
                  src={coverImageUrl}
                  alt="capa"
                  className="w-full max-h-64 object-contain rounded border border-white/10 bg-slate-900/30"
                />
              ) : null}
            </div>
            <div className="rounded-lg border border-white/10 p-3 space-y-2">
              <Label className="text-white">Imagem SEO</Label>
              <p className="text-xs text-slate-300">
                Recomendado para compartilhamento: 1200x630. Formatos: JPG, PNG, WebP, GIF, AVIF (ate 10MB).
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <label
                  htmlFor="seo-upload"
                  className="inline-flex h-10 cursor-pointer items-center rounded-md border border-cyan-300/40 bg-cyan-500/20 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  Enviar ficheiro
                </label>
                <input
                  id="seo-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] ?? null
                    void uploadSeoImage(file)
                    e.currentTarget.value = ""
                  }}
                />
                {seoAssetId ? (
                  <Button
                    size="sm"
                    className="bg-white/10 hover:bg-white/15 border border-white/10"
                    onClick={() => {
                      setSeoAssetId("")
                      setSeoDirectUrl(null)
                    }}
                  >
                    Remover SEO
                  </Button>
                ) : null}
              </div>
              {uploadingSeo ? <p className="text-xs text-cyan-300">Enviando imagem SEO...</p> : null}
              {seoImageUrl ? (
                <img
                  src={seoImageUrl}
                  alt="seo"
                  className="w-full max-h-64 object-contain rounded border border-white/10 bg-slate-900/30"
                />
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900/20 border border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Editor de Blocos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("heading")}>+ Titulo/Subtitulo</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("paragraph")}>+ Texto</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("image")}>+ Imagem</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("embed")}>+ Video</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("list")}>+ Lista</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("quote")}>+ Citacao</Button>
            <Button className="bg-cyan-600 hover:bg-cyan-700" onClick={() => addBlock("divider")}>+ Divisor</Button>
          </div>

          {blocks.map((block, idx) => {
            const imagePreview = resolveBlockImageUrl(block)
            return (
              <div key={block.id} className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <p className="text-sm font-semibold text-slate-100">Bloco {idx + 1}: {blockLabel(block.type)}</p>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-white/10 hover:bg-white/15 border border-white/10" onClick={() => moveBlock(block.id, "up")}>Subir</Button>
                    <Button size="sm" className="bg-white/10 hover:bg-white/15 border border-white/10" onClick={() => moveBlock(block.id, "down")}>Descer</Button>
                    <Button size="sm" className="bg-rose-600 hover:bg-rose-700" onClick={() => removeBlock(block.id)}>Excluir</Button>
                  </div>
                </div>

                {block.type === "heading" && (
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <select className="rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2" value={String(block.level ?? 2)} onChange={(e) => updateBlock(block.id, { level: Number(e.target.value) })}>
                      <option value="1">H1</option>
                      <option value="2">H2</option>
                      <option value="3">H3</option>
                      <option value="4">H4</option>
                    </select>
                    <Input className="md:col-span-3 bg-slate-800/60 border-slate-700 text-white" value={block.text ?? ""} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Texto do titulo/subtitulo" />
                  </div>
                )}

                {block.type === "paragraph" && <Textarea className="bg-slate-800/60 border-slate-700 text-white" rows={4} value={block.text ?? ""} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Texto do paragrafo" />}

                {block.type === "image" && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-300">
                      Recomendado para bloco: 1600x900 (ou proporcional). Em telas grandes a imagem fica em modo
                      contain para nao distorcer.
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label
                        htmlFor={`block-upload-${block.id}`}
                        className="inline-flex h-10 cursor-pointer items-center rounded-md border border-cyan-300/40 bg-cyan-500/20 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                      >
                        Enviar ficheiro
                      </label>
                      <input
                        id={`block-upload-${block.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null
                          void uploadImageForBlock(block.id, file)
                          e.currentTarget.value = ""
                        }}
                      />
                      {(block.asset_id || block.url) ? (
                        <Button
                          size="sm"
                          className="bg-white/10 hover:bg-white/15 border border-white/10"
                          onClick={() => updateBlock(block.id, { asset_id: "", url: "" })}
                        >
                          Remover imagem
                        </Button>
                      ) : null}
                    </div>
                    <Input className="bg-slate-800/60 border-slate-700 text-white" value={block.url ?? ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder="ou URL externa" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <Input className="bg-slate-800/60 border-slate-700 text-white" value={block.alt ?? ""} onChange={(e) => updateBlock(block.id, { alt: e.target.value })} placeholder="Alt" />
                      <Input className="bg-slate-800/60 border-slate-700 text-white" value={block.caption ?? ""} onChange={(e) => updateBlock(block.id, { caption: e.target.value })} placeholder="Legenda" />
                    </div>
                    {uploadingBlockId === block.id && <p className="text-xs text-cyan-300">Enviando imagem...</p>}
                    {imagePreview && (
                      <img
                        src={imagePreview}
                        alt={block.alt || "preview"}
                        className="w-full max-h-64 object-contain rounded border border-white/10 bg-slate-900/30"
                      />
                    )}
                  </div>
                )}

                {block.type === "embed" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <select className="rounded-md bg-slate-800 border border-slate-700 text-white px-3 py-2" value={block.provider ?? "youtube"} onChange={(e) => updateBlock(block.id, { provider: e.target.value as "youtube" | "generic" | "video" })}>
                      <option value="youtube">YouTube</option>
                      <option value="video">Video direto (URL)</option>
                      <option value="generic">Link</option>
                    </select>
                    <Input className="md:col-span-2 bg-slate-800/60 border-slate-700 text-white" value={block.url ?? ""} onChange={(e) => updateBlock(block.id, { url: e.target.value })} placeholder={block.provider === "video" ? "URL direta (.mp4, .webm, .ogg...)" : "URL do video/embed"} />
                  </div>
                )}

                {block.type === "list" && (
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm text-slate-100">
                      <input type="checkbox" checked={block.ordered === true} onChange={(e) => updateBlock(block.id, { ordered: e.target.checked })} />
                      Ordenada
                    </label>
                    <Textarea className="bg-slate-800/60 border-slate-700 text-white" rows={4} value={block.itemsText ?? ""} onChange={(e) => updateBlock(block.id, { itemsText: e.target.value })} placeholder="um item por linha" />
                  </div>
                )}

                {block.type === "quote" && <Textarea className="bg-slate-800/60 border-slate-700 text-white" rows={3} value={block.text ?? ""} onChange={(e) => updateBlock(block.id, { text: e.target.value })} placeholder="Texto da citacao" />}
                {block.type === "divider" && <p className="text-sm text-slate-300">Linha divisoria no post.</p>}
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
