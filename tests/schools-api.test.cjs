// Contratos HTTP reais com autenticação e persistência isoladas do portal.
const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const fs = require('node:fs')
const Module = require('node:module')
const ts = require('typescript')
const { NextRequest, NextResponse } = require('next/server')
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
const contracts = require('../lib/schools/contracts.ts')
const authorization = require('../lib/auth/authorization.ts')
let enabled=false, auth, reads=0, writes=0, audits=0, error
const originalLoad=Module._load
Module._load=function(id,...args) {
  if(id==='@/lib/auth/require') return {requireTeacherApi:async()=>auth}
  if(id==='@/lib/auth/authorization') return authorization
  if(id==='@/lib/schools/audit') return {writeSchoolAuditMirror:async()=>{audits++}}
  if(id==='@/lib/schools/contracts') return contracts
  if(id==='@/lib/schools/server') return {
    schoolsEnabled:()=>enabled,
    schools:{read:async()=>{reads++;if(error)throw error;return {rows:[],total:0}},command:async()=>{writes++;if(error)throw error;return {id:randomUUID()}}},
  }
  return originalLoad.call(this,id,...args)
}
const {GET,POST}=require('../app/api/portal/schools/route.ts')
Module._load=originalLoad
const url='https://portal.example.test/api/portal/schools'
const request=(body={},headers={})=>new NextRequest(url,{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':randomUUID(),...headers},body:JSON.stringify(body)})

test('Escolas: contratos e proteção da API',async t=>{
  await t.test('flag desligada não consulta autenticação nem persistência',async()=>{
    assert.equal((await GET(new NextRequest(url))).status,404)
    assert.equal((await POST(request())).status,404)
    assert.equal(reads+writes,0)
  })
  enabled=true
  await t.test('sessão expirada retorna 401 antes de acessar o módulo',async()=>{
    auth={ok:false,response:NextResponse.json({error:'Não autenticado'},{status:401})}
    assert.equal((await POST(request())).status,401);assert.equal(writes,0)
  })
  auth={ok:true,teacherId:randomUUID(),sessionId:randomUUID(),teacher:{name:'Professor',role:'student'}}
  await t.test('role desconhecida não herda permissões de professor',async()=>{
    assert.equal((await GET(new NextRequest(url))).status,403);assert.equal(reads,0)
  })
  auth.teacher.role='teacher'
  await t.test('leitura autenticada não é armazenada em cache',async()=>{
    const result=await GET(new NextRequest(url))
    assert.equal(result.status,200);assert.equal(result.headers.get('cache-control'),'private, no-store')
  })
  await t.test('paginação, UUID e view inválidos retornam 400',async()=>{
    for(const query of ['page=0','page=2.5','schoolId=abc','view=secrets']) assert.equal((await GET(new NextRequest(`${url}?${query}`))).status,400)
    assert.equal(reads,1)
  })
  await t.test('origem externa é recusada antes da escrita',async()=>{
    assert.equal((await POST(request({}, {origin:'https://attacker.example.test'}))).status,403);assert.equal(writes,0)
  })
  await t.test('chave de idempotência é obrigatória',async()=>{
    assert.equal((await POST(request({}, {'Idempotency-Key':''}))).status,400);assert.equal(writes,0)
  })
  await t.test('corpo excessivo ou JSON inválido não é persistido',async()=>{
    assert.equal((await POST(request({notes:'a'.repeat(150001)}))).status,413)
    assert.equal((await POST(new NextRequest(url,{method:'POST',headers:{'Idempotency-Key':randomUUID()},body:'{'}))).status,400)
    assert.equal(writes,0)
  })
  await t.test('erro de migração é 503 sem tentativa de DDL',async()=>{
    error={code:'42P01'}
    const response=await GET(new NextRequest(url))
    assert.equal(response.status,503);assert.equal((await response.json()).code,'MIGRATION_REQUIRED')
    error=null
  })
  await t.test('conflito ou proibição não geram auditoria de sucesso',async()=>{
    for(const failure of [new contracts.SchoolError(403,'FORBIDDEN','Sem acesso'),{code:'23505'},{code:'23503'}]) {
      error=failure
      assert.equal((await POST(request())).status,failure.status??409)
    }
    assert.equal(audits,0);error=null
  })
  await t.test('sucesso espelha evento na auditoria geral e não usa cache',async()=>{
    const response=await POST(request({action:'request.create'},{origin:'https://portal.example.test'}))
    assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(audits,1)
  })
})
