/* Expand horizontal distances without scaling characters or props.
 * Puzzle/save positions remain in their original logical room coordinates. */
(function(){
  const scale=1.95,cache=new WeakMap();
  const scaleFor=world=>world?.matches?.('.c4-world')?3.9:scale;
  function sync(world){
    if(!world)return;
    const roomScale=scaleFor(world);
    let items=cache.get(world);
    if(!items){items=[...world.children].filter(el=>!el.matches('.c2-wall,.c2-floor,.c2-ceiling')).map(el=>{
      const css=getComputedStyle(el);return {el,x:parseFloat(css.left)||0,w:parseFloat(css.width)||0,base:css.transform,last:null};
    });cache.set(world,items);}
    for(const item of items){const {el}=item,transform=el.style.transform||item.base;
      if(item.last===transform)continue;item.last=transform;
      const m=new DOMMatrixReadOnly(transform==='none'?undefined:transform);
      el.style.translate=`${(item.x+item.w/2+m.m41)*(roomScale-1)}px 0px ${m.m43*(roomScale-1)}px`;
    }
    world.dataset.roomWidth=String(600*roomScale);
  }
  window.B0RoomSpace={scale,scaleFor,sync};
})();
