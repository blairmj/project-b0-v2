"use strict";

// Static, first-person chapter. B-0 owns the note but has not checked his compartment.
const SAVE_KEY = "project-b0-v2-firstperson-v4";
const progressStore = typeof location !== "undefined" && location.pathname.endsWith("/preview-v2.html") ? sessionStorage : localStorage;
const app = document.querySelector("#app");
const intro = [
  ["student", "넌, 넌 누구야?"],
  ["robot", "저는 AI 로봇 B-0입니다."],
  ["student", "여긴 어디야?"],
  ["robot", "여기는 AI 교육 연구소의 접속실입니다."],
  ["student", "여기서 어떻게 나가?"],
  ["robot", "저도 모릅니다. 나가는 길을 찾아보면 되지 않을까요?"],
  ["thought", "AI 로봇이라더니… 왜 그것도 모르는 거야?"],
  ["robot", "제가 바로 답해 드리지 못했네요."],
  ["robot", "저는 아직 이곳의 출입 방법을 확인하지 못했습니다."],
  ["robot", "저도 함께 살펴보겠습니다. 궁금한 것이 있으면 물어봐 주세요."]
];
const fresh = () => ({ phase:"intro", line:0, guide:false, noteFound:false, noteTaken:false,
  unlocked:false, attempts:0, muted:false, logs:[] });
function load() {
  try {
    const d = JSON.parse(progressStore.getItem(SAVE_KEY));
    if (!d || !["intro","room","escaped"].includes(d.phase)) return null;
    return {...fresh(),...d,line:Math.max(0,Math.min(intro.length-1,Number(d.line)||0)),logs:Array.isArray(d.logs)?d.logs:[]};
  } catch { return null; }
}
let state = load() || fresh(), target = "", moving = false, token = 0, timer, speechTimer, audio, lastFocus;
let faceId=0, talkTimer, camera={x:0,y:0}, drag=null, suppressClick=false, roomView, walkFrame, zoom=1, pinch=null;
let chapterTwo,chapterThree,chapterFour,hallView,choiceView;
const NAV_KEY='project-b0-v2-lab-navigation-v1';
function readProgress(key){try{return JSON.parse(progressStore.getItem(key));}catch{return null;}}
function roomProgress(){return {practice:state.phase==='escaped',storage:readProgress(window.B0Choice.KEY)?.phase==='cleared',access:false,mirror:false};}
function loadNavigation(){const n=window.B0LabNavigation.restore(readProgress(NAV_KEY));window.B0LabNavigation.merge(n,roomProgress());return n;}
let navigation=loadNavigation();
function syncCorridorPower(){app.setAttribute?.('data-corridor-power',navigation.powerOut?'out':'on');}
syncCorridorPower();
function saveNavigation(){syncCorridorPower();try{progressStore.setItem(NAV_KEY,JSON.stringify(navigation));}catch{}}
function markRoom(){hallView?.dispose();hallView=null;navigation.mode='room';saveNavigation();}
function chapterUrl(number){const url=new URL(location.href);url.searchParams.delete('area');url.searchParams.delete('room');if(number===1)url.searchParams.delete('chapter');else url.searchParams.set('chapter',String(number));history.replaceState(null,'',url);}
function showHall(from){
  stopAdventure();window.B0LabNavigation.merge(navigation,roomProgress());
  if(from)window.B0LabNavigation.returned(navigation,from);
  navigation.mode='hall';saveNavigation();
  const url=new URL(location.href);url.searchParams.set('area','hall');url.searchParams.delete('room');url.searchParams.set('chapter',String(state.chapter||1));history.replaceState(null,'',url);
  hallView=window.startLabNavigation({app,portrait,state:navigation,onSave:saveNavigation,onEnter:enterFromHall,onHome:campaignHome,muted:state.muted});
}
function enterFromHall(id){
  if(!window.B0LabNavigation.canEnter(navigation,id))return;
  if(id==='practice'){stopAdventure();markRoom();state.chapter=1;save();chapterUrl(1);enterRoom(false,true);return;}
  if(id==='storage')enterChapterTwo();
}
function enterChapterTwo(){
  if(state.phase!=='escaped'){resumeAdventure(1);return;}
  stopAdventure();markRoom();state.chapter=2;save();chapterUrl(2);
  choiceView=window.startChoiceRoom({app,portrait,muted:state.muted,onHome:campaignHome,onBack:()=>showHall(),onComplete:()=>showHall('storage')});
}
const touchPoints=new Map();
const reduced=()=>window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// The illustration stays intact. Screen features are separate SVG animation layers.
function portrait() {
  const id="body-"+(++faceId),src="./assets/b0-body-v3.webp";
  return `<svg class="live-portrait" viewBox="0 0 1024 1536" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs>
    <clipPath id="${id}-left"><ellipse cx="390" cy="451" rx="74" ry="96"/></clipPath><clipPath id="${id}-right"><ellipse cx="649" cy="496" rx="77" ry="94"/></clipPath>
    <radialGradient id="${id}-shade"><stop offset="72%" stop-color="#080d12"/><stop offset="100%" stop-color="#080d12" stop-opacity="0"/></radialGradient></defs>
    <image href="${src}" width="1024" height="1536"/>
    <ellipse cx="390" cy="451" rx="81" ry="104" fill="url(#${id}-shade)"/><ellipse cx="649" cy="496" rx="84" ry="102" fill="url(#${id}-shade)"/>
    <g class="eye eye-left" style="--eye-x:390px;--eye-y:451px"><image href="${src}" width="1024" height="1536" clip-path="url(#${id}-left)"/></g>
    <g class="eye eye-right" style="--eye-x:649px;--eye-y:496px"><image href="${src}" width="1024" height="1536" clip-path="url(#${id}-right)"/></g>
    <ellipse cx="419" cy="337" rx="58" ry="29" fill="url(#${id}-shade)"/><ellipse cx="682" cy="387" rx="56" ry="37" fill="url(#${id}-shade)"/>
    <path class="brow brow-left" d="M387 342 Q421 326 451 335"/><path class="brow brow-right" d="M653 375 Q687 382 710 402"/>
    <ellipse cx="507" cy="541" rx="52" ry="28" fill="url(#${id}-shade)"/><g transform="rotate(10 507 541)"><rect class="live-mouth" x="475" y="534" width="64" height="14" rx="7" style="--mouth-x:507px;--mouth-y:541px"/></g></svg>`;
}
function spriteFace(pose="neutral") {
  const note=pose==="note",x=note?634:pose==="thinking"?236:284,y=note?420:pose==="thinking"?192:196,w=note?45:20,h=note?14:4;
  return `<svg class="sprite-face" viewBox="0 0 ${note?"1310 1201":"512 512"}" aria-hidden="true"><ellipse cx="${x}" cy="${y}" rx="${w*.85}" ry="${h*2.3}" fill="#081218"/><rect class="live-mouth" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="${h/2}" style="--mouth-x:${x}px;--mouth-y:${y}px"/></svg>`;
}
function performSpeech(who,text,mood="attentive",scope=app) {
  clearTimeout(talkTimer);
  app.querySelectorAll(".speaking").forEach(el=>el.classList.remove("speaking"));
  const actor=scope.querySelector(".face")||scope.querySelector(".robot-sprite");
  if(!actor)return;
  actor.dataset.mood=mood;
  if(actor.classList.contains("robot-sprite")&&!actor.classList.contains("live-body"))actor.innerHTML=spriteFace(actor.closest(".found")?"note":mood==="thinking"?"thinking":"neutral");
  if(who!=="robot")return;
  actor.classList.add("speaking");
  talkTimer=setTimeout(()=>actor.classList.remove("speaking"),Math.min(5500,Math.max(1600,text.length*95)));
}
const esc = s => String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const btn = (s,a,c="",attrs="") => `<button type="button" data-action="${a}" class="${c}" ${attrs}>${s}</button>`;
function save(kind,text) { if(kind)state.logs.push({kind,text,time:new Date().toISOString()});try{progressStore.setItem(SAVE_KEY,JSON.stringify(state));}catch{} }
function tone(ok=true) {
  if(state.muted)return;
  try { audio ||= new (window.AudioContext||window.webkitAudioContext)();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.value=ok?720:220;g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.18); }catch{}
}
function dialogue(who,text) { return `<div class="speech ${who}"><b>${who==="robot"?"B-0":who==="thought"?"속마음":"나"}</b><p>${esc(text)}</p></div>`; }
window.B0LessonJumpButton=()=>'';
function openingHeader(){return window.B0UI?.header({place:'접속실',namespace:'action',reset:'view-home'})|| `<header class="opening-header"><span>알 수 없는 곳</span><nav>${btn("처음 위치로","view-home","quiet")}${window.B0LessonJumpButton()}</nav></header>`;}
const campaignKeys=[NAV_KEY,window.B0Choice.KEY];
function hasAdventure(){
  if((state.chapter||1)>1||state.phase!=='intro'||state.line>0)return true;
  try{return campaignKeys.some(key=>progressStore.getItem(key)!==null);}catch{return false;}
}
function stopAdventure(){
  choiceView?.dispose();choiceView=null;
  hallView?.dispose();hallView=null;
  chapterTwo?.dispose();chapterTwo=null;chapterThree?.dispose();chapterThree=null;chapterFour?.dispose();chapterFour=null;
  roomView?.dispose();roomView=null;token++;clearTimeout(timer);clearTimeout(speechTimer);clearTimeout(talkTimer);cancelAnimationFrame(walkFrame);
  app.querySelectorAll('dialog').forEach(d=>d.close());moving=false;suppressClick=false;drag=null;pinch=null;touchPoints.clear();
}
function campaignHome(){
  stopAdventure();chapterUrl(1);const saved=hasAdventure(),chapter=Math.max(1,Math.min(2,state.chapter||1));
  app.innerHTML=`<main class="awakening campaign-home"><div class="face" role="img" aria-label="함께 탈출할 AI 로봇 B-0">${portrait()}</div><div class="wake-controls"><h1>PROJECT B-0 <small class="v2-title-tag">V2</small></h1><p class="campaign-tagline">접속실에서 시작하는 새로운 경로.</p><div class="campaign-buttons">${btn('처음부터 시작','campaign-start','primary')}${saved?btn('이어하기','campaign-continue','secondary'):''}</div>${saved?`<small class="muted">${chapter===1?"접속실":"선택설계실"} 진행이 저장되어 있습니다.</small>`:''}</div></main>`;
}
function resumeAdventure(chapter=state.chapter||1){
  if(navigation.mode==='hall'&&navigation.cleared.practice){showHall();return;}
  if(chapter===2&&state.phase==='escaped'){enterChapterTwo();return;}
  state.chapter=1;save();if(state.phase==='intro')opening();else enterRoom();
}
function startAdventure(){
  const muted=state.muted;stopAdventure();
  for(const key of campaignKeys)progressStore.removeItem(key);
  state=fresh();state.chapter=1;state.muted=muted;navigation=window.B0LabNavigation.fresh();navigation.mode='room';saveNavigation();save();chapterUrl(1);opening();
}
function boot() {
  const requested=typeof location!=="undefined"?new URLSearchParams(location.search).get('chapter'):null;
  if(typeof location!=='undefined'&&new URLSearchParams(location.search).get('area')==='hall'&&navigation.cleared.practice){showHall();return;}
  if(['1','2'].includes(requested)){navigation.mode='room';resumeAdventure(Number(requested));}else campaignHome();
}
function opening() {
  roomView?.dispose();roomView=null;
  token++;clearTimeout(timer);clearTimeout(speechTimer);target="";moving=false;
  app.innerHTML=`<main class="awakening${state.line===0?" waking":""}"><div class="face" role="img" aria-label="잠에서 깨어나 처음 마주한 B-0의 얼굴">${portrait()}</div><div class="eyelids" aria-hidden="true"></div><div class="wake-controls"><div class="intro-speech"></div>${btn("다음","next","next")}</div></main>`;
  renderIntro();
  app.querySelector(".awakening").insertAdjacentHTML("afterbegin",openingHeader());
}
function renderIntro() {
  const line=intro[state.line];app.querySelector(".intro-speech").innerHTML=dialogue(...line);
  app.querySelector('[data-action="next"]').textContent=state.line===intro.length-1?"주변 둘러보기":"다음";
  performSpeech(...line,["attentive","friendly","attentive","thinking","attentive","thinking","concerned","concerned","thinking","friendly"][state.line]);
  save();
}
const places={door:{name:"출입문",wall:0},lock:{name:"도어락",wall:0},map:{name:"벽면 지도",wall:0},robot:{name:"B-0",wall:0},terminal:{name:"단말기",wall:0},cabinet:{name:"보관장",wall:-90},bench:{name:"실습대",wall:90},window:{name:"관찰창",wall:90},filebox:{name:"낡은 서류함",wall:-90},envelope:{name:"접힌 봉투",wall:90}};
const wallTarget=id=>btn("",`approach-${id}`,`target target-${id}`,`aria-label="${places[id].name} 살펴보기"`);
function artifact(id){
  const drawing=id==="filebox"?'<path d="M12 35 43 14h91l14 25v57H12Z" fill="#5b686b" stroke="#263943" stroke-width="5"/><path d="M27 29h96v40H27Z" fill="#b6b6a4"/><path d="M12 44h136v52H12Z" fill="#6a787c" stroke="#34444b" stroke-width="4"/><rect x="55" y="59" width="51" height="21" rx="3" fill="#bcbdb2"/><path d="M68 68h24" stroke="#717d7c" stroke-width="4"/>':'<path d="M15 28 142 16l7 65L22 94Z" fill="#c9c0a5" stroke="#6c756c" stroke-width="4"/><path d="m16 29 68 31 59-43M23 92l42-39m38-2 44 28" fill="none" stroke="#898d7c" stroke-width="3"/>';
  return `<div class="artifact-art art-${id}" aria-hidden="true"><svg viewBox="0 0 160 110">${drawing}</svg></div>${wallTarget(id)}`;
}
function otherWalls(){return `<div class="room-wall side-wall wall-left" data-yaw="-90">${wallTarget("cabinet")}${artifact("filebox")}</div><div class="room-wall side-wall wall-right" data-yaw="90">${wallTarget("bench")}${wallTarget("window")}${artifact("envelope")}</div>`;}
function enterRoom(reveal=false,restoreView=false) {
  if(state.phase==="escaped"&&!restoreView){ending();return;}
  roomView?.dispose();roomView=null;
  token++;clearTimeout(timer);clearTimeout(speechTimer);target="";moving=false;
  camera={x:0,y:-5};zoom=1;drag=null;pinch=null;touchPoints.clear();suppressClick=false;
  app.innerHTML=`<main class="game${reveal?" revealing":""}">${window.B0UI?.header({place:`접속실`,namespace:"action",reset:"view-home",zoomClass:"zoom-value",active:true})||""}<section class="scene" tabindex="0" aria-label="접속실. 드래그하거나 방향키로 시선을 돌려 네 벽과 구석을 살펴보세요."><canvas class="panorama-canvas" role="img" aria-label="벽과 바닥이 하나로 이어진 접속실"></canvas><p class="render-error" hidden role="alert"></p><div class="room-rig"><div class="room-wall world${state.unlocked?" unlocked":""}" data-yaw="0">
    <div class="door-art" aria-hidden="true"><div class="device door-left"></div><div class="device door-right"></div></div><span class="lock-led" aria-hidden="true"></span>
    <div class="device terminal-art" aria-hidden="true"></div><div class="map-board" aria-hidden="true"><small>지도</small><strong>연구소 전체 지도</strong>${window.B0LabNavigation.mapMarkup?.({current:"접속실"})||""}<small>비상 출입 안내</small></div><div class="device light-art" aria-hidden="true"></div>
    <div class="targets">${Object.keys(places).filter(id=>places[id].wall===0&&id!=="robot").map(wallTarget).join("")}</div></div>${otherWalls()}<div class="robot-anchor"><div class="robot-sprite live-body" role="img" aria-label="함께 있는 AI 로봇 B-0">${portrait()}</div>${wallTarget("robot")}</div></div>
    <p class="look-hint">끌어서 둘러보기 · 휠/두 손가락으로 확대·축소</p><div class="room-speech" aria-live="polite" hidden></div><div class="arrival sr-only" role="status"></div>
    </section><footer>${btn("B-0에게 말하기","talk-","secondary")}${btn("소지품 <span class=\"item-count\">"+(state.noteTaken?"1":"0")+"</span>","inventory","secondary")}</footer></main>`;

  const report=text=>{const el=app.querySelector(".render-error");if(el){el.textContent=text;el.hidden=false;}};
  try{roomView=createRoomPanorama(app.querySelector(".panorama-canvas"),report);}catch{report("방 화면을 시작하지 못했습니다. 페이지를 새로고침해 주세요.");}

  if(state.phase==="escaped")roomView?.setDoorOpen(1);
  bindCamera();
  panTo(camera.x,camera.y);
  if(reveal)setTimeout(()=>{if(app.querySelector(".scene"))window.B0UI?.firstGuide();},reduced()?0:1900);
}
function revealRoom() {
  if(moving)return;
  const face=app.querySelector(".face"),source=face?.getBoundingClientRect(),body=face?.cloneNode(true);
  enterRoom(!reduced());
  if(reduced()||!body||!source)return;
  moving=true;const ticket=token,game=app.querySelector(".game"),base=game.getBoundingClientRect();
  const target=app.querySelector(".robot-anchor>.robot-sprite").getBoundingClientRect();
  const width=Math.min(target.width,target.height*2/3),height=width*1.5;
  const overlay=document.createElement("div");overlay.className="departure body-retreat";overlay.setAttribute("aria-hidden","true");
  body.style.width=source.width+"px";body.style.height=source.height+"px";
  overlay.append(body);game.append(overlay);
  const from=`translate(${source.left-base.left}px,${source.top-base.top}px) scale(1)`;
  const to=`translate(${target.left-base.left+(target.width-width)/2}px,${target.top-base.top+(target.height-height)/2}px) scale(${width/source.width})`;
  body.animate([{transform:from},{transform:to}],{duration:1800,easing:"cubic-bezier(.25,.55,.3,1)",fill:"forwards"});
  timer=setTimeout(()=>{if(ticket!==token)return;overlay.remove();game.classList.remove("revealing");moving=false;app.querySelector(".scene").focus({preventScroll:true});},1850);
}
function roomSpeech(who,text) {const el=app.querySelector(".room-speech");if(!el)return;clearTimeout(speechTimer);el.innerHTML=dialogue(who,text);el.hidden=false;speechTimer=setTimeout(()=>{el.hidden=true;},4800);}
function approach(id) {
  if(moving||!places[id]||app.querySelector("dialog"))return;
  target=id;inspect();
}
function panTo(x,y) {
  const scene=app.querySelector(".scene"),rig=app.querySelector(".room-rig");if(!scene||!rig)return;
  // The spherical background and object planes share one camera.
  camera={x:((x+180)%360+360)%360-180,y:Math.max(-18,Math.min(18,y))};
  const focal=Math.min(scene.clientHeight*.58,scene.clientWidth*.9)*(.82/1.5)*zoom;
  scene.style.perspective=focal+"px";
  rig.style.transform=`translateZ(${focal}px) rotateX(${camera.y}deg) rotateY(${camera.x}deg)`;
  scene.dataset.yaw=String(camera.x);scene.dataset.pitch=String(camera.y);
  scene.dataset.zoom=String(zoom);
  roomView?.view(camera.x,camera.y,focal);
  // Keep the existing character art facing the viewer instead of flattening it onto a wall.
  const robot=app.querySelector(".robot-anchor");
  if(robot)robot.style.transform=`translate3d(125px,230px,-470px) rotateY(${-camera.x}deg) rotateX(${-camera.y}deg)`;

}
function setZoom(value){
  if(moving)return;
  zoom=Math.max(.55,Math.min(1.8,value));
  panTo(camera.x,camera.y);
  const label=app.querySelector(".zoom-value");if(label)label.textContent=Math.round(zoom*100)+"%";
  const out=app.querySelector('[data-action="zoom-out"]'),inside=app.querySelector('[data-action="zoom-in"]');
  if(out)out.disabled=zoom<=.55;if(inside)inside.disabled=zoom>=1.8;
}
function hideLookHint(){app.querySelector(".look-hint")?.classList.add("dismissed");}
function bindCamera() {
  const scene=app.querySelector(".scene");
  scene.addEventListener("pointerdown",e=>{
    if(moving||app.querySelector("dialog")||e.button!==0)return;
    if(e.pointerType==="touch"){
      touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});scene.setPointerCapture(e.pointerId);
      if(touchPoints.size===2){const [a,b]=[...touchPoints.values()];pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom};drag=null;suppressClick=true;e.preventDefault();return;}
      if(touchPoints.size>2)return;
    }else if(e.isPrimary===false)return;
    suppressClick=false;drag={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:camera.x,y:camera.y,moved:false};
  });
  scene.addEventListener("pointermove",e=>{
    if(touchPoints.has(e.pointerId))touchPoints.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pinch){if(touchPoints.size>=2){const [a,b]=[...touchPoints.values()];setZoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance);hideLookHint();}e.preventDefault();return;}
    if(!drag||drag.id!==e.pointerId)return;
    const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;
    if(!drag.moved&&Math.hypot(dx,dy)<8)return;
    if(!drag.moved){drag.moved=true;scene.setPointerCapture(e.pointerId);scene.classList.add("dragging");hideLookHint();}
    panTo(drag.x-dx*.16/zoom,drag.y+dy*.10/zoom);e.preventDefault();
  });
  const finish=e=>{touchPoints.delete(e.pointerId);if(pinch){if(touchPoints.size===0)pinch=null;drag=null;suppressClick=true;scene.classList.remove("dragging");return;}if(!drag||drag.id!==e.pointerId)return;suppressClick=drag.moved;drag=null;scene.classList.remove("dragging");if(scene.hasPointerCapture(e.pointerId))scene.releasePointerCapture(e.pointerId);};
  scene.addEventListener("pointerup",finish);scene.addEventListener("pointercancel",finish);scene.addEventListener("lostpointercapture",finish);
  scene.addEventListener("pointerleave",e=>{if(drag&&!drag.moved)finish(e);});
  scene.addEventListener("wheel",e=>{if(moving||app.querySelector("dialog"))return;e.preventDefault();const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?scene.clientHeight:1);setZoom(zoom*Math.exp(-Math.max(-150,Math.min(150,delta))*.0015));hideLookHint();},{passive:false});
  scene.addEventListener("keydown",e=>{
    if(["+","=","-","0"].includes(e.key)){e.preventDefault();setZoom(e.key==="0"?1:zoom+(e.key==="-"?-.15:.15));return;}
    const delta={ArrowLeft:[-15,0],ArrowRight:[15,0],ArrowUp:[0,6],ArrowDown:[0,-6]}[e.key];
    if(!delta||moving)return;e.preventDefault();hideLookHint();panTo(camera.x+delta[0],camera.y+delta[1]);
  });
  scene.addEventListener("focusin",e=>{
    if(!e.target.matches(".target:focus-visible"))return;
    const id=e.target.dataset.action?.replace("approach-","");
    if(places[id])panTo(id==="map"?-45:places[id].wall,-5);
  });
}
function modal(title,content,kind="") {
  const previous=app.querySelector("dialog");if(!previous)lastFocus=document.activeElement;previous?.remove();
  const d=document.createElement("dialog");d.className="modal "+kind;d.innerHTML=`<div class="modal-header"><h2>${title}</h2>${btn("닫기","close","quiet")}</div><div class="modal-body">${content}</div>`;app.append(d);d.addEventListener("close",()=>{d.remove();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});});d.showModal();
  const spoken=d.querySelector(".speech.robot p");
  if(spoken)performSpeech("robot",spoken.textContent,state.noteFound?"friendly":"thinking",d);
}
function inspect() {
  if(moving||!target)return;
  if(target==="filebox")modal("낡은 서류함",`<div class="decoy-detail">${artifact("filebox")}</div><p>얇은 서류 몇 장이 들어 있다. 설레는 마음으로 꺼내 펼쳐 본다.</p><div class="notice-paper"><h3>실습 준비물</h3><p>연필 · 지우개 · 활동지</p></div><p>준비물 목록이다. 출입번호는 적혀 있지 않다.</p>${btn("서류를 돌려놓기","close","primary wide")}`);
  if(target==="envelope")modal("접힌 봉투",`<div class="decoy-detail">${artifact("envelope")}</div><p>봉투 안에 종이가 들어 있다. 조심히 꺼내 본다.</p><div class="notice-paper"><h3>장비 청소 안내</h3><p>사용 후 부드러운 천으로 화면을 닦아 주세요.</p></div><p>장비 관리 안내였다. 비밀번호 쪽지는 아니다.</p>${btn("봉투를 내려놓기","close","primary wide")}`);
  if(target==="door")door();
  if(target==="lock")lock();
  if(target==="map")guide();
  if(target==="robot")robot();
  if(target==="terminal")modal("꺼진 단말기",`<p>화면에 전원이 들어오지 않는다.</p>${dialogue("robot","이 단말기는 작동하지 않습니다.")}${btn("돌아가기","close","secondary wide")}`);
  if(target==="cabinet")modal("보관장",`<p>낡은 장비 상자와 비어 있는 수납칸이다. 문을 여는 데 쓸 만한 물건은 보이지 않는다.</p>${btn("그만 살펴보기","close","secondary wide")}`);
  if(target==="bench")modal("실습대",`<p>실습 도구가 남아 있다. 모니터와 장비의 전원은 모두 꺼져 있다.</p>${btn("그만 살펴보기","close","secondary wide")}`);
  if(target==="window")modal("관찰창",`<p>두꺼운 유리 너머로 빈 교실이 보인다. 이쪽에는 나갈 수 있는 문이 없다.</p>${btn("그만 살펴보기","close","secondary wide")}`);
}
function door(tried=false) {
  if(state.unlocked){modal("잠금이 풀린 출입문",`<p>잠금 표시가 초록색이다. 손잡이를 돌릴 수 있다.</p>${btn("문을 열고 나가기","escape","primary wide")}`);return;}
  modal("출입문",`<div class="door-detail" aria-hidden="true"><div class="device"></div></div><p>${tried?"손잡이를 돌려도 문이 열리지 않는다.":"닫힌 출입문이다. 옆에 숫자 도어락이 달려 있다."}</p>${tried?dialogue("robot","문 옆에 도어락이 있습니다."):""}<div class="action-row">${btn("손잡이 돌려보기","handle","secondary")}${btn("도어락 살펴보기","lock","primary")}</div>`);
}
function guide() {
  state.guide=true;save("발견","벽면 지도의 비상 출입 지침");
  modal("벽면 지도",`<section class="map-preview"><h3>연구소 전체 지도</h3>${window.B0LabNavigation.mapMarkup?.({current:"접속실"})||""}</section><div class="notice-paper"><h3>비상 출입 안내</h3><p>출입 시스템 정지 시<br>관리용 쪽지의 비밀번호를 사용하십시오.</p></div>`);
}
const robotQuestions={identity:"넌 어떤 로봇이야?",where:"여기는 어떤 곳이야?",exit:"여기서 어떻게 나가?",password:"비밀번호 쪽지를 알아?",limits:"AI인데 왜 모르는 게 있어?",belongings:"네가 갖고 있는 건 뭐야?"};
function robotAnswer(topic){
  switch(topic){
    case "identity":return "저는 교육용 AI 로봇 B-0입니다. 함께 살펴보고 알아낸 정보를 정리할 수 있어요.";
    case "where":return "AI 교육 연구소의 접속실입니다. 지금은 대부분의 장비가 꺼져 있어요.";
    case "exit":return state.unlocked?"출입문의 잠금이 풀렸습니다. 이제 문을 열 수 있어요.":state.noteTaken?"받은 쪽지와 도어락을 함께 살펴보면 나가는 방법을 확인할 수 있을 것 같아요.":"아직 출입 방법을 확인하지 못했습니다. 출입문과 주변 물건을 함께 살펴볼까요?";
    case "password":return state.noteTaken?"제 보관함에서 찾은 쪽지를 건네드렸어요. 적힌 번호는 소지품에서 다시 확인할 수 있습니다.":state.noteFound?"제 보관함 안에서 관리용 쪽지를 찾았습니다. 아직 가져가지 않으셨네요.":"아직 비밀번호가 적힌 쪽지는 보지 못했습니다. 확인하지 않은 번호를 답할 수는 없어요.";
    case "limits":return state.noteFound?"쪽지가 제 보관함에 있어도, 안을 확인하기 전에는 무엇인지 몰랐어요. AI도 확인한 정보가 있어야 답할 수 있습니다.":"저도 확인하지 않은 정보는 모릅니다. 함께 찾아보고 확인하면 더 정확하게 답할 수 있어요.";
    case "belongings":return state.noteTaken?"보관함에서 찾은 쪽지는 건네드렸습니다. 지금은 보관함이 비어 있어요.":state.noteFound?"제 보관함에 관리용 쪽지가 들어 있었습니다. 확인해 보니 알게 됐어요.":"가슴 아래에 작은 보관함이 있어요. 안에 무엇이 있는지는 아직 확인하지 않았습니다.";
    default:return state.noteTaken?"쪽지는 건네드렸습니다. 소지품에서 다시 볼 수 있어요.":state.noteFound?"이런 게 들어 있네요.":"궁금한 것이 있나요? 함께 알아볼게요.";
  }
}
function robot(topic="") {
  if(topic&&!Object.hasOwn(robotQuestions,topic))return;
  const topics=["identity","where","exit",...(state.guide||state.noteFound?["password","limits"]:[]),"belongings"];
  const art=`<div class="robot-detail${state.noteFound&&!state.noteTaken?" found":""}" role="img" aria-label="B-0와 가슴 아래 보관함"><div class="robot-sprite">${state.noteFound&&!state.noteTaken?"":spriteFace()}</div></div>`;
  const action=state.noteTaken?btn("비밀번호 쪽지 보기","note","primary wide"):state.noteFound?btn("확인하기","take-note","primary wide"):topic==="belongings"?btn("네 보관함을 살펴봐도 돼?","ask-storage","primary wide"):"";
  modal("B-0와 대화",`${art}<div class="conversation-reply" aria-live="polite">${topic?dialogue("student",robotQuestions[topic]):""}${dialogue("robot",robotAnswer(topic))}</div>${action}<section class="question-panel" aria-label="B-0에게 물어볼 질문"><p>무엇을 물어볼까?</p><div class="question-choices">${topics.filter(t=>t!==topic).map(t=>btn(robotQuestions[t],"talk-"+t,"secondary")).join("")}</div></section>`,"conversation-modal");
}
function askStorage() { modal("B-0의 보관함",`${dialogue("student",state.guide?"네 보관함도 확인해 볼까?":"몸에 보관함이 있네. 안에 뭐가 있어?")}${dialogue("robot","안쪽은 아직 확인하지 않았습니다. 열어 보겠습니다.")}<div class="robot-detail thinking" aria-hidden="true"><div class="robot-sprite">${spriteFace("thinking")}</div></div>${btn("보관함 열어 보기","open-storage","primary wide")}`); }
function openStorage() { state.noteFound=true;save("발견","B-0가 확인하지 않았던 보관함에서 관리용 쪽지 발견");tone();robot(); }
function noteMarkup() {return '<div class="password-note"><small>관리용 쪽지</small><h3>비상 출입번호</h3><strong>4732</strong><p>사용 후 보관함에 넣어 두십시오.</p></div>';}
function showNote() { if(!state.noteTaken)return;modal("비밀번호 쪽지",`${noteMarkup()}${dialogue("student","찾았다! 이 번호로 해보자.")}${btn("쪽지 보관하고 돌아가기","close","primary wide")}`); }
function inventory() {modal("소지품",state.noteTaken?`${noteMarkup()}<p class="muted">B-0의 보관함에서 받은 쪽지.</p>`:'<p>아직 가지고 있는 물건이 없다.</p>');}
function lock() {
  if(state.unlocked){door();return;}
  modal("출입문 도어락",`<div class="keypad"><label for="code">비밀번호 네 자리</label><input id="code" name="code" type="text" inputmode="numeric" maxlength="4" pattern="[0-9]{4}" autocomplete="off" aria-describedby="lock-status" placeholder="— — — —"><div class="keys">${[1,2,3,4,5,6,7,8,9].map(n=>btn(n,"digit-"+n,"key")).join("")}${btn("지우기","erase","key small")}${btn("0","digit-0","key")}${btn("확인","submit-code","key primary")}</div><p id="lock-status" role="status">비밀번호를 입력하십시오.</p></div>${state.noteTaken?`<details class="note-peek"><summary>가진 쪽지 보기</summary>${noteMarkup()}</details>`:""}`,"lock-modal");
}
function submitCode(value) {
  const code=value===undefined?app.querySelector("#code").value:String(value),status=app.querySelector("#lock-status");
  if(!/^\d{4}$/.test(code)){status.textContent="숫자 네 자리를 입력하십시오.";return;}
  state.attempts++;save("입력",code);
  if(code!=="4732"){tone(false);status.textContent="번호가 일치하지 않습니다.";app.querySelector("#code").select();return;}
  state.unlocked=true;save("잠금 해제","4732 입력");tone();app.querySelector(".world").classList.add("unlocked");
  modal("잠금 해제",`<p>딸깍. 문 안쪽에서 걸쇠가 풀리는 소리가 난다.</p>${btn("문 열고 나가기","escape","primary wide")}`);
}
function walkIntoCorridor(){
  const ticket=token,game=app.querySelector(".game");if(!game)return;
  game.classList.add("leaving-room");
  const layer=document.createElement("div");layer.className="corridor-transition";layer.setAttribute("aria-hidden","true");game.append(layer);
  const start=performance.now();
  function frame(now){
    if(ticket!==token)return;
    const t=Math.min(1,(now-start)/2100),ease=t*t*(3-2*t);
    if(t>=.5){const place=game.querySelector('.b0-location');if(place)place.textContent='1층 연구소 복도';}
    zoom=1+ease*2.6;panTo(-13,3);
    layer.style.opacity=String(Math.max(0,(t-.48)/.52));
    layer.style.transform=`scale(${1.04+.06*ease})`;
    if(t<1)walkFrame=requestAnimationFrame(frame);else{moving=false;ending();}
  }
  walkFrame=requestAnimationFrame(frame);
}
function ending() {
  roomView?.dispose();roomView=null;moving=false;
  showHall('practice');
}
function menu() {modal("메뉴",window.B0UI.menuContent({namespace:'action',close:'close',extras:`${btn(state.muted?"효과음 켜기":"효과음 끄기","sound")}${btn("생각거리","hint")}${btn("수업 안내","teacher")}${btn("진행 초기화","restart")}`}));}
function handle(a) {
  if(a==='campaign-home'){campaignHome();return;}
  if(a==='campaign-continue'){resumeAdventure();return;}
  if(a==='campaign-start'){if(hasAdventure())modal('처음부터 시작할까요?',`<p>v2의 접속실과 선택설계실 진행을 초기화하고 처음부터 시작합니다.</p><div class="action-row">${btn('취소','close','secondary')}${btn('처음부터 시작','campaign-new','primary')}</div>`);else startAdventure();return;}
  if(a==='campaign-new'){startAdventure();return;}

  if(a==='chapter-two'||a==='hall-return'){app.querySelector('dialog')?.close();showHall('practice');return;}
  if(a==='chapter-three'){app.querySelector('dialog')?.close();showHall('storage');return;}
  if(a==="close"){app.querySelector("dialog")?.close();return;}
  if(a==="next"){if(state.line<intro.length-1){state.line++;renderIntro();}else{state.phase="room";save("도입","B-0와 만나 탐색 시작");revealRoom();}return;}
  if(a==="continue"){if(state.phase==="escaped")enterRoom();else revealRoom();return;}
  if(a==="restart"){modal("진행을 초기화할까요?",`<p>이번 탐색의 쪽지와 도어락 진행을 초기화하고 B-0와 처음 만나는 장면으로 돌아갑니다.</p><div class="action-row">${btn("계속하기","close","secondary")}${btn("초기화하고 시작","new","primary")}</div>`);return;}
  if(a.startsWith("epilogue-")){const line=Number(a.slice(9));if(state.phase==="escaped"&&[1,2,3].includes(line))ending(line);return;}
  if(a==="view-home"){
    if(state.phase==="intro"){opening();return;}
    if(!app.querySelector(".scene"))enterRoom(false,true);
    panTo(0,-5);setZoom(1);return;
  }
  if(a.startsWith("zoom-")){setZoom(a==="zoom-reset"?1:zoom+(a==="zoom-in"?.15:-.15));return;}
  if(a==="new"){state=fresh();save();opening();return;}
  if(a.startsWith("approach-")){approach(a.slice(9));return;}
  if(a.startsWith("talk-")){robot(a.slice(5));return;}
  if(a==="inspect"){inspect();return;}
  if(a==="handle"){door(true);return;}
  if(a==="lock"){lock();return;}
  if(a==="ask-note"||a==="ask-storage"){askStorage();return;}
  if(a==="open-storage"){openStorage();return;}
  if(a==="take-note"){state.noteTaken=true;save("획득","B-0에게 비상 출입번호 쪽지 받음");app.querySelector(".item-count").textContent="1";showNote();return;}
  if(a==="note"){showNote();return;}
  if(a==="inventory"){inventory();return;}
  if(a.startsWith("digit-")){const input=app.querySelector("#code");if(input.value.length<4)input.value+=a.slice(6);return;}
  if(a==="erase"){const input=app.querySelector("#code");input.value=input.value.slice(0,-1);return;}
  if(a==="submit-code"){submitCode();return;}
  if(a==="escape"&&state.unlocked){state.phase="escaped";save("탈출","B-0와 함께 출입문을 열고 나감");app.querySelector("dialog")?.close();panTo(-13,3);setZoom(1);moving=true;const ticket=token;
    if(reduced()){roomView?.setDoorOpen(1);moving=false;ending();return;}
    roomView?.openDoor();timer=setTimeout(()=>{if(ticket!==token)return;walkIntoCorridor();},1550);return;}
  if(a==="menu"){menu();return;}
  if(a==="sound"){state.muted=!state.muted;save();menu();return;}
  if(a==="hint"){modal("생각거리",`<p>${state.noteTaken?"쪽지에 적힌 번호를 문 옆 도어락에 입력할 수 있어요.":state.guide?"방 안의 물건뿐 아니라 함께 있는 B-0도 살펴봤나요?":"벽에 붙은 지도에 출입 방법이 적혀 있을 수 있어요."}</p>`);return;}
  if(a==="teacher"){modal("1차시 · 첫 만남",'<p>초등 고학년용 탐색 도입. AI도 확인하지 않은 정보는 모를 수 있으며, 사람과 함께 정보를 찾아 문제를 해결한다는 경험.</p><p>플레이: 출입문·지도 탐색 → B-0의 보관함 확인 → 쪽지 획득 → 도어락 입력 → 탈출. 순서 강제 없음.</p><p>수업 대화: B-0는 쪽지를 갖고 있었는데 왜 몰랐을까요? 모른다고 했을 때 함께 무엇을 확인했나요?</p><small>정해진 게임 규칙으로 동작하며 실제 AI나 얼굴 인식은 사용하지 않습니다. 기록은 이 기기에만 저장됩니다.</small>');}
}
app.addEventListener("click",e=>{
  if(suppressClick&&e.detail!==0){suppressClick=false;e.preventDefault();return;}
  const b=e.target.closest("button[data-action]");if(b&&!b.disabled&&!moving)handle(b.dataset.action);
});
window.addEventListener("resize",()=>panTo(camera.x,camera.y));
app.addEventListener("keydown",e=>{if(e.target.id==="code"&&e.key==="Enter"){e.preventDefault();submitCode();}});
window.B0CampaignUI={location:()=>({floor:app.querySelector('.lab-game')?navigation.floor:state.chapter===4?2:1,z:navigation.camera.z,stairsUnlocked:navigation.stairsUnlocked,current:app.querySelector('.b0-location')?.textContent||'접속실'})};
boot();
