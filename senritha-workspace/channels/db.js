/* Storage: IndexedDB on this device (channels, messages, image files), with an in-memory fallback. */
const DB=(()=>{
const STORES={channels:{},messages:{index:['channelId']},blobs:{},meta:{}};
let dbp=null, failed=false; const mem={channels:new Map(),messages:new Map(),blobs:new Map(),meta:new Map()};
function open(){
  if(dbp)return dbp;
  dbp=new Promise((res,rej)=>{try{const r=indexedDB.open('senritha-workspace',1);
    r.onupgradeneeded=()=>{const db=r.result;for(const[n,o]of Object.entries(STORES)){if(db.objectStoreNames.contains(n))continue;const s=db.createObjectStore(n,{keyPath:'id'});(o.index||[]).forEach(i=>s.createIndex(i,i))}};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)}catch(e){rej(e)}}).catch(e=>{failed=true;return null});
  return dbp;
}
async function tx(store,mode,fn){const db=await open();if(!db)return undefined;
  return new Promise((res,rej)=>{const t=db.transaction(store,mode),r=fn(t.objectStore(store));t.oncomplete=()=>res(r&&r.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error)})}
return{
  get usingMemory(){return failed},
  async all(s){try{const a=await tx(s,'readonly',st=>st.getAll());if(a){a.forEach(x=>mem[s].set(x.id,x));return a}}catch(e){}return[...mem[s].values()]},
  async get(s,id){try{const a=await tx(s,'readonly',st=>st.get(id));if(a!==undefined)return a}catch(e){}return mem[s].get(id)},
  async byIndex(s,i,v){try{const a=await tx(s,'readonly',st=>st.index(i).getAll(v));if(a)return a}catch(e){}return[...mem[s].values()].filter(x=>x[i]===v)},
  async put(s,o){mem[s].set(o.id,o);try{await tx(s,'readwrite',st=>st.put(o))}catch(e){}return o},
  async del(s,id){mem[s].delete(id);try{await tx(s,'readwrite',st=>st.delete(id))}catch(e){}},
  async delMany(s,ids){ids.forEach(id=>mem[s].delete(id));try{await tx(s,'readwrite',st=>{ids.forEach(id=>st.delete(id));return null})}catch(e){}},
};
})();
