const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=(a,b)=>html.slice(html.indexOf(a),html.indexOf(b,html.indexOf(a)+a.length));

test('visible session time excludes hidden time and caps a missed heartbeat',()=>{
 let now=1000,visibility='visible',onVisibility;
 const document={get visibilityState(){return visibility;},addEventListener:(name,fn)=>{if(name==='visibilitychange')onVisibility=fn;}};
 const context=vm.createContext({document,Date:{now:()=>now}});
 vm.runInContext('let _loginStartedAt=1000,_loginVisibleMs=0,_loginTimeTick=1000,_loginWasVisible=true;'+source('function loginDurationSeconds(){','function loginAuditProps('),context);
 now=21000;assert.equal(context.loginDurationSeconds(),20);
 now=26000;visibility='hidden';onVisibility();assert.equal(context.loginDurationSeconds(),25);
 now=3600000;assert.equal(context.loginDurationSeconds(),25);
 visibility='visible';onVisibility();now+=20000;assert.equal(context.loginDurationSeconds(),45);
 now+=120000;assert.equal(context.loginDurationSeconds(),75);
});

test('role cards put cumulative time first and rank by time before login count',()=>{
 const logs=[
  {role:'A',count:20,seconds:600,loginAt:'2026-11-09T01:00:00Z',status:'離線'},
  {role:'B',count:1,seconds:7200,loginAt:'2026-11-09T02:00:00Z',status:'離線'}
 ];
 const c=vm.createContext({window:{},loginLogs:logs,filterLoginLogsByRange:x=>x,escapeHtml:String,fmtDateTime:String,pill:String});
 vm.runInContext(source('function loginDurationLabel(seconds){','const THEMES='),c);
 const output=c.renderLoginAuditPanel();
 assert(output.indexOf('2 小時')<output.indexOf('10 分鐘'));
 assert.match(output,/2 小時<\/div>\s*<div[^>]*>累積在線 · 登入 1 次/);
 assert.match(output,/依累積在線時間排序/);
});
