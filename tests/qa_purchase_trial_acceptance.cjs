// Isolated actual-renderer trial: no official mappings or stock writes.
async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8781/?view=trial');
  await page.waitForFunction(()=>document.querySelector('#mainContent').innerText.includes('差異')&&document.querySelector('.pl-trial-warning button')?.disabled===false);
  const text=await page.locator('#mainContent').innerText();
  for(const word of ['尚未核定','單位假設','ERP 進貨入庫','暫算差異','疑似費用'])if(!text.includes(word))throw Error('missing trial basis '+word);
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('trial auto-saved mappings');
  await page.getByRole('button',{name:'重新試跑（只讀資料）',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.pl-trial-warning button')?.disabled===false);
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('rerun auto-saved mappings');
  await page.locator('#mainContent').evaluate(e=>Promise.allSettled(e.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.screenshot({path:'output/trial-'+width+'.png',fullPage:true});
  await page.evaluate(()=>failNextPeriod());await page.getByRole('button',{name:'重新試跑（只讀資料）',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#mainContent').innerText.includes('合成期間總表失敗'));
  if(!(await page.locator('#mainContent').innerText()).includes('不把庫存讀取失敗當作 0 入庫'))throw Error('failed period read implies zero');
  await page.getByRole('button',{name:'重新試跑（只讀資料）',exact:true}).click();await page.waitForFunction(()=>document.querySelector('.pl-trial-warning button')?.disabled===false);
  const filter=page.getByRole('combobox',{name:'試跑差異篩選'});await filter.selectOption('matched');
  if(await page.locator('.pl-trial-models .pl-record').count())throw Error('provisional data treated as confirmed match');
  await filter.selectOption('difference');if(await page.locator('.pl-trial-models .pl-record').count()!==1)throw Error('difference count mismatch');
  const tx=page.locator('.pl-trial-models details').filter({has:page.locator('summary').filter({hasText:'本月正式庫存交易'})});
  await tx.locator('summary').click();
  if(!(await tx.innerText()).includes('IB-TEST-ONE')||(await tx.innerText()).includes('OTHER-SKU-RECEIPT'))throw Error('transaction detail did not match exact SKU');
  await page.getByRole('button',{name:'核對來源單位／換算',exact:true}).click();
  if(!await page.locator('.pl-inline-form details').evaluate(e=>e.open))throw Error('unit shortcut hid conversion');
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('unit shortcut wrote a mapping');
  await page.getByRole('button',{name:'取消這筆編輯',exact:true}).click();await page.getByRole('button',{name:'系統試跑',exact:true}).click();
  const source=page.locator('.pl-trial-originals').first();await source.locator('summary').click();
  await source.getByRole('button',{name:'檢查／校正這筆',exact:true}).click();
  await page.locator('#pl-save').waitFor();
  if(!(await page.locator('.pl-source').first().innerText()).includes('Y-DEMO01'))throw Error('trial correction lost original group');
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('opening correction wrote a mapping');
  await page.getByRole('button',{name:'取消這筆編輯',exact:true}).click();
  await page.getByRole('button',{name:'系統試跑',exact:true}).click();
  await page.getByRole('combobox',{name:'帳務月份'}).selectOption('2026-09');
  await page.waitForFunction(()=>document.querySelector('.pl-trial-warning button')?.disabled===false);
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('period switch wrote a mapping');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('overflow');
  await page.goto('http://127.0.0.1:8781/?view=trial&role=ai');
  await page.waitForFunction(()=>document.querySelector('.pl-trial-warning button')?.disabled===false);
  if(await page.getByRole('button',{name:'檢查／校正這筆',exact:true}).count())throw Error('AI can correct mappings');
 }
 if(errors.length)throw Error(errors.join('\n'));
}
