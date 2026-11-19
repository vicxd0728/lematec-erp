// Run via playwright-cli run-code --filename against qa_purchase_ledger_server.cjs.
async page=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [1440,390]){
  await page.setViewportSize({width,height:1000});await page.goto('http://127.0.0.1:8781');
  const first=page.locator('[data-pl-row="0"]');await first.locator('.pl-candidate').first().waitFor();
  const left=await first.locator('.pl-source').boundingBox(),right=await first.locator('.pl-target').boundingBox();
  if(width>700&&(await first.boundingBox()).width<1000)throw Error('desktop review row is squeezed into a multi-card column');
  if(width>700&&!(right.x>left.x&&Math.abs(right.y-left.y)<2))throw Error('desktop pair is not side-by-side');
  if(width<700&&!(right.y>left.y))throw Error('mobile pair is not grouped vertically');
  await first.locator('.pl-candidate').first().click();await page.locator('#pl-save').waitFor();
  if(await page.evaluate(()=>fakeState().saveCount)!==0)throw Error('candidate selection wrote a mapping');
  if(!await page.getByRole('combobox',{name:'帳務月份'}).isDisabled())throw Error('editing permits ambiguous period switch');
  await page.locator('#pl-note').fill('人工備註保留測試');
  await page.locator('#pl-material-q').fill('NO-MATCH');
  if(!(await page.locator('#pl-candidates').innerText()).includes('找不到料號'))throw Error('search claims old selection is a new match');
  await first.locator('.pl-candidate').last().click();
  if(await page.locator('#pl-note').inputValue()!=='人工備註保留測試')throw Error('selection lost notes');
  await page.getByRole('button',{name:'取消這筆編輯',exact:true}).click();
  if(await page.evaluate(()=>fakeState().saved.length)!==0)throw Error('cancel persisted a mapping');
  await first.locator('.pl-candidate').first().click();
  await page.locator('#mainContent').evaluate(e=>Promise.allSettled(e.getAnimations({subtree:true}).filter(a=>a.effect.getTiming().iterations!==Infinity).map(a=>a.finished)));
  await page.screenshot({path:'output/inline-select-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'確認並儲存這筆對照',exact:true}).click();
  await page.waitForFunction(()=>window.fakeState().saved.length===1&&!document.querySelector('#pl-save'));
  if(await page.evaluate(()=>fakeState().saveCount)!==1)throw Error('confirmation submitted more than once');
  if(!(await page.locator('#mainContent').innerText()).includes('Y-DEMO01 → Y-DEMO-01'))throw Error('saved identity is unclear');
  await page.getByRole('button',{name:'下一筆待確認',exact:true}).click();
  await page.getByRole('button',{name:'確認並儲存這筆對照',exact:true}).click();
  if(await page.evaluate(()=>fakeState().saveCount)!==1)throw Error('unmatched row saved without a selected material');
  if(!(await page.locator('#pl-save-state').innerText()).includes('請選擇既有料號'))throw Error('missing selection lacks guidance');
  await page.locator('#pl-kind').selectOption('expense');
  if(await page.evaluate(()=>fakeState().saveCount)!==1)throw Error('classification auto-saved');
  await page.getByRole('button',{name:'確認並儲存這筆對照',exact:true}).click();
  await page.waitForFunction(()=>window.fakeState().saved.length===2&&!document.querySelector('#pl-save'));
  await first.getByRole('button',{name:'修改這筆對照',exact:true}).click();
  await page.evaluate(()=>failNextSave());await page.getByRole('button',{name:'確認並儲存這筆對照',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('#pl-save-state').textContent.includes('勿重送'));
  if(!await page.locator('#pl-save').isDisabled())throw Error('uncertain result permits replay');
  await page.screenshot({path:'output/inline-failure-'+width+'.png',fullPage:true});
  await page.getByRole('button',{name:'結束編輯並重新讀取',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('#pl-save')&&document.querySelector('.pl-toolbar button').disabled===false);
  if(await page.evaluate(()=>fakeState().saveCount)!==3)throw Error('reload retried mapping mutation');
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('horizontal overflow');
  await page.goto('http://127.0.0.1:8781/?role=ai');await page.waitForFunction(()=>document.querySelector('.pl-candidate'));
  if(!await page.locator('.pl-candidate').first().isDisabled())throw Error('AI candidate can edit');
  if(await page.locator('#pl-save').count())throw Error('AI has save control');
 }
 if(errors.length)throw Error(errors.join('\n'));
}
