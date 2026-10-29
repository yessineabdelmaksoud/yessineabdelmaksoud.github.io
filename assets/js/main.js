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
