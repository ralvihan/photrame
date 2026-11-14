const FRAMES=[
  {id:'black',name:'Black',bg:'#111111',fg:'#ffffff',g:'linear-gradient(160deg,#d4d4d4,#737373)'},
  {id:'white',name:'White',bg:'#ffffff',fg:'#111111',g:'linear-gradient(160deg,#e5e5e5,#9ca3af)'},
  {id:'gray',name:'Dark Gray',bg:'#4b5563',fg:'#ffffff',g:'linear-gradient(160deg,#e5e7eb,#6b7280)'},
  {id:'navy',name:'Navy',bg:'#1b2a4a',fg:'#ffffff',g:'linear-gradient(160deg,#d6def0,#6b7da3)'},
  // frame PNG custom: cuma jalan di layout 1x1. t = ukuran frame (px, skala 1x) + posisi & ukuran bolongan foto
  {id:'photrame',name:'Photrame (1×1)',bg:'#ffffff',fg:'#111111',g:'linear-gradient(160deg,#e5e5e5,#9ca3af)',src:'images/frame-1x1.png',sig:true,
   t:{W:600,H:806,ox:36,oy:36,pw:528,ph:660,cols:1,rows:1}},
  {id:'blob',name:'Blob (1×3)',bg:'#ffffff',fg:'#111111',g:'linear-gradient(160deg,#e5e5e5,#9ca3af)',src:'images/frame-1x3.png',midSrc:'images/blob-1x3.png',blue:true,
   t:{W:1020,H:2026,ox:36,oy:0,pw:528,ph:660,gap:23,cols:1,rows:3}}
];
// font tanda tangan: "Other Hand" (file lokal di fonts/, lihat style.css), cadangan "Mr Dafoe" dari Google Fonts
const SIG_FONT='"Other Hand","Mr Dafoe",cursive';
const FILTERS=[['none','None'],['bw','B&W'],['sepia','Sepia'],['warm','Warm'],['cool','Cool'],['fade','Fade']];
const $=id=>document.getElementById(id);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

const state={
  frame:FRAMES[0],shots:[null,null,null],busy:false,stream:null,
  edit:{filter:'none',bright:0,contrast:0},
  sig:'',adj:[],tone:'light'
};
const video=$('video'),idle=$('idle'),countEl=$('count'),flashEl=$('flash'),dots=$('dots');
const camBtn=$('camBtn'),shootBtn=$('shootBtn'),clearBtn=$('clearBtn'),dlBtn=$('dlBtn');
const rawBtn=$('rawBtn'),upBtn=$('upBtn'),upIn=$('upIn');
let upTarget=null;
const msg=$('msg'),out=$('out'),slotsEl=$('slots'),nWrap=$('nShots'),tPick=$('tmrPick'),tWrap=$('tmrWrap'),tBtn=$('tmrBtn'),tLbl=$('tmrLbl');
state.timer=3;
const BASE_LAYOUTS=[[1,1],[1,2],[1,3],[1,4],[2,2],[2,4]];
const defaultLayout=n=>[1,Math.min(n,4)];
state.layout=defaultLayout(3);state.sel=[0,1,2];state.active=null;
const slotCount=()=>state.layout[0]*state.layout[1];
function dims(){return{cols:state.layout[0],rows:state.layout[1]}}
function resizeShots(n){while(state.shots.length<n)state.shots.push(null);state.shots.length=n}
function layoutOptions(){
  const n=state.shots.length,seen=new Set(),out=[];
  const list=[...BASE_LAYOUTS];
  for(const l of list){const k=l.join('x');if(l[0]*l[1]<=n&&!seen.has(k)){seen.add(k);out.push(l)}}
  return out.sort((a,b)=>a[0]*a[1]-b[0]*b[1]||a[0]-b[0]);
}
function normSel(){
  const n=state.shots.length,c=slotCount(),old=state.sel;
  const next=Array.from({length:c},(_,i)=>(old[i]!=null&&old[i]<n)?old[i]:null);
  for(let i=0;i<c;i++){
    if(next[i]==null){const u=[...Array(n).keys()].find(k=>!next.includes(k));if(u!=null)next[i]=u}
  }
  state.sel=next;
}
function renderL(){
  const n=state.shots.length,opts=layoutOptions(),t=state.frame.t;
  if(t)state.layout=[t.cols,t.rows];
  else if(!opts.some(l=>l.join('x')===state.layout.join('x')))state.layout=defaultLayout(n);
  normSel();
  $('layoutCard').hidden=!!t;
  $('layoutPicker').innerHTML=opts.map(l=>`<button class="chip2${l.join('x')===state.layout.join('x')?' sel':''}" data-l="${l.join('x')}">${l[0]}×${l[1]}</button>`).join('');
}
const LIB=[['photrame',[1]],['white',[2]],['navy',[3,4,3,4]],['blob',[5,6,5]],['white',[7,8,9]],['black',[10,11,12]]];
function stripHTML(f,label,ids){
  if(f.midSrc){
    const t=f.t,pc=(v,d)=>(v/d*100)+'%';
    const sl=ids.map((k,i)=>`<div class="stcw" style="--g:${f.g};left:${pc(t.ox,t.W)};top:${pc(t.oy+i*(t.ph+t.gap),t.H)};width:${pc(t.pw,t.W)};height:${pc(t.ph,t.H)}"><img src="images/lib-${k}.webp" alt="" loading="lazy" decoding="async" onerror="this.remove()"></div>`);
    return `<div class="stc" style="aspect-ratio:${t.W}/${t.H}">${sl[0]}<img class="stcb" src="${f.midSrc}" alt="" loading="lazy" decoding="async" onerror="this.remove()">${sl.slice(1).join('')}<img class="stcf" src="${f.src}" alt="" loading="lazy" decoding="async" onerror="this.remove()"></div>`;
  }
  if(f.src)return `<div class="stc"><div class="stcw" style="--g:${f.g}"><img src="images/lib-${ids[0]}.webp" alt="" loading="lazy" decoding="async" onerror="this.remove()"></div><img class="stcf" src="${f.src}" alt="" loading="lazy" decoding="async" onerror="this.remove()"><canvas class="stcs" width="600" height="806"></canvas></div>`;
  const n=ids.length;
  const w=ids.map(k=>`<div class="stw${n===1?' por':''}" style="--g:${f.g}"><img src="images/lib-${k}.webp" alt="" loading="lazy" decoding="async" onload="this.parentElement.classList.add('ph')" onerror="this.remove()"></div>`).join('');
  return `<div class="st" style="background:${f.bg};color:${f.fg}">${w}${label?'<small>Photrame</small>':''}</div>`;
}

$('fcw').insertAdjacentHTML('beforeend',LIB.map(([id,ids],i)=>`<div class="fc p${i}" aria-hidden="true">${stripHTML(FRAMES.find(f=>f.id===id),true,ids)}</div>`).join(''));

function drawLibSig(){
  document.querySelectorAll('.stcs').forEach(cv=>{
    const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);
    drawSig(ctx,1,36,36,528,'messi');
  });
}
drawLibSig();

function renderTone(){
  const el=$('tonePicker');el.hidden=!state.frame.src;
  const tones=[['light','White','#ffffff'],['dark','Black','#111111']];
  if(state.frame.blue)tones.push(['blue','Blue','#3751ff']);
  el.innerHTML=tones.map(([id,n,c])=>`<button class="chip2 ${state.tone===id?'sel':''}" data-tone="${id}"><i style="background:${c}"></i>${n}</button>`).join('');
}
$('tonePicker').addEventListener('click',e=>{
  const b=e.target.closest('[data-tone]');if(!b)return;
  state.tone=b.dataset.tone;renderTone();scheduleRender();
});
function renderFramePicker(){
  $('framePicker').innerHTML=FRAMES.map(f=>`<button class="chip2 ${f.id===state.frame.id?'sel':''}" data-id="${f.id}"><i style="background:${f.bg}"></i>${f.name}</button>`).join('');
}
$('framePicker').addEventListener('click',e=>{const c=e.target.closest('.chip2');if(c)pickFrame(c.dataset.id,false)});
function pickFrame(id,go){
  const f=FRAMES.find(f=>f.id===id)||state.frame;
  if(state.frame.t&&!f.t)state.layout=defaultLayout(state.shots.length);
  state.frame=f;
  if(state.tone==='blue'&&!f.blue)state.tone='light';
  renderFramePicker();renderTone();renderL();scheduleRender();
  if(go)navTo('/booth',true);
}

function renderFilters(){
  $('filters').innerHTML=FILTERS.map(([id,n])=>`<button class="chip2 ${state.edit.filter===id?'sel':''}" data-f="${id}">${n}</button>`).join('');
}
$('filters').addEventListener('click',e=>{
  const c=e.target.closest('.chip2');if(!c)return;
  state.edit.filter=c.dataset.f;renderFilters();scheduleRender();
});
$('bright').addEventListener('input',e=>{state.edit.bright=+e.target.value;scheduleRender()});
$('contrast').addEventListener('input',e=>{state.edit.contrast=+e.target.value;scheduleRender()});
$('sigIn').addEventListener('input',e=>{state.sig=e.target.value.slice(0,10);scheduleRender()});
$('resetEdit').addEventListener('click',()=>{
  state.edit={filter:'none',bright:0,contrast:0};
  $('bright').value=0;$('contrast').value=0;
  renderFilters();scheduleRender();
});

function getAdj(i){const a=state.adj[i];return a&&a.s===state.sel[i]?a:null}
function dropAdj(shot){state.adj=state.adj.map(a=>a&&a.s===shot?null:a)}
function processed(src,w,h,adj){
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const x=c.getContext('2d',{willReadFrequently:true});
  const z=adj?adj.z:1,px=adj?adj.x:0,py=adj?adj.y:0;
  const sc=Math.max(w/src.width,h/src.height)*z,sw=w/sc,sh=h/sc;
  x.drawImage(src,(src.width-sw)*(1+px)/2,(src.height-sh)*(1+py)/2,sw,sh,0,0,w,h);
  const {filter,bright,contrast}=state.edit;
  if(filter==='none'&&!bright&&!contrast)return c;
  const img=x.getImageData(0,0,w,h),d=img.data;
  const k=contrast*2.55,cf=(259*(k+255))/(255*(259-k)),add=bright*2.55;
  for(let i=0;i<d.length;i+=4){
    let r=d[i],g=d[i+1],b=d[i+2];
    switch(filter){
      case 'bw':{const y=.299*r+.587*g+.114*b;r=g=b=y;break}
      case 'sepia':{const nr=.393*r+.769*g+.189*b,ng=.349*r+.686*g+.168*b,nb=.272*r+.534*g+.131*b;r=nr;g=ng;b=nb;break}
      case 'warm':r*=1.1;b*=.9;break;
      case 'cool':r*=.92;b*=1.1;break;
      case 'fade':r=r*.85+38;g=g*.85+38;b=b*.85+38;break;
    }
    if(contrast){r=cf*(r-128)+128;g=cf*(g-128)+128;b=cf*(b-128)+128}
    r+=add;g+=add;b+=add;
    d[i]=r<0?0:r>255?255:r;d[i+1]=g<0?0:g>255?255:g;d[i+2]=b<0?0:b>255?255:b;
  }
  x.putImageData(img,0,0);
  return c;
}

const ratio=()=>slotCount()===1?4/5:4/3;
function geom(S){
  const t=state.frame.t;
  if(t)return{cols:t.cols,rows:t.rows,n:t.cols*t.rows,W:t.W*S,H:t.H*S,ox:t.ox*S,oy:t.oy*S,gap:(t.gap||0)*S,pw:t.pw*S,ph:t.ph*S};
  const {cols,rows}=dims(),n=slotCount();
  const W=({1:600,2:760,3:960,4:1100}[cols])*S,pad=36*S,gap=20*S;
  const pw=Math.round((W-pad*2-gap*(cols-1))/cols),ph=Math.round(pw/ratio());
  const H=pad+rows*ph+(rows-1)*gap+pad;
  return{cols,rows,n,W,H,ox:pad,oy:pad,gap,pw,ph};
}
// tanda tangan: pojok kiri atas, agak keluar dari foto ke bingkai kiri, miring ~8 derajat, otomatis dikecilin kalau namanya panjang
function drawSig(ctx,S,x,y,pw,nm,col){
  const name=(nm!=null?nm:state.sig).trim().slice(0,10);if(!name)return;
  const ang=.14;
  let fs=64*S;ctx.font=`${fs}px ${SIG_FONT}`;
  let m=ctx.measureText(name),w=m.width;const max=pw*.5;
  if(w>max){fs*=max/w;ctx.font=`${fs}px ${SIG_FONT}`;m=ctx.measureText(name);w=m.width}
  const tx=Math.max(x-pw*.02,6*S+(m.actualBoundingBoxLeft||0)+fs*.08);
  const lift=Math.sin(ang)*w;
  ctx.save();
  ctx.fillStyle=col||'#000000';
  ctx.textAlign='left';ctx.textBaseline='alphabetic';
  ctx.translate(tx,y+8*S+lift+fs*.45);ctx.rotate(-ang);
  ctx.fillText(name,0,0);
  ctx.restore();
}
const ACC=[55,81,255],DARK_BG=17;
const BLUE_BLOB=[255,255,255],BLUE_TEXT=[17,17,17]; // tone Blue: warna blob + huruf O, dan warna huruf lainnya (RGB)

function tintFrame(img,mode){
  const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;
  const x=c.getContext('2d');x.drawImage(img,0,0);
  let id;try{id=x.getImageData(0,0,c.width,c.height)}catch(e){return null}
  const d=id.data,den=ACC[2]-ACC[0],span=255-DARK_BG,blue=mode==='blue';
  for(let i=0;i<d.length;i+=4){
    const r=d[i];
    let w=(d[i+2]-r)/den;w=w<0?0:w>1?1:w;
    if(blue){
      // biru (blob + O) -> BLUE_BLOB, putih -> biru (bg), hitam (teks) -> BLUE_TEXT
      let gl=w>=.999?255:(r-w*ACC[0])/(1-w);gl=gl<0?0:gl>255?255:gl;
      const v=1-gl/255,k=1-w;
      d[i]=w*BLUE_BLOB[0]+k*(ACC[0]*(1-v)+BLUE_TEXT[0]*v);
      d[i+1]=w*BLUE_BLOB[1]+k*(ACC[1]*(1-v)+BLUE_TEXT[1]*v);
      d[i+2]=w*BLUE_BLOB[2]+k*(ACC[2]*(1-v)+BLUE_TEXT[2]*v);
      continue;
    }
    if(w>=.999)continue;
    let gl=(r-w*ACC[0])/(1-w);gl=gl<0?0:gl>255?255:gl;
    const v=DARK_BG+span*(1-gl/255),k=1-w;
    d[i]=w*ACC[0]+k*v;d[i+1]=w*ACC[1]+k*v;d[i+2]=w*ACC[2]+k*v;
  }
  x.putImageData(id,0,0);
  return c;
}
function tinted(f,key,img,mode){
  const c=f[key]||(f[key]={});
  if(c[mode]===undefined)c[mode]=tintFrame(img,mode);
  return c[mode]||img;
}
function frameImg(f){
  if(!f.img||!f.img.complete||!f.img.naturalWidth)return null;
  if(state.tone==='light')return f.img;
  return tinted(f,'tint',f.img,state.tone);
}
function drawStrip(cv,S){
  const {cols,n,W,H,ox,oy,gap,pw,ph}=geom(S);
  cv.width=W;cv.height=H;
  const ctx=cv.getContext('2d'),f=state.frame;
  const tone=f.src?state.tone:'light',dark=tone==='dark',blue=tone==='blue';
  ctx.fillStyle=blue?'#3751ff':dark?'#111111':f.bg;ctx.fillRect(0,0,W,H);
  for(let i=0;i<n;i++){
    const x=ox+(i%cols)*(pw+gap),y=oy+Math.floor(i/cols)*(ph+gap);
    ctx.save();ctx.beginPath();ctx.rect(x,y,pw,ph);ctx.clip();
    const si=state.sel[i],shot=si==null?null:state.shots[si];
    if(shot){ctx.drawImage(processed(shot,pw,ph,getAdj(i)),x,y)}
    else{
      ctx.globalAlpha=.14;ctx.fillStyle=blue?'#ffffff':f.fg;ctx.fillRect(x,y,pw,ph);ctx.globalAlpha=.5;
      ctx.font=`600 ${Math.min(44,pw/(6*S))*S}px Inter,system-ui,sans-serif`;ctx.textAlign='center';ctx.fillText(String(i+1),x+pw/2,y+ph/2+10*S);
    }
    ctx.globalAlpha=1;
    ctx.restore();ctx.globalAlpha=1;
    if(i===0&&f.mid&&f.mid.complete&&f.mid.naturalWidth)ctx.drawImage(tone==='light'?f.mid:tinted(f,'midTint',f.mid,tone),0,0,W,H);
  }
  // frame PNG ditumpuk paling atas (di atas foto dan tanda tangan)
  const fi=frameImg(f);if(fi)ctx.drawImage(fi,0,0,W,H);
  if(f.sig)drawSig(ctx,S,ox,oy,pw,null,dark?'#ffffff':'#000000');
}

function buildSlots(){
  const n=state.shots.length,r=n===1?4/5:4/3,ch=Math.round(240/r);
  slotsEl.style.gridTemplateColumns=`repeat(${Math.min(n,4)},1fr)`;
  const one=n===1;
  slotsEl.style.maxWidth=one?'220px':'';
  slotsEl.style.margin=one?'0 auto':'';
  slotsEl.innerHTML=Array.from({length:n},(_,i)=>`<div class="slot" data-i="${i}" style="aspect-ratio:${one?'4/5':'4/3'}"><canvas width="240" height="${ch}"></canvas><span class="num"></span><button class="dl" data-i="${i}">Save</button><button class="rt" data-i="${i}">Retake</button></div>`).join('');
}
function refreshSlots(){
  [...slotsEl.children].forEach((el,i)=>{
    const s=state.shots[i],cv=el.querySelector('canvas');
    el.classList.toggle('has',!!s);
    const pos=state.sel.map((v,k)=>v===i?k+1:0).filter(Boolean),o=pos.length?pos[0]-1:-1;
    el.classList.toggle('on',o>=0);el.classList.toggle('dim',o<0&&slotCount()<state.shots.length);
    el.querySelector('.num').textContent=pos.length?pos.join(','):i+1;
    if(s){const ctx=cv.getContext('2d');ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(processed(s,cv.width,cv.height),0,0)}
  });
}
slotsEl.addEventListener('click',e=>{
  const d=e.target.closest('.dl');
  if(d){const i=+d.dataset.i;if(state.shots[i])shotBlob(i).then(b=>saveBlob(b,`photrame-raw-${i+1}.png`));return}
  const b=e.target.closest('.rt');
  if(!b){
    const sl=e.target.closest('.slot');
    if(!sl||suppress||state.busy)return;
    const i=+sl.dataset.i;if(!state.shots[i])return;
    const free=state.sel.indexOf(null);
    if(free<0){msg.textContent='Frame is full. Drag this photo onto one in the preview to replace it.';return}
    state.sel[free]=i;msg.textContent='';scheduleRender();return;
  }
  if(!state.stream){upTarget=+b.dataset.i;upIn.click();return}
  shootList([+b.dataset.i]);
});
function renderN(){
  nWrap.innerHTML=Array.from({length:16},(_,i)=>i+1).map(n=>`<button class="pk${n===state.shots.length?' sel':''}" data-n="${n}">${n}</button>`).join('');
}
function renderT(){
  tPick.innerHTML=Array.from({length:11},(_,i)=>i).map(t=>`<button class="pk${t===state.timer?' sel':''}" data-t="${t}">${t===0?'Off':t+'s'}</button>`).join('');
  tLbl.textContent=state.timer===0?'Off':state.timer+'s';
  tBtn.classList.toggle('on',state.timer>0);
}
nWrap.addEventListener('click',e=>{
  const b=e.target.closest('.pk');if(!b||state.busy)return;
  const n=+b.dataset.n;
  resizeShots(n);state.layout=defaultLayout(n);state.sel=[];
  renderN();renderL();buildSlots();scheduleRender();
});
tPick.addEventListener('click',e=>{
  const b=e.target.closest('.pk');if(!b||state.busy)return;
  state.timer=+b.dataset.t;renderT();
});
tBtn.addEventListener('click',()=>{
  tWrap.hidden=!tWrap.hidden;
  tBtn.setAttribute('aria-expanded',String(!tWrap.hidden));
});
clearBtn.addEventListener('click',()=>{state.shots=state.shots.map(()=>null);state.adj=[];state.active=null;scheduleRender()});

let raf=0;
function scheduleRender(){
  cancelAnimationFrame(raf);
  raf=requestAnimationFrame(()=>{drawStrip(out,1);renderCells();refreshSlots();updateUI()});
}
function updateUI(){
  const n=state.shots.length;
  $('panel').hidden=!state.shots.some(Boolean);
  shootBtn.disabled=!state.stream||state.busy;
  camBtn.disabled=state.busy;upBtn.disabled=state.busy;
  nWrap.classList.toggle('lock',state.busy);tPick.classList.toggle('lock',state.busy);
  shootBtn.classList.toggle('busy',state.busy);
  clearBtn.disabled=state.busy||!state.shots.some(Boolean);
  rawBtn.disabled=state.busy||!state.shots.some(Boolean);
  const ai=state.active,showAdj=ai!=null&&state.sel[ai]!=null&&!!state.shots[state.sel[ai]];
  $('adj').hidden=!showAdj;
  if(showAdj){const aa=getAdj(ai);$('zoom').value=Math.round((aa?aa.z:1)*100)}
  dlBtn.disabled=state.busy||state.sel.some(i=>i==null||!state.shots[i]);
  const hint=$('selHint');
  hint.hidden=false;
  hint.textContent='Drag a photo into the preview to add or replace it (you can use the same photo more than once). Tap a photo in the preview to remove it.';
  slotsEl.querySelectorAll('.rt').forEach(b=>b.disabled=state.busy);
  ['sigLbl','sigIn'].forEach(id=>$(id).hidden=!state.frame.sig);
  dots.innerHTML=state.stream?Array.from({length:n},(_,i)=>`<i class="${state.shots[i]?'on':''}"></i>`).join(''):'';
}

async function openCamera(){
  msg.textContent='';
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    msg.textContent='Camera is not supported here. Use HTTPS or localhost in a modern browser.';return;
  }
  try{
    state.stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:960}},audio:false});
    video.srcObject=state.stream;await video.play();
    idle.style.display='none';camBtn.textContent='Close camera';
    updateUI();
  }catch(err){
    msg.textContent=err.name==='NotAllowedError'?'Camera permission was blocked. Allow it in your browser settings.':
      err.name==='NotFoundError'?'No camera found on this device.':'Could not open camera: '+err.message;
  }
}
function closeCamera(){
  if(state.stream)state.stream.getTracks().forEach(t=>t.stop());
  state.stream=null;video.srcObject=null;idle.style.display='';camBtn.textContent='Open camera';
  updateUI();
}
camBtn.addEventListener('click',()=>state.stream?closeCamera():openCamera());

function grabFrame(){
  const vw=video.videoWidth,vh=video.videoHeight,target=4/3;
  let sw=vw,sh=vw/target;
  if(sh>vh){sh=vh;sw=vh*target}
  const sx=(vw-sw)/2,sy=(vh-sh)/2;
  const c=document.createElement('canvas');c.width=Math.round(sw);c.height=Math.round(sh);
  const ctx=c.getContext('2d');
  ctx.translate(c.width,0);ctx.scale(-1,1);
  ctx.drawImage(video,sx,sy,sw,sh,0,0,c.width,c.height);
  return c;
}
async function countdown(sec){
  if(sec<=0)return;
  countEl.style.display='grid';
  for(let s=sec;s>0;s--){countEl.textContent=s;await sleep(1000)}
  countEl.style.display='none';
}
function flash(){flashEl.classList.remove('go');void flashEl.offsetWidth;flashEl.classList.add('go')}
async function shootList(idx){
  if(state.busy||!state.stream)return;
  state.busy=true;msg.textContent='';updateUI();
  const t=state.timer;
  for(let k=0;k<idx.length;k++){
    await countdown(k===0?t:Math.min(t,2));
    flash();
    state.shots[idx[k]]=grabFrame();dropAdj(idx[k]);
    scheduleRender();
    await sleep(t===0?800:500);
  }
  state.busy=false;scheduleRender();
}
shootBtn.addEventListener('click',()=>{
  const empty=state.shots.map((s,i)=>s?-1:i).filter(i=>i>=0);
  shootList(empty.length?empty:state.shots.map((_,i)=>i));
});

function loadImg(file){
  if(window.createImageBitmap)return createImageBitmap(file,{imageOrientation:'from-image'}).catch(()=>viaImage(file));
  return viaImage(file);
}
function viaImage(file){
  return new Promise((res,rej)=>{
    const im=new Image(),u=URL.createObjectURL(file);
    im.onload=()=>{URL.revokeObjectURL(u);res(im)};
    im.onerror=()=>{URL.revokeObjectURL(u);rej(new Error('bad image'))};
    im.src=u;
  });
}
function toShot(im){
  const k=Math.min(1,1600/Math.max(im.width,im.height));
  const c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);
  c.getContext('2d').drawImage(im,0,0,c.width,c.height);
  return c;
}
async function handleFiles(list,target){
  if(state.busy)return;
  let files=[...list].filter(f=>f.type.startsWith('image/'));
  if(!files.length){msg.textContent='Pick an image file (JPG, PNG, WebP).';return}
  msg.textContent='';
  let idx;
  if(target!=null){idx=[target];files=files.slice(0,1)}
  else{
    idx=state.shots.map((s,i)=>s?-1:i).filter(i=>i>=0);
    if(files.length>idx.length){
      const n=Math.min(16,state.shots.length+files.length-idx.length);
      const old=state.shots.length;
      resizeShots(n);state.layout=defaultLayout(n);state.sel=[];
      for(let i=old;i<n;i++)idx.push(i);
      renderN();renderL();buildSlots();
    }
    if(files.length>idx.length){msg.textContent='Max 16 photos. Extra files were skipped.';files=files.slice(0,idx.length)}
  }
  state.busy=true;updateUI();
  let failed=0;
  for(let k=0;k<files.length;k++){
    try{state.shots[idx[k]]=toShot(await loadImg(files[k]));dropAdj(idx[k])}catch(e){failed++}
  }
  state.busy=false;
  if(failed)msg.textContent=failed+' file(s) could not be opened.';
  scheduleRender();
}
upBtn.addEventListener('click',()=>{upTarget=null;upIn.click()});
upIn.addEventListener('change',()=>{
  const t=upTarget;upTarget=null;
  handleFiles(upIn.files,t);
  upIn.value='';
});

function saveBlob(b,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(b);a.download=name;
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
}
function shotBlob(i){return new Promise(r=>state.shots[i].toBlob(r,'image/png'))}
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRC[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
function zipBlob(files){
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  for(const f of files){
    const n=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
    const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(12,33,true);
    h.setUint32(14,crc,true);h.setUint32(18,sz,true);h.setUint32(22,sz,true);h.setUint16(26,n.length,true);
    parts.push(h.buffer,n,f.data);
    const c=new DataView(new ArrayBuffer(46));
    c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(14,33,true);
    c.setUint32(16,crc,true);c.setUint32(20,sz,true);c.setUint32(24,sz,true);c.setUint16(28,n.length,true);c.setUint32(42,off,true);
    cen.push(c.buffer,n);
    off+=30+n.length+sz;
  }
  let cs=0;cen.forEach(b=>cs+=b.byteLength||b.length);
  const e=new DataView(new ArrayBuffer(22));
  e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);
  e.setUint32(12,cs,true);e.setUint32(16,off,true);
  return new Blob([...parts,...cen,e.buffer],{type:'application/zip'});
}
rawBtn.addEventListener('click',async()=>{
  const idx=state.shots.map((s,i)=>s?i:-1).filter(i=>i>=0);
  if(!idx.length)return;
  rawBtn.disabled=true;
  const blobs=await Promise.all(idx.map(shotBlob));
  if(idx.length===1){saveBlob(blobs[0],`photrame-raw-${idx[0]+1}.png`)}
  else{
    const files=await Promise.all(blobs.map(async(b,k)=>({name:`photrame-raw-${idx[k]+1}.png`,data:new Uint8Array(await b.arrayBuffer())})));
    saveBlob(zipBlob(files),'photrame-raw-'+Date.now()+'.zip');
  }
  updateUI();
});

dlBtn.addEventListener('click',()=>{
  const tmp=document.createElement('canvas');
  drawStrip(tmp,2);
  tmp.toBlob(b=>{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(b);a.download='photrame-'+Date.now()+'.png';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  },'image/png');
});


/* ---------- editable cells + drag & drop ---------- */
const cellsEl=$('cells');
let suppress=false,drag=null;
const TRASH='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5"/></svg>';
function renderCells(){
  const g=geom(1);let h='';
  for(let i=0;i<g.n;i++){
    const x=g.ox+(i%g.cols)*(g.pw+g.gap),y=g.oy+Math.floor(i/g.cols)*(g.ph+g.gap);
    const filled=state.sel[i]!=null&&state.shots[state.sel[i]],act=state.active===i&&filled;
    h+=`<div class="cell ${filled?'filled':'empty'}${act?' act':''}" data-c="${i}" style="left:${x/g.W*100}%;top:${y/g.H*100}%;width:${g.pw/g.W*100}%;height:${g.ph/g.H*100}%">${act?`<button class="cx" aria-label="Remove photo">${TRASH}</button>`:''}</div>`;
  }
  cellsEl.innerHTML=h;
}
function assign(cell,shot,from){
  if(from!=null)state.sel[from]=state.sel[cell];
  state.sel[cell]=shot;
  if(from!=null){
    const A=state.adj[from],B=state.adj[cell];
    state.adj[cell]=A?{...A,s:state.sel[cell]}:null;
    state.adj[from]=B?{...B,s:state.sel[from]}:null;
  }else state.adj[cell]=null;
}
cellsEl.addEventListener('click',e=>{
  if(suppress||state.busy)return;
  const cx=e.target.closest('.cx'),cell=e.target.closest('.cell');if(!cell)return;
  const i=+cell.dataset.c;
  if(cx){state.sel[i]=null;state.adj[i]=null;state.active=null;scheduleRender();return}
  if(state.sel[i]!=null){state.active=state.active===i?null:i;scheduleRender();return}
  const used=state.sel,u=[...Array(state.shots.length).keys()].find(k=>!used.includes(k)&&state.shots[k]);
  const any=u!=null?u:state.shots.findIndex(Boolean);
  if(any>=0){state.sel[i]=any;scheduleRender()}
});
document.addEventListener('click',e=>{
  if(state.active!=null&&!e.target.closest('.cell')&&!e.target.closest('#adj')){state.active=null;scheduleRender()}
});
function press(e,shot,from){
  if(state.busy||e.button>0||shot==null||!state.shots[shot]||e.target.closest('button'))return;
  drag={shot,from,x:e.clientX,y:e.clientY,on:false,touch:e.pointerType==='touch',ghost:null,over:null};
  if(drag.touch)drag.timer=setTimeout(()=>{if(drag&&!drag.on)begin(drag.x,drag.y)},220);
}
slotsEl.addEventListener('pointerdown',e=>{
  const sl=e.target.closest('.slot');if(sl)press(e,+sl.dataset.i,null);
});
cellsEl.addEventListener('pointerdown',e=>{
  const c=e.target.closest('.cell');if(!c)return;
  const i=+c.dataset.c;
  if(state.active===i&&state.sel[i]!=null&&state.shots[state.sel[i]]&&!state.busy&&e.button<=0&&!e.target.closest('button')){startPan(e,i,c);return}
  press(e,state.sel[i],i);
});
let pan=null;
function ensureAdj(i){
  let a=getAdj(i);
  if(!a){a={s:state.sel[i],z:1,x:0,y:0};state.adj[i]=a}
  return a;
}
function startPan(e,i,c){
  const a=ensureAdj(i),r=c.getBoundingClientRect(),g=geom(1);
  pan={i,x:e.clientX,y:e.clientY,ax:a.x,ay:a.y,k:g.pw/r.width,moved:false};
  e.preventDefault();
}
function movePan(e){
  const p=pan,a=getAdj(p.i);if(!a)return;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(!p.moved&&Math.hypot(dx,dy)<4)return;
  p.moved=true;
  const g=geom(1),src=state.shots[state.sel[p.i]];
  const sc=Math.max(g.pw/src.width,g.ph/src.height)*a.z;
  const hx=(src.width-g.pw/sc)/2,hy=(src.height-g.ph/sc)/2;
  const cl=v=>Math.max(-1,Math.min(1,v));
  a.x=hx>0?cl(p.ax-(dx*p.k/sc)/hx):0;
  a.y=hy>0?cl(p.ay-(dy*p.k/sc)/hy):0;
  scheduleRender();
}
function endPan(){
  if(!pan)return;
  const moved=pan.moved;pan=null;
  if(moved){suppress=true;setTimeout(()=>{suppress=false},0)}
}
cellsEl.addEventListener('wheel',e=>{
  const c=e.target.closest('.cell');if(!c)return;
  const i=+c.dataset.c;
  if(state.active!==i||state.sel[i]==null||!state.shots[state.sel[i]])return;
  e.preventDefault();
  const a=ensureAdj(i);
  a.z=Math.max(1,Math.min(3,a.z*(e.deltaY<0?1.06:1/1.06)));
  scheduleRender();
},{passive:false});
$('zoom').addEventListener('input',e=>{
  const i=state.active;if(i==null||state.sel[i]==null)return;
  ensureAdj(i).z=+e.target.value/100;scheduleRender();
});
$('adjReset').addEventListener('click',()=>{
  const i=state.active;if(i==null)return;
  state.adj[i]=null;scheduleRender();
});
function begin(x,y){
  const d=drag;d.on=true;state.active=null;
  const g=document.createElement('div');g.className='dragGhost';
  const cv=document.createElement('canvas'),w=160,h=Math.round(w/(state.shots.length===1?4/5:4/3));
  cv.width=w;cv.height=h;cv.getContext('2d').drawImage(processed(state.shots[d.shot],w,h),0,0);
  g.appendChild(cv);document.body.appendChild(g);d.ghost=g;
  document.body.classList.add('dragging');
  move(x,y);
}
function move(x,y){
  const d=drag;d.ghost.style.left=x+'px';d.ghost.style.top=y+'px';
  const c=document.elementFromPoint(x,y),cell=c&&c.closest&&c.closest('.cell');
  if(d.over&&d.over!==cell)d.over.classList.remove('over');
  d.over=cell||null;if(cell)cell.classList.add('over');
}
document.addEventListener('pointermove',e=>{
  if(pan){movePan(e);return}
  if(!drag)return;
  if(!drag.on){
    const dist=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
    if(drag.touch){if(dist>10){clearTimeout(drag.timer);drag=null}}
    else if(dist>5)begin(e.clientX,e.clientY);
    return;
  }
  move(e.clientX,e.clientY);
});
function endDrag(drop){
  const d=drag;if(!d)return;
  clearTimeout(d.timer);drag=null;
  if(!d.on)return;
  d.ghost.remove();document.body.classList.remove('dragging');
  if(drop&&d.over){
    const c=+d.over.dataset.c;
    if(d.from!=null&&d.from===c){/* dropped on itself */}
    else assign(c,d.shot,d.from);
  }
  suppress=true;setTimeout(()=>{suppress=false},0);
  scheduleRender();
}
document.addEventListener('pointerup',()=>{endPan();endDrag(true)});
document.addEventListener('pointercancel',()=>{endPan();endDrag(false)});
window.addEventListener('touchmove',e=>{if(drag&&drag.on)e.preventDefault()},{passive:false});
document.addEventListener('contextmenu',e=>{if(drag)e.preventDefault()});

const ROUTES={'/':null,'/booth':'booth','/how':'how','/frames':'frames'};
function navTo(path,push){
  if(!(path in ROUTES))return;
  if(push&&location.pathname!==path)history.pushState(null,'',path);
  const el=ROUTES[path]&&$(ROUTES[path]);
  if(el)el.scrollIntoView({behavior:'smooth'});else window.scrollTo({top:0,behavior:'smooth'});
}
document.addEventListener('click',e=>{
  const a=e.target.closest('a[href^="/"]');
  if(!a||e.defaultPrevented||e.metaKey||e.ctrlKey||e.shiftKey||e.button)return;
  const p=new URL(a.href).pathname;
  if(p in ROUTES){e.preventDefault();navTo(p,true)}
});
window.addEventListener('popstate',()=>navTo(location.pathname.replace(/\/+$/,'')||'/',false));
(function initRoute(){
  let p=location.pathname.replace(/\/index\.html$/,'').replace(/\/+$/,'')||'/';
  if(location.pathname!==p&&p in ROUTES)history.replaceState(null,'',p);
  if(p!=='/'&&p in ROUTES)window.addEventListener('load',()=>{
    const el=$(ROUTES[p]);if(el)el.scrollIntoView({behavior:'instant'});
  });
})();

renderFramePicker();renderTone();renderFilters();renderL();renderN();renderT();buildSlots();scheduleRender();
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{scheduleRender();drawLibSig()});
// load gambar frame PNG + font tanda tangan, lalu render ulang
FRAMES.forEach(f=>{if(f.src){
  f.img=new Image();
  f.img.onload=()=>scheduleRender();
  f.img.onerror=()=>{msg.textContent='Frame image not found: '+f.src+' (put the PNG in the images folder, then hard refresh with Ctrl+F5).'};
  f.img.src=f.src;
  if(f.midSrc){f.mid=new Image();f.mid.onload=()=>scheduleRender();f.mid.src=f.midSrc}
}});
['"Other Hand"','"Mr Dafoe"'].forEach(n=>{if(document.fonts&&document.fonts.load)document.fonts.load('64px '+n).then(()=>{scheduleRender();drawLibSig()}).catch(()=>{})});
$('layoutPicker').addEventListener('click',e=>{
  const b=e.target.closest('[data-l]');if(!b||state.busy)return;
  state.layout=b.dataset.l.split('x').map(Number);
  renderL();scheduleRender();
});