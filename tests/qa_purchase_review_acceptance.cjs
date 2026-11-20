// Actual renderer, isolated browser-memory mappings; never connects to production.
async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8781/?seed=confirmed&history=full');
  const original=await page.evaluate(()=>JSON.stringify(fakeState().saved));
  await page.getByRole('button',{name:'修改這筆對照',exact:true}).click();
  if(!await page.locator('#pl-unit-confirmed').isChecked()||await page.locator('#pl-factor').inputValue()!=='2.5')throw Error('opening a saved mapping cleared its confirmed factor');
  await page.locator('#pl-material-q').fill('Y-DEMO-02');await page.locator('#pl-candidates button').click();
  if(await page.locator('#pl-unit-confirmed').isChecked()||await page.locator('#pl-factor').inputValue()!=='')throw Error('different material inherited previous conversion');
  if(!(await page.locator('#pl-unit-warning').innerText()).includes('舊換算不會沿用'))throw Error('material change lacks conversion guidance');
  await page.evaluate(()=>{document.getElementById('mainContent').innerHTML=renderPurchaseLedger();loadPurchaseLedger();});
  if(await page.locator('#pl-unit-confirmed').isChecked()||await page.locator('#pl-factor').inputValue()!=='')throw Error('redraw restored old conversion');
  if(await page.locator('#pl-note').inputValue()!=='已確認備註')throw Error('conversion reset erased note');
  await page.getByRole('button',{name:'取消這筆編輯',exact:true}).click();
  if(await page.evaluate(()=>JSON.stringify(fakeState().saved))!==original)throw Error('editing/cancel overwrote saved mapping');
  await page.getByRole('button',{name:'期間進出核對',exact:true}).click();
  await page.getByRole('button',{name:'讀取本月期間進出總表',exact:true}).click();
  await page.locator('.pl-comparison-list article').waitFor();
  if(!(await page.getByLabel('正式核對統計').innerText()).includes('數量不同\n1 個料號'))throw Error('summary differs from detail population');
  const filter=page.getByRole('combobox',{name:'正式核對結果篩選'});
  await filter.selectOption('matched');if(await page.locator('.pl-comparison-list article').count())throw Error('matched filter included difference');
  if(!(await page.locator('.pl-comparison-list').innerText()).includes('目前篩選'))throw Error('filtered empty confused with globally empty');
  await filter.selectOption('difference');
  const card=page.locator('.pl-comparison-list article');
  await card.locator('.pl-compare-sources summary').click();
  if(!(await card.locator('.pl-compare-sources').innerText()).includes('原數量 10 × 2.5 → 25 個'))throw Error('source conversion unavailable');
  const tx=card.locator('[data-pl-tx]');await tx.locator('summary').click();
  if(await tx.locator('.pl-trial-source').count()!==10)throw Error('initial transaction slice wrong');
  await tx.getByRole('button',{name:'再顯示 10 筆交易',exact:true}).click();
  const expanded=page.locator('.pl-comparison-list [data-pl-tx]');
  if(!await expanded.evaluate(e=>e.open)||await expanded.locator('.pl-trial-source').count()!==12)throw Error('older transaction details unreachable');
  if(!(await expanded.innerText()).includes('IB-TEST-ONE')||(await expanded.innerText()).includes('OTHER-SKU-RECEIPT'))throw Error('transaction scope crossed SKU');
  await page.locator('.pl-compare-sources summary').click();
  await page.locator('#mainContent').evaluate(e=>Promise.allSettled(e.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.screenshot({path:'output/playwright/purchase-review-'+width+'.png',fullPage:true});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('horizontal page overflow');
  if(await page.evaluate(()=>fakeState().saveCount)!==0||await page.evaluate(()=>JSON.stringify(fakeState().saved))!==original)throw Error('review flow changed mapping');
  await page.evaluate(()=>failNextPeriod());await page.getByRole('button',{name:'讀取本月期間進出總表',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#mainContent').innerText.includes('合成期間總表失敗'));
  if(await page.locator('.pl-comparison-list article').count())throw Error('failed reload left misleading old comparison cards');
  await page.getByRole('button',{name:'讀取本月期間進出總表',exact:true}).click();await page.locator('.pl-comparison-list article').waitFor();
  await page.goto('http://127.0.0.1:8781/?seed=confirmed&role=ai');
  await page.getByRole('button',{name:'期間進出核對',exact:true}).click();await page.getByRole('button',{name:'讀取本月期間進出總表',exact:true}).click();
  await page.locator('.pl-comparison-list article').waitFor();
  if(await page.getByRole('button',{name:'核對這筆來源／換算',exact:true}).count())throw Error('read-only role can open write form');
 }
 if(errors.length)throw Error(errors.join('\n'));
}
