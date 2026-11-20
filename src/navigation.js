import { CHAPTERS } from './store.js';

export function initNavigation({ store }, controls) {
  const sections = CHAPTERS.map((id) => document.getElementById(id));
  const initialChapter = store.get().chapter;
  let navigating = false;
  let scrollTimer;
  let navigationTimer;

  function captureChapter() {
    if (navigating) return;
    const edge = document.querySelector('.site-header').getBoundingClientRect().bottom + 80;
    const section = sections.findLast((el) => el.getBoundingClientRect().top <= edge) || sections[0];
    store.set({ chapter: section.id });
  }

  function navigate(chapter, behavior = 'smooth') {
    clearTimeout(navigationTimer);
    navigating = true;
    store.set({ chapter });
    store.flushUrl();
    // Allow the collapsed mobile controls and chart layout to settle first.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const section = document.getElementById(chapter);
      section.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : behavior });
      const heading = section.querySelector('h1, h2');
      heading.tabIndex = -1;
      heading.focus({ preventScroll: true });
      navigationTimer = setTimeout(() => { navigating = false; }, behavior === 'instant' ? 100 : 1000);
    }));
  }

  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (event) => {
      const id = link.getAttribute('href').slice(1);
      if (CHAPTERS.includes(id)) {
        event.preventDefault();
        controls.prepareView();
        navigate(id);
      } else if (id === 'main') {
        event.preventDefault();
        document.getElementById(id).focus();
      }
    });
  });
  document.querySelectorAll('[data-preset]').forEach((button) => {
    button.addEventListener('click', () => {
      const chapter = button.dataset.preset;
      controls.prepareView();
      store.reset({ chapter, x: chapter === 'explorer' ? 'gdp' : 'social' });
      navigate(chapter);
    });
  });
  document.getElementById('reset-view').addEventListener('click', () => {
    controls.prepareView();
    store.reset();
    navigate('top');
  });
  const markChapter = (state) => document.querySelectorAll('.chapter-nav a').forEach((link) => {
    if (link.hash === `#${state.chapter}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  store.subscribe((state, changed) => { if (changed.has('chapter')) markChapter(state); });
  markChapter(store.get());
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(captureChapter, 120);
  }, { passive: true });
  window.addEventListener('hashchange', () => {
    controls.prepareView();
    navigate(store.get().chapter, 'instant');
  });
  // Font metrics affect every chapter's position on a fresh visit.
  if (initialChapter !== 'top') {
    navigating = true;
    document.fonts.ready.then(() => navigate(initialChapter, 'instant'));
  }
  return { captureChapter };
}
