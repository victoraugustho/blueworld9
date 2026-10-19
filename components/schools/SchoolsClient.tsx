"use client"

import { useEffect, useRef, useState, type ReactNode, type FormEvent } from 'react'
import Link from 'next/link'
import * as Dialog from '@radix-ui/react-dialog'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { ArrowLeft, ArrowRight, Building2, Boxes, ClipboardList, History, Layers, Loader2, Pencil, Plus, Search, Send, Trash2, Users, X } from 'lucide-react'
import InventoryWorkspace from './InventoryWorkspace'
import KitComponentsEditor from './KitComponentsEditor'

type Row = Record<string, any>
type Props = { admin: boolean; locale: string; schoolId?: string; templates: boolean; tab: string }
const root = '/portal/dashboard/escolas'
const api = '/api/portal/schools'
const panel = 'rounded-2xl border border-white/10 bg-slate-900/85 backdrop-blur-xl shadow-lg'
const input = 'w-full rounded-lg border border-slate-600 bg-slate-950/80 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300 focus:ring-2 focus:ring-cyan-500/20'
const button = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed'
const primary = `${button} !border-cyan-400/30 !bg-cyan-600 hover:!bg-cyan-500`
const general='b9000000-0000-4000-8000-000000000001'
const defaultLine={name:'',category:'',category_id:general,tracking_mode:'bulk',quantity:1,unit:'un'}
const defaultItem = { ...defaultLine,asset_tag:'',serial_number:'',location:'',condition:'good',notes:'',components:[] }
const defaults: Record<string,Row> = {
  school: { name:'',country:'BR',address:'',notes:'',active:true }, item:defaultItem,
  request: { kind:'new',name:'',category_id:general,tracking_mode:'bulk',quantity:1,unit:'un',reason:'',components:[] }, review:{ notes:'' }, delete:{ reason:'' },
  template: { name:'',description:'',active:true,items:[{...defaultLine}] }, apply:{templateId:''},
  category:{name:'',name_es:'',description:'',description_es:'',default_tracking:'bulk',default_unit:'un',active:true},
  condition:{from:'good',to:'damaged',quantity:1,reason:''}, adjust:{direction:'entry',condition:'good',quantity:1,reason:''},
  individualize:{reason:''}, retire:{reason:''}, asset:{condition:'good',serial_number:'',location:'',notes:'',reason:''},
}
const labels: Record<string,[string,string]> = {
  name:['Nome','Nombre'],code:['Código da escola','Código de escuela'],country:['País','País'],address:['Endereço','Dirección'],notes:['Observações','Observaciones'],active:['Ativo','Activo'],
  category:['Categoria','Categoría'],quantity:['Quantidade','Cantidad'],unit:['Unidade','Unidad'],asset_tag:['Patrimônio individual','Patrimonio individual'],serial_number:['Número de série','Número de serie'],location:['Localização','Ubicación'],condition:['Condição','Estado'],
  reason:['Justificativa','Justificación'],kind:['Tipo','Tipo'],description:['Descrição','Descripción'],
  good:['Bom estado','Buen estado'],maintenance:['Em manutenção','En mantenimiento'],damaged:['Danificado','Dañado'],missing:['Não localizado','No localizado'],
  pending:['Pendente','Pendiente'],approved:['Aprovado · aguardando recebimento','Aprobado · esperando recepción'],rejected:['Recusado','Rechazado'],fulfilled:['Incorporado ao inventário','Incorporado al inventario'],
  existing:['Informar item já existente','Informar artículo existente'],new:['Solicitar novo item','Solicitar artículo nuevo'],
  category_id:['Categoria','Categoría'],tracking_mode:['Forma de controle','Forma de control'],bulk:['Por quantidade','Por cantidad'],individual:['Individual, com identificação automática','Individual, con identificación automática'],
  default_tracking:['Controle padrão','Control predeterminado'],default_unit:['Unidade padrão','Unidad predeterminada'],
  name_es:['Nome em espanhol','Nombre en español'],description_es:['Descrição em espanhol','Descripción en español'],
  un:['Unidades','Unidades'],kit:['Kits','Kits'],cx:['Caixas','Cajas'],cj:['Conjuntos','Conjuntos'],
  from:['Condição atual','Estado actual'],to:['Nova condição','Nuevo estado'],direction:['Movimentação','Movimiento'],entry:['Entrada de estoque','Entrada de existencias'],exit:['Baixa de estoque','Baja de existencias'],
}
export default function SchoolsClient({ admin,locale,schoolId,templates,tab }: Props) {
  const es = locale === 'es'
  const t = (pt: string, spanish: string) => es ? spanish : pt
  const label = (key: string) => labels[key]?.[es ? 1 : 0] ?? key
  const [rows,setRows] = useState<Row[]>([]), [detail,setDetail] = useState<Row | null>(null)
  const [total,setTotal] = useState(0), [search,setSearch] = useState(''), [page,setPage] = useState(1)
  const [loading,setLoading] = useState(true), [busy,setBusy] = useState(false), [reload,setReload] = useState(0)
  const [error,setError] = useState(''), [notice,setNotice] = useState('')
  const [editor,setEditor] = useState<{ kind:string; row?:Row; decision?:string } | null>(null)
  const [form,setForm] = useState<Row>({}), [dirty,setDirty] = useState(false), [discard,setDiscard] = useState(false)
  const [confirm,setConfirm] = useState<{ title:string; run:()=>void } | null>(null)
  const [options,setOptions] = useState<Row>({teachers:[],classes:[],templates:[]})
  const [optionSearch,setOptionSearch] = useState(''), [optionsLoading,setOptionsLoading] = useState(false)
  const [optionsFailed,setOptionsFailed] = useState(false)
  const [catalog,setCatalog]=useState<Row[]>([])
  const sending = useRef(false), requestKey = useRef({body:'',key:''})
  const school = detail?.school
  const globalAudit = !schoolId && !templates && tab === 'audit'
  const categories=!schoolId&&tab==='categories'
  const href = (value: string) => `${root}/${schoolId}/${value}`

  async function read(view: string, signal?: AbortSignal, term = search, targetPage = page) {
    const query = new URLSearchParams({view,search:term,page:String(targetPage)})
    if (schoolId) query.set('schoolId',schoolId)
    const response = await fetch(`${api}?${query}`,{ cache:'no-store',signal })
    const data = await response.json().catch(()=>null)
    if (!response.ok) throw new Error(es ? ({FORBIDDEN:'Sin permiso para esta escuela.',MIGRATION_REQUIRED:'El módulo requiere instalación de la migración.',DISABLED:'Módulo no disponible.'} as Row)[data?.code] ?? 'No se pudieron cargar los registros.' : data?.error ?? 'Não foi possível carregar os registros.')
    return data
  }
  useEffect(()=>{
    const controller = new AbortController()
    const timer = setTimeout(async ()=>{
      setLoading(true); setError('')
      try {
        if (schoolId) {
          const result = await read('detail',controller.signal)
          setDetail(result)
          if (tab === 'links'||tab==='inventory') { setRows([]);setTotal(0);return }
        }
        const result = await read(templates ? 'templates' : schoolId || globalAudit || categories ? tab : 'schools',controller.signal)
        setRows(result.rows); setTotal(result.total)
      } catch (e) { if (!controller.signal.aborted) { setError((e as Error).message);setRows([]) } }
      finally { if (!controller.signal.aborted) setLoading(false) }
    },200)
    return ()=>{clearTimeout(timer);controller.abort()}
    // Request scope changes abort stale responses before switching schools or filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[schoolId,templates,tab,search,page,reload])
  useEffect(()=>{
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault();event.returnValue='' }
    window.addEventListener('beforeunload',handler)
    return ()=>window.removeEventListener('beforeunload',handler)
  },[dirty])

  async function send(command: Row) {
    if (sending.current) return
    sending.current = true;setBusy(true);setError('');setNotice('')
    const body = JSON.stringify(command)
    if (requestKey.current.body !== body) requestKey.current = { body,key:crypto.randomUUID() }
    try {
      const response = await fetch(api,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':requestKey.current.key},body})
      const data = await response.json().catch(()=>null)
      if (!response.ok) throw new Error(es ? ({CONFLICT:'Otro usuario modificó este registro. Actualice la página.',HAS_HISTORY:'La escuela tiene historial. Desactívela para conservarlo.',TEACHER_REQUIRED:'Vincule también al profesor responsable de cada grupo.',DUPLICATE:'Código, patrimonio o vínculo ya registrado.',VALIDATION:'Revise los campos y las cantidades.',INACTIVE:'Reactive la escuela antes de editar su inventario.'} as Row)[data?.code] ?? 'No se pudo guardar. Revise los vínculos y el estado del registro.' : data?.error ?? 'Não foi possível salvar.')
      requestKey.current = {body:'',key:''};setEditor(null);setDirty(false);setReload(v=>v+1)
      setNotice(t('Operação registrada com sucesso.','Operación registrada correctamente.'))
      if (command.action === 'school.delete') window.location.assign(root)
    } catch(e) {setError((e as Error).message)}
    finally { sending.current=false;setBusy(false) }
  }
  async function open(kind: string,row?: Row,decision?: string,asKit=false) {
    setError('');setDirty(false);setOptionSearch('');setOptionsFailed(false);setEditor({kind,row,decision})
    const base = defaults[kind] ?? {}
    const values = Object.fromEntries(Object.keys(base).map(key=>[key,row?.[key] ?? base[key]]))
    if(asKit)Object.assign(values,{unit:'kit',tracking_mode:'individual',quantity:1,components:[{name:'',quantity:1,unit:'un'}]})
    if (kind === 'organize') Object.assign(values,{location:row?.location ?? '',notes:row?.notes ?? ''})
    if (kind === 'links') Object.assign(values,{teacherIds:detail?.teachers.map((v:Row)=>v.id) ?? [],classIds:detail?.classes.map((v:Row)=>v.id) ?? []})
    setForm(values)
    if (['links','apply','item','request','template'].includes(kind)) {
      setOptions({teachers:[],classes:[],templates:[]})
      setOptionsLoading(true)
      try {
        if (kind === 'links') setOptions(await read('options',undefined,'',1))
        else if(kind==='apply') { const all: Row[]=[]; let n=1; let result; do { result=await read('templates',undefined,'',n++);all.push(...result.rows) } while(all.length<result.total);setOptions({templates:all.filter(v=>v.active)}) }
        else {
          const result=await read('catalog',undefined,'',1)
          const choices=[...result.rows]
          if(row?.category_id&&!choices.some(c=>c.id===row.category_id)) choices.push({id:row.category_id,name:row.category||t('Categoria inativa','Categoría inactiva'),active:false})
          setCatalog(choices)
        }
      } catch(e){setOptionsFailed(true);setError((e as Error).message)} finally {setOptionsLoading(false)}
    }
  }
  const change = (key: string,value: any) => {setDirty(true);setForm(old=>({...old,[key]:value}))}
  function save(event: FormEvent) {
    event.preventDefault()
    if (!editor || optionsLoading || optionsFailed) return
    const {kind,row,decision} = editor
    const scope = {schoolId}, record = {id:row?.id,version:row?.version}
    let cmd: Row
    if (kind === 'school') cmd=row ? {action:'school.update',schoolId:row.id,version:row.version,data:form} : {action:'school.create',data:form}
    else if (kind === 'item') cmd=row ? {action:'item.update',...scope,...record,data:form} : {action:'item.create',...scope,data:form}
    else if (kind === 'organize') cmd={action:'item.organize',...scope,...record,data:form}
    else if (kind === 'request') cmd={action:'request.create',...scope,data:form}
    else if (kind === 'review') cmd={action:'request.review',...scope,...record,decision,notes:form.notes}
    else if (kind === 'delete') cmd={action:'item.delete',...scope,...record,reason:form.reason}
    else if (kind === 'links') cmd={action:'links.replace',...scope,version:school.version,...form}
    else if (kind === 'apply') cmd={action:'template.apply',...scope,version:school.version,templateId:form.templateId}
    else if (kind === 'category') cmd=row?{action:'category.update',...record,data:form}:{action:'category.create',data:form}
    else if (kind === 'asset') cmd={action:'asset.update',...scope,...record,data:form}
    else if (kind === 'retire') cmd={action:'asset.retire',...scope,...record,reason:form.reason}
    else if (kind === 'individualize') cmd={action:'item.individualize',...scope,...record,reason:form.reason}
    else if (kind === 'condition') cmd={action:'item.condition',...scope,...record,...form}
    else if (kind === 'adjust') cmd={action:'item.adjust',...scope,...record,...form}
    else cmd=row ? {action:'template.update',...record,data:form} : {action:'template.create',data:form}
    const changedKit=kind==='item'&&!!row&&row.components?.length>0&&JSON.stringify(row.components)!==JSON.stringify(form.components)
    if (changedKit || ['delete','review','links','retire','individualize','condition','adjust'].includes(kind) || (row?.active && form.active === false)) {
      setConfirm({title:t('Confirmar esta alteração? Ela ficará registrada no histórico.','¿Confirmar este cambio? Quedará registrado en el historial.'),run:()=>void send(cmd)})
    } else void send(cmd)
  }
  function icon(action:()=>void,title:string,children:ReactNode,danger=false) {
    return <button type="button" title={title} aria-label={title} onClick={action} disabled={busy} className={`${button} !p-2 ${danger ? '!text-rose-300 hover:!bg-rose-500/15':''}`}>{children}</button>
  }
  function field(key:string,textarea=false) {
    if (key==='active') return <label key={key} className="flex items-center gap-2 text-sm text-slate-200"><input type="checkbox" checked={!!form[key]} onChange={e=>change(key,e.target.checked)} />{label(key)}</label>
    const opts = key==='country' ? ['BR','PY','UY'] : ['condition','from','to'].includes(key) ? ['good','maintenance','damaged','missing'] : key==='kind' ? ['new','existing'] : ['unit','default_unit'].includes(key)?['un','kit','cx','cj']:['tracking_mode','default_tracking'].includes(key)?['bulk','individual']:key==='direction'?(editor?.row?.tracking_mode==='individual'?['entry']:['entry','exit']):null
    const readonly=editor?.kind==='item'&&!!editor.row&&['quantity','tracking_mode','condition'].includes(key)
    const quantityMax=editor?.kind==='condition'?editor.row?.[`${form.from}_quantity`]??0
      :editor?.kind==='adjust'&&form.direction==='exit'?editor.row?.[`${form.condition}_quantity`]??0
      :form.tracking_mode==='individual'||(editor?.kind==='adjust'&&editor.row?.tracking_mode==='individual')?1000:100000
    return <label key={key} className={`block space-y-1 text-xs font-medium text-slate-300 ${textarea?'sm:col-span-2':''}`}>
      <span>{label(key)}</span>
      {key==='category_id'?<select aria-label={label(key)} required className={input} value={form[key]??general} onChange={e=>{
        const category=catalog.find(c=>c.id===e.target.value)
        change(key,e.target.value)
        if(category&&!editor?.row)setForm(old=>({...old,category_id:category.id,tracking_mode:old.unit==='kit'?old.tracking_mode:category.default_tracking,unit:old.unit==='kit'?'kit':category.default_unit}))
      }}>{catalog.map(c=><option key={c.id} value={c.id} disabled={!c.active&&c.id!==form[key]}>{es?c.name_es||c.name:c.name}{!c.active?' · '+t('Inativa','Inactiva'):''}</option>)}</select>
      :opts ? <select aria-label={label(key)} className={input} disabled={readonly} value={form[key] ?? ''} onChange={e=>{
        change(key,e.target.value)
        if(key==='unit'&&e.target.value==='kit'&&!form.components?.length)setForm(old=>({...old,unit:'kit',components:[{name:'',quantity:1,unit:'un'}]}))
      }}>{opts.map(v=><option key={v} value={v} disabled={key==='unit'&&!!form.components?.length&&v!=='kit'}>{label(v)}</option>)}</select>
      : textarea ? <textarea className={`${input} min-h-24 resize-y`} maxLength={['description','description_es'].includes(key)||(key==='reason'&&editor?.kind!=='request')?1000:4000} required={key==='reason'||editor?.kind==='review'} minLength={key==='reason'||editor?.kind==='review'?3:undefined} value={form[key] ?? ''} onChange={e=>change(key,e.target.value)} />
      : <input className={input} readOnly={readonly||(key==='serial_number'&&editor?.kind==='asset'&&!admin)} type={key==='quantity'?'number':'text'} min={['request','adjust','condition'].includes(editor?.kind??'')?1:0} max={quantityMax} step={1} maxLength={['name_es','category'].includes(key)||key==='name'&&editor?.kind==='category'?80:key==='serial_number'?120:key==='address'?500:160} required={['name','unit','quantity'].includes(key)} minLength={key==='name'?2:undefined} value={form[key] ?? ''} onChange={e=>change(key,key==='quantity' ? (e.target.value===''?'':Number(e.target.value)):e.target.value)} />}
    </label>
  }
  const titles: Record<string,string> = {school:t('Cadastro da escola','Datos de escuela'),item:t('Item do inventário','Artículo del inventario'),organize:t('Organizar item','Organizar artículo'),request:t('Adicionar ou solicitar item','Agregar o solicitar artículo'),review:t('Decisão da solicitação','Decisión de solicitud'),delete:t('Remover item do inventário','Retirar artículo del inventario'),links:t('Vincular professores e turmas','Vincular profesores y grupos'),template:t('Modelo de inventário','Plantilla de inventario'),apply:t('Preparar inventário com modelo','Preparar inventario con plantilla'),category:t('Categoria do inventário','Categoría del inventario'),condition:t('Alterar quantidade por condição','Cambiar cantidad por estado'),adjust:t('Entrada ou baixa de estoque','Entrada o baja de existencias'),individualize:t('Identificar unidades físicas','Identificar unidades físicas'),asset:t('Atualizar unidade física','Actualizar unidad física'),retire:t('Dar baixa na unidade','Dar de baja la unidad')}
  const statusBadge = (value:string) => <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${['fulfilled','good'].includes(value)?'bg-emerald-400/10 text-emerald-200':['rejected','damaged','missing'].includes(value)?'bg-rose-400/10 text-rose-200':'bg-amber-400/10 text-amber-200'}`}>{label(value)}</span>

  return <div className="mx-auto max-w-7xl space-y-5 text-white">
    <div className={`${panel} overflow-hidden`}>
      <div className="h-1 bg-gradient-to-r from-cyan-400 via-emerald-400 to-transparent" />
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex min-w-0 items-center gap-3">
          {(schoolId||templates||globalAudit||categories)&&<Link href={root} aria-label={t('Voltar','Volver')} className={button}><ArrowLeft size={17}/></Link>}
          <Building2 className="hidden shrink-0 text-cyan-200 sm:block" size={30}/>
          <div className="min-w-0"><p className="text-[10px] uppercase tracking-[.18em] text-cyan-300">BlueWorld9 · {t('Patrimônio','Patrimonio')}</p>
            <h2 className="break-words text-xl font-semibold text-white">{categories?t('Categorias do inventário','Categorías del inventario'):globalAudit?t('Histórico geral','Historial general'):templates?t('Modelos de inventário','Plantillas de inventario'):schoolId?school?.name ?? t('Escola','Escuela'):t('Escolas e inventário','Escuelas e inventario')}</h2>
            <p className="mt-1 text-xs text-slate-400">{schoolId?`${school?.code ?? ''} · ${school?.country ?? ''} · ${school?.inventory_status==='published'?t('Inventário publicado','Inventario publicado'):t('Inventário em preparação','Inventario en preparación')}`:t('Pessoas, turmas e recursos organizados por escola.','Personas, grupos y recursos organizados por escuela.')}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {admin&&!schoolId&&!templates&&!globalAudit&&!categories&&<><Link href={`${root}/categorias`} className={button}><Boxes size={16}/>{t('Categorias','Categorías')}</Link><Link href={`${root}/historico`} className={button}><History size={16}/>{t('Histórico','Historial')}</Link><Link href={`${root}/modelos`} className={button}><Layers size={16}/>{t('Modelos','Plantillas')}</Link><button className={primary} onClick={()=>void open('school')}><Plus size={16}/>{t('Nova escola','Nueva escuela')}</button></>}
          {admin&&categories&&<button className={primary} onClick={()=>void open('category')}><Plus size={16}/>{t('Nova categoria','Nueva categoría')}</button>}
          {admin&&templates&&<button className={primary} onClick={()=>void open('template')}><Plus size={16}/>{t('Novo modelo','Nueva plantilla')}</button>}
          {admin&&school&&icon(()=>void open('school',school),t('Editar escola','Editar escuela'),<Pencil size={16}/>)}
          {admin&&school&&icon(()=>setConfirm({title:t('Excluir esta escola? Só é possível quando não há vínculos nem histórico de inventário.','¿Eliminar esta escuela? Solo es posible sin vínculos ni historial de inventario.'),run:()=>void send({action:'school.delete',schoolId,version:school.version})}),t('Excluir escola','Eliminar escuela'),<Trash2 size={16}/>,true)}
        </div>
      </div>
      {school&&(school.address||school.notes)&&<div className="space-y-1 border-t border-white/10 px-5 py-3 text-xs text-slate-300">{school.address&&<p>{school.address}</p>}{school.notes&&<p className="whitespace-pre-wrap">{school.notes}</p>}</div>}
      {schoolId&&<nav className="flex flex-wrap gap-1 border-t border-white/10 px-3 py-2" aria-label={t('Seções da escola','Secciones de escuela')}>
        {([{key:'inventory',title:t('Inventário','Inventario'),Icon:Boxes},{key:'requests',title:t('Solicitações','Solicitudes'),Icon:ClipboardList},{key:'links',title:t('Professores e turmas','Profesores y grupos'),Icon:Users},...(admin?[{key:'audit',title:t('Histórico','Historial'),Icon:History}]:[])]).map(({key,title,Icon})=><Link key={key} href={href(key)} aria-current={tab===key?'page':undefined} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${tab===key?'bg-cyan-400/15 text-cyan-200':'text-slate-300 hover:bg-white/5'}`}><Icon size={15}/>{title}</Link>)}
      </nav>}
    </div>
    {notice&&<p role="status" className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
    {error&&!editor&&<div role="alert" className="rounded-xl border border-rose-400/30 bg-slate-950 p-4 text-rose-200">{error}<button className={`${button} ml-3`} onClick={()=>setReload(v=>v+1)}>{t('Tentar novamente','Reintentar')}</button></div>}
    {school&&!school.active&&<p className="rounded-xl bg-amber-400/10 p-3 text-sm text-amber-200">{t('Escola desativada. O histórico está preservado.','Escuela desactivada. Se conserva el historial.')}</p>}
    {schoolId&&tab==='links'?<div className={`${panel} p-4`}>
      <div className="mb-4 flex justify-between gap-2"><h3 className="font-semibold text-white">{t('Equipe e turmas vinculadas','Equipo y grupos vinculados')}</h3>{admin&&<button className={primary} disabled={busy||loading} onClick={()=>void open('links')}><Pencil size={15}/>{t('Organizar vínculos','Organizar vínculos')}</button>}</div>
      <div className="grid gap-5 lg:grid-cols-2"><div><h4 className="mb-2 text-sm text-cyan-200">{t('Professores','Profesores')}</h4>{detail?.teachers.map((v:Row)=><div key={v.id} className="border-b border-white/5 py-3 text-sm">{v.name}</div>)}{!detail?.teachers.length&&<p className="text-sm text-slate-400">{t('Nenhum professor vinculado.','Ningún profesor vinculado.')}</p>}</div>
        <div><h4 className="mb-2 text-sm text-cyan-200">{t('Turmas','Grupos')}</h4>{detail?.classes.map((v:Row)=><div key={v.id} className="border-b border-white/5 py-3 text-sm"><p>{v.name} · {v.school_year}</p><p className="text-xs text-slate-400">{v.teacher_name} · ID {v.id.slice(0,8)}</p></div>)}{!detail?.classes.length&&<p className="text-sm text-slate-400">{t('Nenhuma turma vinculada.','Ningún grupo vinculado.')}</p>}</div></div>
    </div>:<div className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4">
        {schoolId&&tab==='inventory'?<div><h3 className="text-sm font-semibold text-white">{t('Controle do inventário','Control del inventario')}</h3><p className="text-xs text-slate-400">{t('Cadastros, unidades e movimentações separados.','Registros, unidades y movimientos separados.')}</p></div>:<label className="relative min-w-0 flex-1 sm:max-w-sm"><Search size={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${input} !pl-9`} aria-label={t('Pesquisar','Buscar')} placeholder={t('Pesquisar por nome…','Buscar por nombre…')} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}} disabled={globalAudit||(schoolId!==undefined&&['requests','audit'].includes(tab))}/></label>}
        <div className="flex flex-wrap gap-2">
          {school?.active&&tab==='inventory'&&<>
            {admin&&school.inventory_status==='draft'&&<><button className={button} disabled={busy} onClick={()=>void open('apply')}><Layers size={15}/>{t('Usar modelo','Usar plantilla')}</button><button className={button} disabled={busy} onClick={()=>setConfirm({title:t('Publicar o inventário conferido para os professores vinculados?','¿Publicar el inventario revisado para los profesores vinculados?'),run:()=>void send({action:'inventory.publish',schoolId,version:school.version})})}><Send size={15}/>{t('Publicar inventário','Publicar inventario')}</button></>}
            <button className={primary} disabled={busy} onClick={()=>void open(admin?'item':'request')}><Plus size={15}/>{admin?t('Adicionar item','Agregar artículo'):t('Adicionar / solicitar','Agregar / solicitar')}</button>
            {admin&&<button className={button} disabled={busy} onClick={()=>void open('item',undefined,undefined,true)}><Boxes size={15}/>{t('Criar kit','Crear kit')}</button>}
          </>}
          {school?.active&&tab==='requests'&&<button className={primary} disabled={busy} onClick={()=>void open('request')}><Plus size={15}/>{t('Nova solicitação','Nueva solicitud')}</button>}
        </div>
      </div>
      {schoolId&&tab==='inventory'?school&&<InventoryWorkspace schoolId={schoolId} admin={admin} active={school.active} published={school.inventory_status==='published'} locale={locale} reload={reload} busy={busy} onOpen={(kind,row)=>void open(kind,row)}/>:loading?<div className="flex items-center justify-center gap-2 p-12 text-slate-400"><Loader2 className="animate-spin" size={18}/>{t('Carregando…','Cargando…')}</div>:<>
        {!rows.length&&<div className="space-y-2 p-10 text-center"><Boxes size={28} className="mx-auto text-cyan-300/60"/><p className="text-slate-300">{schoolId&&tab==='inventory'&&school?.inventory_status==='draft'&&!admin?t('O admin está preparando o inventário desta escola.','El administrador está preparando el inventario.'):t('Nenhum registro encontrado.','No se encontraron registros.')}</p><p className="text-xs text-slate-500">{t('Use as opções acima para começar ou ajuste sua pesquisa.','Utilice las opciones de arriba o ajuste su búsqueda.')}</p></div>}
        <div className="divide-y divide-white/5">
          {rows.map(row=><div key={row.id} className="px-4 py-3 transition hover:bg-white/[0.025]">
            {categories?<div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-medium text-white">{es?row.name_es||row.name:row.name}{!row.active&&' · '+t('Inativa','Inactiva')}</p><p className="text-xs text-cyan-200">{label(row.default_tracking)} · {label(row.default_unit)}</p><p className="break-words text-xs text-slate-400">{es?row.description_es||row.description:row.description}</p></div>{row.system?<span className="text-xs text-slate-400">{t('Padrão do sistema','Predeterminada del sistema')}</span>:<div className="flex gap-2">{icon(()=>void open('category',row),t('Editar categoria','Editar categoría'),<Pencil size={15}/>)}{icon(()=>setConfirm({title:t('Excluir categoria? Categorias em uso devem ser desativadas.','¿Eliminar categoría? Las categorías en uso deben desactivarse.'),run:()=>void send({action:'category.delete',id:row.id,version:row.version})}),t('Excluir categoria','Eliminar categoría'),<Trash2 size={15}/>,true)}</div>}</div>
            :!schoolId&&!templates&&!globalAudit?<div className="flex items-center justify-between gap-3"><Link href={`${root}/${row.id}`} className="min-w-0 flex-1"><p className="font-medium text-white">{row.name} {!row.active&&<span className="text-xs text-amber-300">· {t('Desativada','Desactivada')}</span>}</p><p className="mt-1 text-xs text-slate-400">{row.code} · {row.country} · {row.teacher_count} {t('professores','profesores')} · {row.class_count} {t('turmas','grupos')} · {row.item_count} {t('itens','artículos')}</p></Link><Link className={button} href={`${root}/${row.id}`} aria-label={`${t('Abrir','Abrir')} ${row.name}`}><ArrowRight size={16}/></Link></div>
            :templates?<div className="flex items-center justify-between gap-3"><div><p className="font-medium">{row.name}{!row.active&&' · '+t('Inativo','Inactivo')}</p><p className="text-xs text-slate-400">{row.items.length} {t('itens','artículos')} · {row.description}</p></div><div className="flex gap-2">{icon(()=>void open('template',row),t('Editar','Editar'),<Pencil size={15}/>)}{icon(()=>setConfirm({title:t('Excluir este modelo? Os inventários já criados serão preservados.','¿Eliminar esta plantilla? Se conservarán los inventarios existentes.'),run:()=>void send({action:'template.delete',id:row.id,version:row.version})}),t('Excluir','Eliminar'),<Trash2 size={15}/>,true)}</div></div>
            :tab==='requests'?<div className="space-y-2"><div className="flex flex-wrap justify-between gap-2"><p className="font-medium">{row.name} · {row.quantity} {row.unit}</p>{statusBadge(row.status)}</div><p className="text-xs text-cyan-200">{label(row.kind)} · {row.requester_name} · {new Date(row.created_at).toLocaleDateString(es?'es':'pt-BR')}</p><p className="whitespace-pre-wrap text-sm text-slate-300">{row.reason}</p>{row.decision_notes&&<p className="whitespace-pre-wrap text-sm text-slate-400">{t('Decisão','Decisión')}: {row.decision_notes}</p>}{admin&&school?.active&&<div className="flex gap-2">{row.status==='pending'&&<><button className={primary} onClick={()=>void open('review',row,'approve')}>{t('Aprovar','Aprobar')}</button><button className={button} onClick={()=>void open('review',row,'reject')}>{t('Recusar','Rechazar')}</button></>}{row.status==='approved'&&<button className={primary} onClick={()=>void open('review',row,'fulfill')}>{t('Confirmar recebimento','Confirmar recepción')}</button>}</div>}</div>
            :<details><summary className="cursor-pointer text-sm"><span className="font-medium text-cyan-200">{row.action}</span> · {row.actor_name} · {new Date(row.created_at).toLocaleString(es?'es':'pt-BR')}</summary><div className="mt-3 grid gap-3 md:grid-cols-2"><div><p className="text-xs text-slate-400">{t('Antes','Antes')}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 text-xs">{JSON.stringify(row.before_data,null,2)}</pre></div><div><p className="text-xs text-slate-400">{t('Depois','Después')}</p><pre className="max-h-80 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 text-xs">{JSON.stringify(row.after_data,null,2)}</pre></div></div></details>}
          </div>)}
        </div>
        <div className="flex items-center justify-between border-t border-white/10 p-3 text-xs text-slate-400"><span>{total} {t('registros','registros')} · {t('Página','Página')} {page}</span><div className="flex gap-2"><button className={button} disabled={page===1} onClick={()=>setPage(v=>v-1)} aria-label={t('Anterior','Anterior')}><ArrowLeft size={14}/></button><button className={button} disabled={page*50>=total} onClick={()=>setPage(v=>v+1)} aria-label={t('Próxima','Siguiente')}><ArrowRight size={14}/></button></div></div>
      </>}
    </div>}

    <Dialog.Root open={!!editor} onOpenChange={value=>{if(!value&&!busy){if(dirty)setDiscard(true);else setEditor(null)}}}>
      <Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-[70] bg-slate-950/80 backdrop-blur-sm"/><Dialog.Content onPointerDownOutside={e=>e.preventDefault()} className="fixed left-1/2 top-1/2 z-[71] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-cyan-300/20 bg-slate-900 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between"><Dialog.Title className="text-lg font-semibold text-white">{titles[editor?.kind??'']}</Dialog.Title><Dialog.Close disabled={busy} className={button} aria-label={t('Fechar','Cerrar')}><X size={16}/></Dialog.Close></div>
        <Dialog.Description className="mt-1 text-xs text-slate-400">{t('Confira os dados antes de salvar. Todas as alterações ficam registradas.','Revise los datos antes de guardar. Todos los cambios quedan registrados.')}</Dialog.Description>
        {error&&<p role="alert" className="my-3 rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        <form onSubmit={save} className="mt-5 space-y-4"><fieldset disabled={busy||optionsLoading||optionsFailed} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {editor?.kind==='school'&&<><p className="rounded-lg bg-cyan-400/10 p-3 text-xs text-cyan-200 sm:col-span-2">{editor.row?.code??t('O código da escola será gerado automaticamente.','El código de la escuela se generará automáticamente.')}</p>{field('name')}{field('country')}{field('address')}{field('notes',true)}{field('active')}</>}
            {editor?.kind==='item'&&<><p className="rounded-lg bg-cyan-400/10 p-3 text-xs text-cyan-200 sm:col-span-2">{editor.row?.code??t('Identificação automática. No controle individual, cada unidade recebe seu próprio código.','Identificación automática. En el control individual, cada unidad recibe su propio código.')}</p>{['name','category_id','tracking_mode','quantity','unit','location'].map(v=>field(v))}{!editor.row&&field('condition')}{form.quantity===1&&!editor.row&&field('serial_number')}{field('notes',true)}<p className="text-xs text-slate-400 sm:col-span-2">{editor.row?t('Para alterar o estoque ou o estado dos equipamentos, use os botões de movimentação ou unidades.','Para cambiar existencias o el estado de los equipos, utilice los botones de movimientos o unidades.'):form.tracking_mode==='individual'?t(`${form.quantity||0} identificadores serão gerados ao salvar. Série e estado podem ser ajustados em Ver unidades.`,`${form.quantity||0} identificadores se generarán al guardar. La serie y el estado se pueden ajustar en Ver unidades.`):t('Controle por quantidade: altere apenas o número de unidades afetadas em cada condição.','Control por cantidad: cambie solo el número de unidades afectadas en cada estado.')}</p></>}
            {editor?.kind==='organize'&&<>{field('location')}{field('notes',true)}<p className="text-xs text-slate-400 sm:col-span-2">{t('Condições são alteradas separadamente, por quantidade ou unidade física.','Los estados se cambian por separado, por cantidad o unidad física.')}</p></>}
            {editor?.kind==='category'&&<>{['name','name_es','default_tracking','default_unit'].map(v=>field(v))}{field('description',true)}{field('description_es',true)}{field('active')}</>}
            {editor?.kind==='asset'&&<><p className="font-mono text-sm text-cyan-200 sm:col-span-2">{editor.row?.code}</p>{['condition','serial_number','location'].map(v=>field(v))}{field('notes',true)}{field('reason',true)}</>}
            {editor?.kind==='condition'&&<><p className="text-xs text-slate-300 sm:col-span-2">{editor.row?.name} · {t('A alteração mantém o total e afeta somente a quantidade informada.','El cambio mantiene el total y afecta solo la cantidad indicada.')}</p>{field('from')}{field('to')}{field('quantity')}<p className="self-end pb-2 text-xs text-cyan-200">{t('Saldo disponível nesta condição','Saldo disponible en este estado')}: {editor.row?.[`${form.from}_quantity`]??0}</p>{field('reason',true)}</>}
            {editor?.kind==='adjust'&&<><p className="text-xs text-slate-300 sm:col-span-2">{editor.row?.name} · {t('Total atual','Total actual')}: {editor.row?.quantity}</p>{field('direction')}{field('condition')}{field('quantity')}{field('reason',true)}</>}
            {['individualize','retire'].includes(editor?.kind??'')&&<><p className="text-xs text-slate-300 sm:col-span-2">{editor?.row?.code} · {editor?.kind==='retire'?t('Somente esta unidade será retirada. O histórico é preservado.','Solo se retirará esta unidad. Se conserva el historial.'):t('Gera um código para cada unidade, preservando os saldos por condição. Esta conversão não pode ser desfeita pela interface.','Genera un código para cada unidad, conservando los saldos por estado. Esta conversión no se puede deshacer desde la interfaz.')}</p>{field('reason',true)}</>}
            {editor?.kind==='request'&&<>{['kind','name','category_id','tracking_mode','quantity','unit'].map(v=>field(v))}{field('reason',true)}<p className="text-xs text-slate-400 sm:col-span-2">{t('Item existente: requer conferência do admin. Novo item: após aprovação, entra no inventário apenas quando recebido.','Artículo existente: requiere revisión del administrador. Artículo nuevo: ingresa al inventario después de su recepción.')}</p></>}
            {editor?.kind==='review'&&<><p className="text-sm text-cyan-200 sm:col-span-2">{editor.row?.name} · {editor.row?.quantity} {editor.row?.unit} · {editor.decision==='approve'?t('Aprovar','Aprobar'):editor.decision==='reject'?t('Recusar','Rechazar'):t('Confirmar recebimento','Confirmar recepción')}</p>{field('notes',true)}</>}
            {editor?.kind==='delete'&&<><p className="text-sm text-slate-300 sm:col-span-2">{editor.row?.name} · {t('A remoção preserva o histórico do item.','La eliminación conserva el historial del artículo.')}</p>{field('reason',true)}</>}
            {editor?.kind==='template'&&<>{field('name')}{field('active')}{field('description',true)}</>}
          </div>
          {['item','request'].includes(editor?.kind??'')&&form.unit==='kit'&&<KitComponentsEditor locale={locale} value={form.components??[]} onChange={value=>change('components',value)}/>}
          {editor?.kind==='template'&&<div className="space-y-3">{form.items?.map((item:Row,index:number)=><div key={index} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold text-cyan-200">{t('Item','Artículo')} {index+1}</span><button type="button" className={`${button} !p-2`} disabled={form.items.length===1} aria-label={t('Remover linha','Eliminar fila')} onClick={()=>change('items',form.items.filter((_:Row,i:number)=>i!==index))}><Trash2 size={14}/></button></div>
            <div className="grid gap-2 sm:grid-cols-2">{['name','category_id','tracking_mode','quantity','unit'].map(key=>{
              const update=(value:any)=>change('items',form.items.map((v:Row,i:number)=>i===index?{...v,[key]:value,...(key==='category_id'?(()=>{const c=catalog.find(c=>c.id===value);return {tracking_mode:v.unit==='kit'?v.tracking_mode:c?.default_tracking??'bulk',unit:v.unit==='kit'?'kit':c?.default_unit??'un'}})():{}),...(key==='unit'&&value==='kit'&&!v.components?.length?{components:[{name:'',quantity:1,unit:'un'}]}:{})}:v))
              const choices=key==='category_id'?catalog.map(c=>({value:c.id,title:es?c.name_es||c.name:c.name})):key==='tracking_mode'?['bulk','individual'].map(value=>({value,title:label(value)})):key==='unit'?['un','kit','cx','cj'].map(value=>({value,title:label(value)})):null
              return <label key={key} className="min-w-0 text-xs text-slate-300"><span className="mb-1 block">{label(key)}</span>{choices?<select className={input} value={item[key]??(key==='category_id'?general:'bulk')} onChange={e=>update(e.target.value)}>{choices.map(v=><option key={v.value} value={v.value} disabled={key==='category_id'&&!catalog.find(c=>c.id===v.value)?.active&&v.value!==item.category_id||key==='unit'&&!!item.components?.length&&v.value!=='kit'}>{v.title}</option>)}</select>:<input className={input} value={item[key]} required maxLength={160} type={key==='quantity'?'number':'text'} min={0} max={item.tracking_mode==='individual'?1000:100000} step={1} onChange={e=>update(key==='quantity'?(e.target.value===''?'':Number(e.target.value)):e.target.value)}/>}</label>
            })}</div>{item.unit==='kit'&&<div className="mt-3"><KitComponentsEditor locale={locale} labelPrefix={` · ${index+1}`} value={item.components??[]} onChange={value=>change('items',form.items.map((v:Row,i:number)=>i===index?{...v,components:value}:v))}/></div>}
          </div>)}<button type="button" className={button} disabled={form.items?.length>=200} onClick={()=>change('items',[...form.items,{...defaultLine}])}><Plus size={15}/>{t('Adicionar linha','Agregar fila')}</button></div>}
          {optionsLoading&&<p className="text-sm text-slate-400">{t('Carregando opções…','Cargando opciones…')}</p>}
          {editor?.kind==='apply'&&<label className="block space-y-2 text-sm"><span>{t('Escolha um modelo. Os itens serão copiados para conferência antes de publicar.','Elija una plantilla. Se copiarán los artículos para revisar antes de publicar.')}</span><select required className={input} value={form.templateId??''} onChange={e=>change('templateId',e.target.value)}><option value="">{t('Selecione','Seleccione')}</option>{options.templates?.map((v:Row)=><option key={v.id} value={v.id}>{v.name} · {v.items.length} {t('itens','artículos')}</option>)}</select>{!options.templates?.length&&!optionsLoading&&<Link href={`${root}/modelos`} className="text-cyan-200 underline">{t('Cadastre um modelo primeiro','Cree primero una plantilla')}</Link>}</label>}
          {editor?.kind==='links'&&<><input className={input} aria-label={t('Filtrar opções','Filtrar opciones')} placeholder={t('Pesquisar professor ou turma…','Buscar profesor o grupo…')} value={optionSearch} onChange={e=>setOptionSearch(e.target.value)}/><div className="grid gap-4 md:grid-cols-2">{['teachers','classes'].map(kind=><div key={kind}><h4 className="mb-2 text-sm font-semibold text-cyan-200">{kind==='teachers'?t('Professores','Profesores'):t('Turmas','Grupos')}</h4><div className="max-h-72 space-y-1 overflow-auto rounded-xl border border-white/10 p-2">{options[kind]?.filter((v:Row)=>`${v.name} ${v.teacher_name??''} ${v.id}`.toLocaleLowerCase().includes(optionSearch.toLocaleLowerCase())).map((v:Row)=>{
            const key = kind==='teachers'?'teacherIds':'classIds'
            const checked = form[key]?.includes(v.id)
            return <label key={v.id} className="flex cursor-pointer items-start gap-2 rounded-lg p-2 hover:bg-white/5"><input className="mt-1 accent-cyan-400" type="checkbox" checked={!!checked} disabled={kind==='teachers'&&(!v.active||!v.approved)&&!checked} onChange={e=>{
              const values=e.target.checked?[...form[key],v.id]:form[key].filter((id:string)=>id!==v.id)
              setDirty(true);setForm(old=>({...old,[key]:values,...(kind==='classes'&&e.target.checked?{teacherIds:Array.from(new Set([...old.teacherIds,v.teacher_id]))}:{})}))
            }}/><span className="text-sm">{v.name}<span className="block text-[11px] text-slate-400">{kind==='classes'?`${v.teacher_name} · ${v.school_year} · ID ${v.id.slice(0,8)} · ${v.schedules}`:v.email}</span></span></label>
          })}</div></div>)}</div><p className="text-xs text-slate-400">{t('Cada turma pertence a uma escola. Ao selecionar uma turma, seu professor também é selecionado. IDs e horários diferenciam turmas com nomes iguais.','Cada grupo pertenece a una escuela. Al seleccionar un grupo se selecciona su profesor. Los identificadores y horarios distinguen grupos con nombres iguales.')}</p></>}
          <div className="flex justify-end border-t border-white/10 pt-4"><button className={primary} type="submit" disabled={busy||optionsLoading}>{busy?<Loader2 size={16} className="animate-spin"/>:<Send size={16}/>} {t('Salvar','Guardar')}</button></div>
        </fieldset></form>
      </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
    <AlertDialog.Root open={!!confirm||discard} onOpenChange={value=>{if(!value){setConfirm(null);setDiscard(false)}}}>
      <AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-[80] bg-black/70"/><AlertDialog.Content className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/20 bg-slate-950 p-5 text-white">
        <AlertDialog.Title className="font-semibold text-white">{t('Confirmar ação','Confirmar acción')}</AlertDialog.Title><AlertDialog.Description className="my-4 text-sm text-slate-300">{discard?t('Descartar as alterações ainda não salvas?','¿Descartar los cambios sin guardar?'):confirm?.title}</AlertDialog.Description>
        <div className="flex justify-end gap-2"><AlertDialog.Cancel className={button}>{t('Cancelar','Cancelar')}</AlertDialog.Cancel><AlertDialog.Action className={primary} onClick={()=>{if(discard){setEditor(null);setDirty(false)}else confirm?.run();setConfirm(null);setDiscard(false)}}>{t('Confirmar','Confirmar')}</AlertDialog.Action></div>
      </AlertDialog.Content></AlertDialog.Portal>
    </AlertDialog.Root>
  </div>
}
