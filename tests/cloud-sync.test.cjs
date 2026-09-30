const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const {randomUUID}=require('node:crypto');
function setup({protocol=2,cloudRegions=[],localRegions=[{name:'Local'}],fail=false}={}) {
  const storage=new Map([
    ['pokemon-regions-auth-token','test-token'],
    ['pokemon-regions-auth-user',JSON.stringify({id:'user-a',username:'Test'})],
    ['pokemon-regions-v2',JSON.stringify(localRegions)],
  ]);
  const localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key)};
  let cloud={regions:cloudRegions,customPokemon:[],gimmicks:[],updatedAt:10,syncProtocol:protocol};
  const uploads=[];const cache=new Map();let afterUpload;
  const fetch=async(url,options={})=>{
    if(options.method==='POST') {
      const payload=JSON.parse(options.body);uploads.push(payload);
      if(fail) return {ok:false,json:async()=>({error:'Offline'})};
      if(payload.expectedUpdatedAt!==cloud.updatedAt) return {ok:false,json:async()=>({error:'Conflict'})};
      cloud={...cloud,...payload,updatedAt:cloud.updatedAt+1};afterUpload?.();
      return {ok:true,json:async()=>({success:true,updatedAt:cloud.updatedAt})};
    }
    return {ok:true,json:async()=>({success:true,data:cloud})};
  };
  function load(name) {
    const filename=path.resolve('src/utils',name+'.ts');if(cache.has(filename))return cache.get(filename);
    const exports={};cache.set(filename,exports);
    const code=ts.transpileModule(fs.readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
    vm.runInNewContext(code,{exports,require:id=>load(id.replace('./','')),window:{localStorage},fetch,crypto:{randomUUID},Date});return exports;
  }
  return {storage,localStorage,uploads,load,setCloud:value=>{cloud={...cloud,...value}},afterUpload:fn=>{afterUpload=fn}};
}
test('automatic cloud save uses a revision and records only confirmed success',async()=>{
  const app=setup();const result=await app.load('sync-engine').syncAccount('auto');
  assert.equal(result.savedAt,11);assert.equal(app.uploads[0].expectedUpdatedAt,10);
  assert.equal(app.storage.get('pokemon-regions-last-cloud-save:user-a'),'11');
  assert.equal(app.load('save-history').readVersions().length,1);
});
test('failed cloud save leaves local data and last-success timestamp intact',async()=>{
  const app=setup({fail:true});app.storage.set('pokemon-regions-last-cloud-save:user-a','5');
  const result=await app.load('sync-engine').syncAccount('auto');
  assert.match(result.message,/failed/i);assert.equal(result.savedAt,null);
  assert.equal(app.storage.get('pokemon-regions-last-cloud-save:user-a'),'5');
  assert.equal(JSON.parse(app.storage.get('pokemon-regions-v2'))[0].name,'Local');
});
test('same-named different regions pause sync instead of merging or uploading',async()=>{
  const app=setup({localRegions:[{name:'Same',routes:'1'}],cloudRegions:[{name:'Same',routes:'2'}]});
  const result=await app.load('sync-engine').syncAccount('auto');
  assert.match(result.message,/paused/);assert.equal(app.uploads.length,0);
  assert.equal(JSON.parse(app.storage.get('pokemon-regions-v2'))[0].routes,'1');
});
test('newer cloud data blocks a later automatic overwrite',async()=>{
  const app=setup();const engine=app.load('sync-engine');await engine.syncAccount('auto');
  app.storage.set('pokemon-regions-v2',JSON.stringify([{name:'Device edit'}]));
  app.setCloud({regions:[{name:'Other device edit'}],updatedAt:20});
  const result=await engine.syncAccount('auto');assert.match(result.message,/paused/);assert.equal(app.uploads.length,1);
});
test('older backend cannot receive unsafe automatic uploads',async()=>{
  const app=setup({protocol:1});await assert.rejects(app.load('sync-engine').syncAccount('auto'),/deployed/);assert.equal(app.uploads.length,0);
});
test('cloud pull archives local data and applies empty cloud collections',async()=>{
  const app=setup();const result=await app.load('sync-engine').syncAccount('pull');
  assert.equal(result.reload,true);assert.equal(app.storage.get('pokemon-regions-v2'),'[]');
  assert.equal(JSON.parse(app.load('save-history').readVersions()[0].storage['pokemon-regions-v2'])[0].name,'Local');
});
test('edits arriving during upload request another pass',async()=>{
  const app=setup();app.afterUpload(()=>app.storage.set('pokemon-regions-v2',JSON.stringify([{name:'New edit'}])));
  assert.equal((await app.load('sync-engine').syncAccount('auto')).dirty,true);
});
test('unavailable recovery storage blocks destructive cloud replacement',async()=>{
  const app=setup();app.localStorage.setItem=(key)=>{if(key==='pokemon-regions-save-history-v1')throw Error('Quota');};
  await assert.rejects(app.load('sync-engine').syncAccount('push'),/Quota/);assert.equal(app.uploads.length,0);
});
test('version history retains at most ten prior copies',()=>{
  const app=setup();const history=app.load('save-history');
  for(let i=0;i<12;i++)history.saveVersion('Version '+i,{'pokemon-regions-v2':JSON.stringify([{name:'Version '+i}])});
  assert.equal(history.readVersions().length,10);assert.equal(history.readVersions()[0].label,'Version 11');
});
