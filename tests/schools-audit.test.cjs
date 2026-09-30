const {test}=require('node:test')
const assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const Module=require('node:module')
const fs=require('node:fs')
const ts=require('typescript')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
let query,values,fail=false
const originalLoad=Module._load
Module._load=function(id,...args){
  if(id==='@/lib/db')return {db:async(strings,...params)=>{query=strings.join('?');values=params;if(fail)throw new Error('Audit unavailable')}}
  return originalLoad.call(this,id,...args)
}
const {writeSchoolAuditMirror}=require('../lib/schools/audit.ts')
Module._load=originalLoad
const input={req:{method:'POST',nextUrl:{pathname:'/api/portal/schools'}},actor:{id:randomUUID(),name:'Admin',email:'admin@example.test',role:'admin',sessionId:randomUUID()},commandKey:randomUUID(),action:'schools.item.create',targetId:randomUUID()}
test('espelho da auditoria apenas insere e é idempotente por comando',async()=>{
  await writeSchoolAuditMirror(input)
  assert.match(query,/^\s*INSERT INTO public.audit_logs/)
  assert.match(query,/ON CONFLICT \(id\) DO NOTHING/)
  assert.doesNotMatch(query,/\b(DELETE|ALTER|CREATE|UPDATE)\b/)
  assert.equal(values[0],input.commandKey)
})
test('falha do espelho não transforma comando já confirmado em erro',async()=>{
  fail=true
  const oldError=console.error,logs=[]
  console.error=(...args)=>logs.push(args)
  try {await assert.doesNotReject(()=>writeSchoolAuditMirror(input));assert.equal(logs.length,1)}
  finally {console.error=oldError;fail=false}
})
