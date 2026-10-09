// Rotas reais + postgres.js + PostgreSQL em memória. Não lê .env nem DATABASE_URL.
const {test}=require('node:test'),assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto'),net=require('node:net')
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
const postgres=require('postgres'),{PGlite}=require('@electric-sql/pglite')
const {NextRequest,NextResponse}=require('next/server')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)

async function isolatedPostgres(p,queries) {
 await p.waitReady
 const sockets=new Set()
 const server=net.createServer(socket=>{
  sockets.add(socket)
  let pending=Buffer.alloc(0),started=false
  socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>{})
  socket.on('data',chunk=>{
   pending=Buffer.concat([pending,chunk])
   while(pending.length>=(started?5:4)) {
    const size=started?pending.readUInt32BE(1)+1:pending.readUInt32BE(0)
    if(pending.length<size)return
    const packet=pending.subarray(0,size)
    pending=pending.subarray(size);started=true
    if(packet[0]===88){socket.end();return}
    try {const reply=p.execProtocolRawSync(packet);if(reply.length)socket.write(reply)}
    catch(error){socket.destroy(error);return}
   }
  })
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const sql=postgres({host:'127.0.0.1',port:server.address().port,database:'postgres',username:'postgres',ssl:false,max:1,
  debug:(_connection,query)=>queries.push(query),onnotice:()=>{}})
 return {sql,close:async()=>{
  await sql.end({timeout:1});for(const socket of sockets)socket.destroy()
  await new Promise(resolve=>server.close(resolve))
 }}
}

test('Aprovação e edição: permissões JSONB pelo driver real',{timeout:60000},async t=>{
 const p=new PGlite(),queries=[],audits=[]
 let isolated
 try {
  await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text,email text,phone text,country text DEFAULT 'BR',locale text DEFAULT 'pt-BR',
   document_type text DEFAULT 'CPF',document_number text,approved boolean DEFAULT false,active boolean DEFAULT true,
   role text DEFAULT 'teacher',is_admin boolean DEFAULT false,password_hash text DEFAULT 'hash-de-teste',
   created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
   CREATE TABLE categories(id int PRIMARY KEY,name text);
   CREATE TABLE teacher_categories(teacher_id uuid,category_id int);
   CREATE TABLE teacher_student_years(teacher_id uuid,student_year smallint);
   CREATE TABLE preserved_grades(score numeric);INSERT INTO preserved_grades VALUES(9.5);`)
  await p.exec(fs.readFileSync(path.join(__dirname,'../scripts/045_teacher_portal_permissions.sql'),'utf8'))
  isolated=await isolatedPostgres(p,queries)
  const {sql}=isolated,id=randomUUID(),otherId=randomUUID()
  for(const teacherId of [id,otherId]) await sql`INSERT INTO teachers(id,name,email,phone,document_number)
   VALUES(${teacherId},'Professor de teste','teste@example.test','11999990000','12345678900')`
  const admin={ok:true,teacherId:randomUUID(),sessionId:randomUUID(),teacher:{name:'Admin de teste',email:'admin@example.test'}}
  let auth=admin
  const load=Module._load
  let PATCH,PUT
  Module._load=function(name,...args) {
   if(name==='@/lib/db')return {db:sql}
   if(name==='@/lib/auth/require')return {requireAdminApi:async()=>auth}
   if(name==='@/lib/audit')return {writeAuditLog:async input=>audits.push(input)}
   if(name==='@/lib/runtime-schema')return {ensureRuntimeSchema:async()=>{}}
   if(name.startsWith('@/'))return load.call(this,path.join(__dirname,'..',name.slice(2)),...args)
   return load.call(this,name,...args)
  }
  try {
   PATCH=require('../app/api/admin/teachers/[id]/approve/route.ts').PATCH
   PUT=require('../app/api/admin/teachers/[id]/route.ts').PUT
  } finally {Module._load=load}
  const portal_permissions={aulas:true,agenda_notas:false,materiais:true,projetos:false,ia:false}
  const content_permissions={aulas:{mode:'specific',category_ids:['25','20'],item_ids:[]},
   materiais:{mode:'specific',category_ids:[],item_ids:[randomUUID()]},projetos:{mode:'inherit',category_ids:[],item_ids:[]}}
  const body={decision:'approve',can_download:false,portal_permissions,content_permissions}
  const request=(value,method='PATCH')=>new NextRequest(`https://portal.example.test/api/admin/teachers/${id}/approve`,{
   method,headers:{'Content-Type':'application/json'},body:JSON.stringify(value)})
  const call=(value=body,teacherId=id)=>PATCH(request(value),{params:Promise.resolve({id:teacherId})})
  const current=async teacherId=>(await sql`SELECT * FROM teachers WHERE id=${teacherId??id}`)[0]
  const untouched=await current(otherId)
  await t.test('reproduz o erro de produção com JSON duplamente serializado sem alterar o cadastro',async()=>{
   await assert.rejects(()=>sql`UPDATE teachers SET approved=true,portal_permissions=${JSON.stringify(portal_permissions)}::jsonb,
    content_permissions=${JSON.stringify(content_permissions)}::jsonb WHERE id=${id}`,error=>error.code==='23514')
   assert.equal((await current()).approved,false)
   assert.equal((await sql`SELECT jsonb_typeof(content_permissions) kind FROM teachers WHERE id=${id}`)[0].kind,'object')
  })
  await t.test('aprova com objetos JSON, preserva restrições selecionadas e audita a decisão',async()=>{
   const response=await call();assert.equal(response.status,200)
   const result=await response.json()
   assert.equal(result.approved,true);assert.equal(result.active,true);assert.equal(result.can_download,false)
   assert.deepEqual(result.portal_permissions,portal_permissions);assert.deepEqual(result.content_permissions,content_permissions)
   const stored=await current()
   assert.deepEqual(stored.portal_permissions,portal_permissions);assert.deepEqual(stored.content_permissions,content_permissions)
   assert.equal(stored.role,'teacher');assert.equal(stored.is_admin,false);assert.equal(stored.password_hash,'hash-de-teste')
   assert.deepEqual(await current(otherId),untouched)
   assert.equal(audits.length,1);assert.equal(audits[0].action,'admin.teachers.approve')
   assert.deepEqual(audits[0].metadata.content_permissions,content_permissions)
  })
  await t.test('permissões incompletas, decisão inválida, null e UUID inválido retornam 400 sem alterar dados',async()=>{
   const before=await current(),count=audits.length
   for(const invalid of [null,[],{}, {...body,portal_permissions:{}},{...body,content_permissions:{}},{...body,decision:'admin'}])
    assert.equal((await call(invalid)).status,400)
   assert.equal((await call(body,'id-inválido')).status,400)
   assert.deepEqual(await current(),before);assert.equal(audits.length,count)
  })
  await t.test('sessão expirada e acesso não admin mantêm 401/403 sem escrita',async()=>{
   const before=await current()
   for(const status of [401,403]) {
    auth={ok:false,response:NextResponse.json({error:'Sem acesso'},{status})}
    const start=queries.length
    assert.equal((await call()).status,status);assert.equal(queries.length,start)
   }
   auth=admin;assert.deepEqual(await current(),before)
  })
  await t.test('professor inexistente retorna 404 e não produz auditoria de sucesso',async()=>{
   const count=audits.length
   assert.equal((await call(body,randomUUID())).status,404);assert.equal(audits.length,count)
  })
  await t.test('rejeição também salva permissões como objetos e desativa somente o professor escolhido',async()=>{
   const response=await call({...body,decision:'reject'})
   assert.equal(response.status,200)
   const result=await response.json()
   assert.equal(result.approved,false);assert.equal(result.active,false)
   assert.deepEqual(result.content_permissions,content_permissions)
   assert.equal(audits.at(-1).action,'admin.teachers.reject')
   assert.deepEqual(await current(otherId),untouched)
  })
  await t.test('edição pelo PUT usa a mesma serialização correta e não altera role, senha ou notas',async()=>{
   const payload={name:'Professor editado',email:'editado@example.test',phone:'11999990000',country:'BR',document_number:'12345678900',
    approved:true,active:true,can_download:false,portal_permissions,content_permissions,category_ids:[],student_years:[]}
   const response=await PUT(request(payload,'PUT'),{params:Promise.resolve({id})})
   assert.equal(response.status,200)
   const result=await response.json()
   assert.deepEqual(result.portal_permissions,portal_permissions);assert.deepEqual(result.content_permissions,content_permissions)
   const stored=await current()
   assert.equal(stored.role,'teacher');assert.equal(stored.password_hash,'hash-de-teste')
   assert.equal((await sql`SELECT score FROM preserved_grades`)[0].score,'9.5')
   assert.equal(audits.at(-1).action,'admin.teachers.update')
  })
  await t.test('migração ausente retorna 409 e não tenta criar colunas ou redefinir permissões',async()=>{
   await p.exec('ALTER TABLE teachers RENAME COLUMN content_permissions TO retained_content_permissions')
   try {
    const start=queries.length,count=audits.length
    const response=await call();assert.equal(response.status,409)
    assert.match((await response.json()).error,/045/);assert.equal(audits.length,count)
    assert.ok(queries.slice(start).every(query=>!/^\s*(CREATE|ALTER|UPDATE|DELETE|INSERT)/i.test(query)))
   } finally {await p.exec('ALTER TABLE teachers RENAME COLUMN retained_content_permissions TO content_permissions')}
  })
  await t.test('falha inesperada retorna JSON sem expor o registro sensível e permite nova tentativa',async()=>{
   await p.exec(`CREATE FUNCTION reject_teacher_update() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
    RAISE EXCEPTION 'Falha simulada' USING DETAIL='segredo-do-registro'; END $$;
    CREATE TRIGGER reject_teacher_update BEFORE UPDATE ON teachers FOR EACH ROW EXECUTE FUNCTION reject_teacher_update();`)
   const before=await current(),count=audits.length,logs=[],log=console.error
   console.error=(...args)=>logs.push(args)
   try {
    const response=await call();assert.equal(response.status,500)
    const result=await response.json()
    assert.equal(result.code,'APPROVAL_FAILED');assert.doesNotMatch(JSON.stringify(result),/segredo|hash-de-teste/)
    assert.equal(logs.length,1);assert.doesNotMatch(JSON.stringify(logs),/segredo|hash-de-teste/)
    assert.deepEqual(await current(),before);assert.equal(audits.length,count)
   } finally {console.error=log;await p.exec('DROP TRIGGER reject_teacher_update ON teachers')}
   assert.equal((await call()).status,200)
  })
 } finally {await isolated?.close();await p.close()}
})
