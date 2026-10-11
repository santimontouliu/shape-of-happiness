// Chapter 1: choropleth world map of life-evaluation scores.
import * as d3 from 'd3';
import { feature } from 'topojson-client';
import world from 'world-atlas/countries-110m.json';
import { fmt, regionActive } from '../data.js';
import { dur, esc, observeWidth, tooltip } from '../lib/dom.js';

export const scoreColor = d3
  .scaleSequential(d3.interpolateRgbBasis(['#24204f', '#3b3a8f', '#1f7f9a', '#2bb3a0', '#f2c14e']))
  .domain([3, 7.8])
  .clamp(true);

const countriesGeo = feature(world, world.objects.countries).features.filter(
  (f) => f.properties.name !== 'Antarctica',
);

export function createMap(el, { data, store }) {
  const lookup = new Map();
  data.countries.forEach((c) => lookup.set(c.num ?? `name:${c.mapName}`, c));
  const countryFor = (f) => lookup.get(f.id) ?? lookup.get(`name:${f.properties.name}`);

  const svg = d3.select(el).append('svg').attr('role', 'img');
  const gLand = svg.append('g');
  const gSel = svg.append('g').attr('pointer-events', 'none');
  const projection = d3.geoEqualEarth();
  const path = d3.geoPath(projection);
  let paths;

  function layout(width) {
    const height = Math.round(width * 0.48);
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);
    projection.fitExtent([[4, 4], [width - 4, height - 4]], { type: 'Sphere' });
    paths = gLand
      .selectAll('path')
      .data(countriesGeo, (f) => f.id ?? f.properties.name)
      .join('path')
      .attr('d', path)
      .attr('class', 'country')
      .on('pointerenter', (event, f) => {
        const c = countryFor(f);
        store.set({ hover: c?.id ?? null });
        tooltip.show(event, tipHtml(f, c));
      })
      .on('pointermove', (event) => tooltip.move(event))
      .on('pointerleave', () => {
        store.set({ hover: null });
        tooltip.hide();
      })
      .on('click', (_, f) => {
        const c = countryFor(f);
        if (c) store.toggle(c.id);
      });
    update(store.get(), new Set(['year']));
  }

  function tipHtml(f, c) {
    const { year } = store.get();
    if (!c) return `<p class="tt-title">${esc(f.properties.name)}</p><p class="tt-muted">Not surveyed</p>`;
    const v = data.get(c, year);
    if (!v) return `<p class="tt-title">${esc(c.name)}</p><p class="tt-muted">No data for ${year}</p>`;
    return `<p class="tt-title">${esc(c.name)}</p>
      <p class="tt-big">${fmt.score(v.score)}<span>/10</span></p>
      <p class="tt-muted">Ranked ${fmt.ordinal(v.rank)} in ${year} · ${esc(c.region.name)}</p>
      <p class="tt-hint">Click to compare</p>`;
  }

  function update(state, changed) {
    if (!paths) return;
    const fill = (f) => {
      const c = countryFor(f);
      const v = c && data.get(c, state.year);
      return v ? scoreColor(v.score) : null;
    };
    if (changed.has('year') || changed.has('regions')) {
      paths
        .classed('no-data', (f) => !fill(f))
        .transition()
        .duration(dur(500))
        .attr('fill', (f) => fill(f) ?? 'var(--color-nodata)')
        .attr('opacity', (f) => {
          const c = countryFor(f);
          return !c || regionActive(state, c) ? 1 : 0.18;
        });
    }
    paths.classed('is-hover', (f) => state.hover && countryFor(f)?.id === state.hover);

    const selected = countriesGeo.filter((f) => state.sel.includes(countryFor(f)?.id));
    gSel
      .selectAll('path')
      .data(selected, (f) => f.id ?? f.properties.name)
      .join('path')
      .attr('class', 'country-selected')
      .attr('d', path);

    const top = d3.greatest(data.rows(state.year).filter((r) => regionActive(state, r.c)), (r) => r.score);
    svg.attr(
      'aria-label',
      `World map of happiness scores in ${state.year}. ${top ? `${top.c.name} is highest ${state.regions.length ? 'in the selected regions' : 'worldwide'} at ${fmt.score(top.score)}.` : ''} Use the country search or the table below for exact values.`,
    );
  }

  observeWidth(el, layout);
  store.subscribe(update);
}

/** Draws the gradient legend for the map. */
export function drawLegend(el) {
  const w = 260;
  const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} 34`).attr('width', w).attr('aria-hidden', true);
  const id = 'legend-grad';
  const grad = svg.append('defs').append('linearGradient').attr('id', id);
  d3.range(0, 1.01, 0.1).forEach((t) =>
    grad.append('stop').attr('offset', `${t * 100}%`).attr('stop-color', scoreColor(3 + t * 4.8)),
  );
  svg.append('rect').attr('x', 12).attr('y', 4).attr('width', w - 24).attr('height', 10).attr('rx', 5).attr('fill', `url(#${id})`);
  const x = d3.scaleLinear().domain([3, 7.8]).range([12, w - 12]);
  svg.append('g').attr('transform', 'translate(0,18)').attr('class', 'axis')
    .call(d3.axisBottom(x).tickValues([3, 4, 5, 6, 7]).tickSize(0).tickPadding(6))
    .call((g) => g.select('.domain').remove());
}
