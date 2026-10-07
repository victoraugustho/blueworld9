// Homologação executável: PostgreSQL isolado em memória, sem ler DATABASE_URL.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const { PGlite } = require('@electric-sql/pglite')

Module._extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    compilerOptions: { module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true },
  }).outputText
  module._compile(output,filename)
}
const { schoolService } = require('../lib/schools/service.ts')
const { reviewStatus } = require('../lib/schools/contracts.ts')
const migration = fs.readFileSync(path.join(__dirname,'../scripts/046_schools_inventory.sql'),'utf8')
const admin = { id:randomUUID(),name:'Admin de teste',admin:true }
const teacher = { id:randomUUID(),name:'Professor vinculado',admin:false }
const outsider = { id:randomUUID(),name:'Professor externo',admin:false }
const classA = randomUUID(), classB = randomUUID()
const item = {name:'Arduino Uno',category:'Circuitos',quantity:10,unit:'un',asset_tag:'',serial_number:'',location:'Laboratório',condition:'good',notes:'Conferido'}
const schoolData = code => ({name:'Escola de homologação',code,country:'BR',address:'Rua de teste',notes:'',active:true})
const adapter = p => ({
  query: async (sql,params=[]) => (await p.query(sql,params)).rows,
  transaction: async work => p.transaction(tx=>work({query:async(sql,params=[]) => (await tx.query(sql,params)).rows})),
})

test('Escolas e inventário: homologação isolada', async t => {
  const p = new PGlite()
  try {
    await p.exec(`CREATE TABLE public.teachers(id uuid PRIMARY KEY,name text,email text,active boolean DEFAULT true,approved boolean DEFAULT true);
      CREATE TABLE public.teacher_classes(id uuid PRIMARY KEY,teacher_id uuid REFERENCES teachers(id),name text,school_year int);
      CREATE TABLE public.teacher_schedules(id uuid PRIMARY KEY,class_id uuid,weekday int,start_time time,end_time time);
      CREATE TABLE public.legacy_grades(id uuid PRIMARY KEY,class_id uuid,score numeric);`)
    for (const actor of [admin,teacher,outsider]) await p.query('INSERT INTO teachers(id,name,email) VALUES($1,$2,$3)',[actor.id,actor.name,`${actor.id}@example.test`])
    for (const id of [classA,classB]) await p.query('INSERT INTO teacher_classes VALUES($1,$2,$3,2026)',[id,teacher.id,'1º Ano'])
    await p.query('INSERT INTO legacy_grades VALUES($1,$2,9)',[randomUUID(),classA])
    await t.test('migração aditiva e idempotente', async()=>{
      await p.exec(migration); await p.exec(migration)
      assert.equal((await p.query('SELECT score FROM legacy_grades')).rows[0].score,'9')
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM teacher_classes')).rows[0].n,2)
    })
    const db = adapter(p), service = schoolService(db)
    const run = (actor,body,key=randomUUID())=>service.command(actor,key,body)
    const rejected = (work,status)=>assert.rejects(work,e=>e.status===status)
    let school, other, inventoryItem, template, purchase, existing
    const current = async()=> (await service.read(admin,'detail',school.id)).school
    await t.test('professor não cria escola nem modelo',async()=>{
      await rejected(()=>run(teacher,{action:'school.create',data:schoolData('NAO')}),403)
      await rejected(()=>run(teacher,{action:'template.create',data:{name:'Modelo',description:'',active:true,items:[{name:'LED',category:'',quantity:5,unit:'un'}]}}),403)
    })
    await t.test('admin cria escola com auditoria atômica',async()=>{
      school=await run(admin,{action:'school.create',data:schoolData('ESC-A')})
      other=await run(admin,{action:'school.create',data:schoolData('ESC-B')})
      const audit=(await p.query('SELECT * FROM bw_school_audit WHERE school_id=$1',[school.id])).rows
      assert.equal(audit.length,1);assert.equal(audit[0].actor_id,admin.id);assert.equal(audit[0].after_data.code,'ESC-A')
    })
    await t.test('sem vínculo não lista nem consulta escola por ID',async()=>{
      assert.equal((await service.read(teacher,'schools')).total,0)
      await rejected(()=>service.read(teacher,'detail',school.id),403)
    })
    await t.test('turma exige professor vinculado',async()=>{
      await rejected(()=>run(admin,{action:'links.replace',schoolId:school.id,version:1,teacherIds:[],classIds:[classA]}),400)
    })
    await t.test('turmas homônimas mantêm IDs independentes',async()=>{
      await run(admin,{action:'links.replace',schoolId:school.id,version:1,teacherIds:[teacher.id],classIds:[classA]})
      await run(admin,{action:'links.replace',schoolId:other.id,version:1,teacherIds:[teacher.id],classIds:[classB]})
      assert.equal((await service.read(teacher,'detail',school.id)).classes[0].id,classA)
      assert.equal((await service.read(teacher,'detail',other.id)).classes[0].id,classB)
    })
    await t.test('bloqueia vínculo da mesma turma com duas escolas',async()=>{
      await rejected(()=>run(admin,{action:'links.replace',schoolId:other.id,version:2,teacherIds:[teacher.id],classIds:[classA]}),409)
      assert.equal((await service.read(admin,'detail',other.id)).classes[0].id,classB)
    })
    await t.test('opções mostram apenas turmas disponíveis e da própria escola',async()=>{
      const options=await service.read(admin,'options',school.id)
      assert.deepEqual(options.classes.map(v=>v.id),[classA])
      await rejected(()=>service.read(teacher,'options',school.id),403)
    })
    await t.test('edição desatualizada é recusada',async()=>{
      await rejected(()=>run(admin,{action:'school.update',schoolId:school.id,version:1,data:schoolData('ESC-A')}),409)
    })
    await t.test('modelo aplica rascunho editável sem alterar modelo',async()=>{
      template=await run(admin,{action:'template.create',data:{name:'Kit inicial',description:'Circuitos',active:true,items:[{name:'Arduino Uno',category:'Circuitos',quantity:10,unit:'un'}]}})
      await run(admin,{action:'template.apply',schoolId:school.id,version:2,templateId:template.id})
      inventoryItem=(await service.read(admin,'inventory',school.id)).rows[0]
      assert.equal(inventoryItem.quantity,10)
      assert.equal((await service.read(teacher,'inventory',school.id)).rows.length,0)
      inventoryItem=await run(admin,{action:'item.update',schoolId:school.id,id:inventoryItem.id,version:1,data:{...item,quantity:12}})
      assert.equal((await service.read(admin,'templates')).rows[0].items[0].quantity,10)
      await rejected(()=>run(admin,{action:'template.apply',schoolId:school.id,version:3,templateId:template.id}),409)
    })
    await t.test('professor não organiza rascunho nem altera estoque diretamente',async()=>{
      await rejected(()=>run(teacher,{action:'item.organize',schoolId:school.id,id:inventoryItem.id,version:2,data:{location:'Sala',condition:'good',notes:''}}),403)
      await rejected(()=>run(teacher,{action:'item.create',schoolId:school.id,data:item}),403)
      await rejected(()=>run(teacher,{action:'inventory.publish',schoolId:school.id,version:3}),403)
    })
    await t.test('publicação libera apenas inventário da escola vinculada',async()=>{
      await run(admin,{action:'inventory.publish',schoolId:school.id,version:3})
      assert.equal((await service.read(teacher,'inventory',school.id)).rows.length,1)
      await rejected(()=>service.read(outsider,'inventory',school.id),403)
      await rejected(()=>run(admin,{action:'template.apply',schoolId:school.id,version:4,templateId:template.id}),409)
    })
    await t.test('organização permitida não altera quantidade e audita antes/depois',async()=>{
      const changed=await run(teacher,{action:'item.organize',schoolId:school.id,id:inventoryItem.id,version:2,data:{location:'Sala 2',condition:'maintenance',notes:'Revisar conexões'}})
      assert.equal(changed.quantity,12);assert.equal(changed.location,'Sala 2')
      await rejected(()=>run(teacher,{action:'item.organize',schoolId:school.id,id:inventoryItem.id,version:3,data:{location:'Sala 2',condition:'good',notes:'',quantity:999}}),400)
      const audit=(await p.query("SELECT * FROM bw_school_audit WHERE action='item.organize'")).rows[0]
      assert.equal(audit.before_data.location,'Laboratório');assert.equal(audit.after_data.location,'Sala 2')
    })
    await t.test('proteção IDOR em item de outra escola',async()=>{
      await rejected(()=>run(admin,{action:'item.update',schoolId:other.id,id:inventoryItem.id,version:3,data:item}),404)
    })
    await t.test('idempotência impede duplicação de solicitação e auditoria',async()=>{
      const body={action:'request.create',schoolId:school.id,data:{kind:'new',name:'Micro:bit',quantity:3,unit:'un',reason:'Nova atividade STEAM'}}
      const key=randomUUID();purchase=await run(teacher,body,key)
      assert.equal((await run(teacher,body,key)).id,purchase.id)
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_school_audit WHERE entity_id=$1',[purchase.id])).rows[0].n,1)
      await rejected(()=>run(teacher,{...body,data:{...body.data,quantity:4}},key),409)
      await rejected(()=>run(outsider,body,key),409)
    })
    await t.test('solicitações isoladas por professor',async()=>{
      await rejected(()=>service.read(outsider,'requests',school.id),403)
      const s=await current()
      await run(admin,{action:'links.replace',schoolId:school.id,version:s.version,teacherIds:[teacher.id,outsider.id],classIds:[classA]})
      assert.equal((await service.read(outsider,'requests',school.id)).total,0)
      assert.equal((await service.read(teacher,'requests',school.id)).total,1)
    })
    await t.test('professor não aprova sua própria solicitação',async()=>{
      await rejected(()=>run(teacher,{action:'request.review',schoolId:school.id,id:purchase.id,version:1,decision:'approve',notes:'Aprovado'}),403)
    })
    await t.test('aprovação de compra não aumenta estoque; recebimento aumenta uma vez',async()=>{
      await run(admin,{action:'request.review',schoolId:school.id,id:purchase.id,version:1,decision:'approve',notes:'Compra autorizada'})
      assert.equal((await service.read(admin,'inventory',school.id)).total,1)
      const body={action:'request.review',schoolId:school.id,id:purchase.id,version:2,decision:'fulfill',notes:'Recebido na escola'}
      const key=randomUUID();await run(admin,body,key);await run(admin,body,key)
      assert.equal((await service.read(admin,'inventory',school.id)).total,2)
      await rejected(()=>run(admin,{...body,version:3}),409)
    })
    await t.test('item já existente entra no inventário após conferência',async()=>{
      existing=await run(teacher,{action:'request.create',schoolId:school.id,data:{kind:'existing',name:'LED azul',quantity:20,unit:'un',reason:'Encontrado na sala'}})
      const result=await run(admin,{action:'request.review',schoolId:school.id,id:existing.id,version:1,decision:'approve',notes:'Conferido presencialmente'})
      assert.equal(result.status,'fulfilled');assert.equal((await service.read(admin,'inventory',school.id)).total,3)
    })
    await t.test('recusa não cria estoque',async()=>{
      const r=await run(teacher,{action:'request.create',schoolId:school.id,data:{kind:'new',name:'Kit teste',quantity:1,unit:'un',reason:'Planejamento futuro'}})
      await run(admin,{action:'request.review',schoolId:school.id,id:r.id,version:1,decision:'reject',notes:'Fora do planejamento'})
      assert.equal((await service.read(admin,'inventory',school.id)).total,3)
    })
    await t.test('validação de quantidade, patrimônio e campos excedentes',async()=>{
      for (const data of [{...item,quantity:-1},{...item,quantity:1.5},{...item,asset_tag:'PAT-1',quantity:2},{...item,school_id:other.id}]) await rejected(()=>run(admin,{action:'item.create',schoolId:school.id,data}),400)
      await run(admin,{action:'item.create',schoolId:school.id,data:{...item,quantity:1,asset_tag:'PAT-1'}})
      await assert.rejects(()=>run(admin,{action:'item.create',schoolId:other.id,data:{...item,quantity:1,asset_tag:'pat-1'}}),e=>e.code==='23505')
    })
    await t.test('duas edições com mesma versão: segunda falha sem sobrescrever',async()=>{
      await run(admin,{action:'item.update',schoolId:school.id,id:inventoryItem.id,version:3,data:{...item,quantity:15}})
      await rejected(()=>run(admin,{action:'item.update',schoolId:school.id,id:inventoryItem.id,version:3,data:{...item,quantity:999}}),409)
      assert.equal((await p.query('SELECT quantity FROM bw_inventory_items WHERE id=$1',[inventoryItem.id])).rows[0].quantity,15)
    })
    await t.test('falha da auditoria reverte toda a alteração',async()=>{
      const broken=schoolService({...db,transaction:work=>db.transaction(c=>work({query:async(sql,params)=>{if(sql.includes('INSERT INTO public.bw_school_audit'))throw new Error('Simulated audit failure');return c.query(sql,params)}}))})
      const before=(await service.read(admin,'inventory',school.id)).total
      await assert.rejects(()=>broken.command(admin,randomUUID(),{action:'item.create',schoolId:school.id,data:item}),/Simulated audit failure/)
      assert.equal((await service.read(admin,'inventory',school.id)).total,before)
    })
    await t.test('remoção preserva item e registra motivo',async()=>{
      await rejected(()=>run(teacher,{action:'item.delete',schoolId:school.id,id:inventoryItem.id,version:4,reason:'Baixa conferida'}),403)
      await run(admin,{action:'item.delete',schoolId:school.id,id:inventoryItem.id,version:4,reason:'Baixa por dano irreversível'})
      assert.equal((await p.query('SELECT active FROM bw_inventory_items WHERE id=$1',[inventoryItem.id])).rows[0].active,false)
    })
    await t.test('histórico restrito ao admin',async()=>{
      await rejected(()=>service.read(teacher,'audit',school.id),403)
      assert.ok((await service.read(admin,'audit',school.id)).total>10)
    })
    await t.test('exclusão de escola com histórico bloqueada',async()=>{
      await rejected(async()=>run(admin,{action:'school.delete',schoolId:school.id,version:(await current()).version}),409)
    })
    await t.test('desativação bloqueia acesso e escrita do professor',async()=>{
      await run(admin,{action:'school.update',schoolId:school.id,version:(await current()).version,data:{...schoolData('ESC-A'),active:false}})
      await rejected(()=>service.read(teacher,'detail',school.id),403)
      await rejected(()=>run(teacher,{action:'request.create',schoolId:school.id,data:{kind:'new',name:'Kit',quantity:1,unit:'un',reason:'Teste'}}),403)
    })
    await t.test('escola vazia pode ser excluída; histórico permanece',async()=>{
      const s=await run(admin,{action:'school.create',data:schoolData('EMPTY')})
      await run(admin,{action:'school.delete',schoolId:s.id,version:1})
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_school_audit WHERE school_id=$1',[s.id])).rows[0].n,2)
    })
    await t.test('excluir modelo preserva inventário gerado',async()=>{
      await run(admin,{action:'template.delete',id:template.id,version:1})
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_inventory_items WHERE id=$1',[inventoryItem.id])).rows[0].n,1)
    })
    await t.test('histórico geral inclui modelos e escolas excluídas, apenas para admin',async()=>{
      await rejected(()=>service.read(teacher,'audit'),403)
      const result=await service.read(admin,'audit')
      assert.ok(result.rows.some(row=>row.action==='template.delete'))
      assert.ok(result.rows.some(row=>row.action==='school.delete'))
    })
    await t.test('pesquisa não interpreta SQL e paginação retorna totais',async()=>{
      assert.equal((await service.read(admin,'schools',undefined,"' OR 1=1 --")).total,0)
      const result=await service.read(admin,'schools',undefined,'',2)
      assert.equal(result.rows.length,0);assert.equal(result.total,2)
    })
    await t.test('máquina de estados rejeita transições inválidas',()=>{
      for (const status of ['fulfilled','rejected']) for (const decision of ['approve','reject','fulfill']) assert.throws(()=>reviewStatus('new',status,decision),e=>e.status===409)
      assert.throws(()=>reviewStatus('new','pending','fulfill'),e=>e.status===409)
    })
    await t.test('notas, turmas e professores legados permanecem intactos',async()=>{
      assert.equal((await p.query('SELECT score FROM legacy_grades')).rows[0].score,'9')
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM teacher_classes')).rows[0].n,2)
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM teachers')).rows[0].n,3)
    })
    await t.test('repetição de envio revalida acesso após remoção do vínculo',async()=>{
      const body={action:'request.create',schoolId:other.id,data:{kind:'new',name:'Kit de teste',quantity:1,unit:'un',reason:'Atividade de teste'}}
      const key=randomUUID();await run(teacher,body,key)
      await run(admin,{action:'links.replace',schoolId:other.id,version:2,teacherIds:[],classIds:[]})
      await rejected(()=>run(teacher,body,key),403)
    })
    await t.test('consultas não criam estruturas nem alteram dados',async()=>{
      const queries=[]
      const observed=schoolService({...db,transaction:work=>db.transaction(c=>work({query:(sql,values)=>{queries.push(sql);return c.query(sql,values)}}))})
      for(const view of ['schools','detail','templates','inventory','requests','audit','options']) await observed.read(admin,view,school.id)
      assert.ok(queries.length>10)
      assert.ok(queries.every(sql=>/^\s*SELECT\b/i.test(sql)))
    })
    await t.test('exclusão legada de professor preserva solicitações, inventário e auditoria',async()=>{
      const temporary={id:randomUUID(),name:'Professor temporário',admin:false}
      await p.query('INSERT INTO teachers(id,name) VALUES($1,$2)',[temporary.id,temporary.name])
      await run(admin,{action:'links.replace',schoolId:other.id,version:3,teacherIds:[temporary.id],classIds:[]})
      const request=await run(temporary,{action:'request.create',schoolId:other.id,data:{kind:'existing',name:'Placa de teste',quantity:1,unit:'un',reason:'Conferência inicial'}})
      await run(admin,{action:'request.review',schoolId:other.id,id:request.id,version:1,decision:'approve',notes:'Conferido'})
      await p.query('DELETE FROM teachers WHERE id=$1',[temporary.id])
      const retained=(await service.read(admin,'requests',other.id)).rows.find(row=>row.id===request.id)
      assert.equal(retained.requester_id,null);assert.equal(retained.requester_name,temporary.name)
      assert.equal((await service.read(admin,'inventory',other.id)).total,1)
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_school_audit WHERE actor_id=$1',[temporary.id])).rows[0].n,1)
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_school_teachers WHERE teacher_id=$1',[temporary.id])).rows[0].n,0)
    })
    await t.test('exclusão legada de turma remove apenas seu vínculo escolar',async()=>{
      const classId=randomUUID()
      await p.query('INSERT INTO teacher_classes VALUES($1,$2,$3,2026)',[classId,teacher.id,'Turma temporária'])
      await p.query('INSERT INTO bw_school_classes(class_id,school_id) VALUES($1,$2)',[classId,other.id])
      await p.query('DELETE FROM teacher_classes WHERE id=$1',[classId])
      assert.equal((await p.query('SELECT COUNT(*)::int AS n FROM bw_school_classes WHERE class_id=$1',[classId])).rows[0].n,0)
      assert.equal((await p.query('SELECT score FROM legacy_grades')).rows[0].score,'9')
    })
  } finally { await p.close() }
})
