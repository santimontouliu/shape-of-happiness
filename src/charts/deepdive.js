// Chapter 5: country deep-dive — score over time vs. the world's middle 50%.
import * as d3 from 'd3';
import { fmt } from '../data.js';
import { dur, esc, observeWidth, renderTable, tooltip } from '../lib/dom.js';

export const SLOT_COLORS = ['#f2c14e', '#5fb3e8', '#e8774a'];
const M = { top: 20, right: 120, bottom: 32, left: 40 };

export function createDeepDive(el, tableEl, { data, store }) {
  const { years } = data;
  const calendarYears = d3.range(years[0], years.at(-1) + 1);
  const band = calendarYears.map((yr) => {
    const s = data.rows(yr).map((r) => r.score).sort(d3.ascending);
    return { yr, q1: d3.quantileSorted(s, 0.25), med: d3.quantileSorted(s, 0.5), q3: d3.quantileSorted(s, 0.75) };
  });
  const svg = d3.select(el).append('svg').attr('role', 'img');
  const gAxes = svg.append('g');
  const gBand = svg.append('g');
  const gLines = svg.append('g');
  const marker = svg.append('line').attr('class', 'year-marker');
  const cross = svg.append('line').attr('class', 'crosshair').attr('opacity', 0);
  const x = d3.scaleLinear().domain(d3.extent(years));
  const y = d3.scaleLinear().domain([0, 10]);
  let W = 0;
  let H = 0;

  function render(state, t = dur(600)) {
    if (!W) return;
    const right = W < 520 ? 92 : M.right;
    H = Math.max(300, Math.min(440, W * 0.5));
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    x.range([M.left, W - right]);
    y.range([H - M.bottom, M.top]);

    gAxes.selectAll('*').remove();
    gAxes.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - M.bottom})`)
      .call(d3.axisBottom(x).ticks(W < 520 ? 4 : 8).tickFormat(d3.format('d')).tickSizeOuter(0));
    gAxes.append('g').attr('class', 'axis').attr('transform', `translate(${M.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickSize(-(W - M.left - right)).tickPadding(6))
      .call((g) => g.select('.domain').remove());

    gBand.selectAll('*').remove();
    gBand.append('path').attr('class', 'iqr-band')
      .attr('d', d3.area().defined((d) => d.q1 != null).x((d) => x(d.yr)).y0((d) => y(d.q1)).y1((d) => y(d.q3)).curve(d3.curveMonotoneX)(band));
    gBand.append('path').attr('class', 'median-line')
      .attr('d', d3.line().defined((d) => d.med != null).x((d) => x(d.yr)).y((d) => y(d.med)).curve(d3.curveMonotoneX)(band));
    gBand.append('text').attr('class', 'band-label').attr('x', x(years.at(-1)) + 8).attr('y', y(band.at(-1).med) + 4)
      .text('World median');

    const series = state.sel.map((id, i) => {
      const c = data.byId.get(id);
      return c && { c, color: SLOT_COLORS[i], pts: calendarYears.map((year) => data.get(c, year) ?? { year, score: null }), last: c.series.filter((v) => v?.score != null).at(-1) };
    }).filter(Boolean);

    const line = d3.line().defined((v) => v.score != null).x((v) => x(v.year)).y((v) => y(v.score)).curve(d3.curveMonotoneX);
    const g = gLines.selectAll('g.series').data(series, (s) => s.c.id)
      .join((enter) => enter.append('g').attr('class', 'series')
        .call((e) => e.append('path').attr('class', 'series-line'))
        .call((e) => e.append('text').attr('class', 'series-label')));
    g.select('.series-line').attr('stroke', (s) => s.color).attr('d', (s) => line(s.pts))
      .attr('stroke-dasharray', function () { return `${this.getTotalLength()} ${this.getTotalLength()}`; })
      .attr('stroke-dashoffset', function () { return t ? this.getTotalLength() : 0; })
      .transition().duration(t * 1.6).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);
    g.select('.series-label').attr('fill', (s) => s.color).attr('x', (s) => x(s.last.year) + 8)
      .attr('y', (s, i) => y(s.last.score) + 4 + labelNudge(series, i))
      .text((s) => `${W < 520 ? s.c.id : s.c.name} · ${fmt.ordinal(s.last.rank)}`);

    marker.attr('x1', x(state.year)).attr('x2', x(state.year)).attr('y1', M.top).attr('y2', H - M.bottom);
    svg.attr('aria-label', `Line chart of happiness over time for ${series.map((s) => s.c.name).join(', ') || 'no countries'}, compared with the world median.`);
    renderTable(tableEl, 'Life evaluation by year', [
      { label: 'Year', value: (yr) => yr },
      ...series.map((s) => ({ label: s.c.name, value: (yr) => fmt.score(data.get(s.c, yr)?.score) })),
      { label: 'World median', value: (yr) => fmt.score(band.find((b) => b.yr === yr).med) },
    ], [...calendarYears].reverse());
    return series;
  }

  // Keep end labels from colliding.
  function labelNudge(series, i) {
    const ys = series.map((s) => y(s.last.score));
    let nudge = 0;
    for (let j = 0; j < i; j++) if (Math.abs(ys[i] + nudge - ys[j]) < 14) nudge += ys[i] >= ys[j] ? 14 : -14;
    return nudge;
  }

  svg.on('pointermove', (event) => {
    const [px] = d3.pointer(event);
    const yr = years.reduce((a, b) => (Math.abs(x(b) - px) < Math.abs(x(a) - px) ? b : a));
    cross.attr('x1', x(yr)).attr('x2', x(yr)).attr('y1', M.top).attr('y2', H - M.bottom).attr('opacity', 1);
    const state = store.get();
    const rows = state.sel.map((id, i) => {
      const c = data.byId.get(id);
      const v = c && data.get(c, yr);
      return `<p class="tt-row"><span class="swatch" style="background:${SLOT_COLORS[i]}"></span>${esc(c?.name ?? id)}<b>${fmt.score(v?.score)}</b></p>`;
    }).join('');
    tooltip.show(event, `<p class="tt-title">${yr}</p>${rows}<p class="tt-row tt-muted">World median<b>${fmt.score(band.find((b) => b.yr === yr).med)}</b></p>`);
  });
  svg.on('pointerleave', () => {
    cross.attr('opacity', 0);
    tooltip.hide();
  });

  observeWidth(el, (w) => {
    W = w;
    render(store.get(), 0);
  });
  store.subscribe((s, changed) => {
    if (changed.has('sel')) render(s);
    else if (changed.has('year')) marker.transition().duration(dur(300)).attr('x1', x(s.year)).attr('x2', x(s.year));
  });
}
