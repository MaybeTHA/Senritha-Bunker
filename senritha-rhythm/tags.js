/* Reads title, artist and cover art from MP3 (ID3v2) and M4A/MP4 (iTunes atoms) files. */
const Tags=(()=>{
const latin1=b=>{let s='';for(let i=0;i<b.length;i++)s+=String.fromCharCode(b[i]);return s};
function text(enc,b){
  try{
    if(enc===0)return latin1(b).replace(/\0+$/,'');
    if(enc===3)return new TextDecoder('utf-8').decode(b).replace(/\0+$/,'');
    if(enc===1){const le=b[0]===0xFF&&b[1]===0xFE;return new TextDecoder(le?'utf-16le':'utf-16be').decode(b.subarray(2)).replace(/\0+$/,'')}
    if(enc===2)return new TextDecoder('utf-16be').decode(b).replace(/\0+$/,'');
  }catch(e){}return '';
}
function id3(u){
  if(u.length<10||latin1(u.subarray(0,3))!=='ID3')return null;
  const ver=u[3], size=(u[6]&127)<<21|(u[7]&127)<<14|(u[8]&127)<<7|(u[9]&127), end=Math.min(u.length,10+size), out={};
  if(ver<3)return out;
  let p=10; if(u[5]&0x40){const ex=ver===4?((u[10]&127)<<21|(u[11]&127)<<14|(u[12]&127)<<7|(u[13]&127)):(u[10]<<24|u[11]<<16|u[12]<<8|u[13])+4;p+=ex}
  while(p+10<=end){
    const id=latin1(u.subarray(p,p+4)); if(!/^[A-Z0-9]{4}$/.test(id))break;
    const sz=ver===4?((u[p+4]&127)<<21|(u[p+5]&127)<<14|(u[p+6]&127)<<7|(u[p+7]&127)):((u[p+4]<<24)|(u[p+5]<<16)|(u[p+6]<<8)|u[p+7])>>>0;
    const d=u.subarray(p+10,Math.min(end,p+10+sz)); p+=10+sz;
    if(id==='TIT2'&&d.length>1)out.title=text(d[0],d.subarray(1));
    else if(id==='TPE1'&&d.length>1)out.artist=text(d[0],d.subarray(1));
    else if(id==='APIC'&&!out.art&&d.length>4){
      const enc=d[0]; let i=1; while(i<d.length&&d[i])i++; const mime=latin1(d.subarray(1,i))||'image/jpeg'; i+=2; // skip null + picture type
      if(enc===1||enc===2){while(i+1<d.length&&(d[i]||d[i+1]))i+=2;i+=2}else{while(i<d.length&&d[i])i++;i++}
      if(i<d.length)out.art=new Blob([d.slice(i)],{type:mime.includes('/')?mime:'image/'+mime.toLowerCase()});
    }
  }
  return out;
}
function mp4(u){
  const v=new DataView(u.buffer,u.byteOffset,u.byteLength), out={};
  const CONT={moov:0,udta:0,meta:4,ilst:0};
  (function walk(s,e){
    while(s+8<=e){
      let sz=v.getUint32(s); const t=latin1(u.subarray(s+4,s+8)); let hdr=8;
      if(sz===1){sz=Number(v.getBigUint64?v.getBigUint64(s+8):0);hdr=16}else if(sz===0)sz=e-s;
      if(sz<8||s+sz>e)break;
      if(t in CONT)walk(s+hdr+CONT[t],s+sz);
      else if(t==='©nam'||t==='©ART'||t==='covr'){
        const d=s+hdr; if(latin1(u.subarray(d+4,d+8))==='data'){const dsz=v.getUint32(d),type=v.getUint32(d+8)&0xFFFFFF,b=u.subarray(d+16,d+dsz);
          if(t==='covr'){if(!out.art)out.art=new Blob([b.slice()],{type:type===14?'image/png':'image/jpeg'})}
          else{const s2=new TextDecoder('utf-8').decode(b);if(t==='©nam')out.title=s2;else out.artist=s2}}
      }
      s+=sz;
    }
  })(0,u.length);
  return out;
}
async function read(blob){
  try{
    const head=new Uint8Array(await blob.slice(0,12).arrayBuffer());
    if(latin1(head.subarray(0,3))==='ID3'){const size=(head[6]&127)<<21|(head[7]&127)<<14|(head[8]&127)<<7|(head[9]&127);
      return id3(new Uint8Array(await blob.slice(0,Math.min(blob.size,size+10)).arrayBuffer()))||{}}
    if(latin1(head.subarray(4,8))==='ftyp')return mp4(new Uint8Array(await blob.arrayBuffer()));
  }catch(e){}
  return {};
}
return{read};
})();
