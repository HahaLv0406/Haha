(() => {
  const pitch=document.querySelector('#pitch'), ball=document.querySelector('#ball'), shoe=document.querySelector('#shoe-cursor'), message=document.querySelector('#hud-message'), count=document.querySelector('#kick-counter'), flash=document.querySelector('#goal-flash');
  if(!pitch||!ball)return;
  const goals=[...pitch.querySelectorAll('.goal')];
  const state={x:0,y:0,vx:1.1,vy:-.45,lastX:null,lastY:null,pointerX:0,pointerY:0,kicks:0,lastKick:0,scored:false,lastTime:0};
  const radius=18;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function size(){return {w:pitch.clientWidth,h:pitch.clientHeight}}
  function goalRects(){const p=pitch.getBoundingClientRect();return goals.map(g=>{const r=g.getBoundingClientRect();return {id:g.dataset.goal,x:r.left-p.left+r.width/2,y:r.top-p.top+r.height*.72,half:r.width*.43}})}
  function setMessage(t){message.textContent=t}
  function kick(dx,dy){
    if(state.scored)return;
    const now=performance.now();if(now-state.lastKick<380)return;
    let len=Math.hypot(dx,dy);
    if(len<2){dx=state.x-state.pointerX;dy=state.y-state.pointerY;len=Math.hypot(dx,dy)}
    if(len<2){dx=0;dy=-1;len=1}
    dx/=len;dy/=len;
    // A kick should travel forward into the pitch, while preserving the player's chosen left/right aim.
    if(dy>-.12)dy=-Math.max(.38,Math.abs(dy));
    len=Math.hypot(dx,dy);dx/=len;dy/=len;
    state.vx=dx*13.8;state.vy=dy*13.8;state.lastKick=now;state.kicks++;count.textContent=String(state.kicks).padStart(2,'0');
    setMessage('Nice touch — aim for one of the three goals.');
  }
  function movePointer(e){
    const r=pitch.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;
    shoe.style.left=e.clientX+'px';shoe.style.top=e.clientY+'px';shoe.classList.add('visible');
    state.pointerX=x;state.pointerY=y;
    if(state.lastX!==null){
      const dx=x-state.lastX,dy=y-state.lastY;
      if(Math.hypot(x-state.x,y-state.y)<37 && Math.hypot(dx,dy)>1.2 && performance.now()-state.lastKick>380)kick(dx,dy);
    }
    state.lastX=x;state.lastY=y;
  }
  pitch.addEventListener('pointerenter',()=>{shoe.classList.add('visible');setMessage('Move your shoe into the ball to kick it.')});
  pitch.addEventListener('pointerleave',()=>shoe.classList.remove('visible'));
  pitch.addEventListener('pointermove',movePointer);
  pitch.addEventListener('pointerdown',e=>{const r=pitch.getBoundingClientRect();state.pointerX=e.clientX-r.left;state.pointerY=e.clientY-r.top;if(Math.hypot(state.pointerX-state.x,state.pointerY-state.y)<60)kick(state.x-state.pointerX,state.y-state.pointerY)});
  window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const d=e.key==='ArrowLeft'?-0.7:e.key==='ArrowRight'?0.7:0;kick(d,-1)}});
  function score(goal){
    state.scored=true;flash.classList.add('show');flash.querySelector('strong').textContent='GOAL!';
    flash.querySelector('span').textContent='TAKING YOU TO '+goal.label.toUpperCase();
    setMessage('Goal scored. Opening your page…');
    window.setTimeout(()=>{window.location.href=goal.href},1050);
  }
  function frame(t){
    if(!state.lastTime)state.lastTime=t;
    const dt=Math.min((t-state.lastTime)/16.67,2);state.lastTime=t;
    const {w,h}=size();
    if(!state.scored){
      state.x+=state.vx*dt;state.y+=state.vy*dt;
      state.vx*=Math.pow(.994,dt);state.vy*=Math.pow(.994,dt);
      if(Math.abs(state.vx)+Math.abs(state.vy)<.55){state.vx+=Math.sin(t/900)*.018;state.vy+=Math.cos(t/1100)*.014}
      if(state.x<radius||state.x>w-radius){state.x=clamp(state.x,radius,w-radius);state.vx*=-.82}
      if(state.y>h-radius){state.y=h-radius;state.vy*=-.78}
      const rects=goalRects();
      if(state.y<radius+rects[0].y-12){
        const target=rects.find(g=>Math.abs(state.x-g.x)<g.half);
        if(target&&state.vy<0){score({label:target.id==='base'?'Base Cup':target.id==='about'?'About Me':'Ask Me About',href:target.id==='base'?'journey.html':target.id==='about'?'about.html':'help.html'})}
        else {state.y=radius+rects[0].y-12;state.vy=Math.abs(state.vy)*.78;setMessage('Saved by the net — try another angle.')}
      }
      if(Math.hypot(state.x-state.pointerX,state.y-state.pointerY)<37 && state.lastX!==null && t-state.lastKick>380){/* wait for a fresh pointer movement */}
      ball.style.left=state.x+'px';ball.style.top=state.y+'px';ball.style.transform='translate(-50%,-50%) rotate('+((t/7)%360)+'deg)';
    }
    requestAnimationFrame(frame);
  }
  const {w,h}=size();state.x=w*.5;state.y=h*.68;state.vx=1.2;state.vy=-.35;
  ball.style.left=state.x+'px';ball.style.top=state.y+'px';
  requestAnimationFrame(frame);
  window.addEventListener('resize',()=>{const s=size();state.x=clamp(state.x,radius,s.w-radius);state.y=clamp(state.y,radius,s.h-radius)});
})();