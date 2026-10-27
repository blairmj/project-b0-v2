(function(){
  'use strict';
  const M=window.B0LabNavigation;
  const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const b=(text,action,cls='')=>`<button type="button" data-lab="${action}" class="${cls}">${text}</button>`;
  const keyArt='<svg viewBox="0 0 100 40" aria-hidden="true"><circle cx="20" cy="20" r="13"/><path d="M33 20h53m-12 0v12m-12-12v9"/></svg>';
  M.mapMarkup=function({floor=1,z=80,current=''}={}){
    const markerY=Math.max(246,Math.min(458,458-(80-z)*.13));
    return `<div class="lab-map"><p><b>지도</b><span>● 현재 위치${current?' · '+esc(current):''}</span></p><svg viewBox="0 0 440 550" role="img" aria-label="위쪽 2층에 중앙관리실. 아래쪽 1층 복도에 접속실, 선택설계실, 출입 관리실, 유리 관찰실이 있으며 순서 없이 탐색할 수 있습니다."><g class="map-lines"><path d="M205 214h30v253h-30Z"/><path d="M220 110v104M150 280h55m30 0h55M235 424h55"/></g><g class="map-rooms"><rect x="110" y="45" width="220" height="65"/><rect x="20" y="245" width="140" height="70"/><rect x="280" y="245" width="140" height="70"/><rect x="150" y="467" width="140" height="65"/><rect x="280" y="389" width="140" height="70"/></g><g class="map-labels"><text x="40" y="26" class="map-floor-label">2층</text><text x="220" y="84">중앙관리실</text><text x="220" y="162" class="small">계단 · 열쇠 필요</text><text x="40" y="218" class="map-floor-label">1층</text><text x="90" y="286">출입 관리실</text><text x="350" y="286">유리 관찰실</text><text x="220" y="507">접속실</text><text x="350" y="430">선택설계실</text><text x="220" y="354" class="small">연구소 복도</text></g><circle class="map-you" cx="220" cy="${floor===2?78:markerY}" r="7"/></svg></div>`;
  };
  window.startLabNavigation=function({app,portrait,state:s,onSave,onEnter,onHome,muted=false}){
    let dead=false,frame=0,pointer=null,walking=false,suppress=false,selection=null,world,stage,bar,notice,modalEl,audio;
    const timers=new Set(),camera={...s.camera,zoom:1,height:s.floor===2?360:0};let stairRejecting=false,powerTalkIndex=-1;
    function companionNear(c,floor){const wanted=c.z-240,limit=M.bound(s,c.x,wanted).z;return M.companionSpot(c.x+100,wanted<limit?c.z+240:wanted,floor);}
    let companion=s.companion||companionNear(camera,s.floor),botMoving=false;
    if(s.floor===1&&!s.stairsUnlocked&&companion.z<-1730)companion=companionNear(camera,s.floor);
    function saveCompanion(){s.companion={...companion};}
    const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!dead)fn();},ms);timers.add(id);};
    function save(){saveCompanion();s.camera={x:camera.x,z:camera.z,yaw:camera.yaw,pitch:camera.pitch};onSave();}
    function stepSound(){if(muted)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();void audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(78,audio.currentTime);o.frequency.exponentialRampToValueAtTime(42,audio.currentTime+.1);g.gain.setValueAtTime(.012,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+.13);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.14);}catch{}}
    function pose(id){const d=M.doors[id];if(id==='practice')return {x:0,z:80,yaw:180,pitch:-3};return {x:0,z:d.floor===2?-2370:d.z+(id==='stairs'?145:0),yaw:d.yaw,pitch:-3};}
    function actions(title,items=[]){if(!items.length&&title==='문과 물건을 직접 눌러 살펴보세요.')title='';bar.innerHTML=`<strong>${esc(title)}</strong><div>${items.map(([t,a,c])=>b(t,a,c||'')).join('')}</div>`;}
    function say(text,who='system'){
      notice.innerHTML=`<div class="speech ${who}"><b>${who==='robot'?'B-0':who==='student'?'나':'시설 안내'}</b><p>${esc(text)}</p></div>`;notice.hidden=false;
      const actor=app.querySelector('.lab-b0 .robot-sprite');actor?.classList.toggle('speaking',who==='robot');
      if(who==='robot')later(()=>actor?.classList.remove('speaking'),Math.min(4500,text.length*85));
    }
    const powerTalk=[
      ['student','B-0, 왜 미리 말 안 해줬어?'],
      ['robot','저도 몰랐습니다. 이 바닥 덮개가 전원 장치와 연결된 건 밟은 뒤에야 알았습니다.'],
      ['student','그럼 앞은 같이 살펴보자. 뭔가 알아내면 바로 알려 줘.']
    ];
    function showPowerTalk(){
      const [who,text]=powerTalk[powerTalkIndex];say(text,who);
      actions('',powerTalkIndex<powerTalk.length-1?[['다음','power-talk-next']]:[['닫기','power-talk-close']]);
    }
    function cancelPowerTalk(){if(powerTalkIndex<0)return;powerTalkIndex=-1;actions('');}
    function relaySound(){if(muted)return;try{audio||=new(window.AudioContext||window.webkitAudioContext)();void audio.resume();for(let i=0;i<2;i++){const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime+i*.22;o.frequency.value=i?310:470;g.gain.setValueAtTime(.018,t);g.gain.exponentialRampToValueAtTime(.0001,t+.16);o.connect(g).connect(audio.destination);o.start(t);o.stop(t+.17);}}catch{}}
    function tripPower(){
      s.powerOut=true;save();app.querySelector('.lab-trip-panel')?.classList.add('tripped');
      stepSound();say('앗… 뭔가 밟았어.','student');
      later(()=>{stage.classList.add('power-out');relaySound();},650);
      later(()=>{if(powerTalkIndex<0&&!s.powerTalked)say('전원이 차단되었습니다. 비상 조명으로 전환합니다.');},1700);
    }
    function door(id){const d=M.doors[id],h=d.floor===2?-360:0;return `<div class="lab-door lab-door-${id}" style="transform:translate3d(${d.x}px,${h}px,${d.z}px) rotateY(${-d.yaw}deg)" data-lab-object="${id}" role="button" tabindex="0" aria-label="${d.name}"><span class="lab-door-sign">${d.floor===2?'2F · ':''}${d.name}</span><div class="lab-door-leaf"><i></i><i></i></div><span class="lab-door-light"></span></div>`;}
    function render(){
      app.innerHTML=`<main class="game lab-game">${window.B0UI?.header({place:`${s.floor}층 연구소 복도`,namespace:"lab",reset:"view-home",zoomClass:"lab-zoom",active:true})||""}<section class="lab-stage ${s.powerOut?'power-out':''}" tabindex="0" aria-label="직접 이동하는 연구소 복도. 바닥을 누르면 그곳으로 걷고 빈 공간을 끌면 둘러봅니다. 방향키와 이동 버튼도 사용할 수 있습니다."><div class="lab-world"><div class="lab-trip-panel ${s.powerOut?'tripped':''}" aria-hidden="true"></div>
      ${Array.from({length:7},(_,i)=>{const z=90-i*300;return [-1,1].map(side=>`<div class="lab-wall" style="transform:translate3d(${side*270}px,0,${z}px) rotateY(${-side*90}deg)"><span class="lab-wall-light"></span><span class="lab-pipe"></span></div>`).join('');}).join('')}<div class="lab-floor"></div><div class="lab-ceiling"></div>${Array.from({length:8},(_,i)=>{const z=80-i*260;return `<div class="lab-fluorescent" style="transform:translate3d(0,-282px,${z}px) rotateX(-90deg);--light-order:${i}" aria-hidden="true"><i></i></div><div class="lab-light-pool" style="transform:translate3d(0,179px,${z}px) rotateX(90deg)" aria-hidden="true"></div>`;}).join('')}${[-184,184].map(x=>`<div class="lab-ceiling-conduit" style="transform:translate3d(${x}px,-279px,-840px) rotateX(-90deg)" aria-hidden="true"></div>`).join('')}<div class="lab-end"></div>
      <div class="lab-barrier ${s.cleared.storage?'open':s.barrierTriggered?'':'raised'}" data-lab-object="shutter" role="button" tabindex="0" aria-label="복도 안전 차단문"><span>구역 폐쇄</span></div><div class="lab-glass-gate ${s.cleared.mirror?'open':''}" data-lab-object="glass" role="button" tabindex="0" aria-label="북쪽 복도의 유리 차단문"><i></i><i></i></div>
      ${['practice','storage','access','mirror','outside','central'].map(door).join('')}
      <div class="lab-keybox ${s.keyboxOpen?'open':''}" data-lab-object="keybox" role="button" tabindex="0" aria-label="벽면 열쇠 보관함"><div class="lab-keybox-back">${s.keyTaken?'':keyArt}</div><div class="lab-keybox-lid"><i></i></div></div>
      <div class="lab-stair-entry ${s.stairsUnlocked?'authorized':''}" data-lab-object="stairs" role="button" tabindex="0" aria-label="2층 계단"><span>2F · 중앙관리실</span><i class="lab-stair-field" aria-hidden="true"></i></div><div class="lab-stair-control ${s.stairsUnlocked?'authorized':''}" data-lab-object="stair-control" role="button" tabindex="0" aria-label="계단 차단 제어기"><span>2F</span><i></i><b>제어</b></div>
      ${Array.from({length:14},(_,i)=>`<div class="lab-step" style="transform:translate3d(0,${180-(i+1)*360/14}px,${-1820-i*22}px) rotateX(90deg)"></div><div class="lab-riser" style="transform:translate3d(0,${180-(i+1)*360/14}px,${-1809-i*22}px)"></div>`).join('')}
      ${[-2220,-2440].map((z,i)=>`<div class="lab-fluorescent" style="transform:translate3d(0,-642px,${z}px) rotateX(-90deg);--light-order:${i}" aria-hidden="true"><i></i></div><div class="lab-light-pool" style="transform:translate3d(0,-181px,${z}px) rotateX(90deg)" aria-hidden="true"></div>`).join('')}<div class="lab-upper-floor"></div><div class="lab-upper-ceiling"></div><div class="lab-upper-end"></div>${[-1,1].map(side=>`<div class="lab-upper-wall" style="transform:translate3d(${side*270}px,0,-2330px) rotateY(${-side*90}deg)"><span class="lab-wall-light"></span></div><div class="lab-stair-side" style="transform:translate3d(${side*270}px,0,-1940px) rotateY(${-side*90}deg)"></div>`).join('')}
      <div class="lab-b0"><div class="robot-sprite live-body">${portrait()}</div><div class="c4-walk-art"><div class="c4-walk-frame"></div></div></div></div><div class="lab-notice" role="status" hidden></div><div class="lab-walk-mark" aria-hidden="true">이동 중</div><div class="lab-dpad">${b('↶','turn-left','quiet')}${b('앞으로','forward')}${b('↷','turn-right','quiet')}${b('뒤로','backward','quiet')}</div></section><section class="lab-actions" aria-label="복도에서 선택한 대상"></section><footer>${b('B-0에게 말하기','robot','secondary')}<div class="lab-pocket">${b('소지품','inventory','quiet')}</div></footer></main>`;
      world=app.querySelector('.lab-world');stage=app.querySelector('.lab-stage');bar=app.querySelector('.lab-actions');notice=app.querySelector('.lab-notice');
      stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',cancel);
      stage.addEventListener('keydown',key);stage.addEventListener('wheel',e=>{e.preventDefault();camera.pitch=Math.max(-35,Math.min(45,camera.pitch-e.deltaY*.025));update();save();},{passive:false});
      actions('문과 물건을 직접 눌러 살펴보세요.');update();
    }
    function update(){
      if(dead)return;const f=Math.min(stage.clientWidth*.65,stage.clientHeight*.6)*camera.zoom;stage.style.perspective=f+'px';world.style.transform=`translateZ(${f}px) rotateX(${camera.pitch}deg) rotateY(${camera.yaw}deg) translate3d(${-camera.x}px,${camera.height}px,${-camera.z}px)`;
      const bot=app.querySelector('.lab-b0');
      // A companion occupies one world position. Looking around never relocates him.
      bot.style.transform=`translate3d(${companion.x-42}px,${24-M.groundAt(companion.z)}px,${companion.z}px) rotateY(${-camera.yaw}deg)`;
      bot.classList.toggle('walking',botMoving);bot.dataset.x=String(companion.x);bot.dataset.z=String(companion.z);
      if(!s.barrierTriggered&&!s.cleared.storage&&camera.z<=-60){s.barrierTriggered=true;app.querySelector('.lab-barrier').classList.remove('raised');save();}
      stage.classList.toggle('walking',walking);if(stage.dataset.floor!==String(s.floor)){app.querySelector('.lab-pocket').innerHTML=b('소지품','inventory','quiet')+(s.floor===2?b('1층 계단','downstairs','quiet'):'');}stage.dataset.floor=String(s.floor);stage.dataset.position=String(Math.round(camera.z));app.querySelector('.lab-location').textContent=`${s.floor}층 ${s.floor===2?'중앙관리실 앞 복도':camera.z<-1510?'계단 앞 복도':camera.z<-650?'연구 구역 복도':'실습 구역 복도'}`;
    }
    function animate(to,done,stair=false,durationMs){
      if(walking)return;cancelPowerTalk();const from={...camera},start=performance.now(),turn=(((to.yaw??camera.yaw)-camera.yaw+540)%360)-180;const distance=Math.hypot((to.x??from.x)-from.x,(to.z??from.z)-from.z,(to.height??from.height)-from.height);const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?1:durationMs??(stair?2300:Math.max(380,Math.min(1900,distance*3.7)));walking=true;notice.hidden=true;let lastStep=-1;
      const botFrom={...companion},dx=(to.x??from.x)-from.x,dz=(to.z??from.z)-from.z,travelLength=Math.hypot(dx,dz);
      botMoving=travelLength>8;
      const targetFloor=(to.height??camera.height)>180?2:s.floor===2&&(to.height??camera.height)===0?1:s.floor;
      const candidate=botMoving?M.companionSpot((to.x??from.x)+100,(to.z??from.z)+(dz>5?240:-240),targetFloor):botFrom;
      const limit=M.bound(s,candidate.x,candidate.z);
      let botTo=botMoving&&!stair&&candidate.z<limit.z?M.companionSpot(candidate.x,(to.z??from.z)+240,targetFloor):candidate;
      if(targetFloor===1&&!s.stairsUnlocked)botTo=M.companionSpot(botTo.x,Math.max(-1730,botTo.z),1);
      function tick(t){if(dead)return;const previousPosition={x:camera.x,z:camera.z},p=Math.min(1,(t-start)/duration),q=p*p*(3-2*p);for(const k of ['x','z','pitch','height'])camera[k]=from[k]+((to[k]??from[k])-from[k])*q;camera.yaw=from.yaw+turn*q;companion={x:botFrom.x+(botTo.x-botFrom.x)*q,z:botFrom.z+(botTo.z-botFrom.z)*q,floor:targetFloor};const count=Math.floor(p*duration/380);if(distance>40&&count!==lastStep){lastStep=count;stepSound();}if(s.floor===1&&!s.powerOut&&M.stepsOnPanel(previousPosition,camera))tripPower();update();if(p<1)frame=requestAnimationFrame(tick);else{walking=false;botMoving=false;update();save();done?.();}}frame=requestAnimationFrame(tick);
    }
    function walkTo(id){
      const d=M.doors[id];if(!d)return;
      if(d.floor!==s.floor){if(d.floor===2){walkTo('stairs');return;}descend(()=>walkTo(id));return;}
      const p=pose(id),limited=M.bound(s,p.x,p.z);const blocked=Math.abs(limited.z-p.z)>2;
      selection=null;actions('');
      animate({...p,...limited},()=>{if(blocked){say(limited.z>-600?'안전 차단문이 복도를 가로막고 있다. 다른 길이 있을까?':'유리 차단문이 복도를 가로막고 있다.');actions('막힌 통로',[['다시 둘러보기','clear']]);return;}selection=id;if(!s.visited.includes(id))s.visited.push(id);save();showObject(id);});
    }
    function showObject(id){
      cancelPowerTalk();selection=id;
      if(id==='shutter'){say(s.cleared.storage?'반대편에서 안전 차단문을 해제했다.':'안전 차단문이 내려와 있다. 옆방과 다른 통로를 살펴봐야겠다.');actions('복도 차단문',[['돌아가기','clear']]);return;}
      if(id==='glass'){say(s.cleared.mirror?'유리 차단문이 올라가 북쪽 복도가 이어진다.':'유리 너머로 계단과 작은 보관함이 보인다. 이쪽에서는 열 수 없다.');actions('북쪽 유리 차단문',[['돌아가기','clear']]);return;}
      if(id==='keybox'){if(!s.cleared.mirror){say('유리 차단문 너머에 있다. 여기서는 손이 닿지 않는다.');actions('벽면 보관함',[['돌아가기','clear']]);return;}actions('벽면 열쇠 보관함',[[s.keyboxOpen?'닫기':'열어 보기','keybox-open'],...(s.keyboxOpen&&!s.keyTaken?[['열쇠 집기','take-key']]:[]),['돌아가기','clear']]);return;}
      if(id==='stairs'||id==='stair-control'){actions(id==='stairs'?'2층 계단':'계단 차단 제어기',s.stairsUnlocked?[['계단으로 올라가기','upstairs'],['돌아가기','clear']]:[['계단 올라가 보기','upstairs'],['차단 제어기 살펴보기','inspect-stairs'],...(s.keyTaken?[['열쇠로 차단 해제','unlock-stairs']]:[]),['돌아가기','clear']]);return;}
      if(id==='outside'){say('문 옆 화면에 외부 출입 승인은 2층 중앙관리실에서 확인하라고 적혀 있다.');actions('잠긴 외부 출입구',[['돌아가기','clear']]);return;}
      if(!M.canEnter(s,id)){say('문이 잠겨 있다. 문 옆 장치에도 전원이 들어오지 않는다.');actions(dLabel(id),[['돌아가기','clear']]);return;}
      actions(dLabel(id),[['문 열고 들어가기','enter-'+id,'primary'],['돌아가기','clear']]);
    }
    const dLabel=id=>M.doors[id]?.name||'복도';
    function stairAttempt(p){if(s.floor!==1||!s.cleared.mirror||camera.z> -1630||p.z> -1699||Math.abs(p.x)>150)return false;s.stairsUnlocked?ascend():rejectStairs();return true;}
    function travel(direction){if(walking||stairRejecting)return;selection=null;actions('문과 물건을 직접 눌러 살펴보세요.');const a=camera.yaw*Math.PI/180,p=M.bound(s,camera.x+Math.sin(a)*direction*150,camera.z-Math.cos(a)*direction*150);if(stairAttempt(p))return;if(Math.hypot(p.x-camera.x,p.z-camera.z)<8){say(s.floor===2?'복도 끝이다. 문을 살펴보거나 뒤로 돌아갈 수 있다.':'앞이 막혀 있다. 주변의 문과 다른 길을 살펴보자.');return;}animate(p);}
    function rejectStairs(){
      if(walking||stairRejecting||s.floor!==1)return;stairRejecting=true;selection=null;actions('');
      animate({x:0,z:-1860,height:55,yaw:0,pitch:-3},()=>{
        stage.classList.add('stair-repel');relaySound();say('상층 접근 권한이 없습니다.');
        later(()=>animate({x:0,z:-1695,height:0,yaw:0,pitch:-3},()=>{stairRejecting=false;stage.classList.remove('stair-repel');say('문도 없는데… 다시 밀려 내려왔어.','student');showObject('stairs');},true,900),220);
      },true,850);
    }
    function ascend(){if(!s.stairsUnlocked)return;animate({x:0,z:-1705,yaw:0,pitch:7},()=>animate({x:0,z:-2165,yaw:0,pitch:6,height:360},()=>{M.floor(s,2);Object.assign(camera,s.camera,{height:360});save();update();actions('2층 중앙관리실 앞 복도',[['앞으로','forward'],['1층으로 내려가기','downstairs']]);},true));}
    function descend(done){if(s.floor!==2){done?.();return;}animate({x:0,z:-2145,yaw:180,pitch:-12},()=>animate({x:0,z:-1700,yaw:180,pitch:-4,height:0},()=>{M.floor(s,1);Object.assign(camera,s.camera,{height:0});save();update();actions('1층 계단 앞 복도',[['다시 둘러보기','clear']]);done?.();},true));}
    function modal(title,body){close();const d=document.createElement('dialog');modalEl=d;d.className='lab-modal';d.setAttribute('aria-label',title);d.innerHTML=`<header><h2>${title}</h2>${b('닫기','close','quiet')}</header><div class="lab-modal-body">${body}</div>`;d.addEventListener('close',()=>{if(modalEl===d)modalEl=null;d.remove();if(!dead&&stage?.isConnected)stage.focus({preventScroll:true});});app.append(d);d.showModal();}
    function close(){const d=modalEl;modalEl=null;d?.close();d?.remove();}
    function map(){modal('지도',M.mapMarkup({floor:s.floor,z:camera.z}));}
    function act(a){
      if(a==='close'){close();return;}if(a==='menu'){modal('메뉴',window.B0UI.menuContent({namespace:'lab',close:'close',home:'home',record:'',extras:``}));return;}if(a==='home'){onHome();return;}if(a==='map'){map();return;}
      if(a==='inventory'){modal('소지품',s.keyTaken?`<div class="lab-key-detail">${keyArt}</div><p>계단실 열쇠</p>`:'<p>아직 가지고 있는 물건이 없다.</p>');return;}
      if(walking||stairRejecting)return;
      if(a==='view-home'){camera.zoom=1;selection=null;actions('');animate({x:0,z:s.floor===2?-2170:80,yaw:0,pitch:-4});return;}
      if(a==='zoom-in'||a==='zoom-out'){camera.zoom=Math.max(.65,Math.min(1.6,camera.zoom+(a==='zoom-in'?.15:-.15)));update();return;}
      if(a==='robot'){
        if(s.powerOut&&!s.powerTalked){selection=null;if(powerTalkIndex<0)powerTalkIndex=0;showPowerTalk();}
        else say('함께 살펴보겠습니다. 확인할 문이나 물건을 직접 골라 주세요.','robot');
        return;
      }
      if(a==='power-talk-next'){if(powerTalkIndex>=0){powerTalkIndex=Math.min(powerTalk.length-1,powerTalkIndex+1);showPowerTalk();}return;}
      if(a==='power-talk-close'){if(powerTalkIndex===powerTalk.length-1){s.powerTalked=true;save();cancelPowerTalk();notice.hidden=true;}return;}
      if(a.startsWith('go-')){close();walkTo(a.slice(3));return;}
      if(a==='forward'||a==='backward'){travel(a==='forward'?1:-1);return;}
      if(a==='turn-left'||a==='turn-right'){animate({yaw:camera.yaw+(a==='turn-left'?-90:90)});return;}
      if(a==='clear'){cancelPowerTalk();selection=null;notice.hidden=true;actions('문과 물건을 직접 눌러 살펴보세요.');return;}
      if(a==='inspect-stairs'){say('문은 없다. 계단 옆 차단 제어기에 열쇠 구멍과 접근 제한 표시가 있다.');return;}
      if(a==='keybox-open'){s.keyboxOpen=!s.keyboxOpen;app.querySelector('.lab-keybox').classList.toggle('open',s.keyboxOpen);save();showObject('keybox');return;}
      if(a==='take-key'){if(M.takeKey(s)){save();app.querySelector('.lab-keybox-back').innerHTML='';app.querySelector('.lab-pocket').innerHTML=b('열쇠 1','inventory','quiet');showObject('keybox');say('작은 금속 열쇠를 집었다. 고리에 계단실이라고 적혀 있다.');}return;}
      if(a==='unlock-stairs'){if(M.unlock(s)){save();app.querySelector('.lab-stair-entry').classList.add('authorized');app.querySelector('.lab-stair-control').classList.add('authorized');showObject('stairs');say('열쇠를 돌리자 계단의 접근 차단이 해제됐다.');}return;}
      if(a==='upstairs'){s.stairsUnlocked?ascend():rejectStairs();return;}if(a==='downstairs'){descend();return;}
      if(a.startsWith('enter-')){const id=a.slice(6);if(M.canEnter(s,id)){save();onEnter(id);}return;}
    }
    function click(e){
      if(suppress){suppress=false;return;}const action=e.target.closest('[data-lab]');if(action){e.preventDefault();act(action.dataset.lab);return;}
      if(walking||stairRejecting||modalEl||!stage.contains(e.target))return;
      const el=e.target.closest('[data-lab-object]');if(el){const id=el.dataset.labObject;if(M.doors[id])walkTo(id);else showObject(id);return;}
      if(e.detail===0)return;
      const rect=stage.getBoundingClientRect(),f=Math.min(stage.clientWidth*.65,stage.clientHeight*.6)*camera.zoom;
      const p=M.floorTarget(s,camera,e.clientX-rect.left,e.clientY-rect.top,rect.width,rect.height,f);
      if(!p||stairAttempt(p)||Math.hypot(p.x-camera.x,p.z-camera.z)<8)return;
      selection=null;actions('');stage.focus({preventScroll:true});animate(p);
    }
    function down(e){if(e.button!==0||walking||stairRejecting||modalEl||e.target.closest('button'))return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch,moved:false};}
    function move(e){if(!pointer||pointer.id!==e.pointerId)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(!pointer.moved&&Math.hypot(dx,dy)<6)return;pointer.moved=true;camera.yaw=pointer.yaw-dx*.22;camera.pitch=Math.max(-35,Math.min(45,pointer.pitch+dy*.15));update();}
    function up(){if(!pointer)return;suppress=pointer.moved;pointer=null;save();later(()=>{suppress=false;},0);}
    function cancel(){pointer=null;suppress=false;}
    function key(e){if(walking||stairRejecting||modalEl||e.target.closest('input,textarea,select,dialog'))return;if(['ArrowUp','w','W'].includes(e.key)){e.preventDefault();travel(1);}else if(['ArrowDown','s','S'].includes(e.key)){e.preventDefault();travel(-1);}else if(['ArrowLeft','ArrowRight','a','A','d','D'].includes(e.key)){e.preventDefault();animate({yaw:camera.yaw+(['ArrowLeft','a','A'].includes(e.key)?-90:90)});}else if((e.key==='Enter'||e.key===' ')&&e.target.dataset.labObject){e.preventDefault();const id=e.target.dataset.labObject;M.doors[id]?walkTo(id):showObject(id);}}
    function dispose(){dead=true;cancelAnimationFrame(frame);timers.forEach(clearTimeout);close();audio?.close();app.removeEventListener('click',click);window.removeEventListener('resize',update);}
    app.addEventListener('click',click);window.addEventListener('resize',update);render();save();return {dispose};
  };
})();
