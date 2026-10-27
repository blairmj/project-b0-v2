(function(root){
  'use strict';
  const KEY='project-b0-v2-choice-v1';
  const movable={A:7,B:4,C:2,D:0};
  const bases=[[1,2],[1,3],[0,2,3],[0,2],[1,2],[0,3],[0,1],[0,2,3],[0,3]];
  const initial={A:1,B:2,C:3,D:2};
  const fresh=()=>({version:1,manual:false,rotations:{...initial},visits:[],attempts:0,phase:'room',stowed:false});
  function restore(raw){
    const s=fresh();if(!raw||raw.version!==1)return s;
    s.manual=raw.manual===true;
    for(const id of Object.keys(movable))if(Number.isInteger(raw.rotations?.[id]))s.rotations[id]=((raw.rotations[id]%4)+4)%4;
    s.visits=Array.isArray(raw.visits)?raw.visits.filter(x=>x==='left'||x==='right').slice(-12):[];
    s.attempts=Math.min(999,Math.max(0,Number(raw.attempts)||0));
    if(s.manual&&route(s).connected&&['service','cleared'].includes(raw.phase))s.phase=raw.phase;
    s.stowed=s.phase!=='room'&&raw.stowed===true;
    if(s.phase==='cleared'&&!s.stowed)s.phase='service';
    return s;
  }
  function ports(s,index){const id=Object.keys(movable).find(k=>movable[k]===index);return bases[index].map(p=>(p+(id?s.rotations[id]:0))%4);}
  function route(s){
    const reached=[],parents={},queue=[];
    if(ports(s,7).includes(2)){queue.push(7);parents[7]=null;}
    while(queue.length){
      const n=queue.shift();reached.push(n);
      for(const p of ports(s,n)){
        const row=Math.floor(n/3),col=n%3;
        const nr=row+[-1,0,1,0][p],nc=col+[0,1,0,-1][p];
        if(nr<0||nr>2||nc<0||nc>2)continue;
        const next=nr*3+nc;
        if(Object.hasOwn(parents,next)||!ports(s,next).includes((p+2)%4))continue;
        parents[next]=n;queue.push(next);
      }
    }
    const connected=reached.includes(2)&&ports(s,2).includes(0),path=[];
    if(connected){let n=2;while(n!==null){path.unshift(n);n=parents[n];}}
    return {connected,reached,path};
  }
  function visit(s,side){if(s.manual||!['left','right'].includes(side))return false;s.visits.push(side);s.visits=s.visits.slice(-12);return true;}
  function release(s){if(s.phase!=='room')return false;s.manual=true;return true;}
  function turn(s,id,delta){if(!s.manual||s.phase!=='room'||!Object.hasOwn(movable,id)||![-1,1].includes(delta))return false;s.rotations[id]=(s.rotations[id]+delta+4)%4;return true;}
  function test(s){if(!s.manual||s.phase!=='room')return false;s.attempts++;if(route(s).connected){s.phase='service';return true;}return false;}
  function retract(s){if(s.phase!=='service'||!route(s).connected)return false;s.stowed=true;return true;}
  function leave(s){if(s.phase!=='service'||!s.stowed)return false;s.phase='cleared';return true;}
  const api={KEY,movable,bases,fresh,restore,ports,route,visit,release,turn,test,retract,leave};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.B0Choice=api;
})(typeof window!=='undefined'?window:globalThis);
