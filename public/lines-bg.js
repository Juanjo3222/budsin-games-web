(function(){
  const canvas = document.createElement('canvas');
  canvas.id = 'lines-bg';
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W, H, pts = [], mx = -1e9, my = -1e9, time = 0;

  function resize() {
    W = canvas.width = innerWidth;
    H = canvas.height = innerHeight;
    const n = Math.floor(40 + W / 50);
    pts = [];
    for (let i = 0; i < n; i++) {
      pts.push({
        x: Math.random() * W, y: Math.random() * H,
        ox: Math.random() * W, oy: Math.random() * H
      });
    }
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function draw() {
    time += 0.004;
    ctx.clearRect(0, 0, W, H);
    const theme = document.documentElement.getAttribute('data-site-theme');
    const dark = theme === 'dark' || theme === 'ps5';
    const col = dark ? '148,163,184' : '18,24,38';

    for (const p of pts) {
      const wave = Math.sin(time + p.ox * 0.003) * 0.5 + Math.cos(time * 0.7 + p.oy * 0.004) * 0.5;
      p.x += Math.cos(time + p.ox * 0.005) * 0.3 + wave * 0.2;
      p.y += Math.sin(time * 0.8 + p.oy * 0.005) * 0.3 + wave * 0.2;
      const dx = p.ox - p.x, dy = p.oy - p.y;
      p.x += dx * 0.002;
      p.y += dy * 0.002;

      const d = Math.hypot(p.x - mx, p.y - my);
      if (d < 150) {
        const ang = Math.atan2(p.y - my, p.x - mx);
        const f = (1 - d / 150) * 3;
        p.x += Math.cos(ang) * f;
        p.y += Math.sin(ang) * f;
      }

      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${col},0.4)`;
      ctx.fill();
    }

    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
        if (d < 150) {
          const a = (1 - d / 150) * 0.35;
          ctx.beginPath();
          ctx.moveTo(pts[i].x, pts[i].y);
          ctx.lineTo(pts[j].x, pts[j].y);
          ctx.strokeStyle = `rgba(${col},${a})`;
          ctx.lineWidth = 1;
          ctx.stroke();

          if (d < 60) {
            const mdx = (pts[i].x + pts[j].x) / 2, mdy = (pts[i].y + pts[j].y) / 2;
            const md = Math.hypot(mdx - mx, mdy - my);
            if (md < 120) {
              const f = (1 - md / 120) * 0.6;
              ctx.beginPath();
              ctx.moveTo(lerp(pts[i].x, pts[j].x, 0.3), lerp(pts[i].y, pts[j].y, 0.3));
              ctx.lineTo(lerp(pts[i].x, pts[j].x, 0.7), lerp(pts[i].y, pts[j].y, 0.7));
              ctx.strokeStyle = `rgba(239,63,69,${f})`;
              ctx.lineWidth = 2;
              ctx.stroke();
              const off = 10 + Math.random() * 20;
              ctx.beginPath();
              ctx.moveTo(lerp(pts[i].x, pts[j].x, 0.3), lerp(pts[i].y, pts[j].y, 0.3));
              ctx.lineTo(lerp(pts[i].x, pts[j].x, 0.3) + (Math.random() - 0.5) * off, lerp(pts[i].y, pts[j].y, 0.3) + (Math.random() - 0.5) * off);
              ctx.strokeStyle = `rgba(239,63,69,${f * 0.7})`;
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(lerp(pts[i].x, pts[j].x, 0.7), lerp(pts[i].y, pts[j].y, 0.7));
              ctx.lineTo(lerp(pts[i].x, pts[j].x, 0.7) + (Math.random() - 0.5) * off, lerp(pts[i].y, pts[j].y, 0.7) + (Math.random() - 0.5) * off);
              ctx.strokeStyle = `rgba(239,63,69,${f * 0.7})`;
              ctx.lineWidth = 1;
              ctx.stroke();
            }
          }
        }
      }
    }
    requestAnimationFrame(draw);
  }

  addEventListener('resize', resize);
  addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });
  addEventListener('mouseleave', () => { mx = -1e9; my = -1e9; });
  resize();
  draw();
})();
