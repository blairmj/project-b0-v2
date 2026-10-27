(function(){
  'use strict';
  const M=window.B0Choice;
  const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const button=(label,action,cls='',extra='')=>`<button type="button" class="${cls}" data-choice="${action}" ${extra}>${label}</button>`;
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.startChoiceRoom=function({app,portrait,onBack,onComplete,onHome,muted=false}){
    let raw;try{raw=JSON.parse(localStorage.getItem(M.KEY));}catch{}
    let s=M.restore(raw),stage,world,bar,notice,dialog=null,dead=false,busy=false,frame=0,pointer=null,suppress=false,atDesk=false;
    let selected='A',audio,camera={x:0,z:690,yaw:0,pitch:-6,zoom:1};
    const timers=new Set();
    const later=(fn,ms)=>{const id=setTimeout(()=>{timers.delete(id);if(!dead)fn();},ms);timers.add(id);return id;};
    function save(){try{localStorage.setItem(M.KEY,JSON.stringify(s));}catch{}}
    function mechanicalSound(long=false){
      if(muted)return;
      try{audio||=new(window.AudioContext||window.webkitAudioContext)();void audio.resume();const o=audio.createOscillator(),g=audio.createGain(),t=audio.currentTime,d=long?.9:.28;o.type='triangle';o.frequency.setValueAtTime(long?95:150,t);o.frequency.exponentialRampToValueAtTime(45,t+d);g.gain.setValueAtTime(.018,t);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(g).connect(audio.destination);o.start();o.stop(t+d);}catch{}
    }
    const cellPosition=n=>({x:(n%3-1)*280,z:(Math.floor(n/3)-1)*280});
    function wallMarkup(){
      return Array.from({length:9},(_,n)=>{
        const id=Object.keys(M.movable).find(k=>M.movable[k]===n),p=cellPosition(n),rotation=id?s.rotations[id]*90:0;
        return `<div class="choice-module ${id?'adjustable':''}" data-module="${id||n}" style="--rotation:${rotation}deg;transform:translate3d(${p.x}px,0,${p.z}px) rotateY(${-rotation}deg)">
          <div class="choice-tile-floor"><span>${id||''}</span></div>
          ${M.bases[n].map(d=>`<div class="choice-floor-track" style="transform:translateY(179px) rotateX(90deg) rotateZ(${d*90}deg)"></div>`).join('')}
          ${[0,1,2,3].filter(d=>!M.bases[n].includes(d)).map(d=>`<div class="choice-partition" style="--side:${-d*90}deg;transform:rotateY(${-d*90}deg) translateZ(-140px)"><span class="choice-panel-rib"></span><span class="choice-panel-inset"></span>${id?`<button type="button" data-choice="select-${id}" aria-label="칸막이 ${id} 조정" class="choice-panel-label">${id}</button>`:''}<i class="choice-panel-foot"></i></div>`).join('')}
        </div>`;
      }).join('');
    }
    function automaticMarkup(){
      if(atDesk)return `<div class="choice-assessment-wall"><small>ASSESSMENT STATION</small><strong>07</strong><div class="choice-terminal-screen"><i></i><span>도착 확인</span></div><div class="choice-desk-scratch"></div><div class="choice-desk-top"></div></div>`;
      return `<div class="choice-choice-wall"><span class="choice-wall-caption">SELECTION DESIGN / 01</span>${['left','right'].map((side,i)=>`<button type="button" class="choice-route-door ${side}" data-choice="visit-${side}" aria-label="${i?'오른쪽':'왼쪽'} 문으로 가기"><span>${i?'B':'A'}</span><div class="choice-door-leaves"><i></i><i></i></div><b>${i?'오른쪽':'왼쪽'} 경로</b></button>`).join('')}<div class="choice-route-indicator"><span>선택 대기</span><i></i></div></div>`;
    }
    function render(){
      app.innerHTML=`<main class="game choice-game">${window.B0UI.header({place:'선택설계실',namespace:'choice',reset:'view-home',active:true})}
        <section class="choice-stage ${s.manual?'manual':'automatic'} ${s.stowed?'stowed':''}" tabindex="0" aria-label="선택설계실. 빈 곳을 끌어 둘러보고 문이나 장치를 선택하세요.">
          <div class="choice-world">
            <div class="choice-room-floor"></div><div class="choice-room-ceiling"></div>
            <div class="choice-shell left"></div><div class="choice-shell right"></div><div class="choice-shell back"></div><div class="choice-shell front"></div><div class="choice-entry-door"><span>접속 구역</span><i></i></div>
            <div class="choice-service-door"><span>점검 통로</span><i></i></div>
            <div class="choice-modules" ${s.stowed?'inert':''}>${s.manual?wallMarkup():automaticMarkup()}</div>
            <div class="choice-b0"><div class="robot-sprite live-body">${portrait()}</div></div>
            <button class="choice-rail-case" data-choice="rail" aria-label="바닥 연결함 살펴보기"><i></i><span>연결함</span></button>
            <button class="choice-retract-lever ${s.stowed?'pulled':''}" data-choice="retract" aria-label="벽면 회수 레버" ${s.stowed?'disabled':''}><span>칸막이 회수</span><i></i><b>${s.stowed?'회수 완료':'대기'}</b></button>
            ${[-300,0,300].map(x=>`<div class="choice-overhead" style="transform:translate3d(${x}px,-238px,0) rotateX(-90deg)"></div>`).join('')}
          </div>
          <div class="choice-scene-tag"><span>${s.manual?'수동 배치':atDesk?'도착 지점':'안내 경로'}</span><b>${s.manual?'01':atDesk?'07':'A / B'}</b></div>
          <div class="choice-notice" role="status" hidden></div>
          <div class="choice-view-hint">끌어서 둘러보기</div><div class="choice-shade"></div>
        </section>
        <section class="choice-actions" aria-label="선택설계실 조작"></section>
        <footer>${button('B-0에게 말하기','robot','secondary')}${button('복도로 돌아가기','back','quiet')}</footer>
      </main>`;
      stage=app.querySelector('.choice-stage');world=app.querySelector('.choice-world');bar=app.querySelector('.choice-actions');notice=app.querySelector('.choice-notice');
      stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',cancelPointer);
      stage.addEventListener('keydown',key);stage.addEventListener('wheel',wheel,{passive:false});
      updateCamera();actions();
      if(s.phase==='service'||s.phase==='cleared'){camera={x:280,z:-610,yaw:180,pitch:-5,zoom:1};updateCamera();}
    }
    function actions(){
      if(s.phase==='cleared'){bar.innerHTML=`<div class="choice-action-title"><span class="choice-state-dot"></span>선택설계실 · 통로 개방</div><div class="choice-action-buttons">${button('열린 통로로 나가기','exit','primary')}${button('이 실험실 다시 해보기','restart-room','secondary')}</div>`;return;}
      if(s.phase==='service'){bar.innerHTML=`<div class="choice-action-title">점검 통로 · 벽면 회수 장치</div><div class="choice-action-buttons">${s.stowed?button('열린 통로로 나가기','exit','primary'):button('칸막이 회수 레버 당기기','retract','primary')}</div>`;return;}
      if(!s.manual){bar.innerHTML=`<div class="choice-action-title">${atDesk?'시험대 07 · 모서리에 같은 긁힌 자국이 있다.':'두 문 위에 서로 다른 표식이 있다.'}</div><div class="choice-action-buttons">${atDesk?button('두 문이 있는 곳으로','return-doors'):button('왼쪽 문으로','visit-left')+button('오른쪽 문으로','visit-right')}${button('바닥 연결함 살펴보기','rail','quiet')}</div>`;return;}
      bar.innerHTML=`<div class="choice-action-title"><span class="choice-state-dot amber"></span>안내 연결 해제 · 칸막이를 직접 움직일 수 있다.</div><div class="choice-action-buttons">${button('칸막이 배치판','board','primary')}${button('길 따라가 보기','test','secondary')}</div>`;
    }
    function say(text,robot=false){notice.innerHTML=`<b>${robot?'B-0':'나'}</b><p>${esc(text)}</p>${button('닫기','dismiss','quiet','aria-label="말풍선 닫기"')}`;notice.hidden=false;}
    function updateCamera(){
      if(dead||!stage)return;
      const focal=Math.min(stage.clientWidth*.74,stage.clientHeight*.78)*camera.zoom;
      stage.style.perspective=focal+'px';world.style.transform=`translateZ(${focal}px) rotateX(${camera.pitch}deg) rotateY(${camera.yaw}deg) translate3d(${-camera.x}px,0,${-camera.z}px)`;
      const bot=app.querySelector('.choice-b0');
      if(bot){const p=s.phase==='room'?{x:180,z:440}:{x:160,z:-300};bot.style.transform=`translate3d(${p.x-45}px,26px,${p.z}px) rotateY(${Math.atan2(camera.x-p.x,camera.z-p.z)*180/Math.PI}deg)`;}
    }
    function close(){const d=dialog;dialog=null;d?.close();d?.remove();stage?.focus({preventScroll:true});}
    function modal(title,body,cls=''){
      close();dialog=document.createElement('dialog');dialog.className='choice-modal '+cls;
      dialog.setAttribute('aria-label',title);dialog.innerHTML=`<header><h2>${title}</h2>${button('닫기','close','quiet')}</header><div class="choice-modal-body">${body}</div>`;
      dialog.addEventListener('close',()=>{const d=dialog;dialog=null;d?.remove();stage?.focus({preventScroll:true});});app.append(dialog);dialog.showModal();
    }
    function boardMarkup(){
      const trace=M.route(s);
      return `<p class="choice-board-caption">접속부끼리 맞닿으면 통로가 이어집니다. A·B·C·D 칸막이를 눌러 방향을 바꿔 보세요.</p><div class="choice-map-label end">점검 통로 ↑</div>
        <div class="choice-board" role="group" aria-label="3행 3열 칸막이 배치판">
        ${Array.from({length:9},(_,n)=>{
          const id=Object.keys(M.movable).find(k=>M.movable[k]===n),paths=M.ports(s,n).map(d=>{const p=[[50,0],[100,50],[50,100],[0,50]][d];return `M50 50L${p[0]} ${p[1]}`;}).join(' ');
          const contents=`<svg viewBox="0 0 100 100" aria-hidden="true"><path class="board-channel-edge" d="${paths}"/><path class="board-channel" d="${paths}"/><circle cx="50" cy="50" r="9"/></svg><span>${id||'·'}</span>`;
          return id?button(contents,'select-'+id,`choice-board-tile ${selected===id?'selected':''} ${trace.reached.includes(n)?'reached':''}`,`aria-label="칸막이 ${id}, ${M.ports(s,n).map(p=>['위','오른쪽','아래','왼쪽'][p]).join('·')} 연결" aria-pressed="${selected===id}"`):`<div class="choice-board-tile fixed ${trace.reached.includes(n)?'reached':''}" aria-label="고정 통로">${contents}</div>`;
        }).join('')}</div><div class="choice-map-label start">↑ 현재 위치</div>
        <div class="choice-turn-controls"><b>칸막이 ${selected}</b>${button('↶ 왼쪽으로 돌리기','turn-left')}${button('오른쪽으로 돌리기 ↷','turn-right')}</div>
        <div class="choice-board-bottom"><span>${trace.connected?'점검 통로까지 연결되어 있다.':'밝은 선은 현재 위치에서 이어진 통로다.'}</span>${button('길 따라가 보기','test','primary')}</div>`;
    }
    function board(){modal('칸막이 배치판',boardMarkup(),'choice-board-modal');}
    function updateBoard(){if(dialog?.classList.contains('choice-board-modal'))dialog.querySelector('.choice-modal-body').innerHTML=boardMarkup();}
    function turn(delta){
      if(!M.turn(s,selected,delta))return;save();mechanicalSound();
      const el=app.querySelector(`[data-module="${selected}"]`),p=cellPosition(M.movable[selected]);
      if(el)el.style.transform=`translate3d(${p.x}px,0,${p.z}px) rotateY(${-s.rotations[selected]*90}deg)`;
      updateBoard();
    }
    function rail(){
      if(s.phase!=='room'){say('벽 뒤의 회수 레버로 칸막이를 수납할 수 있어.');return;}
      if(s.manual){board();return;}
      modal('바닥 연결함',`<div class="choice-rail-detail"><div class="choice-connector"><span>안내 연결</span><i></i><b>자동</b></div><div class="choice-mini-routes"><span>A ↘</span><strong>07</strong><span>B ↗</span></div></div><p>두 문에서 나온 연결선이 같은 단자에 꽂혀 있다. 아래에는 칸막이 배치판이 접혀 있다.</p><p>연결 손잡이를 빼면 칸막이를 직접 돌릴 수 있을 것 같다.</p>${button('안내 연결 손잡이 빼기','release','primary wide')}`);
    }
    function tween(to,duration,done){
      const from={...camera},t0=performance.now(),turn=((to.yaw??from.yaw)-from.yaw+540)%360-180;
      const tick=now=>{if(dead)return;const p=reduced()?1:Math.min(1,(now-t0)/duration),q=p*p*(3-2*p);for(const k of ['x','z','pitch'])camera[k]=from[k]+((to[k]??from[k])-from[k])*q;camera.yaw=from.yaw+turn*q;updateCamera();if(p<1)frame=requestAnimationFrame(tick);else done?.();};frame=requestAnimationFrame(tick);
    }
    function visit(side){
      if(!M.visit(s,side))return;save();mechanicalSound(true);busy=true;notice.hidden=true;stage.classList.add('shifting');
      tween({x:side==='left'?-220:220,z:360,yaw:side==='left'?-20:20},650,()=>{
        later(()=>{atDesk=true;camera={x:0,z:690,yaw:0,pitch:-6,zoom:camera.zoom};busy=false;render();say(s.visits.length>1?'아까 그 시험대야. 모서리의 자국도 같아.':'시험대 번호가 07이네.');},reduced()?0:250);
      });
    }
    function test(){
      if(s.phase!=='room'||!s.manual)return;close();notice.hidden=true;
      const connected=M.test(s);save();
      if(!connected){say('통로 중간이 칸막이로 막혀 있어. 배치판에서 이어진 부분을 확인해 보자.');return;}
      busy=true;bar.innerHTML='<div class="choice-action-title">만든 길을 따라 이동하는 중…</div>';
      const points=M.route(s).path.map(cellPosition);points.push({x:280,z:-610});
      let i=0;
      function walk(){if(dead)return;if(i>=points.length){busy=false;camera.yaw=180;camera.pitch=-5;updateCamera();actions();say('벽 뒤로 나왔어. 여기에 칸막이를 회수하는 레버가 있어.');return;}const p=points[i++],yaw=Math.atan2(p.x-camera.x,camera.z-p.z)*180/Math.PI;tween({...p,yaw},reduced()?1:650,walk);}
      walk();
    }
    function retract(){
      if(!M.retract(s))return;save();mechanicalSound(true);busy=true;stage.classList.add('stowed');
      app.querySelector('.choice-modules').inert=true;
      const lever=app.querySelector('.choice-retract-lever');lever.classList.add('pulled');lever.disabled=true;lever.querySelector('b').textContent='회수 완료';
      bar.innerHTML='<div class="choice-action-title">칸막이가 바닥 수납부로 내려가고 있다…</div>';
      later(()=>{busy=false;actions();say('벽들이 모두 내려갔어. 이제 길이 한눈에 보여.');},reduced()?0:1800);
    }
    function act(a){
      if(a==='close'){close();return;}if(a==='dismiss'){notice.hidden=true;return;}
      if(busy)return;
      if(a==='menu'){modal('메뉴',`<div class="b0-menu-list">${button('계속하기','close')}${button('연구소 지도','map')}${button('사용법','help')}${button('이 실험실 다시 해보기','restart-room')}${button('시작 화면으로','home')}</div>`);return;}
      if(a==='map'){modal('연구소 지도',window.B0LabNavigation.mapMarkup({current:'선택설계실'}));return;}
      if(a==='help'){modal('사용법','<p>빈 곳을 끌거나 방향키로 둘러봅니다. 문과 연결함은 직접 누를 수 있습니다.</p><p>칸막이 배치판에서 A·B·C·D를 선택하고 좌우 회전 버튼을 누릅니다. 선이 서로 맞닿으면 실제 통로도 이어집니다.</p><p>길 따라가 보기는 현재 배치를 유지한 채 통로를 확인합니다. 막혀 있으면 다시 조정할 수 있습니다.</p>');return;}
      if(a==='home'){onHome();return;}if(a==='back'){onBack();return;}
      if(a==='view-home'){camera={x:0,z:690,yaw:0,pitch:-6,zoom:1};if(s.phase!=='room')camera={x:280,z:-610,yaw:180,pitch:-5,zoom:1};updateCamera();return;}
      if(a.startsWith('zoom-')){camera.zoom=Math.max(.65,Math.min(1.5,camera.zoom+(a==='zoom-in'?.15:-.15)));updateCamera();return;}
      if(a.startsWith('visit-')){visit(a.slice(6));return;}
      if(a==='return-doors'){atDesk=false;camera={x:0,z:690,yaw:0,pitch:-6,zoom:1};render();return;}
      if(a==='rail'){rail();return;}
      if(a==='release'){M.release(s);save();close();camera={x:0,z:690,yaw:0,pitch:-6,zoom:1};render();say('안내 연결이 빠졌어. 칸막이 배치판을 열어 볼까?');return;}
      if(a==='board'){board();return;}
      if(a.startsWith('select-')){const id=a.slice(7);if(s.phase!=='room'||!Object.hasOwn(M.movable,id))return;selected=id;if(dialog?.classList.contains('choice-board-modal'))updateBoard();else board();return;}
      if(a==='turn-left'||a==='turn-right'){turn(a==='turn-left'?-1:1);return;}
      if(a==='test'){test();return;}
      if(a==='retract'){retract();return;}
      if(a==='exit'){if(s.phase==='cleared'||M.leave(s)){save();onComplete();}return;}
      if(a==='restart-room'){modal('선택설계실을 다시 시작할까요?',`<p>접속실과 복도 진행은 유지하고, 이 실험실의 칸막이와 탐색 기록만 되돌립니다.</p><div class="action-row">${button('취소','close','secondary')}${button('다시 시작','confirm-reset','primary')}</div>`);return;}
      if(a==='confirm-reset'){s=M.fresh();save();close();atDesk=false;camera={x:0,z:690,yaw:0,pitch:-6,zoom:1};render();return;}
      if(a==='robot'){
        if(s.stowed)say('칸막이가 모두 수납되었습니다. 점검 통로는 열려 있습니다.',true);
        else if(s.phase==='service')say('이 레버에는 칸막이 회수라고 적혀 있습니다. 바닥 아래에 수납 공간이 보입니다.',true);
        else if(s.manual){const r=M.route(s);say(r.connected?'현재 위치에서 점검 통로까지 연결되어 있습니다. 직접 지나가 볼 수 있겠습니다.':`현재 위치에서 ${r.reached.length}개 구역이 이어집니다. 연결되지 않은 면에는 칸막이가 남아 있습니다.`,true);}
        else if(s.visits.includes('left')&&s.visits.includes('right'))say('두 문을 통과한 기록의 도착 지점이 모두 07입니다. 이동할 때 바닥에서 기계음이 났습니다.',true);
        else say('문에는 A와 B가 적혀 있습니다. 바닥의 레일은 두 문 아래로 이어집니다.',true);
      }
    }
    function click(e){if(suppress)return;const b=e.target.closest('[data-choice]');if(!b)return;e.preventDefault();act(b.dataset.choice);}
    function down(e){if(e.button!==0||busy||e.target.closest('button')||dialog)return;pointer={id:e.pointerId,x:e.clientX,y:e.clientY,yaw:camera.yaw,pitch:camera.pitch,moved:false};stage.setPointerCapture(e.pointerId);}
    function move(e){if(!pointer||e.pointerId!==pointer.id)return;const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;if(Math.hypot(dx,dy)>6)pointer.moved=true;camera.yaw=pointer.yaw-dx*.18;camera.pitch=Math.max(-35,Math.min(40,pointer.pitch+dy*.14));updateCamera();}
    function up(){if(!pointer)return;suppress=pointer.moved;pointer=null;later(()=>{suppress=false;},0);}
    function cancelPointer(){pointer=null;suppress=false;}
    function key(e){if(busy||dialog||e.target.closest('button'))return;if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();if(e.key==='ArrowLeft')camera.yaw-=15;if(e.key==='ArrowRight')camera.yaw+=15;if(e.key==='ArrowUp')camera.pitch=Math.max(-35,camera.pitch-8);if(e.key==='ArrowDown')camera.pitch=Math.min(40,camera.pitch+8);updateCamera();}}
    function wheel(e){e.preventDefault();if(busy||dialog)return;camera.zoom=Math.max(.65,Math.min(1.5,camera.zoom-e.deltaY*.001));updateCamera();}
    function dispose(){dead=true;cancelAnimationFrame(frame);timers.forEach(clearTimeout);close();void audio?.close();app.removeEventListener('click',click);window.removeEventListener('resize',updateCamera);}
    app.addEventListener('click',click);window.addEventListener('resize',updateCamera);render();save();return {dispose};
  };
})();

