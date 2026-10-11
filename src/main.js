// Entry point: load data, create the store, mount every chapter.
import * as d3 from 'd3';
import { FACTORS, REGIONS, fmt, prepare, regionActive } from './data.js';
import { createStore } from './store.js';
import { initControls } from './controls.js';
import { renderTable } from './lib/dom.js';
import { countryInsight, factorInsight, mapInsight } from './lib/insights.js';
import { createHero } from './charts/hero.js';
import { createMap, drawLegend } from './charts/map.js';
import { createExplorer, effectiveYear } from './charts/explorer.js';
import { createDrivers } from './charts/drivers.js';
import { createSlope } from './charts/slope.js';
import { createDeepDive } from './charts/deepdive.js';

const FEATURED = 'URY'; // Personal angle: Uruguay is pre-selected.
const $ = (sel) => document.querySelector(sel);

async function main() {
  const raw = await fetch(new URL('data/happiness.json', document.baseURI)).then((r) => {
    if (!r.ok) throw new Error(`Data request failed: ${r.status}`);
    return r.json();
  });
  const data = prepare(raw);
  const store = createStore(
    { year: data.years.at(-1), x: 'social', sel: [FEATURED, 'FIN'], trails: false },
    {
      years: new Set(data.years),
      factors: new Set(FACTORS.map((f) => f.key)),
      regions: new Set(REGIONS.map((r) => r.key)),
      countries: new Set(data.byId.keys()),
    },
  );
  const ctx = { data, store, featured: FEATURED };

  initControls(ctx);
  createHero($('#hero-chart'), $('#hero-stats'), ctx);
  createMap($('#map-chart'), ctx);
  drawLegend($('#map-legend'));
  createExplorer($('#explorer-chart'), ctx);
  createDrivers($('#drivers-chart'), $('#drivers-legend'), $('#drivers-table'), ctx);
  createSlope($('#slope-chart'), $('#insight-movers'), ctx);
  createDeepDive($('#deepdive-chart'), $('#deepdive-table'), ctx);

  // Text that reacts to state: insights, notes and the map's table fallback.
  const renderText = (state) => {
    const ey = effectiveYear(data, state.year);
    $('#insight-map').innerHTML = mapInsight(data, state);
    $('#insight-explorer').innerHTML = factorInsight(data, state, ey);
    $('#insight-drivers').innerHTML = countryInsight(data, state, ey);
    $('#insight-compare').innerHTML = countryInsight(data, state, state.year);
    $('#map-scope').textContent = `${state.year} · ${state.regions.length ? 'Selected regions' : 'All regions'}`;
    $('#explorer-scope').textContent = `${ey} · ${state.regions.length ? 'Selected regions' : 'All regions'} · Factor contributions`;
    $('#drivers-scope').textContent = `${ey} · Selected countries + unweighted world average`;
    $('#compare-scope').textContent = `2011–2025 · Selected countries · Marker: ${state.year}`;
    const factor = FACTORS.find((f) => f.key === state.x);
    renderTable($('#explorer-table'), `${factor.label} contribution and life evaluation, ${ey}`, [
      { label: 'Country', value: (r) => r.c.name },
      { label: 'Score', value: (r) => fmt.score(r.score) },
      { label: `${factor.label} contribution`, value: (r) => fmt.score(r[factor.key]) },
      { label: 'Population (latest available)', value: (r) => fmt.pop(r.c.pop) },
      { label: 'Region', value: (r) => r.c.region.name },
    ], d3.sort(data.rows(ey).filter((r) => regionActive(state, r.c) && r[factor.key] != null), (r) => r.rank));
    const note = ey !== state.year ? `Factor breakdowns start in ${data.factorYears[0]}, so this chart shows ${ey}.` : '';
    document.querySelectorAll('[data-factor-note]').forEach((el) => {
      el.textContent = note;
      el.hidden = !note;
    });
    const rows = d3.sort(data.rows(state.year).filter((r) => regionActive(state, r.c)), (r) => r.rank);
    renderTable($('#map-table'), `Happiness ranking, ${state.year}`, [
      { label: 'Country', value: (r) => r.c.name },
      { label: 'Rank', value: (r) => r.rank },
      { label: 'Score', value: (r) => fmt.score(r.score) },
      { label: 'Region', value: (r) => r.c.region.name },
    ], rows);
  };
  store.subscribe((s, changed) => {
    if (!(changed.size === 1 && changed.has('hover'))) renderText(s);
  });
  renderText(store.get());

  $('#copy-link').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    try {
      store.flushUrl();
      await navigator.clipboard.writeText(location.href);
      btn.dataset.state = 'copied';
    } catch {
      btn.dataset.state = 'error';
    }
    setTimeout(() => delete btn.dataset.state, 1800);
  });
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href').slice(1);
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        if (link.classList.contains('skip-link')) target.focus({ preventScroll: true });
      }
    });
  });

  document.documentElement.classList.add('is-ready');
}

main().catch((err) => {
  console.error(err);
  $('#load-error').hidden = false;
});
