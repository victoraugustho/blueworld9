// Homologação isolada: nunca lê .env nem acessa o banco do portal.
const {test}=require('node:test'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
const {PGlite}=require('@electric-sql/pglite')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
const {schoolService}=require('../lib/schools/service.ts')
const components=[{name:'Arduino UNO',quantity:1,unit:'un'},{name:'Cabo USB',quantity:1,unit:'un'},{name:'Protoboard',quantity:1,unit:'un'},{name:'Jumpers',quantity:10,unit:'un'}]
const data={name:'Kit Arduino',category:'',category_id:'b9000000-0000-4000-8000-000000000003',tracking_mode:'individual',quantity:1,unit:'kit',asset_tag:'',serial_number:'',location:'Laboratório',condition:'good',notes:'',components}
test('Kits: composição, estoque, compatibilidade e auditoria',{timeout:60000},async t=>{
 const p=new PGlite()
 try {
  await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text,email text,active boolean,approved boolean);
   CREATE TABLE teacher_classes(id uuid PRIMARY KEY,teacher_id uuid,name text,school_year int);
   CREATE TABLE teacher_schedules(id uuid PRIMARY KEY,class_id uuid,weekday int,start_time time,end_time time);`)
  const migration=name=>fs.readFileSync(path.join(__dirname,`../scripts/${name}`),'utf8')
  for(const name of ['046_schools_inventory.sql','047_inventory_units_and_categories.sql','048_inventory_kit_components.sql']) await p.exec(migration(name))
  const admin={id:randomUUID(),name:'Admin',admin:true},teacher={id:randomUUID(),name:'Professor',admin:false}
  for(const actor of [admin,teacher]) await p.query('INSERT INTO teachers VALUES($1,$2,$3,true,true)',[actor.id,actor.name,`${actor.id}@example.test`])
  const db={query:async(sql,params=[])=>(await p.query(sql,params)).rows,transaction:work=>p.transaction(tx=>work({query:async(sql,params=[])=>(await tx.query(sql,params)).rows}))}
  const service=schoolService(db),run=(body,actor=admin,key=randomUUID())=>service.command(actor,key,body)
  const reject=(work,status)=>assert.rejects(work,error=>error.status===status)
  const school=await run({action:'school.create',data:{name:'Escola de kits',country:'BR',address:'',notes:'',active:true}})
  await run({action:'links.replace',schoolId:school.id,version:1,teacherIds:[teacher.id],classIds:[]})
  let kit,template
  await t.test('1 kit gera somente 1 unidade e não cria estoque para componentes',async()=>{
   const key=randomUUID(),body={action:'item.create',schoolId:school.id,data}
   kit=await run(body,admin,key);await run(body,admin,key)
   assert.equal(kit.quantity,1);assert.equal(kit.good_quantity,1);assert.deepEqual(kit.components,components)
   assert.equal((await service.read(admin,'assets',school.id,'',1,{itemId:kit.id})).total,1)
   const inventory=await service.read(admin,'inventory',school.id)
   assert.equal(inventory.total,1);assert.equal(inventory.rows[0].quantity,1)
   assert.equal((await p.query('SELECT count(*)::int n FROM bw_inventory_assets')).rows[0].n,1)
  })
  await t.test('lote de 3 kits conta 3, não 39 componentes',async()=>{
   const bulk=await run({action:'item.create',schoolId:school.id,data:{...data,name:'Kits em lote',tracking_mode:'bulk',quantity:3}})
   assert.equal(bulk.quantity,3);assert.equal(bulk.good_quantity,3);assert.deepEqual(bulk.components,components)
   assert.equal((await service.read(admin,'assets',school.id,'',1,{itemId:bulk.id})).total,0)
   assert.equal((await p.query('SELECT sum(quantity)::int n FROM bw_inventory_items')).rows[0].n,4)
  })
  await t.test('editar composição preserva quantidade e audita antes/depois',async()=>{
   kit=await run({action:'item.update',schoolId:school.id,id:kit.id,version:1,data:{...data,components:[...components.slice(0,3),{name:'Jumpers',quantity:20,unit:'un'}]}})
   assert.equal(kit.quantity,1);assert.equal(kit.version,2)
   const audit=(await p.query("SELECT * FROM bw_school_audit WHERE entity_id=$1 AND action='item.update'",[kit.id])).rows[0]
   assert.equal(audit.before_data.components[3].quantity,10);assert.equal(audit.after_data.components[3].quantity,20)
  })
  await t.test('cliente antigo não apaga composição ao omitir o campo',async()=>{
   const {components:ignored,...legacy}=data
   kit=await run({action:'item.update',schoolId:school.id,id:kit.id,version:2,data:{...legacy,notes:'Edição antiga'}})
   assert.equal(kit.components[3].quantity,20)
   await reject(()=>run({action:'item.update',schoolId:school.id,id:kit.id,version:3,data:{...legacy,unit:'un'}}),400)
   await reject(()=>run({action:'item.update',schoolId:school.id,id:kit.id,version:1,data}),409)
  })
  await t.test('valida quantidade, nomes, unidades, limite e JSON sem coerção',async()=>{
   const invalid=[[{name:'Jumpers',quantity:0,unit:'un'}],[{name:'Jumpers',quantity:1.5,unit:'un'}],[{name:'A',quantity:1,unit:'un'}],
    [{name:'Outro kit',quantity:1,unit:'kit'}],[{name:'Jumpers',quantity:1,unit:'un',extra:1}],Array.from({length:101},()=>components[0]),JSON.stringify(components)]
   for(const value of invalid) await reject(()=>run({action:'item.create',schoolId:school.id,data:{...data,components:value}}),400)
   await reject(()=>run({action:'item.create',schoolId:school.id,data:{...data,unit:'un'}}),400)
   assert.equal((await p.query('SELECT count(*)::int n FROM bw_inventory_items')).rows[0].n,2)
  })
  await t.test('modelo aplica composição por kit sem duplicar nem alterar o original',async()=>{
   const line={name:data.name,category:'',category_id:data.category_id,tracking_mode:'individual',quantity:2,unit:'kit',components}
   template=await run({action:'template.create',data:{name:'Modelo de kits',description:'Composição por kit',active:true,items:[line]}})
   const target=await run({action:'school.create',data:{name:'Outra escola',country:'BR',address:'',notes:'',active:true}})
   await run({action:'template.apply',schoolId:target.id,version:1,templateId:template.id})
   const inventory=await service.read(admin,'inventory',target.id)
   assert.equal(inventory.total,1);assert.equal(inventory.rows[0].quantity,2);assert.deepEqual(inventory.rows[0].components,components)
   assert.equal((await service.read(admin,'assets',target.id,'',1,{itemId:inventory.rows[0].id})).total,2)
   await reject(()=>run({action:'template.apply',schoolId:target.id,version:2,templateId:template.id}),409)
   assert.deepEqual((await p.query('SELECT items FROM bw_inventory_templates WHERE id=$1',[template.id])).rows[0].items,template.items)
  })
  await t.test('modelo legado preserva kit identificado; renomeação ambígua é recusada',async()=>{
   const {components:ignored,...legacy}=template.items[0]
   template=await run({action:'template.update',id:template.id,version:1,data:{name:template.name,description:'Editado',active:true,items:[legacy]}})
   assert.deepEqual(template.items[0].components,components)
   await reject(()=>run({action:'template.update',id:template.id,version:2,data:{name:template.name,description:'',active:true,items:[{...legacy,name:'Outro kit'}]}}),409)
  })
  await t.test('professor consulta composição, mas não altera composição ou estoque',async()=>{
   await run({action:'inventory.publish',schoolId:school.id,version:2})
   assert.equal((await service.read(teacher,'inventory',school.id)).rows.find(r=>r.id===kit.id).components[3].quantity,20)
   await reject(()=>run({action:'item.update',schoolId:school.id,id:kit.id,version:3,data},teacher),403)
   await reject(()=>run({action:'item.organize',schoolId:school.id,id:kit.id,version:3,data:{location:'',notes:'',components:[]}},teacher),400)
  })
  await t.test('solicitação, aprovação e recebimento mantêm composição e contam só 1 kit',async()=>{
   let request=await run({action:'request.create',schoolId:school.id,data:{kind:'new',name:'Kit solicitado',category_id:data.category_id,tracking_mode:'individual',quantity:1,unit:'kit',reason:'Montagem orientada',components}},teacher)
   assert.deepEqual(request.components,components)
   request=await run({action:'request.review',schoolId:school.id,id:request.id,version:1,decision:'approve',notes:'Aprovado para compra'})
   assert.equal((await p.query('SELECT count(*)::int n FROM bw_inventory_items WHERE school_id=$1',[school.id])).rows[0].n,2)
   await run({action:'request.review',schoolId:school.id,id:request.id,version:2,decision:'fulfill',notes:'Recebimento conferido'})
   const received=(await p.query('SELECT * FROM bw_inventory_items WHERE request_id=$1',[request.id])).rows[0]
   assert.deepEqual(received.components,components);assert.equal(received.quantity,1)
  })
  await t.test('falha da auditoria reverte kit, unidades e idempotência',async()=>{
   const failing=schoolService({query:db.query,transaction:work=>p.transaction(tx=>work({query:async(sql,params=[])=>{
    if(sql.startsWith('INSERT INTO public.bw_school_audit')) throw new Error('Auditoria indisponível')
    return (await tx.query(sql,params)).rows
   }}))})
   const before=(await p.query('SELECT count(*)::int n FROM bw_inventory_items')).rows[0].n
   await assert.rejects(()=>failing.command(admin,randomUUID(),{action:'item.create',schoolId:school.id,data}),/Auditoria indisponível/)
   assert.equal((await p.query('SELECT count(*)::int n FROM bw_inventory_items')).rows[0].n,before)
  })
  await t.test('migração reexecutável preserva IDs, saldos e composição',async()=>{
   const before=(await p.query('SELECT * FROM bw_inventory_items ORDER BY id')).rows
   await p.exec(migration('048_inventory_kit_components.sql'))
   assert.deepEqual((await p.query('SELECT * FROM bw_inventory_items ORDER BY id')).rows,before)
   await assert.rejects(()=>p.query('UPDATE bw_inventory_items SET components=$2::jsonb WHERE id=$1',[kit.id,JSON.stringify('not-array')]),error=>error.code==='23514')
  })
 } finally {await p.close()}
})
