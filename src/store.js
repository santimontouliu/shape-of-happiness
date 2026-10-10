// Tiny pub/sub store whose state is mirrored in the URL hash, so every view
// is a shareable deep link, e.g. #year=2025&x=social&r=lac&c=URY,FIN

const MAX_SELECTED = 3;
const listeners = new Set();
let state;
let hashTimer;

function parseHash(defaults, valid) {
  const p = new URLSearchParams(location.hash.slice(1));
  const year = Number(p.get('year'));
  const x = p.get('x');
  const regions = (p.get('r') || '').split(',').filter((r) => valid.regions.has(r));
  const sel = (p.get('c') || '').split(',').map((s) => s.toUpperCase()).filter((id) => valid.countries.has(id));
  const trails = p.has('trails') ? p.get('trails') === '1' : Boolean(defaults.trails);
  return {
    year: valid.years.has(year) ? year : defaults.year,
    x: valid.factors.has(x) ? x : defaults.x,
    regions,
    sel: p.has('c') ? sel.slice(0, MAX_SELECTED) : defaults.sel,
    trails,
  };
}

function writeHash() {
  clearTimeout(hashTimer);
  hashTimer = setTimeout(() => {
    const p = new URLSearchParams();
    p.set('year', state.year);
    p.set('x', state.x);
    if (state.regions.length) p.set('r', state.regions.join(','));
    p.set('c', state.sel.join(','));
    if (state.trails) p.set('trails', '1');
    history.replaceState(null, '', `#${p.toString().replace(/%2C/g, ',')}`);
  }, 150);
}

export function createStore(defaults, valid) {
  state = { ...parseHash(defaults, valid), hover: null };

  const notify = (changed) => listeners.forEach((fn) => fn(state, changed));

  const store = {
    get: () => state,
    set(patch) {
      const changed = new Set(Object.keys(patch).filter((k) => patch[k] !== state[k]));
      if (!changed.size) return;
      state = { ...state, ...patch };
      if ([...changed].some((k) => k !== 'hover')) writeHash();
      notify(changed);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Toggle a country in the comparison set (oldest drops out past 3). */
    toggle(id) {
      const sel = state.sel.includes(id)
        ? state.sel.filter((s) => s !== id)
        : [...state.sel, id].slice(-MAX_SELECTED);
      store.set({ sel });
    },
    add(id) {
      if (!state.sel.includes(id)) store.toggle(id);
    },
  };

  window.addEventListener('hashchange', () => {
    const next = parseHash(defaults, valid);
    store.set({ ...next, sel: next.sel.join() === state.sel.join() ? state.sel : next.sel,
      regions: next.regions.join() === state.regions.join() ? state.regions : next.regions });
  });

  return store;
}
