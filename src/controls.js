// Wires the HTML controls (filter bar, factor picker, chips) to the store.
import { FACTORS, REGIONS } from './data.js';
import { SLOT_COLORS } from './charts/deepdive.js';
import { esc } from './lib/dom.js';

const $ = (sel) => document.querySelector(sel);

export function initControls({ data, store }) {
  const { years } = data;
  const filterToggle = $('#filter-toggle');
  filterToggle.addEventListener('click', () => {
    const open = filterToggle.getAttribute('aria-expanded') !== 'true';
    filterToggle.setAttribute('aria-expanded', String(open));
    $('#filter-panel').classList.toggle('is-open', open);
  });
  const header = document.querySelector('.site-header');
  new ResizeObserver(() => {
    document.documentElement.style.setProperty('--header-height', `${header.getBoundingClientRect().height + 12}px`);
  }).observe(header);
  const slider = $('#year');
  const out = $('#year-out');
  slider.max = years.length - 1;
  slider.addEventListener('input', () => {
    stopPlay();
    store.set({ year: years[Number(slider.value)] });
  });

  // Play / pause through years. Each play button can animate its own range.
  let timer = null;
  let activeBtn = null;
  const playButtons = [...document.querySelectorAll('[data-play]')];
  function stopPlay() {
    clearInterval(timer);
    timer = null;
    playButtons.forEach((b) => {
      b.setAttribute('aria-pressed', 'false');
      b.querySelector('.play-icon').textContent = '▶';
    });
    activeBtn = null;
  }
  playButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (activeBtn === btn) return stopPlay();
      stopPlay();
      const range = btn.dataset.play === 'factors' ? data.factorYears : years;
      let i = range.indexOf(store.get().year);
      if (i < 0 || i === range.length - 1) i = -1;
      activeBtn = btn;
      btn.setAttribute('aria-pressed', 'true');
      btn.querySelector('.play-icon').textContent = '❚❚';
      const step = () => {
        i++;
        if (i >= range.length) return stopPlay();
        store.set({ year: range[i] });
      };
      step();
      timer = setInterval(step, 1100);
    });
  });

  // Region filter (popover with native checkboxes).
  const regionList = $('#region-list');
  regionList.innerHTML = REGIONS.map((r) => `
    <label class="check"><input type="checkbox" value="${r.key}">
    <span class="swatch" style="background:${r.color}"></span>${esc(r.name)}</label>`).join('');
  regionList.addEventListener('change', () => {
    const regions = [...regionList.querySelectorAll('input:checked')].map((i) => i.value);
    store.set({ regions });
  });
  $('#region-clear').addEventListener('click', () => store.set({ regions: [] }));

  // Region legend under the explorer doubles as a quick filter.
  const legend = $('#region-legend');
  legend.innerHTML = REGIONS.map((r) => `<button type="button" class="legend-chip" data-region="${r.key}" aria-pressed="false">
    <span class="swatch" style="background:${r.color}"></span>${esc(r.name)}</button>`).join('');
  legend.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-region]');
    if (!btn) return;
    const k = btn.dataset.region;
    const cur = store.get().regions;
    store.set({ regions: cur.includes(k) ? cur.filter((r) => r !== k) : [...cur, k] });
  });

  // Country search (native datalist = accessible autocomplete for free).
  const search = $('#search');
  $('#country-list').innerHTML = data.countries.map((c) => `<option value="${esc(c.name)}"></option>`).join('');
  const byName = new Map(data.countries.map((c) => [c.name.toLowerCase(), c]));
  const tryAdd = () => {
    const c = byName.get(search.value.trim().toLowerCase());
    if (c) {
      if (store.add(c.id)) search.value = '';
    }
  };
  search.addEventListener('change', tryAdd);
  search.addEventListener('keydown', (e) => e.key === 'Enter' && tryAdd());

  // Factor picker (radio group styled as segmented pills).
  const picker = $('#factor-picker');
  picker.innerHTML = FACTORS.map((f) => `<label class="pill"><input type="radio" name="factor" value="${f.key}">${esc(f.short)}</label>`).join('');
  picker.addEventListener('change', (e) => store.set({ x: e.target.value }));

  // Selected-country chips.
  const chips = $('#chips');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) store.toggle(btn.dataset.remove);
  });

  // History trails toggle for explorer.
  const trailsBtn = $('#toggle-trails');
  if (trailsBtn) {
    trailsBtn.addEventListener('click', () => {
      store.set({ trails: !store.get().trails });
    });
  }

  function sync(state) {
    $('#selection-status').textContent = state.selectionMessage || '';
    $('#selection-status').hidden = !state.selectionMessage;
    const i = years.indexOf(state.year);
    slider.value = i;
    slider.setAttribute('aria-valuetext', String(state.year));
    slider.style.setProperty('--progress', `${(i / (years.length - 1)) * 100}%`);
    out.textContent = state.year;
    regionList.querySelectorAll('input').forEach((inp) => (inp.checked = state.regions.includes(inp.value)));
    legend.querySelectorAll('[data-region]').forEach((b) => b.setAttribute('aria-pressed', String(state.regions.includes(b.dataset.region))));
    $('#region-count').textContent = state.regions.length ? `${state.regions.length} of ${REGIONS.length}` : 'All';
    picker.querySelectorAll('input').forEach((inp) => (inp.checked = inp.value === state.x));
    if (trailsBtn) {
      trailsBtn.setAttribute('aria-pressed', String(Boolean(state.trails)));
    }
    chips.innerHTML = state.sel.map((id, k) => {
      const c = data.byId.get(id);
      return `<span class="chip" style="--chip:${SLOT_COLORS[k]}"><span class="swatch"></span>${esc(c.name)}
        <button type="button" data-remove="${id}" aria-label="Remove ${esc(c.name)}">×</button></span>`;
    }).join('') || '<span class="chip-empty">Add up to 3 countries</span>';
  }

  store.subscribe((s, changed) => {
    if (!(changed.size === 1 && changed.has('hover'))) sync(s);
  });
  sync(store.get());
}
