/* personal-trainer/scene.js — the signature animation, extracted verbatim from the
   original's main script. base.js calls window.initScene(reduce) after first
   render; the block below closes over that parameter exactly as it closed over
   the outer-scope `reduce` before, so the reduced-motion path is unchanged. */
window.initScene = function (reduce) {
    if(reduce) return;
    var illo = document.querySelector('.portrait__illo');
    var group = illo && illo.querySelector('.portrait__sparks');
    if(!group) return;
    var NS = 'http://www.w3.org/2000/svg', sparks = [], GRAV = 0.045, since = 0;
    var running = false, rafId = null;
    function spawn(){
      var c = document.createElementNS(NS,'circle');
      var s = { el:c, x:170 + (Math.random()*44 - 22), y:250, vx:(Math.random()*1.5 - 0.75),
                vy:-(1.7 + Math.random()*1.5), life:0, max:80 + Math.random()*46, r:1 + Math.random()*1.9 };
      c.setAttribute('r', s.r.toFixed(2));
      c.setAttribute('fill', Math.random() < 0.7 ? '#FF7A47' : '#4FD8C4');
      c.setAttribute('class','portrait__spark');
      group.appendChild(c); sparks.push(s);
    }
    function tick(){
      if(!running) return;             // IO stopped us since this frame was queued
      if(++since > 7 && sparks.length < 44){ spawn(); since = 0; }
      for(var i=sparks.length-1;i>=0;i--){
        var s = sparks[i];
        s.vy += GRAV;                 // gravity acceleration
        s.x += s.vx; s.y += s.vy;     // momentum
        s.life++;
        var o = Math.max(0, 1 - s.life / s.max);
        s.el.setAttribute('cx', s.x.toFixed(1));
        s.el.setAttribute('cy', s.y.toFixed(1));
        s.el.setAttribute('opacity', (o * 0.9).toFixed(2));
        if(s.life >= s.max){ if(s.el.parentNode) group.removeChild(s.el); sparks.splice(i,1); }
      }
      rafId = requestAnimationFrame(tick);
    }
    function start(){
      if(running) return;
      running = true;
      rafId = requestAnimationFrame(tick);
    }
    function stop(){
      running = false;
      if(rafId != null) cancelAnimationFrame(rafId);
      rafId = null;
    }
    /* Continuous fountain, so unlike a settle-and-stop rig this never
       finishes on its own — gate it on hero visibility instead: pause
       while the hero is scrolled off-screen, resume when it's back. */
    if('IntersectionObserver' in window){
      var io = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting) start(); else stop(); });
      }, {threshold:0});
      io.observe(illo);
    } else {
      start();
    }
};
