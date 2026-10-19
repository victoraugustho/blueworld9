import { randomUUID } from 'node:crypto'
import { assertVersion, kitComponents, SchoolError, type Actor, type ItemInput, type SchoolCommand } from './contracts'
import type { SchoolConnection } from './service'

type Row = Record<string, any>
export const states = ['good','maintenance','damaged','missing'] as const
const one = async (c:SchoolConnection, sql:string, values:any[]=[]) => (await c.query(sql,values))[0]
const invalid = (message:string):never => { throw new SchoolError(409,'STOCK',message) }

export function validateComposition(data:{unit:string;components?:unknown}, existing?:Row) {
  // Omitted composition from an older client must never erase a previously saved kit.
  const parsed=kitComponents.safeParse(data.components??existing?.components??[])
  if (!parsed.success || (parsed.data.length>0 && data.unit!=='kit'))
    throw new SchoolError(400,'KIT','Confira a composição: até 100 componentes, quantidades positivas e unidade do cadastro igual a kit.')
  return parsed.data
}

export async function classification(c:SchoolConnection, data:{category_id?:string;category?:string;tracking_mode?:string;unit:string;quantity:number}, existing?:Row) {
  const category = data.category_id
    ? await one(c,'SELECT * FROM public.bw_inventory_categories WHERE id=$1 FOR SHARE',[data.category_id])
    : await one(c,`SELECT * FROM public.bw_inventory_categories WHERE lower(trim(name))=lower(trim($1)) FOR SHARE`,[data.category || 'Geral'])
  if (!category || (!category.active && existing?.category_id!==category.id))
    throw new SchoolError(400,'CATEGORY','Selecione uma categoria ativa e pré-cadastrada.')
  const tracking = data.tracking_mode ?? existing?.tracking_mode ?? 'bulk'
  if (!existing && tracking==='individual' && data.quantity>1000) invalid('Cadastre no máximo 1.000 unidades individuais por operação.')
  // Existing nonstandard units can be retained, but new records use counted units only.
  if (!['un','kit','cx','cj'].includes(data.unit) && data.unit!==existing?.unit)
    throw new SchoolError(400,'UNIT','Selecione unidades, kits, caixas ou conjuntos.')
  return { category_id:category.id, category:category.name, tracking_mode:tracking }
}

async function generateAssets(c:SchoolConnection,item:Row,amount:number,state:string) {
  if (!amount) return
  await c.query(`INSERT INTO public.bw_inventory_assets(item_id,condition,location,serial_number,notes)
    SELECT $1,$2,$3,CASE WHEN $4::int=1 THEN $5 ELSE '' END,$6 FROM generate_series(1,$4::int)`,
  [item.id,state,item.location,amount,item.quantity===1?item.serial_number:'',item.notes])
}

async function syncAssets(c:SchoolConnection,id:string,bump=true) {
  return one(c,`UPDATE public.bw_inventory_items i SET
    quantity=s.total,good_quantity=s.good,maintenance_quantity=s.maintenance,damaged_quantity=s.damaged,missing_quantity=s.missing,
    version=i.version+$2::int,updated_at=NOW()
    FROM (SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE condition='good')::int good,
      COUNT(*) FILTER (WHERE condition='maintenance')::int maintenance,COUNT(*) FILTER (WHERE condition='damaged')::int damaged,
      COUNT(*) FILTER (WHERE condition='missing')::int missing FROM public.bw_inventory_assets WHERE item_id=$1 AND active) s
    WHERE i.id=$1 RETURNING i.*`,[id,bump?1:0])
}

export async function createStock(c:SchoolConnection,schoolId:string,data:ItemInput,requestId:string|null=null) {
  const cls=await classification(c,data,requestId?{category_id:data.category_id,unit:data.unit,tracking_mode:data.tracking_mode}:undefined)
  const components=validateComposition(data)
  const balances=states.map(state=>state===data.condition?data.quantity:0)
  const item=await one(c,`INSERT INTO public.bw_inventory_items
    (id,school_id,name,category,category_id,tracking_mode,quantity,unit,asset_tag,serial_number,location,condition,notes,request_id,
      good_quantity,maintenance_quantity,damaged_quantity,missing_quantity,components)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19::jsonb) RETURNING *`,
  [randomUUID(),schoolId,data.name,cls.category,cls.category_id,cls.tracking_mode,data.quantity,data.unit,data.asset_tag||null,
    data.serial_number,data.location,data.condition,data.notes,requestId,...balances,components])
  if (cls.tracking_mode==='individual') await generateAssets(c,item,data.quantity,data.condition)
  return item
}

export async function stockMutation(c:SchoolConnection,actor:Actor,schoolId:string,cmd:SchoolCommand) {
  if (!('id' in cmd) || !('version' in cmd)) throw new SchoolError(400,'INVALID','Operação inválida.')
  let asset:Row|undefined
  let item:Row|undefined
  if (cmd.action.startsWith('asset.')) {
    // School lock is already held. Lock the parent before the asset in every mutation.
    item=await one(c,`SELECT i.* FROM public.bw_inventory_items i JOIN public.bw_inventory_assets a ON a.item_id=i.id
      WHERE a.id=$1 AND i.school_id=$2 AND i.active FOR UPDATE OF i`,[cmd.id,schoolId])
    asset=await one(c,'SELECT * FROM public.bw_inventory_assets WHERE id=$1 AND active FOR UPDATE',[cmd.id])
  } else item=await one(c,'SELECT * FROM public.bw_inventory_items WHERE id=$1 AND school_id=$2 AND active FOR UPDATE',[cmd.id,schoolId])
  if (!item || (cmd.action.startsWith('asset.')&&!asset)) throw new SchoolError(404,'NOT_FOUND','Item ou unidade não encontrado.')
  assertVersion((asset??item) as {version:number},cmd.version)
  const before=asset?{...asset,item:{...item}}:{...item}
  let result:Row=item
  if (cmd.action==='asset.update') {
    if (!actor.admin && cmd.data.serial_number!==undefined && cmd.data.serial_number!==asset!.serial_number)
      throw new SchoolError(403,'FORBIDDEN','Apenas administradores podem alterar o número de série.')
    result=await one(c,`UPDATE public.bw_inventory_assets SET condition=$2,location=$3,notes=$4,serial_number=$5,
      version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,
    [asset!.id,cmd.data.condition,cmd.data.location,cmd.data.notes,cmd.data.serial_number??asset!.serial_number])
    result.item=await syncAssets(c,item.id);result.reason=cmd.data.reason
  } else if (cmd.action==='asset.retire') {
    result=await one(c,'UPDATE public.bw_inventory_assets SET active=FALSE,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[asset!.id])
    result.item=await syncAssets(c,item.id);result.reason=cmd.reason
  } else if (cmd.action==='item.condition') {
    if (item.tracking_mode!=='bulk') invalid('Selecione a unidade física que deseja alterar.')
    if (cmd.from===cmd.to) invalid('Selecione condições diferentes.')
    if (item[`${cmd.from}_quantity`]<cmd.quantity) invalid('A quantidade informada supera o saldo da condição selecionada.')
    // Column names come only from the validated enum, never from arbitrary input.
    result=await one(c,`UPDATE public.bw_inventory_items SET ${cmd.from}_quantity=${cmd.from}_quantity-$2,
      ${cmd.to}_quantity=${cmd.to}_quantity+$2,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,[item.id,cmd.quantity])
    result.movement={quantity:cmd.quantity,from:cmd.from,to:cmd.to,reason:cmd.reason}
  } else if (cmd.action==='item.adjust') {
    if (cmd.direction==='exit'&&item.tracking_mode==='individual') invalid('Para dar baixa, selecione cada unidade física.')
    const delta=cmd.direction==='entry'?cmd.quantity:-cmd.quantity
    if (item.asset_tag && item.quantity+delta>1) invalid('Este patrimônio legado é individual. Cadastre as novas unidades em um novo item para preservar sua identificação.')
    if (item.quantity+delta>100000 || item[`${cmd.condition}_quantity`]+delta<0) invalid('Quantidade fora do saldo disponível ou do limite de estoque.')
    if (item.tracking_mode==='individual') {
      if (cmd.quantity>1000) invalid('Adicione no máximo 1.000 unidades por operação.')
      await generateAssets(c,{...item,serial_number:''},cmd.quantity,cmd.condition)
      result=await syncAssets(c,item.id)
    } else result=await one(c,`UPDATE public.bw_inventory_items SET quantity=quantity+$2,${cmd.condition}_quantity=${cmd.condition}_quantity+$2,
      version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,[item.id,delta])
    result.movement={direction:cmd.direction,quantity:cmd.quantity,condition:cmd.condition,reason:cmd.reason}
  } else if (cmd.action==='item.individualize') {
    if (item.tracking_mode!=='bulk') invalid('Este item já possui unidades individuais.')
    if (item.quantity>1000) invalid('Individualize no máximo 1.000 unidades por item.')
    for (const state of states) await generateAssets(c,item,item[`${state}_quantity`],state)
    result=await one(c,`UPDATE public.bw_inventory_items SET tracking_mode='individual',version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,[item.id])
    result.reason=cmd.reason
  } else if (cmd.action==='item.delete') {
    await c.query('UPDATE public.bw_inventory_assets SET active=FALSE,version=version+1,updated_at=NOW() WHERE item_id=$1 AND active',[item.id])
    result=await one(c,'UPDATE public.bw_inventory_items SET active=FALSE,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[item.id])
    result.removal_reason=cmd.reason
  } else if (cmd.action==='item.organize') {
    if (cmd.data.condition && cmd.data.condition!==item.condition) invalid('Altere a condição por unidade ou informe a quantidade afetada.')
    result=await one(c,'UPDATE public.bw_inventory_items SET location=$2,notes=$3,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *',[item.id,cmd.data.location,cmd.data.notes])
  } else if (cmd.action==='item.update') {
    const d=cmd.data
    if (d.quantity!==item.quantity || d.condition!==item.condition || (d.tracking_mode&&d.tracking_mode!==item.tracking_mode))
      invalid('O cadastro não altera saldos nem condições. Use movimentação, unidades ou individualização.')
    const cls=await classification(c,d,item)
    const components=validateComposition(d,item)
    result=await one(c,`UPDATE public.bw_inventory_items SET name=$2,category=$3,category_id=$4,unit=$5,
      serial_number=$6,location=$7,notes=$8,components=$9::jsonb,version=version+1,updated_at=NOW() WHERE id=$1 RETURNING *`,
    [item.id,d.name,cls.category,cls.category_id,d.unit,d.serial_number,d.location,d.notes,components])
  } else throw new SchoolError(400,'INVALID','Operação de estoque inválida.')
  return {before,result,entityId:asset?.id??item.id}
}
