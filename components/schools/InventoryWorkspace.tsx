"use client"

import { useEffect, useState } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ArrowLeft, ArrowLeftRight, ArrowRight, Boxes, ChevronDown, History, Loader2, MapPin, MoreHorizontal, Package, PackageOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react'

type Row=Record<string,any>
type Props={schoolId:string;admin:boolean;active:boolean;published:boolean;locale:string;reload:number;busy:boolean;onOpen:(kind:string,row:Row)=>void}
const states=['good','maintenance','damaged','missing']
const colors:Record<string,string>={good:'text-emerald-200 bg-emerald-400/10',maintenance:'text-amber-200 bg-amber-400/10',damaged:'text-rose-200 bg-rose-400/10',missing:'text-slate-300 bg-slate-400/10'}
const button='inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 px-2.5 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-40'
const input='min-w-0 rounded-lg border border-white/15 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-cyan-300'

export default function InventoryWorkspace(props:Props) {
  const {schoolId,admin,active,published,locale,reload,busy,onOpen}=props
  const es=locale==='es',t=(pt:string,spanish:string)=>es?spanish:pt
  const names:Record<string,string>={good:t('Disponíveis','Disponibles'),maintenance:t('Manutenção','Mantenimiento'),damaged:t('Danificados','Dañados'),missing:t('Não localizados','No localizados')}
  const [rows,setRows]=useState<Row[]>([]),[summary,setSummary]=useState<Row>({}),[categories,setCategories]=useState<Row[]>([])
  const [search,setSearch]=useState(''),[category,setCategory]=useState(''),[condition,setCondition]=useState(''),[page,setPage]=useState(1)
  const [total,setTotal]=useState(0),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const [selection,setSelection]=useState<Row|null>(null),[view,setView]=useState('assets')
  const [expanded,setExpanded]=useState<Set<string>>(()=>new Set())
  useEffect(()=>{
    const controller=new AbortController()
    fetch('/api/portal/schools?view=catalog',{cache:'no-store',signal:controller.signal})
      .then(async response=>{if(!response.ok)return;const data=await response.json();setCategories(data.rows)})
      .catch(()=>{})
    return ()=>controller.abort()
  },[reload])
  useEffect(()=>{
    const controller=new AbortController()
    const timer=setTimeout(async()=>{
      setLoading(true);setError('')
      const query=new URLSearchParams({schoolId,view:selection?view:'inventory',search,page:String(page)})
      if(selection)query.set('itemId',selection.id)
      if(category&&!selection)query.set('categoryId',category)
      if(condition&&(!selection||view!=='movements'))query.set('condition',condition)
      try {
        const response=await fetch(`/api/portal/schools?${query}`,{cache:'no-store',signal:controller.signal})
        const data=await response.json()
        if(!response.ok)throw new Error(es?'No se pudo cargar el inventario. Revise la instalación o sus permisos.':data.error)
        setRows(data.rows);setTotal(data.total);setSummary(data.summary??{})
        if(data.item)setSelection(old=>old?data.item:null)
      }catch(e){if(!controller.signal.aborted){setError((e as Error).message);setRows([])}}
      finally{if(!controller.signal.aborted)setLoading(false)}
    },200)
    return ()=>{clearTimeout(timer);controller.abort()}
    // Item metadata refresh must not start another request; its identity controls the scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[schoolId,selection?.id,view,search,category,condition,page,reload,es])
  function inspect(row:Row|null,target:string) {
    // Never render audit records as inventory rows (or inventory rows as assets) while switching views.
    setRows([]);setSummary({});setTotal(0);setLoading(true);setError('')
    setSelection(row);setView(target);setSearch('');setCondition('');setPage(1)
  }
  function action(kind:string,row:Row,title:string,Icon= Pencil,danger=false,compact=false) {
    return <button type="button" disabled={busy||!active} className={`${button} ${compact?'!p-2':''} ${danger?'!text-rose-200':''}`} aria-label={`${title} ${row.code??row.name}`} title={title} onClick={()=>onOpen(kind,row)}><Icon size={14}/>{!compact&&<span>{title}</span>}</button>
  }
  function balances(row:Row,compact=false) {
    return <div className="flex flex-wrap gap-1">{states.filter(state=>!compact||state==='good'||row[`${state}_quantity`]>0).map(state=><span key={state} className={`rounded-md px-2 py-1 text-[11px] tabular-nums ${colors[state]}`}><strong>{row[`${state}_quantity`]??0}</strong> {names[state]}</span>)}</div>
  }
  function kitComposition(row:Row) {
    const components:Array<{name:string;quantity:number;unit:string}>=row.components??[]
    return <div id={`kit-${row.id}`} className="mt-2 rounded-lg border border-cyan-300/15 bg-slate-950/50 px-3 py-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><p className="flex items-center gap-2 text-xs font-semibold text-cyan-200"><PackageOpen size={14}/>{t('Composição por kit','Composición por kit')}</p><span className="text-[10px] text-slate-400">{t('Não soma ao estoque de itens avulsos','No se suma a las existencias de artículos individuales')}</span></div>
      {components.length?<ul className="divide-y divide-white/5">{components.map((component,index)=><li key={index} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="min-w-0 break-words text-slate-200">{component.name}</span><span className="shrink-0 tabular-nums text-cyan-100"><strong>{component.quantity}</strong> <span className="text-slate-400">{component.unit}</span></span></li>)}</ul>:<p className="py-2 text-xs text-slate-400">{t('Composição não informada. O admin pode cadastrá-la na edição do kit.','Composición no informada. El administrador puede registrarla al editar el kit.')}</p>}
      {row.notes&&<p className="mt-2 whitespace-pre-wrap break-words border-t border-white/5 pt-2 text-xs text-slate-400">{row.notes}</p>}
    </div>
  }
  function moreActions(row:Row) {
    const menuItem='flex cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-xs text-slate-200 outline-none data-[highlighted]:bg-white/10 data-[disabled]:opacity-40'
    return <DropdownMenu.Root modal={false}><DropdownMenu.Trigger className={`${button} !p-2`} disabled={busy||!active} title={t('Mais ações','Más acciones')} aria-label={`${t('Mais ações','Más acciones')} ${row.code}`}><MoreHorizontal size={16}/></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content align="end" sideOffset={6} className="z-[65] min-w-48 rounded-xl border border-white/15 bg-slate-950 p-1.5 shadow-2xl">
      <DropdownMenu.Label className="px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-500">{row.code}</DropdownMenu.Label>
      {admin&&<><DropdownMenu.Item className={menuItem} onSelect={()=>onOpen('adjust',row)}><Plus size={15}/>{t('Entrada / baixa','Entrada / baja')}</DropdownMenu.Item>{row.tracking_mode==='bulk'&&<DropdownMenu.Item className={menuItem} onSelect={()=>onOpen('individualize',row)}><Boxes size={15}/>{t('Identificar unidades','Identificar unidades')}</DropdownMenu.Item>}<DropdownMenu.Separator className="my-1 h-px bg-white/10"/><DropdownMenu.Item className={`${menuItem} !text-rose-200`} onSelect={()=>onOpen('delete',row)}><Trash2 size={15}/>{t('Remover item','Retirar artículo')}</DropdownMenu.Item></>}
    </DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root>
  }
  const operations:Record<string,string>={
    'item.create':t('Cadastro inicial','Registro inicial'),'item.from_template':t('Aplicação de modelo','Aplicación de plantilla'),
    'item.received':t('Recebimento','Recepción'),'item.update':t('Dados do item','Datos del artículo'),
    'item.organize':t('Organização','Organización'),'item.condition':t('Mudança de condição','Cambio de estado'),
    'item.adjust':t('Entrada / baixa','Entrada / baja'),'item.individualize':t('Identificação das unidades','Identificación de unidades'),
    'item.delete':t('Retirada do item','Retirada del artículo'),'asset.update':t('Atualização de unidade','Actualización de unidad'),
    'asset.retire':t('Baixa de unidade','Baja de unidad'),
  }
  return <section className="@container space-y-3 p-3 sm:p-4" aria-label={t('Gestão de estoque','Gestión de existencias')}>
    {selection?<div className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3">
      <div className="flex flex-wrap items-center gap-2"><button className={button} onClick={()=>inspect(null,'assets')}><ArrowLeft size={14}/>{t('Inventário','Inventario')}</button><h3 className="min-w-0 break-words font-semibold text-white">{selection.name}</h3><span className="font-mono text-xs text-cyan-200">{selection.code}</span></div>
      {balances(selection)}
      <div className="flex flex-wrap gap-2">{selection.tracking_mode==='individual'&&<button disabled={view==='assets'} className={`${button} ${view==='assets'?'bg-cyan-400/15':''}`} onClick={()=>inspect(selection,'assets')}><Boxes size={14}/>{t('Unidades físicas','Unidades físicas')}</button>}
        <button disabled={view==='movements'} className={`${button} ${view==='movements'?'bg-cyan-400/15':''}`} onClick={()=>inspect(selection,'movements')}><History size={14}/>{t('Histórico do item','Historial del artículo')}</button>
        {admin&&active&&action('adjust',selection,t('Entrada / baixa','Entrada / baja'),Plus)}
      </div>
    </div>:<>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {['quantity',...states].map(state=><button type="button" key={state} aria-pressed={condition===(state==='quantity'?'':state)} onClick={()=>{setCondition(state==='quantity'?'':state);setPage(1)}} className={`rounded-xl border p-3 text-left ${condition===(state==='quantity'?'':state)?'border-cyan-300':'border-white/10'} ${colors[state]??'bg-cyan-400/10 text-cyan-100'}`}>
          <span className="block text-[11px]">{names[state]??t('Total de unidades','Total de unidades')}</span><strong className="mt-1 block text-xl tabular-nums">{summary[state]??(loading?'…':0)}</strong>
        </button>)}
      </div>
      <p className="text-[11px] text-slate-400">{t('Totais gerais da escola. Os filtros alteram apenas a lista abaixo. Kits contam como kits, não como a soma dos seus componentes.','Totales generales de la escuela. Los filtros modifican solo la lista de abajo. Los kits cuentan como kits, no como la suma de sus componentes.')}</p>
    </>}
    {view!=='movements'||!selection?<div className="flex flex-wrap gap-2">
      <label className="relative min-w-0 flex-1 basis-48"><Search size={15} className="absolute left-3 top-3 text-slate-400"/><input className={`${input} w-full !pl-9`} aria-label={t('Pesquisar inventário','Buscar inventario')} placeholder={t('Nome, identificação, série ou local…','Nombre, identificación, serie o ubicación…')} value={search} onChange={e=>{setSearch(e.target.value);setPage(1)}}/></label>
      {!selection&&<select className={`${input} max-w-full`} aria-label={t('Filtrar categoria','Filtrar categoría')} value={category} onChange={e=>{setCategory(e.target.value);setPage(1)}}><option value="">{t('Todas as categorias','Todas las categorías')}</option>{categories.map(c=><option value={c.id} key={c.id}>{es?c.name_es||c.name:c.name}</option>)}</select>}
      <select className={`${input} max-w-full`} aria-label={t('Filtrar condição','Filtrar estado')} value={condition} onChange={e=>{setCondition(e.target.value);setPage(1)}}><option value="">{t('Todas as condições','Todos los estados')}</option>{states.map(state=><option key={state} value={state}>{names[state]}</option>)}</select>
    </div>:null}
    {error&&<p role="alert" className="rounded-lg bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
    {!selection&&<div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_70px_136px] gap-3 rounded-lg bg-white/5 px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-slate-400 @3xl:grid"><span>{t('Item / kit','Artículo / kit')}</span><span>{t('Condição','Estado')}</span><span className="text-right">{t('Quantidade','Cantidad')}</span><span className="text-right">{t('Ações','Acciones')}</span></div>}
    {loading?<div className="flex justify-center gap-2 py-8 text-slate-400"><Loader2 size={18} className="animate-spin"/>{t('Carregando…','Cargando…')}</div>:<div className="divide-y divide-white/10">
      {!rows.length&&<p className="py-8 text-center text-sm text-slate-400">{!published&&!admin?t('Inventário em preparação pelo admin.','Inventario en preparación por el administrador.'):t('Nenhum registro encontrado.','No se encontraron registros.')}</p>}
      {rows.map(row=>!selection?<article key={row.id} className="px-1 py-3 transition-colors hover:bg-white/[0.025] sm:px-3">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @3xl:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_70px_136px] @3xl:gap-3">
          <div className="min-w-0"><div className="flex items-center gap-2">{row.unit==='kit'&&<Package size={16} className="shrink-0 text-cyan-200"/>}<h4 className="break-words text-sm font-semibold text-white">{row.name}</h4></div><p className="mt-1 break-words text-[11px] text-slate-400"><span className="font-mono text-slate-500">{row.code}</span> · {es?row.category_es||row.category:row.category}</p>{row.location&&<p className="mt-0.5 flex min-w-0 items-center gap-1 text-[10px] text-slate-500"><MapPin size={11} className="shrink-0"/><span className="truncate" title={row.location}>{row.location}</span></p>}
            {row.unit==='kit'&&<button type="button" aria-expanded={expanded.has(row.id)} aria-controls={`kit-${row.id}`} aria-label={`${t('Composição do kit','Composición del kit')} ${row.name}`} className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-cyan-400/10 px-2 py-1 text-[10px] font-medium text-cyan-200 hover:bg-cyan-400/20" onClick={()=>setExpanded(old=>{const next=new Set(old);if(next.has(row.id))next.delete(row.id);else next.add(row.id);return next})}><ChevronDown size={12} className={expanded.has(row.id)?'rotate-180':''}/>{t('Composição','Composición')} · {row.components?.length??0} {t('tipos','tipos')}</button>}
          </div>
          <div className="col-start-1 row-start-2 @3xl:col-start-2 @3xl:row-start-1">{balances(row,true)}</div>
          <p className="col-start-2 row-start-1 text-right text-lg font-semibold tabular-nums text-white @3xl:col-start-3">{row.quantity}{' '}<span className="text-[10px] font-normal text-slate-400">{row.unit==='kit'?(row.quantity===1?'kit':'kits'):row.unit}</span></p>
          <div className="col-start-2 row-start-2 flex justify-end gap-1 @3xl:col-start-4 @3xl:row-start-1">
            {row.tracking_mode==='individual'?<button className={`${button} !p-2`} title={t('Ver unidades','Ver unidades')} aria-label={t('Ver unidades','Ver unidades')} onClick={()=>inspect(row,'assets')}><Boxes size={14}/></button>:active&&action('condition',row,t('Alterar condição','Cambiar estado'),ArrowLeftRight,false,true)}
            <button className={`${button} !p-2`} title={t('Histórico','Historial')} aria-label={t('Histórico','Historial')} onClick={()=>inspect(row,'movements')}><History size={14}/></button>
            {active&&<>{action(admin?'item':'organize',row,t('Editar / organizar','Editar / organizar'),Pencil,false,true)}{admin&&moreActions(row)}</>}
          </div>
        </div>
        {row.unit==='kit'&&expanded.has(row.id)&&kitComposition(row)}
      </article>:view==='assets'?<article key={row.id} className="flex flex-wrap items-center gap-3 py-3">
        <div className="min-w-0 flex-1 basis-40"><p className="font-mono text-sm font-semibold text-cyan-100">{row.code}</p><p className="break-words text-xs text-slate-400">{row.serial_number||t('Sem número de série','Sin número de serie')} · {row.location||t('Local não informado','Ubicación no informada')}</p>{row.notes&&<p className="whitespace-pre-wrap break-words text-xs text-slate-400">{row.notes}</p>}</div>
        <span className={`rounded-md px-2 py-1 text-xs ${colors[row.condition]}`}>{names[row.condition]}</span>
        {active&&action('asset',row,t('Atualizar unidade','Actualizar unidad'))}{admin&&active&&action('retire',row,t('Dar baixa','Dar de baja'),Trash2,true)}
      </article>:<article key={row.id} className="space-y-2 py-3 text-xs">
        <p className="font-semibold text-cyan-200">{operations[row.action]??row.action}</p><p className="text-slate-400">{row.actor_name} · {new Date(row.created_at).toLocaleString(es?'es':'pt-BR')}</p>
        {(row.after_data?.reason||row.after_data?.removal_reason||row.after_data?.movement?.reason)&&<p className="whitespace-pre-wrap text-slate-200">{row.after_data.reason||row.after_data.removal_reason||row.after_data.movement.reason}</p>}
        <details><summary className="cursor-pointer text-slate-300">{t('Conferir alteração','Revisar cambio')}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">{['before_data','after_data'].map(key=><pre key={key} className="max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-2 text-[11px] text-slate-400">{JSON.stringify(row[key],null,2)}</pre>)}</div></details>
      </article>)}
    </div>}
    <div className="flex justify-between border-t border-white/10 pt-3 text-xs text-slate-400"><span>{total} {t('registros','registros')} · {t('Página','Página')} {page}</span><div className="flex gap-2"><button className={button} disabled={page===1} onClick={()=>setPage(v=>v-1)} aria-label={t('Página anterior','Página anterior')}><ArrowLeft size={14}/></button><button className={button} disabled={page*50>=total} onClick={()=>setPage(v=>v+1)} aria-label={t('Próxima página','Página siguiente')}><ArrowRight size={14}/></button></div></div>
  </section>
}
