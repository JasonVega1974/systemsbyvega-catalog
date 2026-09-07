/* pressure-washing/scene.js — the signature animation, extracted from the
   original's main script; the procedural drawClean/drawDirty painting was later
   swapped for real photos (Phase B) with the erase mechanic untouched. base.js
   calls window.initScene(reduce) after first render; the block below closes
   over that parameter exactly as it closed over the outer-scope `reduce`
   before, so the reduced-motion path is unchanged. */
window.initScene = function (reduce) {
  /* =====================================================
     SIGNATURE — WAND-REVEAL HERO
     Two stacked canvases: a bright "clean" layer underneath,
     a grimy layer on top. Pointer/touch acts as the wash
     wand: destination-out compositing erases the dirty
     layer along the drag path, revealing the clean layer
     beneath. Fully mandatory fallbacks:
       - prefers-reduced-motion: skip the ambient auto-demo
         sweep (no looping animation); reveal a representative
         patch instantly instead, with no animation.
       - touch: Pointer Events unify mouse/touch/pen on all
         evergreen browsers; where PointerEvent is unavailable
         we bind explicit touchstart/touchmove/touchend AND
         mousedown/mousemove/mouseup listeners as a fallback.
       - universal "Tap to auto-clean" button: works for touch,
         reduced-motion, keyboard/switch users, or anyone who
         just doesn't want to drag.
     ===================================================== */
  (function(){
    var panel = document.getElementById('wandPanel');
    var cleanCv = document.getElementById('wandClean');
    var dirtyCv = document.getElementById('wandDirty');
    var brush = document.getElementById('wandBrush');
    var hint = document.getElementById('wandHint');
    var autoBtn = document.getElementById('wandAuto');
    if(!panel || !cleanCv || !dirtyCv || !cleanCv.getContext) return;

    var cctx = cleanCv.getContext('2d');
    var dctx = dirtyCv.getContext('2d');
    var W = 0, H = 0, dpr = Math.max(1, window.devicePixelRatio || 1);
    var touched = false, cleaned = false, autoRAF = null, demoRAF = null;

    function sizeCanvas(cv, ctx){
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    /* Real photography replaces the procedural grime/concrete painting
       (design upgrade, Phase B): two Pexels photos of matched concrete
       block pavers -- a moss-grown dark set on the dirty layer, a bright
       grey set on the clean layer (photos/CREDITS.md). Absolute paths,
       since on a tenant subdomain the document is served at "/" and a
       relative photos/ URL would 404. Until a photo decodes (or if its
       fetch fails) the draw functions below fall back to the old flat
       gradient fills, so the panel never shows blank or broken. A photo
       that arrives after first paint repaints its layer -- except the
       dirty layer once the visitor has started erasing it, because that
       repaint would silently undo their wash. */
    var cleanImg = new Image(), dirtyImg = new Image();
    function onPhotoReady(){
      if(!seen) return;
      drawClean();
      if(!cleaned && !touched) drawDirty();
    }
    cleanImg.onload = onPhotoReady;
    dirtyImg.onload = onPhotoReady;
    cleanImg.src = '/sites/pressure-washing/photos/wand-clean-pavers.jpg';
    dirtyImg.src = '/sites/pressure-washing/photos/wand-dirty-pavers.jpg';

    // cover-crop: fill the panel, preserve the photo's aspect, center the crop
    function drawCover(ctx, img){
      var iw = img.naturalWidth, ih = img.naturalHeight;
      var s = Math.max(W / iw, H / ih), dw = iw * s, dh = ih * s;
      ctx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
    }

    function drawClean(){
      cctx.clearRect(0,0,W,H);
      if(cleanImg.naturalWidth){ drawCover(cctx, cleanImg); return; }
      // fallback while the photo loads: plain bright "washed concrete"
      var g = cctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0, '#eef7fa');
      g.addColorStop(.55, '#d7ecf1');
      g.addColorStop(1, '#c3dee5');
      cctx.fillStyle = g;
      cctx.fillRect(0,0,W,H);
    }

    function drawDirty(){
      dctx.clearRect(0,0,W,H);
      if(dirtyImg.naturalWidth){ drawCover(dctx, dirtyImg); return; }
      // fallback while the photo loads: plain grime brown
      var g = dctx.createLinearGradient(0,0,W,H);
      g.addColorStop(0, '#5c4a2e');
      g.addColorStop(.5, '#4a3d26');
      g.addColorStop(1, '#332a1a');
      dctx.fillStyle = g;
      dctx.fillRect(0,0,W,H);
    }

    function resize(){
      var r = panel.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width));
      H = Math.max(1, Math.round(r.height));
      sizeCanvas(cleanCv, cctx);
      sizeCanvas(dirtyCv, dctx);
      drawClean();
      if(!cleaned) drawDirty();
    }

    var BRUSH_R = 42;
    var lastX = null, lastY = null;

    function erasePoint(x, y){
      dctx.save();
      dctx.globalCompositeOperation = 'destination-out';
      var rg = dctx.createRadialGradient(x,y,0,x,y,BRUSH_R);
      rg.addColorStop(0, 'rgba(0,0,0,1)');
      rg.addColorStop(.7, 'rgba(0,0,0,.9)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = rg;
      dctx.beginPath(); dctx.arc(x,y,BRUSH_R,0,Math.PI*2); dctx.fill();
      dctx.restore();
    }
    function eraseSegment(x1,y1,x2,y2){
      var dist = Math.hypot(x2-x1, y2-y1);
      var steps = Math.max(1, Math.ceil(dist / (BRUSH_R*.35)));
      for(var i=0;i<=steps;i++){
        var t = i/steps;
        erasePoint(x1 + (x2-x1)*t, y1 + (y2-y1)*t);
      }
    }

    function onTouchedFirst(){
      if(touched) return;
      touched = true;
      if(hint) hint.classList.add('hidden');
      if(demoRAF){ cancelAnimationFrame(demoRAF); demoRAF = null; }
    }

    function localXY(clientX, clientY){
      var r = panel.getBoundingClientRect();
      return { x: clientX - r.left, y: clientY - r.top };
    }

    function moveBrush(x, y, show){
      if(!brush) return;
      brush.style.left = x + 'px';
      brush.style.top = y + 'px';
      brush.style.width = (BRUSH_R*2) + 'px';
      brush.style.height = (BRUSH_R*2) + 'px';
      brush.style.opacity = show ? '1' : '0';
    }

    function handleStart(cx, cy){
      onTouchedFirst();
      var p = localXY(cx, cy);
      lastX = p.x; lastY = p.y;
      erasePoint(p.x, p.y);
      moveBrush(p.x, p.y, true);
    }
    function handleMove(cx, cy, active){
      var p = localXY(cx, cy);
      moveBrush(p.x, p.y, true);
      if(active){
        if(lastX == null){ lastX = p.x; lastY = p.y; }
        eraseSegment(lastX, lastY, p.x, p.y);
        lastX = p.x; lastY = p.y;
      }
    }
    function handleEnd(){
      lastX = null; lastY = null;
      moveBrush(0,0,false);
    }

    /* Input binding: Pointer Events unify mouse + touch + pen on every evergreen
       browser (this alone gives correct touch support). Where PointerEvent is
       unavailable we fall back to explicit touch + mouse listeners so dragging
       still works with real touch-event handling, not just mouse events. */
    if(window.PointerEvent){
      panel.addEventListener('pointerdown', function(e){
        try{ panel.setPointerCapture(e.pointerId); }catch(err){}
        handleStart(e.clientX, e.clientY);
      });
      panel.addEventListener('pointermove', function(e){ handleMove(e.clientX, e.clientY, e.buttons > 0); });
      panel.addEventListener('pointerup', handleEnd);
      panel.addEventListener('pointercancel', handleEnd);
      panel.addEventListener('pointerleave', function(){ moveBrush(0,0,false); });
    } else {
      // explicit touch fallback
      panel.addEventListener('touchstart', function(e){
        var t = e.touches[0]; if(t) handleStart(t.clientX, t.clientY);
      }, {passive:true});
      panel.addEventListener('touchmove', function(e){
        var t = e.touches[0]; if(t){ handleMove(t.clientX, t.clientY, true); e.preventDefault(); }
      }, {passive:false});
      panel.addEventListener('touchend', handleEnd, {passive:true});
      panel.addEventListener('touchcancel', handleEnd, {passive:true});
      // explicit mouse fallback
      var mdown = false;
      panel.addEventListener('mousedown', function(e){ mdown = true; handleStart(e.clientX, e.clientY); });
      panel.addEventListener('mousemove', function(e){ handleMove(e.clientX, e.clientY, mdown); });
      window.addEventListener('mouseup', function(){ mdown = false; handleEnd(); });
      panel.addEventListener('mouseleave', function(){ moveBrush(0,0,false); });
    }

    // "Tap to auto-clean" — universal fallback (touch / reduced-motion / anyone else)
    function autoClean(){
      onTouchedFirst();
      if(autoRAF){ cancelAnimationFrame(autoRAF); autoRAF = null; }
      if(cleaned){
        // reset: redraw the grime so the demo can be shown again
        drawDirty();
        cleaned = false;
        autoBtn.textContent = 'Tap to auto-clean';
        return;
      }
      if(reduce){
        // no animation under reduced motion — instant full reveal
        dctx.clearRect(0,0,W,H);
        cleaned = true;
        autoBtn.textContent = 'Reset the grime';
        return;
      }
      var start = null, duration = 900;
      function step(ts){
        if(start == null) start = ts;
        var t = Math.min(1, (ts - start) / duration);
        dctx.clearRect(0,0,W,H);
        // progressively reveal left-to-right with a soft wipe edge
        var edge = W * t;
        drawDirty();
        dctx.save();
        dctx.globalCompositeOperation = 'destination-out';
        var wg = dctx.createLinearGradient(0,0,edge+60,0);
        wg.addColorStop(0, 'rgba(0,0,0,1)');
        wg.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = wg;
        dctx.fillRect(0,0,edge+60,H);
        dctx.restore();
        if(t < 1){ autoRAF = requestAnimationFrame(step); }
        else { dctx.clearRect(0,0,W,H); cleaned = true; autoRAF = null; autoBtn.textContent = 'Reset the grime'; }
      }
      autoRAF = requestAnimationFrame(step);
    }
    if(autoBtn) autoBtn.addEventListener('click', autoClean);

    // ambient "demo sweep" hint — plays once before the visitor interacts, never
    // loops, and never runs at all under reduced motion (a static instant reveal
    // is drawn instead so the effect is still visible without any animation).
    function runDemoSweep(){
      if(reduce || touched) return;
      var start = null, duration = 1500;
      function step(ts){
        if(touched){ demoRAF = null; drawDirty(); return; }
        if(start == null) start = ts;
        var t = Math.min(1, (ts - start) / duration);
        var cx = W * (0.28 + 0.30 * Math.sin(t * Math.PI));
        var cy = H * (0.42 + 0.12 * Math.cos(t * Math.PI * 1.4));
        erasePoint(cx, cy);
        if(t < 1) demoRAF = requestAnimationFrame(step);
        else {
          demoRAF = null;
          // let the hint linger a moment, then quietly restore the grime so the
          // visitor's own drag starts from a fully dirty panel
          setTimeout(function(){ if(!touched) drawDirty(); }, 1100);
        }
      }
      demoRAF = requestAnimationFrame(step);
    }

    var seen = false;
    function onVisible(){
      if(seen) return; seen = true;
      resize();
      if(reduce){
        // static instant partial reveal — no animation, still shows the effect
        erasePoint(W*0.32, H*0.46);
      } else {
        runDemoSweep();
      }
    }
    if('IntersectionObserver' in window){
      var vio = new IntersectionObserver(function(entries){
        entries.forEach(function(e){ if(e.isIntersecting) onVisible(); });
      }, {threshold:.3});
      vio.observe(panel);
    } else { onVisible(); }

    window.addEventListener('resize', function(){
      var wasCleaned = cleaned;
      resize();
      if(wasCleaned) dctx.clearRect(0,0,W,H);
    }, {passive:true});
  })();
};
