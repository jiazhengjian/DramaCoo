/* UI fixtures only. All API traffic is intercepted; no model or user data is used. */
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3004';
const evidence = path.resolve(process.env.UI_EVIDENCE_DIR || '../../../docs/evidence/阶段3-设计规范统一/界面');
const stages = ['script_generation','character_design','storyboard','reference_generation','video_generation','post_production'];
const names = ['剧本','资产图','分镜脚本','分镜图','分镜视频','视频合成'];
const sampleImage='/ui/inspiration-ink.png';
const artifacts = {
  script_generation:{title:'山水之间 · UI 验证样例',logline:'一位旅人循着河流，寻找失落的故乡。',genre:['治愈'],overall_style:'水墨',characters:[{name:'旅人',character_id:'hero',role:'主角',description:'背着行囊的年轻旅人',personality:['温柔','坚定']}],settings:[{name:'山谷',description:'薄雾笼罩的清晨山谷'}],scenes:[{scene_number:1,location:'山谷',characters:['旅人'],plot:'旅人乘一叶扁舟，驶向晨雾。'}],episodes:[{act_number:1,act_title:'启程',content:'清晨，旅人离开渡口。'}]},
  character_design:{characters:[{id:'hero',name:'旅人',description:'背着行囊的年轻旅人',status:'done',selected:sampleImage,versions:[sampleImage]}],settings:[{id:'valley',name:'山谷',description:'薄雾笼罩的山谷',status:'done',selected:sampleImage,versions:[sampleImage]}],props:[]},
  storyboard:{episodes:[{episode_number:1,episode_title:'启程',segments:[{segment_id:'segment_1',segment_number:1,episode_number:1,location:'山谷',characters:['旅人'],total_duration:5,shots:[{shot_number:1,shot_type:'远景',duration:5,content:'扁舟缓缓穿过山谷。'}]}]}]},
  reference_generation:{scenes:[{id:'frame1',name:'场景1-镜头1',segment_id:'segment_1',segment_number:1,scene_number:1,episode_number:1,description:'水墨山谷中的扁舟',prompt:'水墨山谷中的扁舟',status:'done',selected:sampleImage,versions:[sampleImage]}]},
  video_generation:{clips:[{id:'frame1',name:'场景1-镜头1',description:'扁舟经过山谷（界面测试视频）',duration:1,status:'done',selected:'/ui-fixture.mp4',versions:['/ui-fixture.mp4']}]}, post_production:{final_videos:[{name:'启程 · UI 测试',path:'/ui-fixture.mp4',episode:1}]},
};
const project={id:'ui-fixture',title:'山水之间 · UI 验证样例',idea:'山水之间',style:'水墨',status:'draft',cover_image:sampleImage,updated_at:'2026-09-24T08:00:00',archived:false};
const asset={id:1,project_id:null,asset_type:'character',name:'水墨山谷 · UI 样例',media_type:'image',file_path:sampleImage,thumb_path:sampleImage,file_size:1024,source:'upload',created_at:'2026-09-24T08:00:00'};
const results=[]; const errors=[]; const writes=[];
let scenario={};
async function run(name, task){try{await task();results.push({name,passed:true});console.log('PASS',name)}catch(error){results.push({name,passed:false,message:error.message});console.error('FAIL',name,error.message)}}
(async()=>{
 await fs.mkdir(evidence,{recursive:true});
 const browser=await chromium.launch({channel:process.env.UI_BROWSER_CHANNEL || 'chrome',headless:true,ignoreDefaultArgs:['--hide-scrollbars']});
 const context=await browser.newContext({viewport:{width:1440,height:960},reducedMotion:'reduce'});
 await context.route('**/ui-fixture.mp4',route=>route.fulfill({status:200,contentType:'video/mp4',path:path.resolve('scripts/fixtures/ui-video.mp4')}));
 await context.route('**/ui-fixture_poster.jpg',route=>route.fulfill({status:200,contentType:'image/png',path:path.resolve('public/ui/inspiration-ink.png')}));
 await context.route('**/api/**',async route=>{
   const req=route.request(), url=new URL(req.url()), p=url.pathname;
   const reply=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(req.method()!=='GET'){writes.push({method:req.method(),path:p});return reply({error:{code:'UI_TEST',message:'模拟操作失败'},detail:'模拟操作失败'},500)}
   if(scenario.delay && p===scenario.delay) await new Promise(resolve=>setTimeout(resolve,1800));
   if(scenario.fail && p===scenario.fail) return reply({error:{code:'UI_TEST',message:'模拟网络错误'}},503);
   if(p==='/api/sessions') return reply({sessions:scenario.populated?[project]:[]});
   if(p==='/api/library') return reply({assets:scenario.populated?[asset]:[]});
   if(p==='/api/models') return reply({models:[{id:'ui-fixture-model',label:'验证模型',provider:'openai',model_type:url.searchParams.get('model_type')||'video',api_contract_verified:true,ability_types:['first_frame_i2v','start_end_frame_i2v','reference_to_video']}]});
   if(p==='/api/config') return reply({config:{models:{llm:'ui-fixture-model',vlm:'ui-fixture-model',image_t2i:'ui-fixture-model',image_it2i:'ui-fixture-model',video_first_frame:'ui-fixture-model'},generation:{video_ratio:'16:9',video_resolution:'720P'}}});
   if(p==='/api/sandbox/history') return reply({success:true,records:[]});
   if(p==='/api/sandbox/tasks') return reply({tasks:[]});
   if(p==='/api/tasks') return reply({tasks:scenario.task?[scenario.task]:[]});
   if(p.startsWith('/api/tasks/')) return reply(scenario.task||{});
   if(p==='/api/pipelines/standard/templates') return reply({templates:[]});
   if(p==='/api/stages') return reply({stages:stages.map((id,order)=>({id,name:names[order],order,description:''}))});
   if(p.includes('/status')) return reply({session_id:'ui-fixture',current_stage:scenario.stage||stages[0],status:Object.fromEntries(stages.map(id=>[id,id===scenario.stage?(scenario.status||'waiting'):'pending'])),artifacts,meta:{idea:'山水之间',llm_model:'ui-fixture-model',video_ratio:'16:9'},error:scenario.status==='error'?'生成失败，请检查连接后重试。':null,progress:{[scenario.stage]:{percent:42,message:'正在生成'}}});
   if(p.includes('/artifact/')) return reply({artifact:artifacts[p.split('/').at(-1)]||{}});
   return reply({});
 });
 const page=await context.newPage();
 page.on('pageerror',error=>errors.push(error.message));
 const shot=async name=>page.screenshot({path:path.join(evidence,`${name}.png`),fullPage:true,animations:'disabled'});
 const go=async url=>{await page.goto(base+url,{waitUntil:'networkidle'}); await page.locator('.xyq-shell').waitFor();};
 const noOverflow=async()=>{
   const layout=await page.evaluate(()=>{
     const main=document.querySelector('.xyq-main'), rect=main.getBoundingClientRect();
     const gutter=innerWidth>=1024?40:innerWidth>=768?24:16;
     const left=rect.left+main.clientLeft+gutter, right=rect.left+main.clientLeft+main.clientWidth-gutter;
     const rails=[...document.querySelectorAll('.xyq-page, .xyq-home-main, .xyq-topbar, .xyq-stage-content, .xyq-stage-actions')].filter(el=>getComputedStyle(el).display!=='none').map(el=>{
       const box=el.getBoundingClientRect(), style=getComputedStyle(el);
       return {name:el.className, leftError:box.left+el.clientLeft+parseFloat(style.paddingLeft)-left,rightError:box.left+el.clientLeft+el.clientWidth-parseFloat(style.paddingRight)-right};
     });
     return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,mainClient:main.clientWidth,mainScroll:main.scrollWidth,rails};
   });
   assert(layout.scroll<=layout.client+1,`页面横向溢出 ${JSON.stringify(layout)}`);
   assert(layout.mainScroll<=layout.mainClient+1,`主区域横向溢出 ${JSON.stringify(layout)}`);
   for(const rail of layout.rails)assert(Math.abs(rail.leftError)<=1&&Math.abs(rail.rightError)<=1,`页面状态基线偏移 ${JSON.stringify(rail)}`);
 };
 const routes=[['工作室','/'],['项目库','/projects'],['素材库','/library'],['临时工作台','/sandbox'],['动作迁移','/pipelines/action-transfer'],['设置','/settings'],['兼容-文艺短视频','/pipelines/standard'],['兼容-数字人口播','/pipelines/digital-human']];
 for(const width of [1440,390]){
   await page.setViewportSize({width,height:960});
   for(const [name,url] of routes){scenario={populated:name==='素材库'||name==='项目库'};await run(`${name} ${width}px 页面与布局`,async()=>{await go(url);await noOverflow();assert.equal(await page.locator('nav[aria-label="创作功能"] a').count(),5);assert.equal(await page.locator('nav[aria-label="创作功能"]').getByText('文艺短视频').count(),0);await shot(`${width}-${name}`)});}
 }
 for(const width of [320,768,1024]){
   await page.setViewportSize({width,height:900});
   for(const [name,url] of routes){scenario={populated:true};await run(`${name} ${width}px 断点`,async()=>{await go(url);await noOverflow()});}
 }
 for(const width of [1440,390]){
   await page.setViewportSize({width,height:960});scenario={};await go('/sandbox');
   for(const name of ['LLM 对话','图片理解','文生图','图生图','视频生成']){await run(`临时工作台 ${name} ${width}px`,async()=>{await page.getByRole('button',{name:new RegExp('^'+name)}).first().click();await noOverflow();await shot(`${width}-工具-${name}`)});}
 }
 await page.setViewportSize({width:1440,height:960});scenario={};await go('/');
 await run('侧栏 240/64、导航保留、偏好恢复',async()=>{
   if(await page.locator('.xyq-sidebar').evaluate(el=>Math.round(el.getBoundingClientRect().width))!==240)await page.locator('.xyq-sidebar').getByRole('button',{name:'展开侧边栏',exact:true}).click();
   assert.equal(await page.locator('.xyq-sidebar').evaluate(el=>el.getBoundingClientRect().width),240);
   await page.locator('.xyq-sidebar').getByRole('button',{name:'收起侧边栏',exact:true}).click();
   await page.waitForFunction(()=>document.querySelector('.xyq-sidebar').getBoundingClientRect().width===64);
   await page.getByRole('link',{name:'项目库',exact:true}).hover();await page.getByRole('link',{name:'项目库',exact:true}).locator('.xyq-nav-tooltip').waitFor({state:'visible'});await shot('侧栏-收起与悬停');
   await page.reload({waitUntil:'networkidle'});await page.waitForFunction(()=>document.querySelector('.xyq-sidebar').getBoundingClientRect().width===64);
   await page.getByRole('button',{name:'任务中心',exact:true}).click();await page.getByRole('dialog',{name:'任务中心',exact:true}).waitFor();await shot('侧栏-任务弹层');await page.keyboard.press('Escape');
   await page.locator('.xyq-sidebar').getByRole('button',{name:'展开侧边栏',exact:true}).click();
 });
 await run('收起侧栏任务选择后关闭弹层并导航',async()=>{
   scenario={task:{task_id:'ui-task',pipeline:'action_transfer',status:'running',progress:42,input:{title:'UI 任务导航样例'}}};
   await page.locator('.xyq-sidebar').getByRole('button',{name:'收起侧边栏',exact:true}).click();
   await page.getByRole('button',{name:'任务中心',exact:true}).click();
   const panel=page.getByRole('dialog',{name:'任务中心',exact:true});
   await panel.getByRole('button',{name:/UI 任务导航样例/}).click();
   await panel.waitFor({state:'detached'});await page.waitForURL('**/pipelines/action-transfer?task=ui-task');
   scenario={};await go('/');await page.locator('.xyq-sidebar').getByRole('button',{name:'展开侧边栏',exact:true}).click();
 });
 await run('设置 popover Escape、外部点击、焦点返回',async()=>{
   const trigger=page.locator('.xyq-sidebar').getByRole('button',{name:'设置',exact:true});await trigger.click();await page.getByRole('dialog',{name:'设置菜单'}).waitFor();await shot('交互-设置popover');await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);await trigger.click();await page.locator('h1').click();assert.equal(await page.getByRole('dialog',{name:'设置菜单'}).count(),0);
 });
 await run('集数 popover 值更新与 Escape',async()=>{await page.getByRole('button',{name:/剧集：/}).click();const pop=page.getByRole('dialog',{name:'设置总集数'});await pop.waitFor();await pop.locator('input[type=range]').fill('7');await shot('交互-集数popover');await page.keyboard.press('Escape');assert.match(await page.getByRole('button',{name:/剧集：/}).innerText(),/7/)});
 await run('首页配置展开与主按钮禁用状态',async()=>{await page.getByRole('button',{name:'生成配置',exact:true}).click();await shot('工作室-配置与禁用');assert.equal(await page.getByRole('button',{name:'一键生成',exact:true}).isDisabled(),true);await page.locator('.xyq-prompt-input').fill('UI 自动化验证，不提交生成');assert.equal(await page.getByRole('button',{name:'一键生成',exact:true}).isEnabled(),true)});
 for(const [name,url,api] of [['项目库','/projects','/api/sessions'],['素材库','/library','/api/library'],['设置','/settings','/api/config']]){
  await run(`${name} 错误与重试`,async()=>{scenario={fail:api};await go(url);assert(await page.locator('[role=alert]').count()>0);await noOverflow();await shot(`${name}-加载失败`);scenario={};await page.getByRole('button',{name:'重新加载',exact:true}).click();await page.locator('.ui-state[role=alert]').waitFor({state:'detached'});await noOverflow();await shot(`${name}-空或恢复`)});
 }
 await run('加载状态保持布局',async()=>{scenario={delay:'/api/sessions'};await page.goto(base+'/projects',{waitUntil:'domcontentloaded'});await page.locator('.ui-skeleton').first().waitFor();await noOverflow();await shot('项目库-加载骨架');await page.waitForLoadState('networkidle')});
 await run('项目删除确认、焦点约束、失败反馈',async()=>{scenario={populated:true};await go('/projects');const trigger=page.getByRole('button',{name:/删除项目 山水/});await trigger.click();const dialog=page.getByRole('dialog',{name:'删除项目',exact:true});await dialog.waitFor();await page.keyboard.press('Shift+Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);await shot('项目库-删除确认');await page.keyboard.press('Escape');assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);await trigger.click();await page.getByRole('dialog').getByRole('button',{name:'删除项目',exact:true}).click();await page.getByRole('alert').filter({hasText:'删除失败'}).waitFor();await shot('反馈-操作失败toast')});
 for(const [name,url] of [['工作室','/'],['临时工作台','/sandbox'],['动作迁移','/pipelines/action-transfer']]){
   await run(`${name} 模型错误恢复`,async()=>{scenario={fail:'/api/models'};await go(url);const notice=page.locator('.ui-notice').filter({hasText:'模型列表加载失败'});await notice.waitFor();await shot(`${name}-模型错误`);scenario={};await notice.getByRole('button',{name:/重试/}).click();await notice.waitFor({state:'detached'})});
 }
 for(const stage of stages){
  for(const status of ['pending','running','waiting','completed','error','stopped']){
   scenario={stage,status,populated:true};await run(`${stage} ${status} 状态`,async()=>{await go('/?session=ui-fixture&stage='+stage);await page.locator('.xyq-topbar').waitFor();await noOverflow();if(status==='waiting'||(stage===stages[0]&&['running','error','stopped'].includes(status)))await shot(`流程-${stage}-${status}`)});
  }
 }
 for(const [stage,name,mode,label] of [['script_generation','剧本','JSON编辑','剧本 JSON'],['storyboard','分镜脚本','JSON','分镜脚本 JSON']]){
   await run(`${name} JSON 错误保留编辑`,async()=>{scenario={stage,status:'waiting'};await go('/?session=ui-fixture&stage='+stage);await page.getByRole('button',{name:'修改',exact:true}).click();await page.getByRole('button',{name:mode,exact:true}).click();await page.getByRole('textbox',{name:label,exact:true}).fill('{broken');const before=writes.length;await page.getByRole('button',{name:/保存/}).last().click();await page.getByRole('alert').filter({hasText:/JSON/}).waitFor();assert.equal(writes.length,before);assert.equal(await page.getByRole('textbox',{name:label,exact:true}).inputValue(),'{broken');await shot(`${name}-JSON编辑错误`)});
 }
 await run('404 统一错误页',async()=>{scenario={};await go('/ui-missing-page');await page.getByRole('heading',{name:'页面不存在'}).waitFor();await noOverflow();await shot('页面不存在')});
 await page.setViewportSize({width:390,height:844});scenario={stage:'character_design',status:'waiting',populated:true};await run('移动端流程与模型弹层',async()=>{await go('/?session=ui-fixture&stage=character_design');await noOverflow();await shot('390-工作流');const button=page.locator('.xyq-topbar').getByRole('button',{name:/生成配置/});{await button.click();await page.locator('.ui-popover').waitFor();await noOverflow();await shot('390-模型popover');await page.keyboard.press('Escape')}});
 await run('移动导航抽屉、Escape与背景锁定',async()=>{await page.locator('.xyq-mobile-menu').getByRole('button',{name:'展开侧边栏'}).click();assert.equal(await page.locator('.xyq-main').getAttribute('inert'),'');assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');await shot('390-侧栏抽屉');await page.keyboard.press('Escape');assert.equal(await page.locator('.xyq-main').getAttribute('inert'),null)});
 await run('无运行时异常',async()=>assert.deepEqual(errors,[]));
 const summary={date:new Date().toISOString(),base,fixtures:true,realGeneration:false,passed:results.filter(x=>x.passed).length,total:results.length,results,errors,interceptedWrites:writes};
 await fs.writeFile('/tmp/dramacoo-ui-audit/results.json',JSON.stringify(summary,null,2));
 console.log(JSON.stringify({passed:summary.passed,total:summary.total,errors,writes}));
 await browser.close();if(summary.passed!==summary.total)process.exitCode=1;
})().catch(error=>{console.error(error);process.exit(1)});
