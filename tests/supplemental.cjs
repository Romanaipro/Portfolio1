const fs=require('node:fs');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('playwright');
const AxeBuilder=require('@axe-core/playwright').default;
const base='http://127.0.0.1:4174';
const results={contrast:[],axe:[],external:[],fontGeometry:{}};
const luminance=rgb=>{const v=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(c=>{c/=255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;});return .2126*v[0]+.7152*v[1]+.0722*v[2];};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});await context.route('**/webhook/**',r=>r.abort());const page=await context.newPage();
    const requests=[];page.on('response',r=>{if(r.url().startsWith(base))requests.push({url:r.url().replace(base,''),status:r.status()});});
    await page.goto(base);await page.evaluate(()=>document.fonts.ready);
    for(const index of [0,1,2])for(const state of ['normal','hover','focus']){
      const button=page.locator('.pricing-card .button').nth(index);await page.mouse.move(0,0);await page.locator('h1').evaluate(el=>el.tabIndex=-1);await page.locator('h1').focus();
      if(state==='hover')await button.hover();if(state==='focus')await button.focus();
      await page.waitForTimeout(220);
      const style=await button.evaluate(el=>{const s=getComputedStyle(el);return {foreground:s.color,background:s.backgroundColor,outline:s.outlineStyle,outlineWidth:s.outlineWidth};});
      const contrast=ratio(style.foreground,style.background);assert.ok(contrast>=4.5);if(state==='focus')assert.notEqual(style.outline,'none');results.contrast.push({package:index,state,ratio:contrast,...style});
    }
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});await page.goto(base);await page.locator('#show-all').click();const scan=await new AxeBuilder({page}).analyze();results.axe.push({state:'all-cases-'+width,violations:scan.violations});assert.deepEqual(scan.violations,[]);
      await page.locator('.case-card [data-case-link]').first().click();await page.waitForSelector('dialog[open]');const dialogScan=await new AxeBuilder({page}).analyze();results.axe.push({state:'dialog-'+width,violations:dialogScan.violations});assert.deepEqual(dialogScan.violations,[]);
      await page.locator('#name').evaluate(el=>el.focus());assert.ok(await page.locator('dialog[open]').evaluate(d=>d.contains(document.activeElement)));
      await page.locator('dialog[open] [data-context]').click();
      assert.equal(await page.locator('dialog[open]').count(),0);assert.ok(await page.locator('#name').evaluate(el=>el===document.activeElement));
    }
    // Failure of both enhancement scripts still leaves the static offer and contacts.
    const failure=await browser.newContext({viewport:{width:390,height:844}});await failure.route('**/assets/*.js',r=>r.abort());const fp=await failure.newPage();await fp.goto(base);assert.equal(await fp.locator('#contact-form').isVisible(),false);assert.ok(await fp.locator('a[href^="mailto:"]').first().isVisible());results.scriptFailure='static content/contact visible; inactive form hidden';await failure.close();
    const fonts=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await fonts.route('**/*.woff2',async r=>{await new Promise(resolve=>setTimeout(resolve,1600));await r.continue();});const p=await fonts.newPage();
    await p.goto(base,{waitUntil:'domcontentloaded'});
    const geometry=()=>p.evaluate(()=>Object.fromEntries(['.hero h1','.hero-actions','.hero-actions .primary','.hero-actions .ghost'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return [s,{x:r.x,y:r.y,width:r.width,height:r.height}];})));
    results.fontGeometry.initial=await geometry();await p.evaluate(()=>document.fonts.ready);results.fontGeometry.afterFontsReady=await geometry();assert.deepEqual(results.fontGeometry.initial,results.fontGeometry.afterFontsReady);await p.screenshot({path:'review/after/390-delayed-font.png'});await fonts.close();
    assert.equal(fs.readFileSync('index.html','utf8'),fs.readFileSync('Portfolio.html','utf8'));
    results.metadata=await page.evaluate(()=>({lang:document.documentElement.lang,h1:document.querySelectorAll('h1').length,canonical:document.querySelector('link[rel=canonical]').href,schema:JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)}));assert.equal(results.metadata.schema.priceRange,'від $300');assert.equal(results.metadata.h1,1);assert.equal(results.metadata.lang,'uk');results.localRequests=requests;assert.ok(requests.every(r=>r.status===200));
    await context.close();
    const original=execFileSync('git',['show','30965afbce47eef47fa09225867f2cbdc09e7a71:index.html'],{maxBuffer:1024*1024}).toString().replace('<head>','<head><base href="/">');
    const old=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});await old.route('**/webhook/**',r=>r.abort());await old.route('**/baseline-original',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:original}));const op=await old.newPage();await op.goto(base+'/baseline-original');await op.waitForSelector('#cases button');
    const caseButton=op.locator('.case-card-wrap button').first();results.baselineButton=await caseButton.textContent();await caseButton.click();await op.waitForSelector('[role=dialog]');await op.screenshot({path:'review/before/390-case-dialog.png'});await old.close();
    for(const url of ['https://urbantrend.com.ua','https://nardy-katalog.netlify.app/','https://github.com/Romanaipro','https://www.instagram.com/roma.ai.pro/','https://t.me/URBAN_TREND_SHOP_BOT','https://t.me/yedki_hub_test_bot','https://t.me/romanmuronchuk']){
      try{const r=await fetch(url,{method:'HEAD',signal:AbortSignal.timeout(10000)});results.external.push({url,status:r.status,finalUrl:r.url});}catch(error){results.external.push({url,error:error.message});}
    }
  }finally{fs.writeFileSync('review/after/supplemental.json',JSON.stringify(results,null,2));await browser.close();}
  console.log('Supplemental checks passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
