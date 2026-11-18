// Same installed Chrome, simulated Lighthouse throttling and cold storage for every run.
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const out='review/performance';fs.mkdirSync(out,{recursive:true});
(async()=>{
  const {default:lighthouse}=await import('lighthouse');
  const {launch}=await import('chrome-launcher');
  const {default:desktopConfig}=await import('lighthouse/core/config/desktop-config.js');
  const original=execFileSync('git',['show','30965afbce47eef47fa09225867f2cbdc09e7a71:index.html'],{maxBuffer:1024*1024});
  const server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(original);return;}
    const file=path.resolve('.','.'+url.pathname);
    if(!file.startsWith(path.resolve('.')+path.sep)){res.writeHead(403).end();return;}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':'application/octet-stream');res.end(data);});
  });
  await new Promise(r=>server.listen(4175,'127.0.0.1',r));
  const desktopOnly=process.argv.includes('--desktop-only');
  const runs=desktopOnly?JSON.parse(fs.readFileSync(`${out}/summary.json`,'utf8')).filter(r=>r.formFactor!=='desktop'):[];
  try{
    for(const version of desktopOnly?[]:['before','after'])for(let i=1;i<=3;i++){
      const chrome=await launch({chromeFlags:['--headless=new','--no-sandbox','--disable-dev-shm-usage']});
      try{
        const report=await lighthouse(`http://127.0.0.1:${version==='before'?4175:4174}/`,{port:chrome.port,output:'json',onlyCategories:['performance','accessibility','best-practices','seo'],logLevel:'error',blockedUrlPatterns:['*n8n.myproject.pp.ua*'],throttlingMethod:'simulate'});
        fs.writeFileSync(`${out}/${version}-mobile-${i}.json`,report.report);
        const a=report.lhr.audits;
        const shifts=a['layout-shifts']||a['layout-shift-elements']||a['cls-culprits-insight'];
        const row={version,run:i,formFactor:'mobile',lcp:a['largest-contentful-paint'].numericValue,cls:a['cumulative-layout-shift'].numericValue,fcp:a['first-contentful-paint'].numericValue,scores:Object.fromEntries(Object.entries(report.lhr.categories).map(([k,v])=>[k,v.score])),shifts:shifts?.details||null,userAgent:report.lhr.environment.hostUserAgent,lighthouse:report.lhr.lighthouseVersion};
        runs.push(row);fs.writeFileSync(`${out}/summary.json`,JSON.stringify(runs,null,2));console.log(JSON.stringify({...row,shifts:undefined}));
      }finally{await chrome.kill();}
    }
    const chrome=await launch({chromeFlags:['--headless=new','--no-sandbox']});
    try{const report=await lighthouse('http://127.0.0.1:4174/',{port:chrome.port,output:'json',onlyCategories:['performance','accessibility','best-practices','seo'],logLevel:'error',blockedUrlPatterns:['*n8n.myproject.pp.ua*']},desktopConfig);assertDesktop(report.lhr);fs.writeFileSync(`${out}/after-desktop.json`,report.report);runs.push({version:'after',formFactor:'desktop',lcp:report.lhr.audits['largest-contentful-paint'].numericValue,cls:report.lhr.audits['cumulative-layout-shift'].numericValue,scores:Object.fromEntries(Object.entries(report.lhr.categories).map(([k,v])=>[k,v.score]))});fs.writeFileSync(`${out}/summary.json`,JSON.stringify(runs,null,2));console.log('Desktop complete');}finally{await chrome.kill();}
  }finally{await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;});
function assertDesktop(lhr){if(lhr.configSettings.formFactor!=='desktop')throw Error('Expected desktop Lighthouse configuration');}
