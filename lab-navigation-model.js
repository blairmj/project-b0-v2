(function(root){
  'use strict';
  const doors={
    practice:{name:'접속실',floor:1,x:0,z:236,yaw:180},
    storage:{name:'선택설계실',floor:1,x:268,z:-320,yaw:90},
    access:{name:'출입 관리실',floor:1,x:-268,z:-950,yaw:-90},
    mirror:{name:'유리 관찰실',floor:1,x:268,z:-1320,yaw:90},
    keybox:{name:'열쇠 보관함',floor:1,x:-268,z:-1640,yaw:-90},
    stairs:{name:'2층 계단',floor:1,x:0,z:-1810,yaw:0},
    outside:{name:'외부 출입구',floor:1,x:-268,z:-1160,yaw:-90},
    central:{name:'중앙관리실',floor:2,x:0,z:-2540,yaw:0}
  };
  const fresh=()=>({version:1,mode:'hall',floor:1,camera:{x:0,z:80,yaw:0,pitch:-4},cleared:{practice:false,storage:false,access:false,mirror:false},keyboxOpen:false,keyTaken:false,stairsUnlocked:false,barrierTriggered:false,powerOut:false,powerTalked:false,companion:null,visited:[]});
  function restore(raw){
    const s=fresh();if(!raw||raw.version!==1)return s;
    for(const id of Object.keys(s.cleared))s.cleared[id]=raw.cleared?.[id]===true;
    for(const id of ['keyboxOpen','keyTaken','stairsUnlocked','powerTalked'])s[id]=raw[id]===true;
    if(s.stairsUnlocked)s.keyTaken=true;
    s.floor=raw.floor===2&&s.stairsUnlocked?2:1;s.mode=raw.mode==='room'?'room':'hall';
    const c=raw.camera||{};s.camera={x:Number.isFinite(c.x)?Math.max(-180,Math.min(180,c.x)):0,z:Number.isFinite(c.z)?c.z:80,yaw:Number.isFinite(c.yaw)?c.yaw:0,pitch:Number.isFinite(c.pitch)?Math.max(-35,Math.min(45,c.pitch)):-4};
    const p=bound(s,s.camera.x,s.camera.z);s.camera.x=p.x;s.camera.z=p.z;
    s.barrierTriggered=raw.barrierTriggered===true||s.camera.z<=-60||s.cleared.storage;
    s.powerOut=raw.powerOut===true||(raw.powerOut===undefined&&(s.barrierTriggered||s.cleared.access||s.cleared.mirror));
    if(raw.companion&&Number.isFinite(raw.companion.x)&&Number.isFinite(raw.companion.z)&&raw.companion.floor===s.floor)s.companion=companionSpot(raw.companion.x,raw.companion.z,s.floor);
    s.visited=Array.isArray(raw.visited)?raw.visited.filter(id=>doors[id]):[];return s;
  }
  function merge(s,p){for(const id of Object.keys(s.cleared))s.cleared[id]||=p[id]===true;return s;}
  function bound(s,x,z){
    x=Math.max(-180,Math.min(180,x));
    if(s.floor===2)return {x,z:Math.max(-2435,Math.min(-2150,z))};
    const min=!s.cleared.mirror?-1460:-1700;
    return {x,z:Math.max(min,Math.min(160,z))};
  }
  function canEnter(s,id){return ['practice','storage'].includes(id);}
  function returned(s,from){
    s.mode='hall';s.floor=1;s.companion=null;s.camera={x:0,z:80,yaw:0,pitch:-4};
    if(from==='storage'){s.cleared.storage=true;s.camera.z=-790;}
    if(from==='access'){s.cleared.access=true;s.camera.z=-1100;}
    if(from==='mirror'){s.cleared.access=s.cleared.mirror=true;s.camera.z=-1610;s.camera.yaw=-22;}
    if(from==='central'){s.floor=2;s.camera.z=-2350;s.camera.yaw=0;}
    if(from==='practice')s.cleared.practice=true;
    return s;
  }
  function takeKey(s){if(s.floor!==1||!s.cleared.mirror||!s.keyboxOpen||s.keyTaken)return false;s.keyTaken=true;return true;}
  function unlock(s){if(!s.keyTaken||s.floor!==1)return false;s.stairsUnlocked=true;return true;}
  function floor(s,n){if(n===2&&!s.stairsUnlocked)return false;s.floor=n===2?2:1;s.companion=null;s.camera={x:0,z:s.floor===2?-2170:-1700,yaw:s.floor===2?0:180,pitch:-4};return true;}
  function companionSpot(x,z,floor){return {x:Math.max(-175,Math.min(175,x)),z:Math.max(floor===2?-2440:-2120,Math.min(160,z)),floor};}
  // Invert the CSS perspective camera and intersect the ray with this floor.
  function floorTarget(s,c,sx,sy,width,height,focal){
    if(!(width>0&&height>0&&focal>0))return null;
    const pitch=c.pitch*Math.PI/180,yaw=c.yaw*Math.PI/180;
    const u=(sx-width/2)/focal,v=(sy-height/2)/focal;
    const ry=v*Math.cos(pitch)-Math.sin(pitch),rz=-v*Math.sin(pitch)-Math.cos(pitch);
    if(ry<=.03)return null;
    const dx=u*Math.cos(yaw)-rz*Math.sin(yaw),dz=u*Math.sin(yaw)+rz*Math.cos(yaw);
    const t=180/ry,scale=Math.min(1,900/Math.max(1,Math.hypot(dx*t,dz*t)));
    return bound(s,c.x+dx*t*scale,c.z+dz*t*scale);
  }
  // Swept foot contact with the actual loose plate, rather than a hallway-wide trigger.
  function stepsOnPanel(from,to){
    if(Math.hypot(to.x-from.x,to.z-from.z)<.001)return false;
    let enter=0,leave=1;
    for(const [axis,min,max]of [['x',-55,55],['z',-125,-5]]){
      const delta=to[axis]-from[axis];
      if(Math.abs(delta)<.000001){if(from[axis]<min||from[axis]>max)return false;continue;}
      const a=(min-from[axis])/delta,b=(max-from[axis])/delta;
      enter=Math.max(enter,Math.min(a,b));leave=Math.min(leave,Math.max(a,b));
      if(enter>leave)return false;
    }
    return true;
  }
  function groundAt(z){return Math.max(0,Math.min(360,(-z-1810)/308*360));}
  const api={doors,fresh,restore,merge,bound,canEnter,returned,takeKey,unlock,floor,companionSpot,floorTarget,stepsOnPanel,groundAt};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.B0LabNavigation=api;
})(typeof window!=='undefined'?window:globalThis);
