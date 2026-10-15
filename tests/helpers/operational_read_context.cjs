const vm=require('node:vm');
module.exports=function installLoadedReadFixture(ctx,html){
  // These older list fixtures represent an already loaded (possibly empty) snapshot.
  ctx.window._picksLoaded=true;ctx.window._inboundsLoaded=true;
  const start=html.indexOf('function operationalReadState('),end=html.indexOf('async function readPicks(',start);
  if(start<0||end<start)throw Error('operational read helpers missing');
  vm.runInContext(html.slice(start,end),ctx);
};
