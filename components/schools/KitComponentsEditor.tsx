"use client"

import { useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { PackageOpen, Plus, Trash2 } from 'lucide-react'

export type KitComponent={name:string;quantity:number|string;unit:string}
type Props={value:KitComponent[];onChange:(value:KitComponent[])=>void;locale:string;labelPrefix?:string}
const input='w-full min-w-0 rounded-lg border border-white/15 bg-slate-950 px-2.5 py-2 text-sm text-white outline-none focus:border-cyan-300'
const button='inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-40'

export default function KitComponentsEditor({value,onChange,locale,labelPrefix=''}:Props) {
  const es=locale==='es',t=(pt:string,spanish:string)=>es?spanish:pt
  const [removing,setRemoving]=useState<number|null>(null)
  function update(index:number,key:keyof KitComponent,value:number|string) {
    onChange(valueRows.map((row,i)=>i===index?{...row,[key]:value}:row))
  }
  const valueRows=value??[]
  const pieces=valueRows.reduce((sum,row)=>sum+(Number(row.quantity)||0),0)
  return <section className="space-y-3 rounded-xl border border-cyan-300/20 bg-cyan-400/5 p-3 sm:p-4" aria-label={`${t('Composição do kit','Composición del kit')}${labelPrefix}`}>
    <div className="flex items-start gap-2"><PackageOpen size={19} className="mt-0.5 shrink-0 text-cyan-200"/><div><h4 className="text-sm font-semibold text-white">{t('Composição por kit','Composición por kit')}</h4><p className="mt-1 text-xs text-slate-400">{t('Informe o que vem dentro de um kit. Esses componentes não aumentam o saldo do inventário nem retiram itens avulsos automaticamente.','Indique qué incluye un kit. Estos componentes no aumentan las existencias ni retiran artículos individuales automáticamente.')}</p></div></div>
    <div className="space-y-2">
      {valueRows.map((row,index)=><div key={index} className="grid grid-cols-[minmax(0,1fr)_70px_34px] gap-2 rounded-lg border border-white/10 bg-slate-900/70 p-2 sm:grid-cols-[minmax(0,1fr)_80px_110px_34px]">
        <label className="min-w-0"><span className="mb-1 block text-[11px] text-slate-300">{t('Componente','Componente')}</span><input aria-label={`${t('Nome do componente','Nombre del componente')} ${index+1}${labelPrefix}`} className={input} value={row.name} required minLength={2} maxLength={160} placeholder={t('Ex.: Arduino UNO','Ej.: Arduino UNO')} onChange={e=>update(index,'name',e.target.value)}/></label>
        <label><span className="mb-1 block text-[11px] text-slate-300">{t('Qtd.','Cant.')}</span><input aria-label={`${t('Quantidade do componente','Cantidad del componente')} ${index+1}${labelPrefix}`} className={`${input} tabular-nums`} type="number" min={1} max={100000} step={1} required value={row.quantity} onChange={e=>update(index,'quantity',e.target.value===''?'':Number(e.target.value))}/></label>
        <label className="col-span-2 row-start-2 sm:col-span-1 sm:row-auto"><span className="mb-1 block text-[11px] text-slate-300">{t('Unidade','Unidad')}</span><select aria-label={`${t('Unidade do componente','Unidad del componente')} ${index+1}${labelPrefix}`} className={input} value={row.unit} onChange={e=>update(index,'unit',e.target.value)}><option value="un">{t('Unidades','Unidades')}</option><option value="cx">{t('Caixas','Cajas')}</option><option value="cj">{t('Conjuntos','Conjuntos')}</option></select></label>
        <button type="button" className={`${button} col-start-3 row-start-1 self-end !px-2 !text-rose-200 sm:col-start-4`} title={t('Remover componente','Eliminar componente')} aria-label={`${t('Remover componente','Eliminar componente')} ${index+1}${labelPrefix}`} onClick={()=>setRemoving(index)}><Trash2 size={14}/></button>
      </div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><button type="button" className={button} disabled={valueRows.length>=100} onClick={()=>onChange([...valueRows,{name:'',quantity:1,unit:'un'}])}><Plus size={14}/>{t('Adicionar componente','Agregar componente')}</button><span className="text-[11px] text-cyan-200">{valueRows.length} {t('tipos','tipos')} · {pieces} {t('componentes por kit','componentes por kit')}</span></div>
    <AlertDialog.Root open={removing!==null} onOpenChange={open=>{if(!open)setRemoving(null)}}><AlertDialog.Portal><AlertDialog.Overlay className="fixed inset-0 z-[85] bg-black/70"/><AlertDialog.Content className="fixed left-1/2 top-1/2 z-[86] w-[calc(100%_-_2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-white/15 bg-slate-950 p-5 text-white"><AlertDialog.Title className="font-semibold text-white">{t('Remover componente?','¿Eliminar componente?')}</AlertDialog.Title><AlertDialog.Description className="my-3 text-sm text-slate-300">{t('A composição será alterada apenas ao salvar o formulário.','La composición se modificará solo al guardar el formulario.')}</AlertDialog.Description><div className="flex justify-end gap-2"><AlertDialog.Cancel className={button}>{t('Cancelar','Cancelar')}</AlertDialog.Cancel><AlertDialog.Action className={`${button} bg-rose-500/15 !text-rose-200`} onClick={()=>{onChange(valueRows.filter((_,index)=>index!==removing));setRemoving(null)}}>{t('Remover','Eliminar')}</AlertDialog.Action></div></AlertDialog.Content></AlertDialog.Portal></AlertDialog.Root>
  </section>
}
