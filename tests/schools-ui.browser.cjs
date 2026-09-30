// Navegador real + componente real + serviço real, em servidor e PostgreSQL isolados.
// Não inicia o Next nem carrega .env. Autenticação HTTP é coberta em schools-api.test.cjs.
const {test}=require('node:test')
const assert=require('node:assert/strict')
const {randomUUID}=require('node:crypto')
const fs=require('node:fs')
const path=require('node:path')
const http=require('node:http')
const Module=require('node:module')
const ts=require('typescript')
const esbuild=require('esbuild')
const postcss=require('postcss')
const tailwind=require('@tailwindcss/postcss')
const {chromium,expect}=require('@playwright/test')
const {PGlite}=require('@electric-sql/pglite')
Module._extensions['.ts']=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true},
}).outputText,filename)
const {schoolService}=require('../lib/schools/service.ts')

test('Escolas: interface responsiva e fluxos em navegador isolado',{timeout:120000},async t=>{
  const p=new PGlite()
  let server,browser
  try {
    await p.exec(`CREATE TABLE teachers(id uuid PRIMARY KEY,name text,email text,active boolean DEFAULT true,approved boolean DEFAULT true);
      CREATE TABLE teacher_classes(id uuid PRIMARY KEY,teacher_id uuid,name text,school_year int);
      CREATE TABLE teacher_schedules(id uuid PRIMARY KEY,class_id uuid,weekday int,start_time time,end_time time);`)
    await p.exec(fs.readFileSync(path.join(__dirname,'../scripts/046_schools_inventory.sql'),'utf8'))
    const admin={id:randomUUID(),name:'Admin homologação',admin:true},teacher={id:randomUUID(),name:'Professor homologação',admin:false}
    for(const actor of [admin,teacher]) await p.query('INSERT INTO teachers(id,name,email) VALUES($1,$2,$3)',[actor.id,actor.name,'teste@example.test'])
    const service=schoolService({query:async(sql,params)=>(await p.query(sql,params)).rows,transaction:work=>p.transaction(tx=>work({query:async(sql,params)=>(await tx.query(sql,params)).rows}))})
    const school=await service.command(admin,randomUUID(),{action:'school.create',data:{name:'Escola Horizonte',code:'HOR',country:'BR',address:'',notes:'',active:true}})
    await service.command(admin,randomUUID(),{action:'links.replace',schoolId:school.id,version:1,teacherIds:[teacher.id],classIds:[]})
    const template=await service.command(admin,randomUUID(),{action:'template.create',data:{name:'Kit STEAM',description:'Inventário de referência',active:true,items:[{name:'Arduino Uno',category:'Circuitos',quantity:10,unit:'un'}]}})
    const root='/portal/dashboard/escolas', cwd=path.resolve(__dirname,'..')
    const bundle=await esbuild.build({
      stdin:{contents:`import React from 'react';import {createRoot} from 'react-dom/client';import SchoolsClient from './components/schools/SchoolsClient';
        const query=new URLSearchParams(location.search);const parts=location.pathname.split('/').filter(Boolean).slice(3);
        createRoot(document.getElementById('root')).render(<SchoolsClient admin={query.get('role')!=='teacher'} locale={query.get('locale')||'pt-BR'} templates={parts[0]==='modelos'} schoolId={['modelos','historico'].includes(parts[0])?undefined:parts[0]} tab={parts[0]==='historico'?'audit':parts[1]||'inventory'}/>);`,resolveDir:cwd,loader:'tsx'},
      bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},
      plugins:[{name:'isolated-link',setup(build){build.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'isolated'}));build.onLoad({filter:/.*/,namespace:'isolated'},()=>({contents:"import React from 'react';export default function Link(props){return React.createElement('a',props)}",loader:'js',resolveDir:cwd}))}}],
    })
    const css=await postcss([tailwind({base:cwd})]).process('@import "tailwindcss"; @source "./components/schools";',{from:path.join(cwd,'schools-test.css')})
    server=http.createServer((req,res)=>{
      if(req.url==='/ui.js'){res.setHeader('Content-Type','text/javascript');res.end(bundle.outputFiles[0].text);return}
      if(req.url==='/ui.css'){res.setHeader('Content-Type','text/css');res.end(css.css);return}
      res.setHeader('Content-Type','text/html; charset=utf-8')
      res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/ui.css"></head><body style="background:#020617;padding:16px;font-family:sans-serif"><div id="root"></div><script src="/ui.js"></script></body></html>')
    })
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
    const base=`http://127.0.0.1:${server.address().port}`
    const installed=process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync)
    browser=await chromium.launch({headless:true,...(installed?{executablePath:installed}:{})})
    const page=await browser.newPage({viewport:{width:1366,height:900}})
    let actor=admin
    const browserErrors=[]
    page.on('pageerror',error=>browserErrors.push(error.message))
    await page.route('**/api/portal/schools?*',async route=>{
      const query=new URL(route.request().url()).searchParams
      try {await route.fulfill({json:await service.read(actor,query.get('view'),query.get('schoolId')||undefined,query.get('search')||'',Number(query.get('page')||1))})}
      catch(error){await route.fulfill({status:error.status||500,json:{error:error.message,code:error.code}})}
    })
    await page.route('**/api/portal/schools',async route=>{
      try {await route.fulfill({json:await service.command(actor,route.request().headers()['idempotency-key'],route.request().postDataJSON())})}
      catch(error){await route.fulfill({status:error.status||500,json:{error:error.message,code:error.code}})}
    })
    const go=async(suffix='',spanish=false)=>page.goto(`${base}${root}${suffix}?role=${actor.admin?'admin':'teacher'}&locale=${spanish?'es':'pt-BR'}`)
    const success=()=>expect(page.getByRole('status')).toContainText('Operação registrada')
    const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'A página não deve ter rolagem horizontal')
    await t.test('lista e criação com acentuação preservada',async()=>{
      await go();await expect(page.getByText('Escola Horizonte',{exact:true})).toBeVisible()
      await page.getByRole('button',{name:'Nova escola',exact:true}).click()
      await page.getByLabel('Nome',{exact:true}).fill('Escola Inovação')
      await page.getByLabel('Código da escola').fill('INOV')
      await page.getByRole('button',{name:'Salvar',exact:true}).click();await success()
      await expect(page.getByText('Escola Inovação',{exact:true})).toBeVisible()
    })
    await t.test('aplicação do modelo, edição e publicação confirmada',async()=>{
      await go(`/${school.id}`)
      await page.getByRole('button',{name:'Usar modelo'}).click()
      await page.getByRole('combobox').selectOption(template.id)
      await page.getByRole('button',{name:'Salvar',exact:true}).click();await success()
      await expect(page.getByText('Arduino Uno',{exact:true})).toBeVisible()
      await page.getByRole('button',{name:'Editar / organizar'}).click()
      await page.getByLabel('Quantidade',{exact:true}).fill('12')
      await page.getByRole('button',{name:'Salvar',exact:true}).click();await success()
      await page.getByRole('button',{name:'Publicar inventário'}).click()
      await expect(page.getByRole('alertdialog')).toBeVisible()
      await page.getByRole('button',{name:'Confirmar',exact:true}).click();await success()
      await expect(page.getByText(/Inventário publicado/)).toBeVisible()
    })
    await t.test('professor organiza item sem poder mudar quantidade',async()=>{
      actor=teacher;await go(`/${school.id}`)
      await page.getByRole('button',{name:'Editar / organizar'}).click()
      await expect(page.getByLabel('Quantidade',{exact:true})).toHaveCount(0)
      await page.getByLabel('Localização',{exact:true}).fill('Laboratório principal')
      await page.getByRole('button',{name:'Salvar',exact:true}).click();await success()
      await expect(page.getByText(/Laboratório principal/)).toBeVisible()
    })
    await t.test('fechar formulário alterado pede confirmação e permite continuar',async()=>{
      await page.getByRole('button',{name:'Adicionar / solicitar'}).click()
      await page.getByLabel('Nome',{exact:true}).fill('Pedido não salvo')
      await page.getByRole('button',{name:'Fechar',exact:true}).click()
      await expect(page.getByRole('alertdialog')).toContainText('Descartar')
      await page.getByRole('button',{name:'Cancelar',exact:true}).click()
      await expect(page.getByLabel('Nome',{exact:true})).toHaveValue('Pedido não salvo')
      await page.getByRole('button',{name:'Fechar',exact:true}).click()
      await page.getByRole('button',{name:'Confirmar',exact:true}).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
    await t.test('solicitação e recebimento percorrem fluxo completo',async()=>{
      await go(`/${school.id}/requests`)
      await page.getByRole('button',{name:'Nova solicitação'}).click()
      await page.getByLabel('Nome',{exact:true}).fill('Micro:bit')
      await page.getByLabel('Justificativa',{exact:true}).fill('Programação com sensores')
      await page.getByRole('button',{name:'Salvar',exact:true}).click();await success()
      await expect(page.getByText('Pendente',{exact:true})).toBeVisible()
      actor=admin;await go(`/${school.id}/requests`)
      for(const action of ['Aprovar','Confirmar recebimento']) {
        await page.getByRole('button',{name:action,exact:true}).click()
        await page.getByLabel('Observações',{exact:true}).fill('Conferido em homologação')
        await page.getByRole('button',{name:'Salvar',exact:true}).click()
        await page.getByRole('button',{name:'Confirmar',exact:true}).click();await success()
      }
      await expect(page.getByText('Incorporado ao inventário',{exact:true})).toBeVisible()
    })
    await t.test('telas e modal cabem em 360px e textos seguem em espanhol',async()=>{
      await page.setViewportSize({width:360,height:800})
      for(const suffix of ['',`/${school.id}`,`/${school.id}/requests`,`/${school.id}/links`,'/historico','/modelos']) {
        await go(suffix);await expect(page.getByPlaceholder('Pesquisar por nome…').or(page.getByRole('heading',{name:'Equipe e turmas vinculadas'}))).toBeVisible();await noOverflow()
      }
      await page.getByRole('button',{name:'Novo modelo'}).click()
      await expect(page.getByRole('dialog')).toBeVisible();await noOverflow()
      const box=await page.getByRole('dialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=360)
      await page.getByRole('button',{name:'Fechar',exact:true}).click()
      actor=teacher;await go(`/${school.id}`,true)
      await expect(page.getByRole('link',{name:'Inventario',exact:true})).toBeVisible()
      await page.getByRole('button',{name:'Agregar / solicitar'}).click()
      await expect(page.getByRole('dialog')).toContainText('Agregar o solicitar artículo');await noOverflow()
    })
    assert.deepEqual(browserErrors,[])
  } finally {
    await browser?.close()
    if(server) await new Promise(resolve=>server.close(resolve))
    await p.close()
  }
})
