(function () {
  var root = document.documentElement;
  var toggle = document.querySelector('[data-theme-toggle]');
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Theme
  function labelToggle() {
    var dark = root.getAttribute('data-theme') === 'dark';
    toggle.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', dark ? '#0D1424' : '#ECEEF1');
    });
  }
  toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    labelToggle();
    window.dispatchEvent(new CustomEvent('themechange'));
  });
  labelToggle();

  // Header background once the page moves
  var header = document.querySelector('.top');
  function onScroll() { header.classList.toggle('scrolled', scrollY > 24); }
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Current section in the nav
  var links = {};
  document.querySelectorAll('.top nav a').forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
  var sectionObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var a = links[e.target.id];
      if (a && e.isIntersecting) {
        Object.values(links).forEach(function (l) { l.classList.remove('active'); l.removeAttribute('aria-current'); });
        a.classList.add('active');
        a.setAttribute('aria-current', 'true');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('main section[id]').forEach(function (s) { sectionObserver.observe(s); });

  // Project diagrams animate only while on screen
  var caseObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) { e.target.classList.toggle('in-view', e.isIntersecting); });
  }, { threshold: 0.35 });
  document.querySelectorAll('.case').forEach(function (c) { caseObserver.observe(c); });

  // Scroll-driven 3D: --p goes from 0 as an element enters to 1 once it is in place
  var s3d = Array.prototype.slice.call(document.querySelectorAll('[data-s3d]'));
  if (s3d.length && !reduce) {
    document.querySelectorAll('.now-grid article').forEach(function (el, i) { el.s3dDelay = i * 0.12; });
    var ticking = false;
    var update = function () {
      ticking = false;
      var vh = innerHeight;
      s3d.forEach(function (el) {
        var r = el.getBoundingClientRect();
        if (r.top > vh * 1.2 || r.bottom < -vh * 0.2) return;
        var p = (vh - r.top) / (vh * 0.55) - (el.s3dDelay || 0);
        p = Math.max(0, Math.min(1, p));
        p = 1 - Math.pow(1 - p, 3);
        el.style.setProperty('--p', p.toFixed(3));
      });
    };
    var request = function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    addEventListener('scroll', request, { passive: true });
    addEventListener('resize', request);
    update();
  }

  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // Projects stack: as the next case slides over, the one underneath recedes (--c 0..1)
  var cases = Array.prototype.slice.call(document.querySelectorAll('.case'));
  var stackMode = matchMedia('(min-width: 961px) and (min-height: 700px)');
  // Experience drum and progress line
  var timeline = document.querySelector('.timeline');
  var items = timeline ? Array.prototype.slice.call(timeline.children) : [];

  function updateDepth() {
    var vh = innerHeight;
    var cover = cases.map(function (el, i) {
      var next = cases[i + 1];
      if (!stackMode.matches || !next) return 0;
      var stickTop = parseFloat(getComputedStyle(next).top) || 0;
      return clamp((vh - next.getBoundingClientRect().top) / (vh - stickTop), 0, 1);
    });
    cases.forEach(function (el, i) {
      if (!stackMode.matches) { el.style.removeProperty('--c'); el.style.removeProperty('--c2'); return; }
      // --c: covered by the next card; --c2 adds the card after that, so cards two deep fade away
      el.style.setProperty('--c', cover[i].toFixed(3));
      el.style.setProperty('--c2', (1 + (cover[i + 1] || 0)).toFixed(3));
    });

    if (timeline) {
      var tr = timeline.getBoundingClientRect();
      timeline.style.setProperty('--tl', clamp((vh * 0.5 - tr.top) / tr.height, 0, 1).toFixed(3));
      items.forEach(function (li) {
        var r = li.querySelector('summary').getBoundingClientRect();
        var d = clamp((r.top + r.height / 2 - vh / 2) / (vh * 0.6), -1, 1);
        li.style.setProperty('--d', d.toFixed(3));
        li.style.setProperty('--ad', Math.abs(d).toFixed(3));
        li.classList.toggle('passed', r.top + r.height / 2 < vh / 2);
      });
    }
  }
  if (!reduce) {
    var depthTicking = false;
    var requestDepth = function () {
      if (!depthTicking) { depthTicking = true; requestAnimationFrame(function () { depthTicking = false; updateDepth(); }); }
    };
    addEventListener('scroll', requestDepth, { passive: true });
    addEventListener('resize', requestDepth);
    if (timeline) timeline.addEventListener('toggle', requestDepth, true);
    updateDepth();
  }

  // Contact heading: split into letters that flip up in turn. Screen readers get the plain heading.
  document.querySelectorAll('[data-split]').forEach(function (h) {
    var text = h.textContent.trim();
    h.setAttribute('aria-label', text);
    h.textContent = '';
    var ci = 0;
    text.split(' ').forEach(function (word, wi) {
      if (wi) h.appendChild(document.createTextNode(' '));
      var w = document.createElement('span');
      w.className = 'w';
      w.setAttribute('aria-hidden', 'true');
      Array.prototype.forEach.call(word, function (ch) {
        var c = document.createElement('span');
        c.className = 'ch';
        c.style.setProperty('--ci', ci++);
        c.textContent = ch;
        w.appendChild(c);
      });
      h.appendChild(w);
    });
  });

  // Rolling links: a second copy of the label sits on the cube's bottom face
  document.querySelectorAll('[data-roll]').forEach(function (a) {
    var text = a.textContent.trim();
    a.textContent = '';
    var roll = document.createElement('span');
    roll.className = 'roll';
    var front = document.createElement('span');
    front.className = 'roll-face';
    front.textContent = text;
    var bottom = document.createElement('span');
    bottom.className = 'roll-face roll-bottom';
    bottom.setAttribute('aria-hidden', 'true');
    bottom.textContent = text;
    roll.appendChild(front);
    roll.appendChild(bottom);
    a.appendChild(roll);
  });

  // Magnetic links lean toward the pointer
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    document.querySelectorAll('[data-magnet]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        el.style.translate = (dx * 0.22).toFixed(1) + 'px ' + (dy * 0.35).toFixed(1) + 'px';
      });
      el.addEventListener('pointerleave', function () { el.style.translate = ''; });
    });
  }

  // Skills globe: tags on a sphere, spins on its own, drag to throw it
  var globe = document.querySelector('.globe');
  if (globe) {
    var tags = Array.prototype.slice.call(globe.children);
    var n = tags.length;
    var golden = Math.PI * (3 - Math.sqrt(5));
    var pts = tags.map(function (_, i) {
      var y = 1 - (i / (n - 1)) * 2;
      var rr = Math.sqrt(1 - y * y);
      return [Math.cos(golden * i) * rr, y, Math.sin(golden * i) * rr];
    });
    var ax = -0.25, ay = 0, vx = 0, vy = 0.004;
    var spinY = 0.004, dragging = false, last = null, globeVisible = false, hover = false;

    var drawGlobe = function () {
      var R = globe.clientWidth * 0.4;
      var cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
      for (var i = 0; i < n; i++) {
        var p = pts[i];
        var x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
        var y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
        var depth = (z2 + 1) / 2;
        var t = tags[i];
        t.style.transform = 'translate(-50%, -50%) translate3d(' + (x1 * R).toFixed(1) + 'px,' + (y2 * R).toFixed(1) + 'px,0) scale(' + (0.65 + depth * 0.5).toFixed(3) + ')';
        t.style.opacity = (0.2 + depth * 0.8).toFixed(2);
        t.style.zIndex = Math.round(depth * 100);
        t.classList.toggle('front', depth > 0.88);
      }
    };
    var tick = function () {
      if (!globeVisible) return;
      if (!dragging) {
        var target = hover ? spinY * 0.25 : spinY;
        vy += (target - vy) * 0.02;
        vx *= 0.95;
      }
      ay += vy;
      ax = clamp(ax + vx, -1.2, 1.2);
      drawGlobe();
      requestAnimationFrame(tick);
    };
    drawGlobe();
    if (!reduce) {
      new IntersectionObserver(function (entries) {
        var was = globeVisible;
        globeVisible = entries[0].isIntersecting;
        if (globeVisible && !was) requestAnimationFrame(tick);
      }).observe(globe);
      globe.addEventListener('pointerenter', function () { hover = true; });
      globe.addEventListener('pointerleave', function () { hover = false; });
      globe.addEventListener('pointerdown', function (e) {
        dragging = true; last = [e.clientX, e.clientY];
        globe.classList.add('dragging');
        globe.setPointerCapture(e.pointerId);
      });
      globe.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        vy = (e.clientX - last[0]) * 0.006;
        vx = -(e.clientY - last[1]) * 0.006;
        last = [e.clientX, e.clientY];
      });
      var release = function () { dragging = false; globe.classList.remove('dragging'); };
      globe.addEventListener('pointerup', release);
      globe.addEventListener('pointercancel', release);
    }
  }

  // Portrait follows the pointer a little
  var portrait = document.querySelector('[data-tilt]');
  if (portrait && !reduce && matchMedia('(pointer: fine)').matches) {
    var hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', function (e) {
      var r = portrait.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / innerWidth;
      var y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      portrait.style.transform = 'perspective(900px) rotateY(' + (x * 14).toFixed(2) + 'deg) rotateX(' + (-y * 14).toFixed(2) + 'deg)';
    });
    hero.addEventListener('pointerleave', function () { portrait.style.transform = ''; });
  }
})();
