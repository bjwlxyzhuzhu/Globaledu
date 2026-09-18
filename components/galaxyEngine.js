/* eslint-disable */
/* 自动生成：移植自设计定稿 设计风格预览/风格A_银河探索.html。
   M1 以命令式形式运行整套银河动效；后续里程碑可逐步组件化。请勿手改，改设计请改原型再重新生成。 */
export function initGalaxy(){
let stopped=false;const offs=[];
function on(t,e,f){if(!t)return;t.addEventListener(e,f);offs.push(()=>t.removeEventListener(e,f))}

const PI=Math.PI;function lsGet(k){try{return localStorage.getItem(k)}catch(e){return null}}function lsSet(k,v){try{localStorage.setItem(k,v)}catch(e){}}let lang=lsGet('lang_xj')||'zh';function tx(m,k){return lang==='en'&&m[k+'_en']?m[k+'_en']:m[k]}function hexA(h,a){const n=parseInt(h.slice(1),16);return`rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function toRGB(h){const n=parseInt(h.slice(1),16);return[n>>16&255,n>>8&255,n&255]}
function mix(a,b,t){return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t]}
function rs(a){return`rgb(${a[0]|0},${a[1]|0},${a[2]|0})`}
function palette(hex){const c=toRGB(hex),Wh=[255,255,255],K=[20,22,46],rot=[c[1],c[2],c[0]],rot2=[c[2],c[0],c[1]];return[mix(c,Wh,.55),mix(c,Wh,.85),mix(c,rot,.6),mix(c,rot2,.5),mix(c,K,.4),mix(c,Wh,.3)].map(rs)}
function planetTex(m){const S=180,cv=document.createElement('canvas');cv.width=S;cv.height=S;const c=cv.getContext('2d'),pal=palette(m.clr);let s=(m.n.charCodeAt(0)*7+m.n.charCodeAt(1)*13)%233;function rnd(){s=(s*9301+49297)%233280;return s/233280}
  c.fillStyle=m.clr;c.fillRect(0,0,S,S);
  for(let i=0;i<11;i++){const col=pal[Math.floor(rnd()*pal.length)],R=44+rnd()*74,cx=rnd()*S,cy=rnd()*S,al=.3+rnd()*.32;[cy-S,cy,cy+S].forEach(yy=>{const g=c.createRadialGradient(cx,yy,0,cx,yy,R);c.globalAlpha=al;g.addColorStop(0,col);g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(cx,yy,R,0,7);c.fill()})}
  for(let i=0;i<3;i++){const R=14+rnd()*24,cx=rnd()*S,cy=rnd()*S;[cy-S,cy,cy+S].forEach(yy=>{const g=c.createRadialGradient(cx,yy,0,cx,yy,R);c.globalAlpha=.5;g.addColorStop(0,'rgba(255,255,255,.85)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;c.beginPath();c.arc(cx,yy,R,0,7);c.fill()})}
  c.globalAlpha=1;for(let i=0;i<150;i++){c.globalAlpha=rnd()*.045;c.fillStyle='#fff';c.fillRect(rnd()*S,rnd()*S,1,1)}c.globalAlpha=1;return cv.toDataURL()}
const THEME={
 learn:{deep:'radial-gradient(120% 90% at 50% 28%,#0a1330,#05060f 70%)',neb:['#1c4f9e','#0e6e8a','#2a3a9a'],core:['rgba(150,210,255,.4)','rgba(70,150,230,.15)'],star:[[210,235,255],[150,205,255],[120,240,225]]},
 apply:{deep:'radial-gradient(120% 90% at 50% 28%,#2a0e12,#0a0506 70%)',neb:['#a8341e','#c2641a','#7c1f4e'],core:['rgba(255,205,150,.42)','rgba(255,120,70,.16)'],star:[[255,225,185],[255,175,120],[255,130,120]]}};
let theme=THEME.learn;
function applyTheme(){theme=THEME[zone?'apply':'learn'];document.querySelector('.deep').style.background=theme.deep;document.querySelector('.n1').style.background=theme.neb[0];document.querySelector('.n2').style.background=theme.neb[1];document.querySelector('.n3').style.background=theme.neb[2]}
const gc=document.getElementById('galaxy'),g=gc.getContext('2d');let W,H,gx,gy,gal=[],fg=[],shoot=null,gt=0;
function ginit(){W=gc.width=innerWidth||document.documentElement.clientWidth||1280;H=gc.height=innerHeight||document.documentElement.clientHeight||800;gx=W*.6;gy=H*.34;gal=[];const R=Math.min(W,H)*.6;
  for(let i=0;i<900;i++){const r=Math.pow(Math.random(),.62)*R,arm=(i%2)*PI,a=arm+r*0.012+(Math.random()-.5)*.55,k=r/R,ci=k<.18?0:k<.5?1:2;gal.push({r,a,k,ci,s:Math.random()*1.5+.3,tw:Math.random()*6})}
  fg=[...Array(150)].map(()=>({x:Math.random()*W,y:Math.random()*H,r:Math.random()*1.5+.3,sp:Math.random()*.3+.04,tw:Math.random()*6,ci:Math.floor(Math.random()*3)}))}
ginit();on(window,'resize',ginit);
function gdraw(t){if(stopped)return;const dt=(t-gt)/1000||0;gt=t;g.clearRect(0,0,W,H);const gr=g.createRadialGradient(gx,gy,0,gx,gy,Math.min(W,H)*.4);gr.addColorStop(0,theme.core[0]);gr.addColorStop(.25,theme.core[1]);gr.addColorStop(1,'transparent');g.fillStyle=gr;g.fillRect(0,0,W,H);g.globalCompositeOperation='lighter';
  gal.forEach(p=>{p.a+=(0.045*(0.25/(p.k+0.25)))*dt;p.tw+=dt*2;const x=gx+Math.cos(p.a)*p.r,y=gy+Math.sin(p.a)*p.r*0.46,a=(0.5+0.5*Math.sin(p.tw))*(1-p.k*.55),col=theme.star[p.ci];g.globalAlpha=Math.max(a,.05);g.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;g.fillRect(x,y,p.s,p.s)});
  fg.forEach(p=>{p.y+=p.sp;p.tw+=dt*2;if(p.y>H)p.y=0;const col=theme.star[p.ci];g.globalAlpha=.35+.45*Math.sin(p.tw);g.fillStyle=`rgb(${col[0]},${col[1]},${col[2]})`;g.fillRect(p.x,p.y,p.r,p.r)});
  if(!shoot&&Math.random()<.006)shoot={x:Math.random()*W,y:Math.random()*H*.4,vx:8+Math.random()*6,vy:3+Math.random()*3,life:1};
  if(shoot){const col=theme.star[0];g.globalAlpha=shoot.life;g.strokeStyle=`rgb(${col[0]},${col[1]},${col[2]})`;g.lineWidth=2;g.beginPath();g.moveTo(shoot.x,shoot.y);g.lineTo(shoot.x-shoot.vx*6,shoot.y-shoot.vy*6);g.stroke();shoot.x+=shoot.vx;shoot.y+=shoot.vy;shoot.life-=.02;if(shoot.life<=0||shoot.x>W)shoot=null}
  g.globalAlpha=1;g.globalCompositeOperation='source-over';requestAnimationFrame(gdraw)}
requestAnimationFrame(gdraw);
const LEARN=[
 {a:'🐘',n:'理论知识',n_en:'Theory Hub',sz:108,rs:16,d:'五模块《创新创业基础》课件，AI 老师逐章讲解。',d_en:'Five chapters of innovation fundamentals, taught step by step by your AI mentor.',clr:'#38bdf8',ring:0,nx:'理论知识 · AI 老师',nx_en:'Theory Hub · AI Mentor'},
 {a:'🦒',n:'政策解读',n_en:'Policy Lens',sz:80, rs:11,d:'双创与赛事政策一键看懂，自动划重点。',d_en:'Innovation & contest policies decoded in one click; key points auto-highlighted.',clr:'#3b82f6',ring:0,nx:'政策解读',nx_en:'Policy Lens'},
 {a:'🐹',n:'案例宝库',n_en:'Case Vault',sz:94, rs:20,d:'50 个区域产业案例＋获奖项目，AI 拆解逻辑。',d_en:'50 regional industry cases plus past winners, dissected by AI.',clr:'#2dd4bf',ring:0,nx:'案例库',nx_en:'Case Vault'},
 {a:'🐨',n:'模板宝库',n_en:'Template Vault',sz:84, rs:13,d:'BP、路演 PPT、专利、合同模板随取随用。',d_en:'BP, pitch deck, patent & contract templates, ready to use.',clr:'#a78bfa',ring:1,nx:'模板库',nx_en:'Template Vault'}];
const COMET={n:'平台直达',n_en:'Platform Portal',d:'一键跳转攒经验、拿证书（合规导流，不代刷）。',d_en:'One-click jumps to earn XP & certificates (compliant routing, no cheating).',clr:'#bdf0ff',nx:'平台直达',nx_en:'Platform Portal',a:'☄️',comet:1,cfg:{rx:.96,ry:.72,t:-35,p:120,dir:1}};
const APPLY=[
 {a:'🦊',n:'选题匹配',n_en:'Topic Match',sz:110,rs:15,d:'AI 主动多轮提问定方向，研/本/专组队建议。',d_en:'AI asks multi-round questions to pin your direction & team mix.',clr:'#ff3b30',ring:0,nx:'选题与赛道匹配',nx_en:'Topic & Track Match'},
 {a:'🦅',n:'文本生成',n_en:'Text Forge',sz:94, rs:10,d:'BP、专利、合同、文案一键起草并导出 Word。',d_en:'Draft BP, patent, contract & copy in one click; export to Word.',clr:'#ff9f0a',ring:0,nx:'文本生成',nx_en:'Text Forge'},
 {a:'🦁',n:'幻灯生成',n_en:'Deck Forge',sz:92, rs:18,d:'大纲＋逐字稿＋gpt-image-2 配图直接出片。',d_en:'Outline + script + gpt-image-2 visuals, slides ready to go.',clr:'#ff2d95',ring:1,nx:'PPT 生成',nx_en:'Deck Forge'},
 {a:'🐺',n:'模拟答辩',n_en:'Mock Defense',sz:82, rs:12,d:'多角色评委连环追问、雷达图打分。',d_en:'Multi-role judge agents grill you in rounds with radar scoring.',clr:'#ffcc00',ring:0,nx:'模拟路演答辩',nx_en:'Mock Defense'},
 {a:'🦉',n:'专家打磨',n_en:'Expert Polish',sz:90, rs:23,d:'AI 专家团逐项审稿，对标国赛把项目磨成精品。',d_en:'An AI expert panel reviews item by item, polishing to national-finals quality.',clr:'#e11d48',ring:1,nx:'专家打磨 · AI 专家评审',nx_en:'Expert Polish · AI Review'}];
 /* 创业星舰已升级为「宇宙黑洞」常驻入口，由 React 组件 BlackHole 渲染（两区都可见），不再作为普通行星 */
const CFG=[{rx:.52,ry:.50,t:0,p:30,dir:1,w:2.4},{rx:.76,ry:.42,t:24,p:46,dir:-1,w:1},{rx:.60,ry:.76,t:-28,p:38,dir:1,w:3.2},{rx:.84,ry:.60,t:48,p:54,dir:1,w:1.6},{rx:.44,ry:.72,t:-14,p:34,dir:-1,w:2.6},{rx:.66,ry:.58,t:12,p:50,dir:1,w:2.0}];
const CAP={zh:['🌊 闯关星区（吃草动物）· 柔和水系行星沿轨公转 →','🔥 创新星区（肉食动物）· 火系行星高速运转 →'],en:['🌊 Challenge Galaxy (herbivores) · gentle aqua planets in orbit →','🔥 Innovation Galaxy (carnivores) · fiery planets in high orbit →']};
let zone=0,bodies=[],stageEl,SW,SH,SCx,SCy,last=0,zf=1,binAng=0,scL=1.16,scA=.8;
const sL=document.getElementById('starLearn'),sA=document.getElementById('starApply');
function sizeVars(){stageEl=document.getElementById('solar');SW=stageEl.clientWidth;SH=stageEl.clientHeight;SCx=SW/2;SCy=SH/2}
function buildSolar(){stageEl=document.getElementById('solar');const list=zone?APPLY:LEARN;zf=zone?.66:1.1;
  stageEl.querySelectorAll('.planet,.comet').forEach(e=>e.remove());document.querySelectorAll('.orbitline').forEach(e=>e.remove());
  sizeVars();bodies=[];const ol=document.querySelector('.orbits');
  list.forEach((m,i)=>{const c=CFG[i],o=document.createElement('div');o.className='orbitline';o.style.width=(c.rx*SW)+'px';o.style.height=(c.ry*SH)+'px';o.style.setProperty('--t',c.t+'deg');o.style.border=c.w+'px solid '+hexA(m.clr,.4);o.style.boxShadow='0 0 12px '+hexA(m.clr,.16);ol.appendChild(o)});
  list.forEach((m,i)=>{const el=document.createElement('div');el.className='planet';el.style.setProperty('--sz',m.sz+'px');el.style.setProperty('--clr',m.clr);el.style.setProperty('--ss',m.rs+'s');el.style.animationDelay=(i*.08)+'s';
    el.innerHTML=`<div class="globe">${m.ring?'<div class="pring"></div>':''}<div class="atmos"></div><div class="ball"><div class="surf"></div></div><div class="i3d"><div class="glyph">${m.a}</div></div><div class="moon"></div></div><div class="ptip"><b>${tx(m,'n')}</b><span>${tx(m,'d')}</span><i>${lang==='en'?'Click to enter →':'点击进入 →'}</i></div>`;
    el.querySelector('.surf').style.backgroundImage=`url(${planetTex(m)})`;
    stageEl.appendChild(el);const globe=el.querySelector('.globe'),p={el,m,cfg:CFG[i],ang:(i/list.length)*6.283,hov:false};
    globe.addEventListener('mouseenter',()=>{p.hov=true;el.classList.add('hov');el.style.zIndex=999;globe.style.transform='scale(1.16)'});
    globe.addEventListener('mousemove',e=>{const r=globe.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;globe.style.transform=`scale(1.18) rotateY(${x*16}deg) rotateX(${-y*16}deg)`});
    globe.addEventListener('mouseleave',()=>{p.hov=false;el.classList.remove('hov');globe.style.transform=''});
    globe.addEventListener('click',()=>boomTo(globe,m));bodies.push(p)});
  if(!zone){const el=document.createElement('div');el.className='comet';el.style.setProperty('--clr',COMET.clr);
    el.innerHTML=`<div class="ctail"></div><div class="chead">☄️</div><div class="ptip"><b>${tx(COMET,'n')}</b><span>${tx(COMET,'d')}</span><i>${lang==='en'?'Click to enter →':'点击进入 →'}</i></div>`;
    stageEl.appendChild(el);const head=el.querySelector('.chead'),tail=el.querySelector('.ctail'),p={el,m:COMET,cfg:COMET.cfg,ang:1.2,hov:false,isComet:1,tail};
    head.addEventListener('mouseenter',()=>{p.hov=true;el.classList.add('hov');el.style.zIndex=999;head.style.transform='translate(-50%,-50%) scale(1.3)'});
    head.addEventListener('mouseleave',()=>{p.hov=false;el.classList.remove('hov');head.style.transform='translate(-50%,-50%)'});
    head.addEventListener('click',()=>boomTo(head,COMET));bodies.push(p)}
  document.getElementById('zc').textContent=CAP[lang][zone]}
function setZone(z){zone=z;sL.classList.toggle('active',z===0);sA.classList.toggle('active',z===1);applyTheme();buildSolar()}
function solar(t){if(stopped)return;const dt=Math.min((t-last)/1000||0,.05);last=t;
  binAng+=dt*0.2;const binR=Math.min(SW,SH)*0.078;
  const dxL=Math.cos(binAng)*binR,dyL=Math.sin(binAng)*binR*0.6,dxA=Math.cos(binAng+PI)*binR,dyA=Math.sin(binAng+PI)*binR*0.6;
  const tL=zone===0?1.16:0.8,tA=zone===1?1.16:0.8;scL+=(tL-scL)*Math.min(dt*6,1);scA+=(tA-scA)*Math.min(dt*6,1);
  sL.style.transform=`translate(-50%,-50%) translate(${dxL}px,${dyL}px) scale(${scL})`;sA.style.transform=`translate(-50%,-50%) translate(${dxA}px,${dyA}px) scale(${scA})`;
  sL.style.zIndex=zone===0?26:9;sA.style.zIndex=zone===1?26:9;
  bodies.forEach(p=>{if(!p.hov)p.ang+=p.cfg.dir*(6.283/(p.cfg.p*zf))*dt;
    const rx=p.cfg.rx*SW/2,ry=p.cfg.ry*SH/2,tr=p.cfg.t*PI/180,lx=rx*Math.cos(p.ang),ly=ry*Math.sin(p.ang),
      x=SCx+lx*Math.cos(tr)-ly*Math.sin(tr),y=SCy+lx*Math.sin(tr)+ly*Math.cos(tr);
    if(p.isComet){p.el.style.transform=`translate(${x}px,${y}px)`;if(!p.hov&&p.px!==undefined){const vx=x-p.px,vy=y-p.py;if(vx*vx+vy*vy>0.02){const back=Math.atan2(vy,vx)+PI;p.tail.style.transform=`translateY(-50%) rotate(${back}rad)`}}p.px=x;p.py=y;if(!p.hov)p.el.style.zIndex=Math.round(y)}
    else{const sz=p.m.sz;p.el.style.transform=`translate(${x-sz/2}px,${y-sz/2}px)`;if(!p.hov)p.el.style.zIndex=Math.round(y)}});
  requestAnimationFrame(solar)}
on(window,'resize',()=>{if(stageEl){sizeVars();const cfgs=zone?APPLY.map((m,i)=>CFG[i]):LEARN.map((m,i)=>CFG[i]);document.querySelectorAll('.orbitline').forEach((o,i)=>{const c=cfgs[i];if(c){o.style.width=(c.rx*SW)+'px';o.style.height=(c.ry*SH)+'px'}})}});
applyTheme();buildSolar();requestAnimationFrame(solar);
const human=document.getElementById('human'),helmet=human.querySelector('.helmet');
human.addEventListener('mousemove',e=>{const r=human.getBoundingClientRect(),x=(e.clientX-r.left)/r.width-.5,y=(e.clientY-r.top)/r.height-.5;helmet.style.transform=`rotateY(${x*28}deg) rotateX(${-y*28}deg)`});
human.addEventListener('mouseleave',()=>helmet.style.transform='');
const fx=document.getElementById('fx'),fcx=fx.getContext('2d');let FW,FH,parts=[];
function fxr(){FW=fx.width=innerWidth||document.documentElement.clientWidth||1280;FH=fx.height=innerHeight||document.documentElement.clientHeight||800}fxr();on(window,'resize',fxr);
function boom(x,y,clr){const f=document.createElement('div');f.className='flash';document.body.appendChild(f);setTimeout(()=>f.remove(),320);
  const sw=document.createElement('div');sw.className='shock';sw.style.left=x+'px';sw.style.top=y+'px';sw.style.setProperty('--c',clr);document.body.appendChild(sw);setTimeout(()=>sw.remove(),700);
  for(let i=0;i<110;i++){const a=Math.random()*6.283,sp=Math.random()*8+2;parts.push({x,y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,life:1,clr:Math.random()<.5?clr:'#fff',sz:Math.random()*3+1})}}
function fxloop(){if(stopped)return;fcx.clearRect(0,0,FW,FH);fcx.globalCompositeOperation='lighter';parts.forEach(p=>{p.x+=p.vx;p.y+=p.vy;p.vx*=.95;p.vy*=.95;p.life-=.018;fcx.globalAlpha=Math.max(p.life,0);fcx.fillStyle=p.clr;fcx.beginPath();fcx.arc(p.x,p.y,p.sz*p.life+.4,0,7);fcx.fill()});parts=parts.filter(p=>p.life>0);fcx.globalAlpha=1;fcx.globalCompositeOperation='source-over';requestAnimationFrame(fxloop)}
fxloop();
function boomTo(node,m){const r=node.getBoundingClientRect();boom(r.left+r.width/2,r.top+r.height/2,m.clr);setTimeout(()=>openDetail(m),600)}
function openDetail(m){var MODMAP={'案例宝库':'cases','模板宝库':'templates','理论知识':'theory','政策解读':'policy','平台直达':'links','选题匹配':'topic','文本生成':'text','幻灯生成':'ppt','模拟答辩':'defense','专家打磨':'expert','创业星舰':'cockpit'};var _key=MODMAP[m.n]||'';var _live=['cases','templates','theory','policy','links','topic','text','ppt','defense','expert','cockpit'].indexOf(_key)>=0;window.__module={key:_key,name:tx(m,'n'),live:_live,zone:zone};const d=document.getElementById('detail');d.querySelector('.dwrap').style.setProperty('--clr',m.clr);const dg=document.getElementById('dg');dg.style.setProperty('--clr',m.clr);dg.textContent=m.a||'🌠';const dt=document.getElementById('dt');dt.textContent=tx(m,'n');dt.style.setProperty('--clr',m.clr);document.getElementById('dd').textContent=tx(m,'d');document.getElementById('dnote').textContent=lang==='en'?('🚀 Landed —— '+(_live?'open the page below':('"'+tx(m,'nx')+'" coming soon'))):('🚀 已登陆 ——'+(_live?'点下方「进入模块」':('「'+tx(m,'nx')+'」即将上线')));d.classList.add('show')}
function closeDetail(){document.getElementById('detail').classList.remove('show')}
on(window,'keydown',e=>{if(e.key==='Escape')closeDetail()});
/* ===== 头像系统：20 动物随机分配 + 自定义上传 ===== */
const ANIMALS=['🐼','🐯','🦊','🐰','🐻','🐶','🐱','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦉','🦅','🦄','🐝'];
let curAv=lsGet('av_xj')||ANIMALS[Math.floor(Math.random()*ANIMALS.length)];
function isImgAv(s){return s&&s.indexOf('data:')===0}
function renderAv(){const a=document.getElementById('avShow');if(isImgAv(curAv))a.innerHTML='<img src="'+curAv+'" alt="">';else a.textContent=curAv}
function openAv(){const gr=document.getElementById('avGrid');gr.innerHTML='';ANIMALS.forEach(x=>{const c=document.createElement('div');c.className='avcell'+(x===curAv?' on':'');c.textContent=x;c.onclick=()=>{curAv=x;lsSet('av_xj',x);renderAv();gr.querySelectorAll('.avcell').forEach(z=>z.classList.remove('on'));c.classList.add('on')};gr.appendChild(c)});document.getElementById('avPanel').classList.add('show')}
function closeAv(){document.getElementById('avPanel').classList.remove('show')}
window.__openAvatarPicker=openAv;
document.getElementById('avFile').addEventListener('change',e=>{const f=e.target.files[0];if(!f)return;const rd=new FileReader();rd.onload=()=>{curAv=rd.result;lsSet('av_xj',curAv);renderAv()};rd.readAsDataURL(f)});
on(window,'keydown',e=>{if(e.key==='Escape')closeAv()});
renderAv();
/* ===== 中英文切换 ===== */
const I18N={
 zh:{tag:'创新创业教育 · 比赛 · AI 工具应用',hero:'不是一个 AI，是一群<span class="g">懂创赛的智能搭子</span>',sub:'点亮中央的 🐼 / 🐯 双子星，切换两片星系；每颗行星都是一个可爱搭子，悬停看清、点击登陆。',credits:'积分',learnTip:'🐼 叫我 <b>敢闯</b>！点我进「闯关中心」',applyTip:'🐯 我会 <b>创</b>！点我进「创新中心」',bubble:'嗨，我是小航 🚀<br>创赛上有问题，点我答疑～',back:'← 返回银河系',footer:'风格A · 银河探索　|　🐼闯/🐯创双子星 · 行星柔和多彩星球面＋大气 · 彗星顺向飞行 · 星系切换换景换色　|　双创AI星际',avTitle:'选择你的星际头像',avDesc:'首次进入随机分配，20 种小动物任选，也可以上传自己的头像（建议 1:1 比例）。',avUpload:'📷 上传自定义头像',avDone:'完成',toggle:'EN'},
 en:{tag:'Innovation & Entrepreneurship · Contest · AI Tools',hero:'Not one AI — a whole crew of <span class="g">contest-savvy buddies</span>',sub:'Light up the central 🐼 / 🐯 binary stars to switch galaxies; every planet is a cute buddy — hover to peek, click to land.',credits:'Credits',learnTip:'🐼 Call me <b>Explorer</b>! Enter the Challenge Hub',applyTip:'🐯 I can <b>Create</b>! Enter the Innovation Hub',bubble:'Hi! I am Xiaohang 🚀<br>Got a contest question? Tap me!',back:'← Back to galaxy',footer:'Style A · Galactic Explorer | DOUBLE INNOVATION AI COSMOS · Twin stars · Varied orbits · Forward comet · Galaxy theming · Bilingual',avTitle:'Pick Your Cosmic Avatar',avDesc:'Auto-assigned on first visit; pick one of 20 animals or upload your own (1:1 recommended).',avUpload:'📷 Upload custom avatar',avDone:'Done',toggle:'中'}};
function q(s){return document.querySelector(s)}
function applyLang(){const t=I18N[lang];document.documentElement.lang=lang==='en'?'en':'zh-CN';
 q('.tag').textContent=t.tag;q('header h1').innerHTML=t.hero;q('.sub').textContent=t.sub;
 document.getElementById('creditsLbl').textContent=t.credits;
 q('#starLearn .btip').innerHTML=t.learnTip;q('#starApply .btip').innerHTML=t.applyTip;
 /* .hbubble 由 React(GalaxyHome) 按当前数字人(小闯/小创)接管，引擎不再写入 */ q('.dback').textContent=t.back;q('footer').innerHTML=t.footer;
 q('.avbox h3').textContent=t.avTitle;q('.avbox p').textContent=t.avDesc;
 q('label[for=avFile]').textContent=t.avUpload;q('.avrow .close').textContent=t.avDone;
 document.getElementById('langTxt').textContent=t.toggle;
 document.getElementById('zc').textContent=CAP[lang][zone]}
document.getElementById('langBtn').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';lsSet('lang_xj',lang);applyLang();buildSolar()});
applyLang();

on(document.getElementById('starLearn'),'click',()=>setZone(0));
on(document.getElementById('starApply'),'click',()=>setZone(1));
on(document.querySelector('.dback'),'click',()=>closeDetail());
on(document.querySelector('.avrow .close'),'click',()=>closeAv());
return ()=>{stopped=true;offs.forEach(f=>{try{f()}catch(e){}})};
}
