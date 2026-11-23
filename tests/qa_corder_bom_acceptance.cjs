async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8782');
  await page.getByRole('button',{name:'重新讀取 BOM 並檢查',exact:true}).waitFor();
  const confirm=page.getByRole('button',{name:'確認匯入並扣庫',exact:true}),retry=page.getByRole('button',{name:'重新讀取 BOM 並檢查',exact:true});
  if(!await confirm.isDisabled()||!(await page.getByRole('status').innerText()).includes('不需重傳'))throw Error('failure does not explain safe same-preview recovery');
  if((await page.locator('.preflight-list').innerText()).includes('庫存主檔找不到料號'))throw Error('failed read was mislabeled as missing materials');
  await retry.click();await page.waitForFunction(()=>!window._corderImportPreviewBusy);
  if(!await confirm.isDisabled())throw Error('repeated failure unlocked import');
  await retry.scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/corder-bom-failure-'+width+'.png',fullPage:false});
  await page.evaluate(()=>{setFailure(false);holdNextBom()});await retry.click();
  await page.waitForFunction(()=>window.qaState().requests.length===6);
  if(!await retry.isDisabled()||!await confirm.isDisabled())throw Error('in-flight retry permits overlapping actions');
  await page.evaluate(()=>retryCorderImportPreflight());if(await page.evaluate(()=>qaState().requests.length)!==6)throw Error('double click repeated data fetch');
  await page.evaluate(()=>releaseBom());await page.waitForFunction(()=>!window._corderImportPreviewBusy&&window._corderImportPreflight?.errors===0);
  if(await confirm.isDisabled()||await page.evaluate(()=>window._corderImportPreflight.rows.length)!==4)throw Error('retry failed to restore all original rows');
  if(!(await page.getByRole('status').innerText()).includes('尚未建單或扣料'))throw Error('successful read implies business execution');
  if(await retry.count())throw Error('normal upload added an unnecessary retry step');
  await confirm.scrollIntoViewIfNeeded();await page.screenshot({path:'output/playwright/corder-bom-recovered-'+width+'.png',fullPage:false});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('page horizontal overflow');
  if(await page.evaluate(()=>qaState().requests.some(r=>r.method!=='GET'))||await page.evaluate(()=>window._corderImportPreflight.incoming.length)!==4)throw Error('preview recovery changed input or wrote business data');
 }
 if(errors.length)throw Error(errors.join('\n'));
}
