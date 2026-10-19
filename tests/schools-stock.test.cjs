// Homologação v2: apenas PostgreSQL em memória. Nunca lê .env ou DATABASE_URL.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
const {PGlite}=require('@electric-sql/pglite')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
const {schoolService}=require('../lib/schools/service.ts')
const general='b9000000-0000-4000-8000-000000000001', computers='b9000000-0000-4000-8000-000000000002'
const data={name:'Notebooks',category:'',category_id:computers,tracking_mode:'individual',quantity:12,unit:'un',asset_tag:'',serial_number:'',location:'Laboratório',condition:'good',notes:''}

test('Inventário profissional: unidades, categorias, saldos e segurança',{timeout:60000},async t=>{
 const p=new PGlite()
 try {
  await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text,email text,active boolean,approved boolean);
   CREATE TABLE teacher_classes(id uuid PRIMARY KEY,teacher_id uuid,name text,school_year int);
   CREATE TABLE teacher_schedules(id uuid PRIMARY KEY,class_id uuid,weekday int,start_time time,end_time time);
   CREATE TABLE preserved_grades(score numeric);INSERT INTO preserved_grades VALUES(9.5);`)
  const migration=name=>fs.readFileSync(path.join(__dirname,`../scripts/${name}`),'utf8')
  await p.exec(migration('046_schools_inventory.sql'))
  const actor={id:randomUUID(),name:'Admin',admin:true},teacher={id:randomUUID(),name:'Professor',admin:false},outsider={id:randomUUID(),name:'Outro professor',admin:false}
  for(const a of [actor,teacher,outsider]) await p.query('INSERT INTO teachers VALUES($1,$2,$3,true,true)',[a.id,a.name,`${a.id}@example.test`])
  const oldSchool=randomUUID(),oldItem=randomUUID(),oldTemplate=randomUUID(),taggedItem=randomUUID()
  await p.query("INSERT INTO bw_schools(id,name,code,country) VALUES($1,'Escola antiga','ANTIGA','BR')",[oldSchool])
  await p.query("INSERT INTO bw_inventory_items(id,school_id,name,category,quantity,condition,asset_tag,notes) VALUES($1,$2,'Peças antigas','Categoria antiga',12,'damaged',null,'Não modificar')",[oldItem,oldSchool])
  await p.query("INSERT INTO bw_inventory_items(id,school_id,name,quantity,asset_tag,serial_number) VALUES($1,$2,'Equipamento legado',1,'PATRIMONIO-LEGADO-123','SERIE-ANTIGA-456')",[taggedItem,oldSchool])
  await p.query('INSERT INTO bw_inventory_templates(id,name,items) VALUES($1,$2,$3)',[oldTemplate,'Modelo antigo',[{name:'Peça',category:'Categoria de modelo',quantity:3,unit:'un'}]])
  await p.exec(migration('047_inventory_units_and_categories.sql'))
  await p.exec(migration('048_inventory_kit_components.sql'))
  const db={query:async(sql,params=[])=>(await p.query(sql,params)).rows,transaction:work=>p.transaction(tx=>work({query:async(sql,params=[])=>(await tx.query(sql,params)).rows}))}
  const service=schoolService(db),run=(a,body,key=randomUUID())=>service.command(a,key,body)
  const reject=(work,status=409)=>assert.rejects(work,error=>error.status===status)
  const item=async id=>(await p.query('SELECT * FROM bw_inventory_items WHERE id=$1',[id])).rows[0]
  let school,other,notebooks,bulk,category,assets
  await t.test('migração preserva quantidades, condição e identificadores antigos',async()=>{
   const old=await item(oldItem)
   assert.equal(old.quantity,12);assert.equal(old.damaged_quantity,12);assert.equal(old.good_quantity,0)
   assert.equal(old.tracking_mode,'bulk');assert.equal(old.notes,'Não modificar')
   assert.equal((await p.query('SELECT code FROM bw_schools WHERE id=$1',[oldSchool])).rows[0].code,'ANTIGA')
   assert.equal((await p.query('SELECT name FROM bw_inventory_categories WHERE id=$1',[old.category_id])).rows[0].name,'Categoria antiga')
   const line=(await p.query('SELECT items FROM bw_inventory_templates WHERE id=$1',[oldTemplate])).rows[0].items[0]
   assert.equal(line.quantity,3);assert.ok(line.category_id);assert.equal(line.tracking_mode,'bulk')
  })
  await t.test('escolas recebem códigos automáticos distintos',async()=>{
   const d={name:'Escola de teste',country:'BR',address:'',notes:'',active:true}
   school=await run(actor,{action:'school.create',data:d});other=await run(actor,{action:'school.create',data:d})
   assert.match(school.code,/^ESC-[A-F0-9]{12}$/);assert.notEqual(school.code,other.code)
   await run(actor,{action:'links.replace',schoolId:school.id,version:1,teacherIds:[teacher.id],classIds:[]})
  })
  await t.test('pesquisa encontra patrimônio e série legados, sem exigir individualização',async()=>{
   for(const term of ['PATRIMONIO-LEGADO-123','SERIE-ANTIGA-456']) {
    const result=await service.read(actor,'inventory',oldSchool,term)
    assert.equal(result.total,1);assert.equal(result.rows[0].id,taggedItem)
    assert.equal(result.rows[0].tracking_mode,'bulk')
    assert.equal((await service.read(actor,'inventory',school.id,term)).total,0)
   }
  })
  await t.test('categoria precisa existir; professor não cria nem administra categorias',async()=>{
   await reject(()=>run(actor,{action:'item.create',schoolId:school.id,data:{...data,category_id:randomUUID()}}),400)
   await reject(()=>run(actor,{action:'item.create',schoolId:school.id,data:{...data,category_id:undefined,category:'Não cadastrada'}}),400)
   await reject(()=>run(teacher,{action:'category.create',data:{name:'Teste',name_es:'',description:'',description_es:'',default_tracking:'bulk',default_unit:'un',active:true}}),403)
   await reject(()=>service.read(teacher,'categories'),403)
  })
  await t.test('12 notebooks recebem 12 unidades e códigos automáticos únicos',async()=>{
   notebooks=await run(actor,{action:'item.create',schoolId:school.id,data})
   assert.match(notebooks.code,/^INV-\d+$/);assert.equal(notebooks.good_quantity,12)
   assets=(await service.read(actor,'assets',school.id,'',1,{itemId:notebooks.id})).rows
   assert.equal(assets.length,12);assert.equal(new Set(assets.map(a=>a.code)).size,12)
   assert.ok(assets.every(a=>/^BW9-\d+$/.test(a.code)))
  })
  await t.test('professor não altera equipamentos em rascunho',async()=>{
   await reject(()=>run(teacher,{action:'asset.update',schoolId:school.id,id:assets[0].id,version:1,data:{condition:'damaged',location:'Sala',notes:'',reason:'Falha verificada'}}),403)
   await reject(()=>service.read(teacher,'assets',school.id,'',1,{itemId:notebooks.id}),403)
   await run(actor,{action:'inventory.publish',schoolId:school.id,version:2})
  })
  await t.test('somente 1 dos 12 notebooks fica danificado e total continua 12',async()=>{
   const body={action:'asset.update',schoolId:school.id,id:assets[0].id,version:1,data:{condition:'damaged',location:'Sala',notes:'Tela quebrada',reason:'Conferido pelo professor'}}
   const key=randomUUID(),changed=await run(teacher,body,key)
   assert.equal(changed.item.quantity,12);assert.equal(changed.item.good_quantity,11);assert.equal(changed.item.damaged_quantity,1)
   await run(teacher,body,key)
   assert.equal((await item(notebooks.id)).version,2)
   const unchanged=(await service.read(teacher,'assets',school.id,'',1,{itemId:notebooks.id})).rows.filter(a=>a.condition==='good')
   assert.equal(unchanged.length,11)
  })
  await t.test('versão desatualizada não sobrescreve estado de equipamento',async()=>{
   await reject(()=>run(actor,{action:'asset.update',schoolId:school.id,id:assets[0].id,version:1,data:{condition:'good',location:'',notes:'',reason:'Tentativa antiga'}}))
   assert.equal((await item(notebooks.id)).damaged_quantity,1)
  })
  await t.test('professor não dá baixa, não aumenta estoque e não altera série',async()=>{
   await reject(()=>run(teacher,{action:'asset.retire',schoolId:school.id,id:assets[0].id,version:2,reason:'Baixa indevida'}),403)
   await reject(()=>run(teacher,{action:'asset.update',schoolId:school.id,id:assets[1].id,version:1,data:{condition:'good',location:'',notes:'',serial_number:'ALTERADA',reason:'Alterar série'}}),403)
   await reject(()=>run(teacher,{action:'item.adjust',schoolId:school.id,id:notebooks.id,version:2,direction:'entry',condition:'good',quantity:1,reason:'Sem permissão'}),403)
  })
  await t.test('IDOR impede leitura e alteração de equipamento de outra escola',async()=>{
   await reject(()=>service.read(outsider,'assets',school.id,'',1,{itemId:notebooks.id}),403)
   await reject(()=>run(actor,{action:'asset.update',schoolId:other.id,id:assets[1].id,version:1,data:{condition:'damaged',location:'',notes:'',reason:'Outra escola'}}),404)
   await reject(()=>service.read(actor,'assets',other.id,'',1,{itemId:notebooks.id}),404)
  })
  await t.test('material por quantidade mantém saldos separados',async()=>{
   bulk=await run(actor,{action:'item.create',schoolId:school.id,data:{...data,name:'Cabos',category_id:general,tracking_mode:'bulk'}})
   bulk=await run(teacher,{action:'item.condition',schoolId:school.id,id:bulk.id,version:1,from:'good',to:'maintenance',quantity:1,reason:'Conector com falha'})
   assert.equal(bulk.quantity,12);assert.equal(bulk.good_quantity,11);assert.equal(bulk.maintenance_quantity,1)
   await reject(()=>run(teacher,{action:'item.condition',schoolId:school.id,id:bulk.id,version:2,from:'maintenance',to:'damaged',quantity:2,reason:'Saldo insuficiente'}))
   await reject(()=>run(teacher,{action:'item.condition',schoolId:school.id,id:bulk.id,version:2,from:'good',to:'good',quantity:1,reason:'Estado repetido'}))
  })
  await t.test('edição do cadastro não altera quantidade nem todo o lote',async()=>{
   await reject(()=>run(actor,{action:'item.update',schoolId:school.id,id:bulk.id,version:2,data:{...data,name:'Cabos',category_id:general,tracking_mode:'bulk',quantity:20}}))
   await reject(()=>run(teacher,{action:'item.organize',schoolId:school.id,id:bulk.id,version:2,data:{location:'',notes:'',condition:'damaged'}}))
   await reject(()=>run(teacher,{action:'item.condition',schoolId:school.id,id:notebooks.id,version:2,from:'good',to:'damaged',quantity:12,reason:'Alteração de lote'}))
  })
  await t.test('entrada, baixa e limites são auditados e não admitem saldo negativo',async()=>{
   bulk=await run(actor,{action:'item.adjust',schoolId:school.id,id:bulk.id,version:2,direction:'entry',condition:'good',quantity:3,reason:'Recebimento de cabos'})
   assert.equal(bulk.quantity,15);assert.equal(bulk.good_quantity,14)
   bulk=await run(actor,{action:'item.adjust',schoolId:school.id,id:bulk.id,version:3,direction:'exit',condition:'maintenance',quantity:1,reason:'Conserto inviável'})
   assert.equal(bulk.quantity,14);assert.equal(bulk.maintenance_quantity,0)
   await reject(()=>run(actor,{action:'item.adjust',schoolId:school.id,id:bulk.id,version:4,direction:'exit',condition:'damaged',quantity:1,reason:'Não existe saldo'}))
   await reject(()=>run(actor,{action:'item.adjust',schoolId:school.id,id:bulk.id,version:4,direction:'entry',condition:'good',quantity:100000,reason:'Excede o limite'}))
  })
  await t.test('baixa individual retira apenas a unidade selecionada e preserva histórico',async()=>{
   const removed=await run(actor,{action:'asset.retire',schoolId:school.id,id:assets[0].id,version:2,reason:'Dano irreversível'})
   assert.equal(removed.active,false);assert.equal(removed.item.quantity,11);assert.equal(removed.item.good_quantity,11);assert.equal(removed.item.damaged_quantity,0)
   assert.equal((await p.query('SELECT COUNT(*)::int n FROM bw_inventory_assets WHERE item_id=$1',[notebooks.id])).rows[0].n,12)
  })
  await t.test('entrada individual gera novos códigos sem reutilizar unidade removida',async()=>{
   const key=randomUUID(),body={action:'item.adjust',schoolId:school.id,id:notebooks.id,version:3,direction:'entry',condition:'good',quantity:2,reason:'Novos notebooks'}
   const changed=await run(actor,body,key);await run(actor,body,key)
   assert.equal(changed.quantity,13)
   const all=(await p.query('SELECT code FROM bw_inventory_assets WHERE item_id=$1',[notebooks.id])).rows
   assert.equal(all.length,14);assert.equal(new Set(all.map(v=>v.code)).size,14)
   await reject(()=>run(actor,{...body,version:4,direction:'exit',quantity:1}))
  })
  await t.test('individualização preserva saldos e atribui código a cada unidade',async()=>{
   bulk=await run(teacher,{action:'item.condition',schoolId:school.id,id:bulk.id,version:4,from:'good',to:'damaged',quantity:2,reason:'Duas peças com falha'})
   bulk=await run(actor,{action:'item.individualize',schoolId:school.id,id:bulk.id,version:5,reason:'Conferência patrimonial'})
   assert.equal(bulk.quantity,14);assert.equal(bulk.good_quantity,12);assert.equal(bulk.damaged_quantity,2)
   const units=await service.read(actor,'assets',school.id,'',1,{itemId:bulk.id,condition:'damaged'})
   assert.equal(units.total,2)
   await reject(()=>run(actor,{action:'item.individualize',schoolId:school.id,id:bulk.id,version:6,reason:'Não duplicar unidades'}))
  })
  await t.test('categorias duplicadas, Geral e exclusão de categoria em uso são protegidas',async()=>{
   const d={name:'Categoria especial',name_es:'Categoría especial',description:'',description_es:'',default_tracking:'bulk',default_unit:'un',active:true}
   category=await run(actor,{action:'category.create',data:d})
   await assert.rejects(()=>run(actor,{action:'category.create',data:{...d,name:'CATEGORIA ESPECIAL'}}),e=>e.code==='23505')
   await reject(()=>run(actor,{action:'category.delete',id:general,version:1}))
   await reject(()=>run(actor,{action:'category.update',id:general,version:1,data:{...d,active:false}}))
   await reject(()=>run(actor,{action:'category.delete',id:computers,version:1}))
   await run(actor,{action:'category.update',id:category.id,version:1,data:{...d,active:false}})
   await reject(()=>run(actor,{action:'item.create',schoolId:school.id,data:{...data,category_id:category.id}}),400)
   await run(actor,{action:'category.delete',id:category.id,version:2})
  })
  await t.test('categoria por ID continua vinculada após renomear',async()=>{
   await run(actor,{action:'category.update',id:computers,version:1,data:{name:'Equipamentos de informática',name_es:'Equipos informáticos',description:'',description_es:'',default_tracking:'individual',default_unit:'un',active:true}})
   const result=await service.read(actor,'inventory',school.id,'',1,{categoryId:computers})
   assert.equal(result.total,1);assert.equal(result.rows[0].category,'Equipamentos de informática')
  })
  await t.test('filtros, totais e histórico por item são coerentes',async()=>{
   const filtered=await service.read(teacher,'inventory',school.id,'',1,{condition:'damaged'})
   assert.equal(filtered.total,1);assert.equal(filtered.summary.damaged,2)
   const all=await service.read(teacher,'inventory',school.id)
   assert.equal(all.summary.quantity,27);assert.equal(all.summary.good,25)
   assert.deepEqual(filtered.summary,all.summary)
   for(const condition of ['good','maintenance','damaged','missing']) {
    const result=await service.read(teacher,'inventory',school.id,'',1,{condition})
    assert.deepEqual(result.summary,all.summary)
    assert.ok(result.rows.every(row=>row[`${condition}_quantity`]>0))
   }
   const categoryResult=await service.read(teacher,'inventory',school.id,'',1,{categoryId:computers})
   assert.equal(categoryResult.total,1);assert.deepEqual(categoryResult.summary,all.summary)
   const empty=await service.read(teacher,'inventory',school.id,'Não existe',2,{condition:'maintenance',categoryId:computers})
   assert.equal(empty.total,0);assert.equal(empty.rows.length,0);assert.deepEqual(empty.summary,all.summary)
   const history=await service.read(teacher,'movements',school.id,'',1,{itemId:notebooks.id})
   assert.ok(history.rows.some(row=>row.action==='asset.retire'))
   assert.ok(history.rows.some(row=>row.action==='asset.update'&&row.after_data.reason==='Conferido pelo professor'))
  })
  await t.test('unidades, classificação e limites não aceitam valores arbitrários',async()=>{
   for(const extra of [{unit:'qualquer'},{quantity:1001},{code:'FORJADO'},{quantity:1.5}]) await reject(()=>run(actor,{action:'item.create',schoolId:school.id,data:{...data,...extra}}),extra.quantity===1001?409:400)
   await reject(()=>run(actor,{action:'item.condition',schoolId:school.id,id:bulk.id,version:6,from:'good; DROP TABLE teachers',to:'damaged',quantity:1,reason:'Não executar SQL'}),400)
  })
  await t.test('edição de modelo não aceita trocar um lote grande para controle individual acima do limite',async()=>{
   const line={name:'Equipamentos',category:'',category_id:general,tracking_mode:'bulk',quantity:1001,unit:'un'}
   const model=await run(actor,{action:'template.create',data:{name:'Modelo grande',description:'',active:true,items:[line]}})
   await reject(()=>run(actor,{action:'template.update',id:model.id,version:1,data:{name:model.name,description:'',active:true,items:[{...model.items[0],tracking_mode:'individual'}]}}),400)
   const stored=(await p.query('SELECT items,version FROM bw_inventory_templates WHERE id=$1',[model.id])).rows[0]
   assert.equal(stored.version,1);assert.equal(stored.items[0].tracking_mode,'bulk')
  })
  await t.test('falha da auditoria reverte inclusive unidades e saldos',async()=>{
   const broken=schoolService({...db,transaction:work=>db.transaction(c=>work({query:async(sql,params)=>{if(sql.includes('INSERT INTO public.bw_school_audit'))throw new Error('Audit failure');return c.query(sql,params)}}))})
   const count=(await p.query('SELECT COUNT(*)::int n FROM bw_inventory_assets')).rows[0].n
   await assert.rejects(()=>broken.command(actor,randomUUID(),{action:'item.create',schoolId:school.id,data}),/Audit failure/)
   assert.equal((await p.query('SELECT COUNT(*)::int n FROM bw_inventory_assets')).rows[0].n,count)
   await assert.rejects(()=>broken.command(actor,randomUUID(),{action:'asset.update',schoolId:school.id,id:assets[1].id,version:1,data:{condition:'damaged',location:'',notes:'',reason:'Rollback completo'}}),/Audit failure/)
   assert.equal((await item(notebooks.id)).damaged_quantity,0)
  })
  await t.test('banco rejeita saldos incoerentes mesmo fora do serviço',async()=>{
   await assert.rejects(()=>p.query('UPDATE bw_inventory_items SET good_quantity=999 WHERE id=$1',[notebooks.id]),e=>e.cause?.code==='23514'||e.code==='23514')
  })
  await t.test('leituras não executam DDL ou alterações',async()=>{
   const checked=schoolService({query:db.query,transaction:work=>db.transaction(c=>work({query:(sql,params)=>{assert.ok(/^SELECT\b/i.test(sql.trim()));return c.query(sql,params)}}))})
   await checked.read(teacher,'inventory',school.id);await checked.read(teacher,'assets',school.id,'',1,{itemId:notebooks.id});await checked.read(teacher,'movements',school.id,'',1,{itemId:notebooks.id});await checked.read(teacher,'catalog')
  })
  await t.test('desativar categoria preserva cadastros e recebimento já aprovado, mas bloqueia novas associações',async()=>{
   const d={name:'Equipamentos especiais',name_es:'Equipos especiales',description:'',description_es:'',default_tracking:'individual',default_unit:'un',active:true}
   const cat=await run(actor,{action:'category.create',data:d})
   const line={name:'Equipamento especial',category:'',category_id:cat.id,tracking_mode:'individual',quantity:2,unit:'un'}
   let template=await run(actor,{action:'template.create',data:{name:'Modelo especial',description:'',active:true,items:[line]}})
   const request=await run(teacher,{action:'request.create',schoolId:school.id,data:{kind:'new',name:'Equipamento especial',category_id:cat.id,tracking_mode:'individual',quantity:2,unit:'un',reason:'Atividade de robótica'}})
   await run(actor,{action:'request.review',schoolId:school.id,id:request.id,version:1,decision:'approve',notes:'Compra autorizada'})
   await run(actor,{action:'category.update',id:cat.id,version:1,data:{...d,active:false}})
   await reject(()=>run(teacher,{action:'request.create',schoolId:school.id,data:{kind:'new',name:'Outra compra',category_id:cat.id,tracking_mode:'individual',quantity:2,unit:'un',reason:'Associação nova'}}),400)
   template=await run(actor,{action:'template.update',id:template.id,version:1,data:{name:'Modelo especial revisado',description:'Sem perder os vínculos',active:true,items:template.items}})
   await reject(()=>run(actor,{action:'template.apply',schoolId:other.id,version:1,templateId:template.id}),400)
   assert.equal((await service.read(actor,'inventory',other.id)).total,0)
   await run(actor,{action:'request.review',schoolId:school.id,id:request.id,version:2,decision:'fulfill',notes:'Compra já aprovada e recebida'})
   const received=(await p.query('SELECT * FROM bw_inventory_items WHERE request_id=$1',[request.id])).rows[0]
   assert.equal(received.category_id,cat.id);assert.equal(received.good_quantity,2)
   assert.equal((await service.read(actor,'assets',school.id,'',1,{itemId:received.id})).total,2)
   await run(actor,{action:'item.update',schoolId:school.id,id:received.id,version:1,data:{...data,name:received.name,category_id:cat.id,quantity:2,location:'Sala de robótica'}})
   await reject(()=>run(actor,{action:'category.delete',id:cat.id,version:2}))
  })
  await t.test('reexecutar migração não altera os saldos novos nem dados legados',async()=>{
   const before=await item(bulk.id)
   await p.exec(migration('047_inventory_units_and_categories.sql'))
   assert.deepEqual(await item(bulk.id),before)
   assert.equal((await p.query('SELECT score FROM preserved_grades')).rows[0].score,'9.5')
   assert.equal((await item(oldItem)).damaged_quantity,12)
   assert.equal((await p.query("SELECT count(*)::int n FROM bw_inventory_categories WHERE name='Computadores e tablets'")).rows[0].n,0)
  })
  await t.test('migração de modelo misto preserva categorias explícitas, controle individual e composição',async()=>{
   const id=randomUUID(),components=[{name:'Arduino UNO',quantity:1,unit:'un'}]
   const modern={name:'Kit já configurado',category:'Nome antigo da categoria',category_id:computers,tracking_mode:'individual',quantity:2,unit:'kit',components}
   const legacy={name:'Cabos legados',category:'Categoria antiga',quantity:3,unit:'un'}
   const partial={name:'Item parcialmente configurado',category:'Categoria antiga',category_id:general,quantity:1,unit:'un'}
   await p.query('INSERT INTO bw_inventory_templates(id,name,items) VALUES($1,$2,$3)',[id,'Modelo misto',[modern,legacy,partial]])
   await p.exec(migration('047_inventory_units_and_categories.sql'))
   const lines=(await p.query('SELECT items FROM bw_inventory_templates WHERE id=$1',[id])).rows[0].items
   assert.deepEqual(lines[0],modern)
   assert.equal(lines[1].name,legacy.name);assert.equal(lines[1].quantity,3);assert.equal(lines[1].tracking_mode,'bulk')
   assert.equal(lines[1].category_id,(await item(oldItem)).category_id)
   assert.deepEqual(lines[2],{...partial,tracking_mode:'bulk'})
   assert.equal((await p.query("SELECT count(*)::int n FROM bw_inventory_categories WHERE name='Nome antigo da categoria'")).rows[0].n,0)
   await p.exec(migration('047_inventory_units_and_categories.sql'))
   assert.deepEqual((await p.query('SELECT items FROM bw_inventory_templates WHERE id=$1',[id])).rows[0].items,lines)
  })
 }finally{await p.close()}
})
