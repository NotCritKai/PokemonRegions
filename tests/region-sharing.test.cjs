const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText, {exports, ...globals});
  return exports;
}
const sharing = load('src/utils/region-sharing.ts', {window: {location: {origin: 'https://test.example'}}});
test('snapshot links strip device metadata and preserve literal percentages', () => {
  const link = sharing.createRegionShareLink({name:'100% Forest',temporary:true,sharePermission:'edit',liveRoomCode:'private',sharedLinkKey:'old',sharedComments:['private']},'view');
  const parsed = new URL(link);
  const region = sharing.decodeSharedRegion(parsed.searchParams.get('sharedRegion'));
  assert.equal(region.name,'100% Forest');
  for(const key of ['temporary','sharePermission','liveRoomCode','sharedLinkKey','sharedComments']) assert.equal(region[key],undefined);
  assert.equal(parsed.searchParams.get('permission'),'view');
  assert.throws(()=>sharing.decodeSharedRegion('[]'));
  assert.throws(()=>sharing.decodeSharedRegion('null'));
});
const source = fs.readFileSync('src/app/my-regions.tsx','utf8');
const ast = ts.createSourceFile('screen.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const functions = new Map();
function visit(node) { if(ts.isFunctionDeclaration(node)&&node.name) functions.set(node.name.text,node.getText(ast)); ts.forEachChild(node,visit); }
visit(ast);
function runHandler(name, globals, args=[]) {
  const code = ['canEditRegion','canEditContent',name].map(n=>functions.get(n)).join('\n');
  const context = {saveRecoverySnapshot:()=>true, selectedGimmicks: [], ...globals,args};
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\n'+name+'(...args);',context);
}
for(const permission of ['view','comment']) test(permission+' permission blocks every content save/removal handler',()=>{
  const methods = ['toggleGimmick','openGimmickCreate','saveNewGimmick','saveRegionGimmicks','saveMusic','openMusicEditor','chooseMusicFile','saveMusicEntry','removeMusicEntry','addRoute','removeRoute','addGyms','addSuggestedGyms','openCustomGymMenu','addCustomGyms','saveTeam','saveGym','removeGym','addEliteFour','addChampion','saveEliteMember','removeEliteFour','removeChampion','startMapDrag','moveMapDrag','finishMapDrag','saveRoute'];
  for(const method of methods) runHandler(method,{contentRegionIndex:0,regions:[{sharePermission:permission}],setRegions:()=>assert.fail(method+' mutated a read-only region')});
  runHandler('saveRegion',{editingRegionIndex:0,regions:[{sharePermission:permission}],setRegions:()=>assert.fail('saveRegion mutated read-only region')});
  runHandler('openEditMenu',{regions:[{sharePermission:permission}]},[0]);
});
test('route deletion preserves surviving route names and assigned Pokemon',()=>{
  let regions=[{routeNames:['Route 1','Route 2'],routePokemon:{'Route 1':[{name:'a'}],'Route 2':[{name:'b'}]},routeDetails:{'Route 1':{},'Route 2':{terrain:'Forest'}}}];
  runHandler('removeRoute',{contentRegionIndex:0,regions,setRegions:fn=>{regions=fn(regions)}},[0]);
  assert.equal(regions[0].routeNames[0],'Route 2');
  assert.equal(regions[0].routePokemon['Route 2'][0].name,'b');
  assert.equal(regions[0].routePokemon['Route 1'],undefined);
});
test('persistent recovery survives reload and preserves later edits',()=>{
  const storage=new Map();
  const local={readLocalData:key=>storage.get(key),saveLocalData:(key,value)=>{storage.set(key,value);return true}};
  const globals={window:{},require:()=>local};
  const recovery=load('src/utils/region-recovery.ts',globals);
  const entry={id:'recover-1',name:'Original',region:{name:'Original'},index:0,deletedAt:new Date().toISOString(),kind:'region'};
  assert.equal(recovery.saveRecovery([entry]),true);
  const reloaded=load('src/utils/region-recovery.ts',globals);
  assert.equal(reloaded.readRecovery()[0].id,entry.id);
  const current=[{name:'Later addition'}];
  const next=reloaded.recoverRegion(current,entry);
  assert.equal(next[0].name,'Original');assert.equal(next[1],current[0]);
  assert.equal(reloaded.recoverRegion(next,entry),next);
  const snapshot={...entry,id:'snapshot',kind:'snapshot'};
  const copies=reloaded.recoverRegion([{name:'Edited original'}],snapshot);
  assert.equal(copies[0].name,'Edited original');assert.equal(copies[1].name,'Original (Recovered)');
});
test('recovery replaces a reopened preview but never overwrites an accepted shared copy',()=>{
  const recovery=load('src/utils/region-recovery.ts',{require:()=>({})});
  const entry={id:'r',region:{name:'Original',sharedLinkKey:'same'},index:0,kind:'region'};
  const current=[{name:'Edited',sharedLinkKey:'same',temporary:false}];
  assert.equal(recovery.recoverRegion(current,entry),current);
  const result=recovery.recoverRegion([{name:'Preview',sharedLinkKey:'same',temporary:true}],entry);
  assert.equal(result.length,1);assert.equal(result[0].name,'Original');assert.equal(result[0].temporary,false);
});
test('failed recovery write cancels region deletion',()=>{
  let message='';
  const code=['archiveRegion','removeSavedRegion'].map(n=>functions.get(n)).join('\n');
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nremoveSavedRegion(0);',{
    regions:[{name:'Keep me'}],window:{},readRecovery:()=>[],saveRecovery:()=>false,generateRoomCode:()=> 'r',
    setRecoveryMessage:value=>{message=value},setRegions:()=>assert.fail('must not delete'),
  });
  assert.match(message,/cancelled/);
});
for(const scenario of ['missing','rejected','success','empty']) test('clipboard '+scenario+' reports honestly',async()=>{
  let written;
  const navigator=scenario==='missing'?{}:{clipboard:{writeText:async text=>{if(scenario==='rejected')throw new Error('Denied');written=text}}};
  const {copyText}=load('src/utils/clipboard.ts',{navigator});
  assert.equal(await copyText(scenario==='empty'?'':'https://example.com/share'),scenario==='success');
  assert.equal(written,scenario==='success'?'https://example.com/share':undefined);
});
function transport() {
  const sockets=[], peers=[], timers=new Map(); let timerId=0;
  class Socket { static OPEN=1; readyState=1; sent=[]; constructor(){sockets.push(this)} send(s){this.sent.push(JSON.parse(s))} close(){this.closed=true;this.onclose?.()} }
  class Peer { connectionState='new'; remoteDescription=null; constructor(){peers.push(this)} createDataChannel(){return this.channel={readyState:'open',send:()=>{},close(){this.onclose?.()}}} close(){this.connectionState='closed';this.onconnectionstatechange?.()} async createOffer(){return {type:'offer',sdp:'test'}} async setLocalDescription(){} async setRemoteDescription(d){this.remoteDescription=d} async addIceCandidate(){} async createAnswer(){return {type:'answer',sdp:'test'}} }
  const {LiveShareSession}=load('src/utils/region-peer-share.ts',{WebSocket:Socket,RTCPeerConnection:Peer,setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id)});
  return {session:new LiveShareSession('testroom','host'),sockets,peers,timers};
}
test('disconnect, reconnect and stale callbacks have deterministic status', async()=>{
  const {session,sockets,peers}=transport();const statuses=[];session.onStatus=s=>statuses.push(s);session.connect();sockets[0].onopen();
  assert.equal(sockets[0].sent[0].type,'ready');
  peers[0].connectionState='disconnected';peers[0].onconnectionstatechange();assert.equal(statuses.at(-1),'connecting');
  peers[0].connectionState='connected';peers[0].onconnectionstatechange();assert.equal(statuses.at(-1),'connected');
  const oldClose=sockets[0].onclose;session.connect();assert.equal(statuses.at(-1),'connecting');oldClose();assert.equal(statuses.at(-1),'connecting');
  assert.equal(peers[0].connectionState,'closed');assert.equal(sockets[0].closed,true);
  session.close();assert.equal(session.send({type:'comment',text:'offline'}),false);
});
test('guest rejoining causes the host to negotiate with a fresh peer',async()=>{
  const {session,sockets,peers}=transport();session.connect();peers[0].remoteDescription={type:'answer'};
  await sockets[0].onmessage({data:JSON.stringify({type:'hello'})});assert.equal(peers.length,2);assert.equal(sockets.length,2);
  await sockets[1].onmessage({data:JSON.stringify({type:'hello'})});assert.equal(sockets[1].sent.at(-1).type,'offer');
});
test('malformed messages and signaling errors do not escape the session',async()=>{
  const {session,sockets,peers}=transport();let received=0;const statuses=[];session.onMessage=()=>received++;session.onStatus=s=>statuses.push(s);session.connect();
  for(const data of ['null','[]','{','{"type":"unexpected"}']) peers[0].channel.onmessage({data});assert.equal(received,0);
  peers[0].createOffer=async()=>{throw new Error('failed')};await sockets[0].onmessage({data:'{"type":"hello"}'});assert.equal(statuses.at(-1),'error');
});

for (const permission of ['view', 'comment', 'edit']) test('live host enforces its own '+permission+' grant', () => {
  let session, regions=[{name:'Owner',temporary:false}], activity=[];
  class Session { constructor(){session=this} connect(){} }
  const globals={shareRegionIndex:0,sharePermission:permission,regions,regionsRef:{current:regions},liveHostRef:{current:null},liveSessionRef:{current:null},isLiveShareSupported:()=>true,stopLiveShare:()=>{},generateRoomCode:()=> 'room',buildLiveShareLink:()=> 'link',setLiveShareLink:()=>{},setLiveShareStatus:()=>{},setLiveActivity:fn=>{activity=typeof fn==='function'?fn(activity):fn},setRegions:fn=>{regions=fn(regions)},LiveShareSession:Session};
  const code=['canEditRegion','normalizeImportedRegions','startLiveShare'].map(n=>functions.get(n)).join('\n');
  vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nstartLiveShare();',globals);
  session.onMessage({type:'edit',region:{name:'Changed',temporary:true,sharePermission:'edit'}});
  assert.equal(regions[0].name,permission==='edit'?'Changed':'Owner');
  assert.equal(regions[0].temporary,false);
  assert.equal(regions[0].sharePermission,undefined);
  const count=activity.length;session.onMessage({type:'comment',text:'Hello'});
  assert.equal(activity.length,count+(permission==='comment'?1:0));
});
test('adding routes after deletion fills unused names without duplicating surviving assignments',()=>{
  let regions=[{routes:'3',routeNames:['Route 2','Route 3']}];
  runHandler('addRoute',{contentRegionIndex:0,regions,setRegions:fn=>{regions=fn(regions)}});
  assert.equal(new Set(regions[0].routeNames).size,3);
  assert.equal(regions[0].routeNames[2],'Route 1');
});

test('custom route quantities fill only requested slots and never exceed the limit',()=>{
  for(const amount of [2,100,0,-1,1.5,NaN]) {
    let regions=[{routes:'5',routeNames:['Route 2'],routePokemon:{'Route 2':[{name:'pikachu'}]}}];
    runHandler('addRoute',{contentRegionIndex:0,regions,setRegions:fn=>{regions=fn(regions)}},[amount]);
    assert.equal(regions[0].routeNames.length,amount===2?3:amount===100?5:1);
    assert.equal(new Set(regions[0].routeNames).size,regions[0].routeNames.length);
    assert.equal(regions[0].routePokemon['Route 2'][0].name,'pikachu');
  }
});
test('route limit validates integers and protects existing routes',()=>{
  const code=ts.transpileModule(functions.get('validateRouteCount'),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  for(const [value,minimum,valid] of [['5',3,true],['2',3,false],['0',0,false],['1.5',0,false],['Infinity',0,false],['1000',0,false],['999',0,true]]) {
    const context={value,minimum,setRouteCountError:()=>{},result:null};
    vm.runInNewContext(code+'\nresult=validateRouteCount(value,minimum)',context);
    assert.equal(context.result,valid);
  }
});

test('duplicate and reorder preserve route encounters and paired gym data',()=>{
  let regions=[{routes:'4',routeNames:['A','B'],routePokemon:{A:[{name:'pikachu'}]},routeDetails:{A:{terrain:'Forest'}},gyms:['First','Second'],gymDetails:[{leader:'One'},{leader:'Two'}],gymPokemon:[[{name:'a',moves:['x']}],[{name:'b',moves:['y']}]]}];
  const globals=()=>({contentRegionIndex:0,regions,setRegions:fn=>{regions=fn(regions)}});
  runHandler('organizeContent',globals(),['route',0,'duplicate']);
  assert.equal(regions[0].routeNames[2],'A (Copy)');
  assert.equal(regions[0].routePokemon['A (Copy)'][0].name,'pikachu');
  assert.notEqual(regions[0].routePokemon.A[0],regions[0].routePokemon['A (Copy)'][0]);
  runHandler('organizeContent',globals(),['gym',0,'down']);
  assert.equal(regions[0].gyms[0],'Second');assert.equal(regions[0].gymDetails[0].leader,'Two');assert.equal(regions[0].gymPokemon[0][0].name,'b');
  for(const permission of ['view','comment']) runHandler('organizeContent',{contentRegionIndex:0,regions:[{sharePermission:permission}],setRegions:()=>assert.fail('read-only mutation')},['route',0,'duplicate']);
});

test('connection timeout releases transports and allows retry',()=>{
  const {session,sockets,peers,timers}=transport();let status;session.onStatus=value=>status=value;
  session.connect();assert.equal(timers.size,1);[...timers.values()][0]();
  assert.equal(status,'error');assert.equal(sockets[0].closed,true);assert.equal(peers[0].connectionState,'closed');
  session.connect();sockets[1].onopen();assert.equal(timers.size,0);assert.equal(status,'waiting-for-peer');
  session.close();assert.equal(timers.size,0);
});

test('cloud status reports failures honestly and requires a server save timestamp',()=>{
  const {cloudSaveStatus,lastCloudSaveKey}=load('src/utils/cloud-save-status.ts');
  for(const result of [{success:false,error:'Offline'},{success:true},{success:true,updatedAt:NaN}]) {
    assert.equal(cloudSaveStatus(result).savedAt,null);
    assert.notEqual(cloudSaveStatus(result).message,'Saved to cloud.');
  }
  assert.equal(cloudSaveStatus({success:true,updatedAt:123}).savedAt,123);
  assert.notEqual(lastCloudSaveKey('a'),lastCloudSaveKey('b'));
});
