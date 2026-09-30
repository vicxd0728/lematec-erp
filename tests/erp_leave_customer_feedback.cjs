const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const {test}=require('node:test');

const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function section(start,end){
  const a=html.indexOf(start),b=html.indexOf(end,a+start.length);
  assert(a>=0&&b>a,`missing ${start}`);
  return html.slice(a,b);
}
function fields(values){return {getElementById:id=>({value:values[id]??''})};}

test('leave application rejects zero duration and preserves the form on a failed write',async()=>{
  const data={lv_name:'員工',lv_title:'',lv_type:'年假',lv_days:'0',lv_hours:'0',lv_from:'2026-10-01',lv_to:'2026-10-01',lv_proxy:'',lv_reason:''};
  let writes=0,closed=0;
  const toasts=[];
  const ctx=vm.createContext({document:fields(data),DB:{leave:'leave'},ROLE:'sales',
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    notionAPI:async()=>{writes++;return {object:'error',message:'服務失敗'};},
    assertNotionPage:result=>{if(result.object==='error')throw Error(result.message);return result;},
  });
  vm.runInContext(section('async function submitLeave(){','async function doApproveLeave('),ctx);
  await ctx.submitLeave();
  assert.equal(writes,0);
  assert(toasts.some(message=>message.includes('天數與時數')));
  data.lv_days='1';data.lv_hours='8';
  await ctx.submitLeave();
  assert.equal(writes,1);
  assert.equal(closed,0);
  assert(toasts.some(message=>message.includes('服務失敗')));
});

test('accepted leave remains successful when list refresh fails',async()=>{
  let closed=0;
  const toasts=[];
  const ctx=vm.createContext({document:fields({lv_name:'員工',lv_title:'',lv_type:'年假',lv_days:'1',lv_hours:'8',lv_from:'2026-10-01'}),DB:{leave:'leave'},ROLE:'sales',
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    notionAPI:async()=>({object:'page'}),assertNotionPage:result=>result,
    ensureLeaveEmployeeRecord:async()=>null,logUserAction:()=>{},
    refreshAffectedData:async()=>{throw Error('讀取失敗');},leaveDurationLabel:()=>'',
  });
  vm.runInContext(section('async function submitLeave(){','async function doApproveLeave('),ctx);
  await ctx.submitLeave();
  assert.equal(closed,1);
  assert(toasts.some(message=>message.includes('已送出，但清單更新失敗')));
  assert(!toasts.some(message=>message.includes('送出失敗')));
});

test('leave edit retains the form when the update fails',async()=>{
  let closed=0;
  const toasts=[];
  const ctx=vm.createContext({document:fields({elv_name:'員工',elv_title:'',elv_type:'年假',elv_status:'待審核',elv_days:'1',elv_hours:'8',elv_from:'2026-10-01'}),
    leaves:[{id:'id',name:'員工',status:'待審核'}],ROLE:'sales',ROLES:{sales:{label:'業務'}},
    normalizeLeaveStatus:value=>value,showToast:message=>toasts.push(message),closeModal:()=>closed++,
    updatePage:async()=>{throw Error('服務失敗');},
  });
  vm.runInContext(section('async function saveEditLeave(','function openDeleteLeave('),ctx);
  await ctx.saveEditLeave('id');
  assert.equal(closed,0);
  assert(toasts.some(message=>message.includes('服務失敗')));
});

test('customer creation preserves form on write failure and distinguishes refresh failure',async()=>{
  let closed=0,accepted=false;
  const toasts=[];
  const ctx=vm.createContext({document:fields({nc_name:'客戶',nc_code:'C-1',nc_region:''}),DB:{custMaster:'customers'},ROLE:'sales',
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    notionAPI:async()=>accepted?{object:'page'}:{object:'error',message:'服務失敗'},
    assertNotionPage:result=>{if(result.object==='error')throw Error(result.message);return result;},
    logUserAction:()=>{},refreshAffectedData:async()=>{throw Error('讀取失敗');},
  });
  vm.runInContext(section('async function submitNewCustomer(){','async function submitCorder('),ctx);
  await ctx.submitNewCustomer();
  assert.equal(closed,0);
  accepted=true;
  await ctx.submitNewCustomer();
  assert.equal(closed,1);
  assert(toasts.some(message=>message.includes('已建立，但清單更新失敗')));
});

test('schedule save distinguishes accepted write from failed reload',async()=>{
  let closed=0;
  const toasts=[];
  const ctx=vm.createContext({document:fields({sc_name:'工作',sc_start:'2026-10-01',sc_end:'2026-10-02',sc_note:''}),DB:{schedule:'schedule'},
    showToast:message=>toasts.push(message),closeModal:()=>closed++,
    createPage:async()=>({object:'page'}),loadSchedule:async()=>{throw Error('讀取失敗');},renderTab:()=>{},
  });
  vm.runInContext(section('async function saveSchedule(','function openModal('),ctx);
  await ctx.saveSchedule('');
  assert.equal(closed,1);
  assert(toasts.some(message=>message.includes('已儲存，但清單更新失敗')));
  assert(!toasts.some(message=>message.startsWith('❌')));
});
