// Developer-only Edge QA. Uses existing Playwright; no dependency installation.
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const cashKey = 'budgetlens.cashflow.v1', debtKey = 'debtpayoff.debts.v1', histKey = 'moneyhub.ledger_history.v1';
const cash = {monthlyIncome:3000,monthlySpending:2500,monthlyKept:500,savingsRate:1/6,topCategories:[],attackSource:{monthly:100,items:[]}};
const debt = [{balance:1000,apr:12,min:50}];
const previous = JSON.stringify([{d:'2026-10-01',kept:400,debt:1200,attack:100}]);
const cases = [
  {name:'empty', values:{}},
  {name:'valid', values:{[cashKey]:JSON.stringify(cash),[debtKey]:JSON.stringify(debt)}},
  ...['{broken','{}','[null]'].map(raw=>({name:'bad history '+raw,values:{[cashKey]:JSON.stringify(cash),[debtKey]:JSON.stringify(debt),[histKey]:raw},warn:true,preserve:true})),
  ...['{}','[null]','[{"balance":"junk","apr":12,"min":50}]'].map(raw=>({name:'bad debts '+raw,values:{[cashKey]:JSON.stringify(cash),[debtKey]:raw,[histKey]:previous},warn:true,preserve:true})),
  {name:'bad categories',values:{[cashKey]:JSON.stringify({...cash,topCategories:[null]}),[debtKey]:JSON.stringify(debt),[histKey]:previous},warn:true,preserve:true},
  {name:'missing debt source',values:{[cashKey]:JSON.stringify(cash),[histKey]:previous},warn:true,preserve:true},
  {name:'failed history write',values:{[cashKey]:JSON.stringify(cash),[debtKey]:JSON.stringify(debt),[histKey]:previous},blockWrite:true,warn:true,preserve:true},
  {name:'blocked reads',values:{[cashKey]:JSON.stringify(cash),[debtKey]:JSON.stringify(debt),[histKey]:previous},blockRead:true,warn:true,preserve:true},
  {name:'nonpositive kept with debt',values:{[cashKey]:JSON.stringify({...cash,monthlyKept:-100,savingsRate:-1/30}),[debtKey]:JSON.stringify(debt)}}
];
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const width of [1440,390]) for(const fixture of cases) {
      const context=await browser.newContext({viewport:{width,height:900}});
      const page=await context.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.route(/^https?:/,r=>r.abort()); // includes externally hosted fonts
      await page.addInitScript(({fixture,keys})=>{
        const read=Storage.prototype.getItem,write=Storage.prototype.setItem;
        for(const [key,value] of Object.entries(fixture.values)) write.call(localStorage,key,value);
        window.qaSnapshot=()=>Object.fromEntries(keys.map(key=>[key,read.call(localStorage,key)]));
        window.qaBefore=window.qaSnapshot();
        if(fixture.blockRead) Storage.prototype.getItem=function(){throw new DOMException('Synthetic blocked storage','SecurityError');};
        if(fixture.blockWrite) Storage.prototype.setItem=function(key,value){if(key===keys[2])throw new DOMException('Synthetic full storage','QuotaExceededError');return write.call(this,key,value);};
      },{fixture,keys:[cashKey,debtKey,histKey]});
      await page.goto(pathToFileURL(path.join(__dirname,'../index.html')).href,{waitUntil:'domcontentloaded'});
      await page.locator('#cards .card').first().waitFor();
      if(fixture.warn) assert.equal(await page.locator('#data-status').isVisible(),true,fixture.name);
      if(fixture.preserve) assert.deepEqual(await page.evaluate(()=>qaSnapshot()),await page.evaluate(()=>qaBefore),fixture.name);
      if(fixture.blockWrite) assert.match(await page.locator('#hist-verdict').innerText(),/could not be saved/);
      if(fixture.name==='nonpositive kept with debt') assert(!/No debts/.test(await page.locator('#l-verdict').innerText()));
      if(fixture.name==='valid') {
        assert.match(await page.locator('#l-debt').innerText(),/1,000/);
        assert.equal(await page.locator('#data-status').isVisible(),false);
        await page.evaluate(({cashKey,debtKey})=>{
          localStorage.removeItem(cashKey);localStorage.removeItem(debtKey);
          window.dispatchEvent(new StorageEvent('storage',{key:cashKey}));
        },{cashKey,debtKey});
        for(const id of ['l-income','l-spend','l-kept','l-rate-val','l-debt','l-mins','l-interest','h-projected']) assert.equal(await page.locator('#'+id).innerText(),'—');
        assert.equal(await page.locator('#l-apply').getAttribute('href'),null);
        assert.equal(await page.locator('#l-apply').getAttribute('aria-disabled'),'true');
      }
      await page.locator('#search').fill('debt');
      assert.equal(await page.locator('#cards .card').count(),1,'Search stays usable');
      assert.deepEqual(errors,[],fixture.name);
      await context.close();
      console.log('PASS '+width+' '+fixture.name);
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
