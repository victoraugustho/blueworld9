// Autorização e transações reais em banco isolado. Nunca usa DATABASE_URL.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript')
const {PGlite}=require('@electric-sql/pglite'),{NextRequest,NextResponse}=require('next/server')
const {isolatedPostgres}=require('./helpers/isolated-postgres.cjs')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
const saved={single:process.env.SUPER_ADMIN_ID,multiple:process.env.SUPER_ADMIN_IDS}
const restoreEnv=()=>{
 for(const [key,value] of [['SUPER_ADMIN_ID',saved.single],['SUPER_ADMIN_IDS',saved.multiple]])
  if(value===undefined)delete process.env[key];else process.env[key]=value
}
test('SuperAdmin: gestão de coordenação, proteção de contas e auditoria atômica',{timeout:60000},async t=>{
 const p=new PGlite(),queries=[]
 let isolated
 try {
  await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text DEFAULT 'Professor de teste',email text DEFAULT 'teste@example.test',phone text DEFAULT '11999990000',
   country text DEFAULT 'BR',locale text DEFAULT 'pt-BR',document_type text DEFAULT 'CPF',document_number text DEFAULT '12345678900',avatar_url text,
   approved boolean DEFAULT true,active boolean DEFAULT true,role text DEFAULT 'teacher',is_admin boolean DEFAULT false,
   password_hash text DEFAULT 'hash-preservado',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
   CREATE TABLE teacher_sessions(id uuid PRIMARY KEY,teacher_id uuid REFERENCES teachers(id),expires_at timestamptz DEFAULT now()+interval '1 hour',revoked_at timestamptz);
   CREATE TABLE categories(id int PRIMARY KEY,name text);
   CREATE TABLE teacher_categories(teacher_id uuid,category_id int);
   CREATE TABLE teacher_student_years(teacher_id uuid,student_year smallint);
   CREATE TABLE preserved_grades(score numeric);INSERT INTO preserved_grades VALUES(9.5);`)
  for(const file of ['009_audit_logs.sql','045_teacher_portal_permissions.sql']) await p.exec(fs.readFileSync(path.join(__dirname,'../scripts',file),'utf8'))
  isolated=await isolatedPostgres(p,queries)
  const {sql}=isolated,owner=randomUUID(),secondOwner=randomUUID(),admin=randomUUID(),teacher=randomUUID(),pending=randomUUID(),disabled=randomUUID(),future=randomUUID()
  for(const id of [owner,secondOwner,admin,teacher,pending,disabled,future]) await sql`INSERT INTO teachers(id) VALUES(${id})`
  await sql`UPDATE teachers SET role='admin',is_admin=true WHERE id=ANY(${[owner,secondOwner,admin]}::uuid[])`
  await sql`UPDATE teachers SET approved=false WHERE id=${pending}`
  await sql`UPDATE teachers SET active=false WHERE id=${disabled}`
  await sql`UPDATE teachers SET role='auditor' WHERE id=${future}`
  const ownerSession=randomUUID(),adminSession=randomUUID(),targetSession=randomUUID(),secondSession=randomUUID()
  for(const [id,user] of [[ownerSession,owner],[adminSession,admin],[targetSession,teacher],[secondSession,teacher]])
   await sql`INSERT INTO teacher_sessions(id,teacher_id) VALUES(${id},${user})`
  const row=async id=>(await sql`SELECT * FROM teachers WHERE id=${id}`)[0]
  let auth={ok:true,teacherId:owner,sessionId:ownerSession,teacher:await row(owner)}
  process.env.SUPER_ADMIN_ID=owner;process.env.SUPER_ADMIN_IDS=secondOwner
  let rolePatch,listTeachers,editTeacher,deleteTeacher,disableTeacher,approveTeacher,security,auditGet
  const originalLoad=Module._load
  Module._load=function(name,...args){
   if(name==='@/lib/db')return {db:sql}
   if(name==='@/lib/auth/require')return {requireAdminApi:async()=>auth}
   if(name==='@/lib/runtime-schema')return {ensureRuntimeSchema:async()=>{}}
   if(name==='@/lib/audit')return {writeAuditLog:async()=>{}}
   if(name.startsWith('@/'))return originalLoad.call(this,path.join(__dirname,'..',name.slice(2)),...args)
   return originalLoad.call(this,name,...args)
  }
  try {
   rolePatch=require('../app/api/admin/teachers/[id]/role/route.ts').PATCH
   listTeachers=require('../app/api/admin/teachers/route.ts').GET
   const detail=require('../app/api/admin/teachers/[id]/route.ts');editTeacher=detail.PUT;deleteTeacher=detail.DELETE
   disableTeacher=require('../app/api/admin/teachers/[id]/disable/route.ts').PATCH
   approveTeacher=require('../app/api/admin/teachers/[id]/approve/route.ts').PATCH
   auditGet=require('../app/api/admin/audit/route.ts').GET
   security=require('../lib/auth/super-admin.ts')
  } finally {Module._load=originalLoad}
  const ctx=id=>({params:Promise.resolve({id})})
  const request=(id,body,headers={},method='PATCH')=>new NextRequest(`https://portal.example.test/api/admin/teachers/${id}/role`,{
   method,headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)})
  const call=(body={role:'admin',expected_role:'teacher'},id=teacher,headers={})=>rolePatch(request(id,body,headers),ctx(id))
  const auditCount=async()=>(await sql`SELECT count(*)::int n FROM audit_logs`)[0].n
  const countSessions=async id=>(await sql`SELECT count(*)::int n FROM teacher_sessions WHERE teacher_id=${id} AND revoked_at IS NULL`)[0].n
  const initial=await row(teacher),other=await row(pending)
  await t.test('allowlist é exclusiva do servidor, aceita singular/lista e falha fechada',async()=>{
   assert.equal(security.isSuperAdmin(auth.teacher),true)
   process.env.SUPER_ADMIN_ID='inválido';process.env.SUPER_ADMIN_IDS=''
   assert.equal(security.isSuperAdmin(auth.teacher),false)
   assert.equal((await call()).status,403)
   process.env.SUPER_ADMIN_ID=` ${owner.toUpperCase()} `;process.env.SUPER_ADMIN_IDS=`inválido, ${secondOwner}`
   assert.equal(security.isConfiguredSuperAdminId(owner),true);assert.equal(security.isConfiguredSuperAdminId(secondOwner),true)
   assert.equal(security.isSuperAdmin({...auth.teacher,role:'teacher',is_admin:true}),false)
   process.env.SUPER_ADMIN_ID=owner
  })
  await t.test('lista informa capacidade e proteção por conta sem expor configurações do ambiente',async()=>{
   let response=await listTeachers(),data=await response.json()
   assert.equal(response.status,200);assert.equal(data.can_manage_roles,true)
   assert.equal(data.approved.find(t=>t.id===owner).is_super_admin,true)
   assert.equal(data.approved.find(t=>t.id===secondOwner).role_management_protected,true)
   assert.equal(data.approved.find(t=>t.id===teacher).role,'teacher')
   assert.equal(response.headers.get('cache-control'),'private, no-store')
   auth={ok:true,teacherId:admin,sessionId:adminSession,teacher:await row(admin)}
   data=await (await listTeachers()).json();assert.equal(data.can_manage_roles,false)
   assert.equal((await call()).status,403)
   auth={ok:true,teacherId:owner,sessionId:ownerSession,teacher:await row(owner)}
  })
  await t.test('sessão ausente ou acesso não admin retorna 401/403 antes de consultar o banco',async()=>{
   const previous=auth
   try {
    for(const status of [401,403]) {
     auth={ok:false,response:NextResponse.json({error:'Sem acesso'},{status})}
     const start=queries.length
     assert.equal((await call()).status,status);assert.equal(queries.length,start)
    }
   } finally {auth=previous}
  })
  await t.test('entrada inválida, origem externa, autoalteração e contas protegidas não gravam',async()=>{
   const count=await auditCount()
   for(const value of [null,{},[],{role:'superadmin',expected_role:'teacher'},{role:'admin',expected_role:'teacher',is_super_admin:true}])
    assert.equal((await call(value)).status,400)
   assert.equal((await call(undefined,'inválido')).status,400)
   assert.equal((await call(undefined,teacher,{origin:'https://externo.example.test'})).status,403)
   assert.equal((await call({role:'admin',expected_role:'teacher',payload:'A'.repeat(4100)})).status,413)
   for(const id of [owner,secondOwner]) assert.equal((await call({role:'teacher',expected_role:'admin'},id)).status,409)
   assert.equal(await auditCount(),count);assert.deepEqual(await row(teacher),initial)
  })
  await t.test('cadastros pendentes, desativados e roles futuros não são promovidos',async()=>{
   for(const id of [pending,disabled,future]) assert.equal((await call(undefined,id)).status,409)
   assert.equal((await call(undefined,randomUUID())).status,404)
   assert.deepEqual(await row(pending),other)
  })
  await t.test('pedido sem mudança efetiva não revoga sessões nem gera auditoria de alteração',async()=>{
   const response=await call({role:'teacher',expected_role:'teacher'})
   assert.equal(response.status,200);assert.equal((await response.json()).changed,false)
   assert.equal(await countSessions(teacher),2);assert.equal(await auditCount(),0)
   assert.deepEqual(await row(teacher),initial)
  })
  await t.test('promove com ambos os campos sincronizados, revoga só sessões do alvo e audita objetos JSON',async()=>{
   const result=await call();assert.equal(result.status,200)
   const data=await result.json();assert.equal(data.role,'admin');assert.equal(data.is_admin,true)
   const stored=await row(teacher)
   for(const field of Object.keys(initial).filter(k=>!['role','is_admin','updated_at'].includes(k))) assert.deepEqual(stored[field],initial[field])
   assert.equal(await countSessions(teacher),0);assert.equal(await countSessions(owner),1);assert.equal(await countSessions(admin),1)
   const [audit]=await sql`SELECT *,jsonb_typeof(metadata) kind FROM audit_logs WHERE target_id=${teacher}`
   assert.equal(audit.kind,'object');assert.equal(audit.action,'admin.teachers.role.change');assert.equal(audit.actor_id,owner)
   assert.equal(audit.metadata.before.role,'teacher');assert.equal(audit.metadata.after.is_admin,true);assert.equal(audit.metadata.revoked_sessions,2)
   const auditResponse=await auditGet(new NextRequest('https://portal.example.test/api/admin/audit'))
   assert.equal(auditResponse.status,200)
   const auditList=await auditResponse.json()
   assert.equal(auditList.items.find(item=>item.id===audit.id).relevance_level,'critical')
   assert.deepEqual(await row(pending),other)
   assert.equal((await sql`SELECT score FROM preserved_grades`)[0].score,'9.5')
  })
  await t.test('conflito não inverte papel inadvertidamente e rebaixamento preserva permissões',async()=>{
   assert.equal((await call()).status,409)
   const response=await call({role:'teacher',expected_role:'admin'})
   assert.equal(response.status,200)
   const stored=await row(teacher)
   assert.equal(stored.role,'teacher');assert.equal(stored.is_admin,false)
   assert.deepEqual(stored.portal_permissions,initial.portal_permissions);assert.deepEqual(stored.content_permissions,initial.content_permissions)
   assert.equal(await auditCount(),2)
  })
  await t.test('rebaixamento de conta desativada e compatibilidade com is_admin legado não reativam contas',async()=>{
   await sql`UPDATE teachers SET role='admin',is_admin=true WHERE id=${disabled}`
   assert.equal((await call({role:'teacher',expected_role:'admin'},disabled)).status,200)
   assert.equal((await row(disabled)).active,false)
   await sql`UPDATE teachers SET role='teacher',is_admin=true WHERE id=${teacher}`
   assert.equal((await call({role:'teacher',expected_role:'admin'})).status,200)
   assert.equal((await row(teacher)).is_admin,false)
  })
  await t.test('ator e sessão são revalidados dentro da transação',async()=>{
   await sql`UPDATE teachers SET role='teacher',is_admin=false WHERE id=${owner}`
   assert.equal((await call()).status,403)
   await sql`UPDATE teachers SET role='admin',is_admin=true WHERE id=${owner}`
   await sql`UPDATE teacher_sessions SET revoked_at=NOW() WHERE id=${ownerSession}`
   assert.equal((await call()).status,401)
   await sql`UPDATE teacher_sessions SET revoked_at=NULL WHERE id=${ownerSession}`
  })
  await t.test('falha da auditoria reverte papel e revogação das sessões',async()=>{
   await sql`UPDATE teacher_sessions SET revoked_at=NULL WHERE id=${targetSession}`
   await p.exec(`CREATE FUNCTION fail_role_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Auditoria indisponível'; END $$;
    CREATE TRIGGER fail_role_audit BEFORE INSERT ON audit_logs FOR EACH ROW EXECUTE FUNCTION fail_role_audit();`)
   const before=await row(teacher),count=await auditCount(),log=console.error
   console.error=()=>{}
   try {
    const response=await call();assert.equal(response.status,500)
    assert.equal((await response.json()).code,'ROLE_CHANGE_FAILED')
    assert.deepEqual(await row(teacher),before);assert.equal(await countSessions(teacher),1);assert.equal(await auditCount(),count)
   } finally {console.error=log;await p.exec('DROP TRIGGER fail_role_audit ON audit_logs')}
  })
  await t.test('admins comuns não podem tomar ou remover contas protegidas por rotas antigas',async()=>{
   auth={ok:true,teacherId:admin,sessionId:adminSession,teacher:await row(admin)}
   const before=await row(owner)
   assert.equal((await editTeacher(request(owner,{email:'atacante@example.test'}, {},'PUT'),ctx(owner))).status,403)
   assert.equal((await disableTeacher(request(owner,{active:false}),ctx(owner))).status,403)
   assert.equal((await approveTeacher(request(owner,{decision:'reject'}),ctx(owner))).status,403)
   assert.equal((await deleteTeacher(request(owner,{}),ctx(owner))).status,409)
   assert.deepEqual(await row(owner),before)
   auth={ok:true,teacherId:owner,sessionId:ownerSession,teacher:await row(owner)}
   assert.equal((await disableTeacher(request(secondOwner,{active:false}),ctx(secondOwner))).status,409)
   assert.equal((await deleteTeacher(request(secondOwner,{}),ctx(secondOwner))).status,409)
   const payload={...initial,approved:false,role:undefined,is_admin:undefined}
   assert.equal((await editTeacher(request(secondOwner,payload,{},'PUT'),ctx(secondOwner))).status,409)
   const approvedPayload={decision:'reject',can_download:true,portal_permissions:initial.portal_permissions,content_permissions:initial.content_permissions}
   assert.equal((await approveTeacher(request(secondOwner,approvedPayload),ctx(secondOwner))).status,409)
  })
  await t.test('sem configuração, a gestão fica desligada sem modificar contas e nenhuma rota executa DDL',async()=>{
   delete process.env.SUPER_ADMIN_ID;delete process.env.SUPER_ADMIN_IDS
   assert.equal((await call()).status,403)
   const data=await (await listTeachers()).json();assert.equal(data.can_manage_roles,false)
   assert.ok(data.approved.every(t=>t.role_management_protected===false))
   assert.ok(queries.every(query=>!/^\s*(CREATE|ALTER|DROP|TRUNCATE)/i.test(query)))
  })
 } finally {restoreEnv();await isolated?.close();await p.close()}
})
