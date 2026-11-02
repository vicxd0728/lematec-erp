const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync('index.html','utf8');
const script=source.slice(source.indexOf('const THEMES='),source.indexOf('const ADMIN_ROLE_PIN_KEY='));
function setup(saved={}){
  const data={...saved},attrs={},writes=[];
  const document={documentElement:{style:{},setAttribute:(k,v)=>attrs[k]=v,getAttribute:k=>attrs[k],removeAttribute:k=>delete attrs[k]},getElementById:()=>null};
  const context=vm.createContext({document,localStorage:{getItem:k=>data[k]??null,setItem:(k,v)=>{data[k]=v;writes.push(k);}}});
  vm.runInContext(script,context);
  return {context,attrs,data,writes};
}
test('saved industrial, scene and font preferences restore without any business writes',()=>{
  const {attrs,writes,context}=setup({erp_theme:'industrial',erp_scene:'off',erp_font:'17'});
  assert.equal(attrs['data-theme'],'industrial');assert.equal(attrs['data-scene'],'off');
  assert.equal(vm.runInContext('document.documentElement.style.fontSize',context),'17px');assert.deepEqual(writes,[]);
});
test('all existing theme preferences persist and invalid inputs cannot change the selected theme',()=>{
  const {context,attrs,writes}=setup({erp_theme:'warm'});
  assert.equal(attrs['data-theme'],'warm');
  const keys=vm.runInContext('Object.keys(THEMES)',context);assert.equal(keys.length,14);
  for(const key of keys){vm.runInContext(`applyTheme(${JSON.stringify(key)})`,context);assert.equal(attrs['data-theme']||'tech',key);}
  vm.runInContext("applyTheme('industrial');applyTheme('__proto__')",context);assert.equal(attrs['data-theme'],'industrial');
  assert.ok(writes.every(k=>k==='erp_theme'));assert.equal(setup({erp_theme:'obsolete'}).attrs['data-theme'],'premium');
});
test('picker renders every option exactly once with explicit selected state and readable previews',()=>{
  const {context}=setup({erp_theme:'industrial'});
  const panel={innerHTML:'',querySelectorAll:()=>[],querySelector:()=>null};context.panel=panel;
  vm.runInContext('buildThemePanel(panel)',context);
  assert.equal((panel.innerHTML.match(/class="theme-option"/g)||[]).length,14);
  assert.equal((panel.innerHTML.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(panel.innerHTML,/data-tk="industrial" class="theme-option" aria-pressed="true"/);
  assert.equal((panel.innerHTML.match(/Aa 123/g)||[]).length,14);
  assert.doesNotMatch(panel.innerHTML,/undefined/);
});
