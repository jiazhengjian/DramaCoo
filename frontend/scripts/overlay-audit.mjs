import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = process.env.UI_BASE_URL || 'http://127.0.0.1:3004';
(async () => {
 const browser = await chromium.launch({headless:true,channel:'chrome'});
 const context = await browser.newContext({viewport:{width:1280,height:900}});
 const page = await context.newPage();
 const checks=[]; const errors=[]; let libraryMode='fail'; let deletes=0; let attaches=0;
 const project={id:'fixture-session',title:'界面验证项目',idea:'示例创意',style:'写实',status:'completed',cover_image:null,updated_at:'2026-09-24',archived:false};
 const asset={id:1,project_id:null,asset_type:'upload',name:'测试素材',media_type:'image',file_path:'/ui/inspiration-space.png',thumb_path:null,file_size:10,source:'uploaded',created_at:null};
 const artifact={characters:[{id:'char1',name:'测试角色',description:'测试描述',status:'done',selected:'/ui/inspiration-space.png',versions:['/ui/inspiration-space.png','/ui/inspiration-ink.png']}],settings:[],props:[]};
 const status={session_id:'fixture-session',current_stage:'character_design',status:{script_generation:'completed',character_design:'completed'},artifacts:{character_design:artifact,script_generation:{episodes:[]}},meta:{idea:'界面验证',style:'realistic',video_ratio:'16:9',llm_model:'fixture',vlm_model:'fixture',image_t2i_model:'fixture',image_it2i_model:'fixture',video_model:'fixture'}};
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());
  if(!['127.0.0.1','localhost'].includes(url.hostname)) return route.abort();
  if(!url.pathname.startsWith('/api/'))return route.continue();
  let body={tasks:[],models:[],stages:[]};let code=200;
  if(url.pathname==='/api/sessions')body={sessions:[project]};
  else if(url.pathname.includes('/status'))body=status;
  else if(url.pathname.includes('/artifact/')&&url.pathname.includes('attach_library_asset')){attaches++;body={artifact,status_map:status.status};}
  else if(url.pathname.includes('/artifact/'))body={artifact};
  else if(route.request().method()==='DELETE'){deletes++;body={status:'ok'};}
  else if(url.pathname==='/api/library'){if(libraryMode==='fail'){code=503;body={detail:'离线测试错误'};}else body={assets:libraryMode==='empty'?[]:[asset]};}
  else if(url.pathname==='/api/config')body={config:{models:{llm:'fixture',vlm:'fixture',image_t2i:'fixture',image_it2i:'fixture',video:'fixture'},generation:{video_ratio:'16:9',video_resolution:'720P'}}};
  await route.fulfill({status:code,contentType:'application/json',body:JSON.stringify(body)});
 });
 page.on('pageerror',error=>errors.push(error.message));
 const focusInside=async selector=>page.locator(selector).evaluate(el=>el.contains(document.activeElement));
 await page.goto(base+'/projects');
 const deleteButton=page.getByRole('button',{name:'删除项目 界面验证项目'});
 await deleteButton.click();
 const dialog=page.getByRole('dialog',{name:'删除项目',exact:true}); await dialog.waitFor();
 assert(await focusInside('[role=dialog]'));assert.equal(await page.evaluate(()=>document.body.style.overflow),'hidden');
 await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'删除项目');
 await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-label')),'关闭对话框');
 await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert(await deleteButton.evaluate(el=>el===document.activeElement));assert.notEqual(await page.evaluate(()=>document.body.style.overflow),'hidden');
 checks.push('Dialog: 初始焦点、Tab/Shift+Tab循环、Escape、触发器焦点恢复和body滚动恢复');
 await deleteButton.click();await dialog.waitFor();await page.mouse.click(8,8);await dialog.waitFor({state:'hidden'});checks.push('Dialog: 点击遮罩关闭');
 await deleteButton.click();await dialog.getByRole('button',{name:'删除项目',exact:true}).click();await page.getByRole('status').filter({hasText:'项目已删除'}).waitFor();assert.equal(deletes,1);checks.push('确认操作仅触发1次mock DELETE，并显示成功Toast');
 await page.goto(base+'/');
 await page.evaluate(()=>{window.focusLog=[];document.addEventListener('focusin',e=>window.focusLog.push(e.target.outerHTML.slice(0,250)))});const episodes=page.getByRole('button',{name:/剧集：/});await episodes.click();
 const popover=page.getByRole('dialog',{name:'设置总集数'});await popover.waitFor();await page.waitForFunction(()=>document.querySelector('.ui-popover')?.contains(document.activeElement),null,{timeout:3000}).catch(async error=>{console.error('Popover focus diagnostic:',await page.evaluate(()=>({buttons:[...document.querySelectorAll('.ui-popover button')].map(x=>({html:x.outerHTML,style:getComputedStyle(x).visibility,display:getComputedStyle(x).display,rect:x.getBoundingClientRect().toJSON()})),focusLog:window.focusLog,active:document.activeElement?.outerHTML,dialogs:[...document.querySelectorAll('[role=dialog]')].map(x=>({label:x.getAttribute('aria-label'),html:x.outerHTML.slice(0,500)}))})));throw error});assert(await focusInside('.ui-popover'));
 let bounds=await popover.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=1280&&bounds.y+bounds.height<=900);
 await page.keyboard.press('Escape');await popover.waitFor({state:'hidden'});assert(await episodes.evaluate(el=>el===document.activeElement));
 await episodes.click();await popover.waitFor();await page.mouse.click(1100,50);await popover.waitFor({state:'hidden'});checks.push('Popover: 自动定位在视口内、初始焦点、Escape返回、outside关闭');
 await page.setViewportSize({width:390,height:640});await episodes.click();await popover.waitFor();bounds=await popover.boundingBox();assert(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y>=0&&bounds.y+bounds.height<=640);
 await page.keyboard.press('Escape');await page.setViewportSize({width:1280,height:900});checks.push('Popover: 390px窄屏碰撞定位不越界');
 await page.goto(base+'/?session=fixture-session&stage=character_design');
 const pickerButton=page.getByTitle('从素材库选择').first();await pickerButton.click();
 const picker=page.getByRole('dialog',{name:'从素材库选择',exact:true});await picker.waitFor();await picker.getByRole('button',{name:'重新加载'}).waitFor();libraryMode='success';await picker.getByRole('button',{name:'重新加载'}).click();
 const pick=picker.getByRole('button',{name:'选择素材 测试素材'});await pick.waitFor();assert.equal(await pick.getAttribute('aria-pressed'),'false');await pick.click();await picker.waitFor({state:'hidden'});assert.equal(attaches,1);checks.push('LibraryPicker: 错误态重试、可访问选择label和mock素材选择');
 libraryMode='empty';await pickerButton.click();await picker.getByText('还没有可用的图片').waitFor();await page.keyboard.press('Escape');await picker.waitFor({state:'hidden'});assert(await pickerButton.evaluate(el=>el===document.activeElement));checks.push('LibraryPicker: 空态、Escape与触发器焦点恢复');
 const preview=page.getByTitle('放大查看').first();await preview.click();const lightbox=page.getByRole('dialog',{name:/图片预览/});await lightbox.waitFor();
 await lightbox.getByRole('button',{name:'放大图片',exact:true}).click();await lightbox.getByText('150%',{exact:true}).waitFor();await page.keyboard.press('ArrowRight');await page.getByRole('heading',{name:'图片预览 · 2 / 2'}).waitFor();await lightbox.getByText('100%',{exact:true}).waitFor();
 const viewport=lightbox.locator('.ui-lightbox-stage');await viewport.hover();await page.mouse.wheel(0,-100);await lightbox.getByText('115%',{exact:true}).waitFor();await lightbox.getByRole('button',{name:'重置缩放和位置'}).click();await lightbox.getByText('100%',{exact:true}).waitFor();await page.keyboard.press('Escape');await lightbox.waitFor({state:'hidden'});assert(await preview.evaluate(el=>el===document.activeElement));checks.push('ImageLightbox: 150%缩放、键盘翻页、滚轮115%缩放、重置、Escape和焦点恢复');
 assert.deepEqual(errors,[]);
 const result={status:'passed',checks,realAPIRequests:0,mockedDeletes:deletes,mockedAttaches:attaches,pageErrors:errors};fs.writeFileSync('/tmp/DramaCoo-overlay-audit.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
