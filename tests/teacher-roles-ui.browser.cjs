// Componente real em navegador isolado; API interceptada, sem banco ou .env.
const {test}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto')
const fs=require('node:fs'),path=require('node:path'),http=require('node:http')
const esbuild=require('esbuild'),postcss=require('postcss'),tailwind=require('@tailwindcss/postcss')
const {chromium,expect}=require('@playwright/test')

test('Gestão da coordenação: visibilidade, confirmação e erros em modal',{timeout:60000},async t=>{
 const cwd=path.resolve(__dirname,'..'),teacher={id:randomUUID(),name:'João da Silva',role:'teacher',is_admin:false,approved:true,active:true}
 let server,browser
 try {
  const bundle=await esbuild.build({stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import TeacherRoleAction from './components/admin/TeacherRoleAction';
   const root=createRoot(document.getElementById('root'));window.teacher=${JSON.stringify(teacher)};window.canManage=true;window.changed=0;
   window.renderRole=()=>root.render(<div className="p-4 text-white"><TeacherRoleAction teacher={window.teacher} canManageRoles={window.canManage} onChanged={async()=>{window.changed++;window.teacher={...window.teacher,...window.savedRole};window.renderRole()}}/></div>);window.renderRole();`,resolveDir:cwd,loader:'tsx'},
   absWorkingDir:cwd,bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}})
  const css=await postcss([tailwind({base:cwd})]).process('@import "tailwindcss"; @source "./components/admin"; @source "./components/ui";', {from:path.join(cwd,'roles-test.css')})
  server=http.createServer((req,res)=>{
   if(req.url==='/ui.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return}
   if(req.url==='/ui.css'){res.setHeader('Content-Type','text/css');res.end(css.css);return}
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body style="background:#020617"><div id="root"></div><script src="/ui.js"></script></body></html>')
  })
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
  const installed=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)
  browser=await chromium.launch({headless:true,...(installed?{executablePath:installed}:{})})
  const page=await browser.newPage({viewport:{width:1100,height:800}}),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  let status=200,calls=[]
  await page.route('**/api/admin/teachers/*/role',async route=>{
   const body=route.request().postDataJSON();calls.push(body)
   if(status!==200){await route.fulfill({status,json:{error:'Sem autorização para alterar a coordenação.'}});return}
   const data={role:body.role,is_admin:body.role==='admin'}
   await page.evaluate(data=>{window.savedRole=data},data)
   await route.fulfill({json:{id:teacher.id,...data,changed:true}})
  })
  await page.goto(`http://127.0.0.1:${server.address().port}`)
  await t.test('cancelamento não envia e confirmação promove e atualiza o botão',async()=>{
   await page.getByRole('button',{name:'Tornar coordenador',exact:true}).click()
   await expect(page.getByRole('heading',{name:'Tornar coordenador'})).toBeVisible()
   assert.equal(calls.length,0)
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(calls.length,0)
   await page.getByRole('button',{name:'Tornar coordenador',exact:true}).click()
   await page.getByRole('button',{name:'Tornar coordenador',exact:true}).last().click()
   await expect(page.getByRole('button',{name:'Remover coordenação',exact:true})).toBeVisible()
   assert.deepEqual(calls,[{role:'admin',expected_role:'teacher'}]);assert.equal(await page.evaluate(()=>window.changed),1)
  })
  await t.test('remoção exige confirmação e preserva o papel quando cancelada',async()=>{
   await page.getByRole('button',{name:'Remover coordenação',exact:true}).click()
   await expect(page.getByRole('heading',{name:'Remover coordenação'})).toBeVisible()
   await page.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(calls.length,1)
   await page.getByRole('button',{name:'Remover coordenação',exact:true}).click()
   await page.getByRole('button',{name:'Remover coordenação',exact:true}).last().click()
   await expect(page.getByRole('button',{name:'Tornar coordenador',exact:true})).toBeVisible()
   assert.deepEqual(calls[1],{role:'teacher',expected_role:'admin'})
  })
  await t.test('opção não aparece para admin comum, conta protegida, pendente ou outro role',async()=>{
   await page.evaluate(()=>{window.canManage=false;window.renderRole()})
   await expect(page.getByRole('button')).toHaveCount(0)
   for(const patch of [{role_management_protected:true},{approved:false},{role:'auditor'}]) {
    await page.evaluate(({teacher,patch})=>{window.canManage=true;window.teacher={...teacher,...patch};window.renderRole()},{teacher,patch})
    await expect(page.getByRole('button')).toHaveCount(0)
   }
   await page.evaluate(teacher=>{window.teacher=teacher;window.renderRole()},teacher)
  })
  await t.test('falha permanece em modal, não simula sucesso e libera nova tentativa em 360px',async()=>{
   status=403;await page.setViewportSize({width:360,height:800})
   await page.getByRole('button',{name:'Tornar coordenador',exact:true}).click()
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1))
   await page.getByRole('button',{name:'Tornar coordenador',exact:true}).last().click()
   await expect(page.getByRole('alertdialog')).toContainText('Sem autorização')
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1))
   assert.equal(await page.evaluate(()=>window.changed),2)
   await page.getByRole('button',{name:'Entendi',exact:true}).click()
   await expect(page.getByRole('button',{name:'Tornar coordenador',exact:true})).toBeEnabled()
   assert.equal(await page.evaluate(()=>window.teacher.role),'teacher')
  })
  assert.deepEqual(errors,[])
 } finally {await browser?.close();if(server)await new Promise(resolve=>server.close(resolve))}
})
