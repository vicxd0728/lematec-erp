const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const code=html.slice(html.indexOf('// 行銷時程表直接以 Notion 為主資料'),html.indexOf('function renderVideoLibrary(){'));

function row({id='row-1',title='海報',status='未開始',legacy='未開始',edited='v1',icon}={}){
  return {object:'page',id,url:`https://notion.so/${id}`,last_edited_time:edited,parent:{data_source_id:'812a963f-e986-482c-9041-cb7bd3f1a20b'},icon,
    properties:{'名稱':{title:[{plain_text:title}]},'日期':{date:{start:'2026-10-02',end:null}},'狀態':{status:{name:status}},'狀態1':{status:{name:legacy}},'指派':{people:[]}}};
}
function setup({pages=[row()],fresh=row(),onWrite=async()=>({object:'page',id:'row-1'})}={}){
  const notices=[];
  const calls=[];
  const fields={marketingTitle:{value:'海報更新'},marketingStart:{value:'2026-10-02'},marketingEnd:{value:''},marketingStatus:{value:'完成'},marketingSaveButton:{disabled:false}};
  const ctx=vm.createContext({
    ROLE:'vic',TOKEN:'test-token',PROXY:'https://example.test',CURRENT_TAB:'videos',
    Date,Intl,console,
    document:{getElementById:id=>fields[id]},
    getTitle:(props,key)=>props[key]?.title?.[0]?.plain_text||'',
    escapeHtml:value=>String(value??''),
    todayStr:()=> '2026-10-02',
    isModalOpen:()=>false,
    renderTab:()=>{},
    showToast:(message,kind)=>notices.push({message,kind}),
    closeModal:()=>{},
    notionProxyRequest:async payload=>{
      calls.push(payload);
      if(payload.endpoint.startsWith('data_sources/'))return {object:'list',results:pages,has_more:false};
      if(payload.endpoint.startsWith('pages/'))return fresh;
      throw new Error('unexpected read');
    },
    fetch:async(_url,options)=>{
      const payload=JSON.parse(options.body);calls.push(payload);
      return {ok:true,json:async()=>onWrite(payload)};
    },
    _notionCacheEpoch:0
  });
  vm.runInContext(code,ctx);
  return {ctx,notices,calls,fields};
}

test('media hub contains separate video and marketing tabs',()=>{
  assert.match(html,/videos:'🎬 影音專區'/);
  assert.match(html,/if\(tab==='videos'\)\{c\.innerHTML=renderMediaHub\(\);return;\}/);
  assert.match(html,/role="tablist" aria-label="影音專區內容"/);
});

test('secondary status divergence is disclosed without marking each row broken',()=>{
  const s=setup();
  const normal=s.ctx.marketingPageRow(row({status:'完成',legacy:'未開始'}));
  assert.equal(s.ctx.marketingStatusColumnsDiffer(normal),true);
  assert.equal(s.ctx.marketingRowMismatch(normal),'');
  const icon=s.ctx.marketingPageRow(row({status:'未開始',legacy:'未開始',icon:{type:'emoji',emoji:'✅'}}));
  assert.match(s.ctx.marketingRowMismatch(icon),/圖示或標題標示完成/);
});

test('marketing reads current Notion data source rather than ERP production schedule',async()=>{
  const s=setup();
  await s.ctx.loadMarketingSchedule();
  assert.equal(vm.runInContext('marketingRows.length',s.ctx),1);
  assert.match(s.calls[0].endpoint,/data_sources\/812a963f-e986-482c-9041-cb7bd3f1a20b\/query/);
  assert.equal(s.calls[0].notionVersion,'2026-03-11');
});

test('concurrent Notion change blocks ERP write',async()=>{
  const s=setup({fresh:row({edited:'v2'})});
  await s.ctx.loadMarketingSchedule();
  await s.ctx.saveMarketingSchedule('row-1');
  assert.equal(s.calls.filter(c=>c.method==='PATCH').length,0);
  assert.match(s.notices.at(-1).message,/較新的修改/);
});

test('ERP update preserves assignment and legacy status, then reads back',async()=>{
  const saved=row({title:'海報更新',status:'完成'});
  const s=setup({fresh:saved});
  await s.ctx.loadMarketingSchedule();
  await s.ctx.saveMarketingSchedule('row-1');
  const write=s.calls.find(c=>c.method==='PATCH');
  assert.equal(write.endpoint,'pages/row-1');
  assert.deepEqual(Object.keys(write.body.properties).sort(),['名稱','日期','狀態'].sort());
  assert.match(s.notices.at(-1).message,/回讀確認/);
});

test('new marketing event is created in the original Notion data source',async()=>{
  const saved=row({title:'海報更新',status:'完成'});
  const s=setup({pages:[],fresh:saved});
  await s.ctx.saveMarketingSchedule();
  const write=s.calls.find(c=>c.method==='POST'&&c.endpoint==='pages');
  assert.equal(write.body.parent.data_source_id,'812a963f-e986-482c-9041-cb7bd3f1a20b');
  assert.equal(write.body.properties['名稱'].title[0].text.content,'海報更新');
  assert.match(s.notices.at(-1).message,/回讀確認/);
});

test('read-only ERP roles cannot submit a marketing write',async()=>{
  const s=setup();
  s.ctx.ROLE='ai';
  await s.ctx.saveMarketingSchedule();
  assert.equal(s.calls.length,0);
  assert.match(s.notices.at(-1).message,/僅能查看/);
});
