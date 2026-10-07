/* Browser-local action references. They are navigation aids, never proof of a server write. */
(function(root){
  'use strict';
  const KEY='lematec_erp_action_receipts_v1';
  const LIMIT=40;
  let fallback=[];
  const storage=()=>{try{return root.localStorage||null;}catch{return null;}};
  function read(){
    try{
      const saved=storage()?.getItem(KEY);
      const rows=saved?JSON.parse(saved):fallback;
      return Array.isArray(rows)?rows.filter(row=>row&&typeof row.id==='string'&&typeof row.kind==='string').slice(0,LIMIT):[];
    }catch{return fallback.slice(0,LIMIT);}
  }
  function write(rows){
    fallback=rows.slice(0,LIMIT);
    try{storage()?.setItem(KEY,JSON.stringify(fallback));}catch{}
  }
  function start(kind,reference,targetId='',role=''){
    const id=typeof root.crypto?.randomUUID==='function'?root.crypto.randomUUID():`${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const now=new Date().toISOString();
    const row={id,kind:String(kind).slice(0,40),reference:String(reference||'').slice(0,100),targetId:String(targetId||'').slice(0,100),role:String(role||'').slice(0,30),state:'processing',createdAt:now,updatedAt:now};
    write([row,...read()]);
    return id;
  }
  function mark(id,state){
    if(!['accepted','uncertain'].includes(state))return false;
    const rows=read(),row=rows.find(item=>item.id===id);
    if(!row)return false;
    row.state=state;row.updatedAt=new Date().toISOString();
    write(rows);
    return true;
  }
  function dismiss(id){write(read().filter(item=>item.id!==id));}
  root.erpActionReceipts={start,mark,list:read,dismiss};
})(window);
