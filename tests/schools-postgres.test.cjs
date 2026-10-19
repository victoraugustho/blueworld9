// Regressão pelo protocolo PostgreSQL: usa o mesmo postgres.js/adaptador do portal.
// O servidor abaixo só existe no teste, em localhost, com PGlite em memória.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const net=require('node:net')
const fs=require('node:fs')
const path=require('node:path')
const Module=require('node:module')
const ts=require('typescript')
const postgres=require('postgres')
const {PGlite}=require('@electric-sql/pglite')

Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)

async function isolatedPostgres(p) {
  await p.waitReady
  const sockets=new Set()
  const server=net.createServer(socket=>{
    sockets.add(socket)
    let pending=Buffer.alloc(0),started=false
    socket.on('close',()=>sockets.delete(socket))
    socket.on('error',()=>{})
    socket.on('data',chunk=>{
      pending=Buffer.concat([pending,chunk])
      while(pending.length>=(started?5:4)) {
        const size=started?pending.readUInt32BE(1)+1:pending.readUInt32BE(0)
        if(pending.length<size)return
        const packet=pending.subarray(0,size)
        pending=pending.subarray(size);started=true
        if(packet[0]===88){socket.end();return}
        try {
          const reply=p.execProtocolRawSync(packet)
          if(reply.length)socket.write(reply)
        } catch(error) {socket.destroy(error);return}
      }
    })
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const sql=postgres({host:'127.0.0.1',port:server.address().port,database:'postgres',username:'postgres',ssl:false,max:1,prepare:false})
  return {sql,close:async()=>{
    await sql.end({timeout:1})
    for(const socket of sockets)socket.destroy()
    await new Promise(resolve=>server.close(resolve))
  }}
}

test('Escolas: JSON pelo driver postgres.js real',{timeout:60000},async t=>{
  const p=new PGlite()
  let isolated
  try {
    await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text,email text,active boolean DEFAULT true,approved boolean DEFAULT true);
      CREATE TABLE teacher_classes(id uuid PRIMARY KEY,teacher_id uuid,name text,school_year int);
      CREATE TABLE teacher_schedules(id uuid PRIMARY KEY,class_id uuid,weekday int,start_time time,end_time time);
      CREATE TABLE audit_logs(id uuid PRIMARY KEY,actor_id uuid,actor_email text,actor_name text,actor_role text,session_id uuid,
        action text,target_type text,target_id text,request_method text,request_path text,status text,metadata jsonb);`)
    await p.exec(fs.readFileSync(path.join(__dirname,'../scripts/046_schools_inventory.sql'),'utf8'))
    await p.exec(fs.readFileSync(path.join(__dirname,'../scripts/047_inventory_units_and_categories.sql'),'utf8'))
    await p.exec(fs.readFileSync(path.join(__dirname,'../scripts/048_inventory_kit_components.sql'),'utf8'))
    isolated=await isolatedPostgres(p)
    const {sql}=isolated
    const originalLoad=Module._load
    let schools,writeSchoolAuditMirror
    Module._load=function(id,...args){if(id==='@/lib/db')return {db:sql};return originalLoad.call(this,id,...args)}
    try {
      schools=require('../lib/schools/server.ts').schools
      writeSchoolAuditMirror=require('../lib/schools/audit.ts').writeSchoolAuditMirror
    } finally {Module._load=originalLoad}
    const actor={id:randomUUID(),name:'Admin de regressão',admin:true}
    await sql`INSERT INTO teachers(id,name,email) VALUES(${actor.id},${actor.name},'teste@example.test')`
    const run=(body,key=randomUUID())=>schools.command(actor,key,body)
    let school,template,commandKey
    const category=await run({action:'category.create',data:{name:'Teste Automático',name_es:'Prueba automática',description:'',description_es:'',default_tracking:'bulk',default_unit:'un',active:true}})
    const items=[{name:'T1',category:'Teste Automático',category_id:category.id,tracking_mode:'bulk',quantity:3,unit:'un'}]
    await t.test('reproduz a violação quando uma lista é pré-convertida em texto JSON',async()=>{
      await assert.rejects(()=>sql.unsafe('INSERT INTO bw_inventory_templates(id,name,items) VALUES($1,$2,$3::jsonb)',[randomUUID(),'Teste antigo',JSON.stringify(items)]),error=>error.code==='23514')
      assert.equal((await sql`SELECT count(*)::int AS total FROM bw_inventory_templates`)[0].total,0)
    })
    await t.test('cria modelo com items do tipo array e retorna lista original',async()=>{
      template=await run({action:'template.create',data:{name:'Teste',description:'Teste',active:true,items}})
      assert.deepEqual(template.items,items)
      const [stored]=await sql`SELECT jsonb_typeof(items) AS kind FROM bw_inventory_templates WHERE id=${template.id}`
      assert.equal(stored.kind,'array')
    })
    await t.test('edita modelo e mantém array, auditoria estruturada e versão',async()=>{
      const updated=[...items,{name:'Micro:bit',category:'Circuitos',category_id:'b9000000-0000-4000-8000-000000000003',tracking_mode:'bulk',quantity:2,unit:'un'}]
      template=await run({action:'template.update',id:template.id,version:1,data:{name:'Modelo revisado',description:'Teste',active:true,items:updated}})
      assert.deepEqual(template.items,updated);assert.equal(template.version,2)
      const [audit]=await sql`SELECT jsonb_typeof(before_data) AS before_kind,jsonb_typeof(after_data) AS after_kind,before_data,after_data FROM bw_school_audit WHERE entity_id=${template.id} AND action='template.update'`
      assert.equal(audit.before_kind,'object');assert.equal(audit.after_kind,'object')
      assert.deepEqual(audit.before_data.items,items);assert.deepEqual(audit.after_data.items,updated)
    })
    await t.test('reenvio retorna objeto e não duplica escola nem auditoria',async()=>{
      const body={action:'school.create',data:{name:'Escola Teste',code:'REG',country:'BR',address:'',notes:'',active:true}}
      commandKey=randomUUID();school=await run(body,commandKey)
      const repeated=await run(body,commandKey)
      assert.deepEqual(repeated,JSON.parse(JSON.stringify(school)))
      const [ledger]=await sql`SELECT jsonb_typeof(result) AS kind FROM bw_school_commands WHERE id=${commandKey}`
      assert.equal(ledger.kind,'object')
      assert.equal((await sql`SELECT count(*)::int AS total FROM bw_school_audit WHERE entity_id=${school.id}`)[0].total,1)
    })
    await t.test('aplica modelo e publica itens corretamente pelo adaptador de produção',async()=>{
      await run({action:'template.apply',schoolId:school.id,version:1,templateId:template.id})
      const inventory=await schools.read(actor,'inventory',school.id)
      assert.equal(inventory.total,2)
      assert.equal(inventory.rows.find(item=>item.name==='T1').quantity,3)
      await run({action:'inventory.publish',schoolId:school.id,version:2})
      assert.equal((await schools.read(actor,'detail',school.id)).school.inventory_status,'published')
    })
    await t.test('driver real gera 12 unidades e sincroniza somente a unidade alterada',async()=>{
      const created=await run({action:'item.create',schoolId:school.id,data:{name:'Notebooks',category:'',category_id:'b9000000-0000-4000-8000-000000000002',tracking_mode:'individual',quantity:12,unit:'un',asset_tag:'',serial_number:'',location:'Laboratório',condition:'good',notes:''}})
      const units=await schools.read(actor,'assets',school.id,'',1,{itemId:created.id})
      assert.equal(units.total,12);assert.equal(new Set(units.rows.map(row=>row.code)).size,12)
      const changed=await run({action:'asset.update',schoolId:school.id,id:units.rows[0].id,version:1,data:{condition:'damaged',location:'Laboratório',notes:'Tela danificada',reason:'Somente uma unidade'}})
      assert.equal(changed.item.quantity,12);assert.equal(changed.item.good_quantity,11);assert.equal(changed.item.damaged_quantity,1)
      const history=await schools.read(actor,'movements',school.id,'',1,{itemId:created.id})
      assert.equal(history.rows.find(row=>row.action==='asset.update').after_data.item.damaged_quantity,1)
    })
    await t.test('composição do kit é array JSONB pelo driver real e conta somente 1 unidade',async()=>{
      const components=[{name:'Arduino UNO',quantity:1,unit:'un'},{name:'Jumpers',quantity:10,unit:'un'}]
      const body={action:'item.create',schoolId:school.id,data:{name:'Kit Arduino',category:'',category_id:category.id,tracking_mode:'individual',quantity:1,unit:'kit',asset_tag:'',serial_number:'',location:'',condition:'good',notes:'',components}}
      const key=randomUUID(),kit=await run(body,key);await run(body,key)
      const [stored]=await sql`SELECT components,jsonb_typeof(components) AS kind,quantity FROM bw_inventory_items WHERE id=${kit.id}`
      assert.equal(stored.kind,'array');assert.deepEqual(stored.components,components);assert.equal(stored.quantity,1)
      assert.equal((await schools.read(actor,'assets',school.id,'',1,{itemId:kit.id})).total,1)
      const [audit]=await sql`SELECT after_data FROM bw_school_audit WHERE entity_id=${kit.id}`
      assert.deepEqual(audit.after_data.components,components)
    })
    await t.test('metadata da auditoria geral é objeto JSON e o espelho continua idempotente',async()=>{
      const input={req:{method:'POST',nextUrl:{pathname:'/api/portal/schools'}},actor:{...actor,email:'teste@example.test',role:'admin',sessionId:randomUUID()},commandKey,action:'schools.school.create',targetId:school.id}
      await writeSchoolAuditMirror(input);await writeSchoolAuditMirror(input)
      const rows=await sql`SELECT jsonb_typeof(metadata) AS kind,metadata FROM audit_logs WHERE id=${commandKey}`
      assert.equal(rows.length,1);assert.equal(rows[0].kind,'object');assert.deepEqual(rows[0].metadata,{command_id:commandKey})
    })
    await t.test('lê snapshots antigos duplamente codificados sem modificar os registros',async()=>{
      const old={id:school.id,name:'Nome anterior'},auditId=randomUUID()
      await sql`INSERT INTO bw_school_audit(id,school_id,actor_id,actor_name,action,entity_id,before_data,after_data)
        VALUES(${auditId},${school.id},${actor.id},${actor.name},'school.update',${school.id},${sql.json(JSON.stringify(old))},${sql.json(JSON.stringify({name:'Nome novo'}))})`
      for(const id of [school.id,undefined]) {
        const audit=(await schools.read(actor,'audit',id)).rows.find(row=>row.id===auditId)
        assert.deepEqual(audit.before_data,old);assert.deepEqual(audit.after_data,{name:'Nome novo'})
      }
      assert.equal((await sql`SELECT jsonb_typeof(before_data) AS kind FROM bw_school_audit WHERE id=${auditId}`)[0].kind,'string')
    })
    await t.test('reenvio de comando antigo converte resposta em objeto sem alterar o banco',async()=>{
      const body={action:'school.create',data:{name:'Escola Legada',code:'LEG',country:'BR',address:'',notes:'',active:true}},key=randomUUID()
      const first=await run(body,key)
      await sql`UPDATE bw_school_commands SET result=${sql.json(JSON.stringify(first))} WHERE id=${key}`
      assert.deepEqual(await run(body,key),JSON.parse(JSON.stringify(first)))
      assert.equal((await sql`SELECT jsonb_typeof(result) AS kind FROM bw_school_commands WHERE id=${key}`)[0].kind,'string')
    })
  } finally {
    await isolated?.close()
    await p.close()
  }
})
