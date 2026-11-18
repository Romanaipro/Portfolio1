const fs=require('node:fs');
const assert=require('node:assert/strict');
const playwright=require('playwright');
const base='http://127.0.0.1:4174';
const out='review/after';fs.mkdirSync(out,{recursive:true});
const result={viewports:[],checks:[],console:[],requests:[],external:[]};
const check=(name,detail)=>{result.checks.push({name,detail});console.log('PASS',name);};
(async()=>{
  const browser=await playwright.chromium.launch({channel:'chrome',headless:true});
  result.browser=browser.version();
  try{
    for(const [width,height] of [[1440,900],[768,1024],[390,844],[320,844]]){
      const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'});
      await context.route('**/webhook/**',route=>route.abort());
      const page=await context.newPage();page.on('pageerror',e=>result.console.push(e.message));
      await page.goto(base);await page.evaluate(()=>document.fonts.ready);
      await page.screenshot({path:`${out}/${width}-hero.png`});
      assert.equal(await page.locator('h1').count(),1);
      assert.deepEqual(await page.locator('.stack-list li').evaluateAll(els=>els.map(el=>el.childNodes[1].textContent)),['n8n','Gemini','ChatGPT','Claude Code, Codex']);
      await page.locator('#show-all').click();assert.equal(await page.locator('.case-card:visible').count(),6);
      for(const section of ['cases','services','process','about','certificates','pricing','reviews','contact'])await page.locator('#'+section).scrollIntoViewIfNeeded();
      const geometry=await page.evaluate(()=>{
        const entries=[];
        for(const el of document.querySelectorAll('main h1,main h2,main h3,.case-card,.flow li,.case-body p,.case-body a,.contact-links a,.contact-links span,form input,form textarea,.pricing-card,.stack-list li')){
          if(!el.getClientRects().length)continue;
          const r=el.getBoundingClientRect();
          if(r.left<-.5||r.right>innerWidth+.5||el.scrollWidth>el.clientWidth+1)entries.push({tag:el.tagName,text:el.textContent.slice(0,80),left:r.left,right:r.right,scroll:el.scrollWidth,client:el.clientWidth});
        }
        return {width:innerWidth,document:document.documentElement.scrollWidth,issues:entries};
      });
      result.viewports.push(geometry);assert.deepEqual(geometry.issues,[]);
      await page.locator('#cases').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.screenshot({path:`${out}/${width}-cases.png`});
      await page.locator('.case-card [data-case-link]').first().click();await page.waitForSelector('dialog[open]');
      await page.screenshot({path:`${out}/${width}-case-dialog.png`});
      assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.keyboard.press('Shift+Tab');assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.keyboard.press('Tab');assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));
      assert.ok(await page.locator('.case-card [data-case-link]').first().evaluate(el=>el===document.activeElement));
      await page.locator('[data-context]').filter({hasText:'Обговорити цей пакет'}).last().click();
      assert.match(await page.locator('#description').inputValue(),/Екосистема під ключ/);
      assert.equal(await page.locator('#name').evaluate(el=>el===document.activeElement),true);
      await page.locator('#contact').evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await page.locator('.form-panel').screenshot({path:`${out}/${width}-form.png`});await page.screenshot({path:`${out}/${width}-contact.png`});
      await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:`${out}/${width}-full.png`,fullPage:true});
      if(width===390){await page.locator('.menu-toggle').click();assert.equal(await page.locator('#navigation').isVisible(),true);await page.keyboard.press('Tab');await page.keyboard.press('Escape');assert.equal(await page.locator('.menu-toggle').getAttribute('aria-expanded'),'false');}
      check('responsive '+width,geometry);await context.close();
    }
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
    let mode='error';let posts=[];
    await context.route('**/webhook/**',async route=>{
      const data=new URLSearchParams(route.request().postData());posts.push(Object.fromEntries(data));
      if(mode==='network')return route.abort('failed');
      await route.fulfill({status:mode==='error'?500:200,contentType:'application/json',body:JSON.stringify(mode==='accepted'?{accepted:true,request_id:data.get('request_id')}:{unexpected:true})});
    });
    const page=await context.newPage();await page.goto(base);
    // Every filter and case; browser history preserves the selected filter.
    const counts={all:6,ecom:3,ai:4,analytics:3};
    for(const [filter,count] of Object.entries(counts)){await page.locator(`[data-filter="${filter}"]`).click();assert.equal(await page.locator('.case-card:visible').count(),count);assert.equal(await page.locator(`[data-filter="${filter}"]`).getAttribute('aria-pressed'),'true');}
    const slugs=await page.locator('dialog.case-dialog').evaluateAll(ds=>ds.map(d=>d.id.slice(5)));
    for(const slug of slugs){await page.goto(base+'/#case/'+slug);await page.waitForSelector('dialog[open]');assert.equal(await page.locator('dialog[open]').getAttribute('id'),'case-'+slug);await page.reload();await page.waitForSelector('dialog[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('dialog[open]'));}
    await page.goto(base+'/#cases');await page.locator('[data-filter="ecom"]').click();const opener=page.locator('.case-card:visible [data-case-link]').first();await opener.click();await page.waitForSelector('dialog[open]');await page.goBack();assert.equal(await page.locator('.case-card:visible').count(),3);await page.goForward();await page.waitForSelector('dialog[open]');await page.locator('dialog[open] [data-context]').click();assert.match(await page.locator('#description').inputValue(),/Urban Trend Shop/);assert.equal(await page.locator('#name').evaluate(el=>el===document.activeElement),true);
    check('six deep links, reload, Back/Forward, filters and context','passed');
    for(let i=0;i<3;i++){
      const button=page.locator('[data-certificate]').nth(i);await button.focus();await page.keyboard.press(i===1?'Space':'Enter');await page.waitForSelector('dialog.cert-dialog[open]');
      await page.keyboard.press('Shift+Tab');assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.keyboard.press('Tab');assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.screenshot({path:`${out}/certificate-${i+1}.png`});await page.keyboard.press('Escape');assert.equal(await button.evaluate(el=>el===document.activeElement),true);
    }
    check('three certificates keyboard and focus','Enter / Space / Shift+Tab / Tab / Escape');
    await page.locator('#name').fill('Ізольований тест');await page.locator('#contact-input').fill('invalid');await page.locator('#description').fill('Перевірка форми без реальної відправки');await page.locator('[type=submit]').click();assert.equal(posts.length,0);
    await page.locator('#contact-input').fill('test@example.com');
    for(mode of ['error','unexpected','network','accepted']){
      await page.locator('[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('[type=submit]').disabled);
      if(mode!=='accepted'){assert.equal(await page.locator('#name').inputValue(),'Ізольований тест');assert.ok(await page.locator('#form-error').textContent());await page.screenshot({path:`${out}/form-${mode}.png`});}
      else{assert.match(await page.locator('#form-status').textContent(),/Сервер прийняв/);assert.equal(await page.locator('#name').inputValue(),'');await page.screenshot({path:`${out}/form-accepted.png`});}
    }
    assert.equal(posts.length,4);assert.equal(new Set(posts.map(p=>p.request_id)).size,1);result.requests=posts.map(({request_id})=>({request_id}));check('mock form UI','validation, 500, unexpected 200, network, accepted; preserved data; identical retry ID');
    // Equivalent CSS layout viewport after 200% and 400% zoom of a 1280px desktop.
    for(const width of [640,320]){await page.setViewportSize({width,height:900});await page.goto(base);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);await page.screenshot({path:`${out}/reflow-${width}.png`,fullPage:true});}
    check('desktop reflow equivalent 200% / 400%','640px and 320px CSS layout widths; browser zoom UI not exercised');
    await page.goto(base+'/Portfolio.html');assert.equal(await page.locator('.case-card').count(),6);check('Portfolio.html alias','same generated content');
    try{const AxeBuilder=require('@axe-core/playwright').default;await page.goto(base);const axe=await new AxeBuilder({page}).analyze();result.axe={violations:axe.violations,passes:axe.passes.length};fs.writeFileSync(`${out}/axe.json`,JSON.stringify(result.axe,null,2));}catch(e){result.axe={error:e.message};}
    await context.close();
    const nojs=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const np=await nojs.newPage();await np.goto(base);assert.ok(await np.locator('h1').isVisible());assert.ok(await np.locator('a[href="mailto:mironcukroman602@gmail.com"]').first().isVisible());await np.screenshot({path:`${out}/no-javascript.png`,fullPage:true});await nojs.close();check('no JavaScript','full static offer and direct contacts remain');
  }finally{fs.writeFileSync(`${out}/browser-results.json`,JSON.stringify(result,null,2));await browser.close();}
  assert.deepEqual(result.console,[]);if(result.axe?.violations)assert.deepEqual(result.axe.violations,[]);
})().catch(error=>{console.error(error);process.exitCode=1;});
