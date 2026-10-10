// Chapter 2: Gapminder-style bubble chart — happiness vs. a chosen factor.
import * as d3 from 'd3';
import { FACTORS, fmt, regionActive } from '../data.js';
import { dur, esc, observeWidth, tooltip } from '../lib/dom.js';

const M = { top: 16, right: 16, bottom: 46, left: 44 };

export const effectiveYear = (data, year) => {
  const fy = data.factorYears;
  return year < fy[0] ? fy[0] : fy.includes(year) ? year : d3.greatest(fy.filter((y) => y <= year));
};

export function createExplorer(el, { data, store }) {
  const xMax = Object.fromEntries(
    FACTORS.map((f) => [f.key, d3.max(data.countries, (c) => d3.max(c.series, (v) => v?.[f.key])) * 1.05]),
  );
  const maxPop = d3.max(data.countries, (c) => c.pop);
  const svg = d3.select(el).append('svg').attr('role', 'img');
  const gAxes = svg.append('g');
  const gTrend = svg.append('g');
  const gTrails = svg.append('g');
  const gDots = svg.append('g');
  const gLabels = svg.append('g').attr('pointer-events', 'none');
  const yearLabel = svg.append('text').attr('class', 'year-watermark').attr('aria-hidden', true);
  const x = d3.scaleLinear();
  const y = d3.scaleLinear().domain([1.5, 8]);
  const r = d3.scaleSqrt().domain([0, maxPop]);
  let W = 0;
  let H = 0;
  let current = [];

  function layout(width) {
    W = width;
    H = Math.max(320, Math.min(560, Math.round(width * 0.62)));
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    y.range([H - M.bottom, M.top]);
    r.range([0, Math.max(14, W / 26)]);
    update(store.get(), new Set(['x', 'year', 'regions', 'sel']), true);
  }

  function update(state, changed, force = false) {
    if (!W) return;
    const ey = effectiveYear(data, state.year);
    const f = FACTORS.find((d) => d.key === state.x);
    const t = force ? 0 : dur(750);
    x.domain([0, xMax[f.key]]).range([M.left, W - M.right]);

    if (force || changed.has('x')) {
      gAxes.selectAll('*').remove();
      gAxes.append('g').attr('class', 'axis').attr('transform', `translate(0,${H - M.bottom})`)
        .call(d3.axisBottom(x).ticks(W < 500 ? 4 : 7).tickSize(-(H - M.top - M.bottom)).tickPadding(8))
        .call((g) => g.select('.domain').remove());
      gAxes.append('g').attr('class', 'axis').attr('transform', `translate(${M.left},0)`)
        .call(d3.axisLeft(y).ticks(6).tickSize(-(W - M.left - M.right)).tickPadding(8))
        .call((g) => g.select('.domain').remove());
      gAxes.append('text').attr('class', 'axis-label').attr('x', W - M.right).attr('y', H - 8)
        .attr('text-anchor', 'end').text(`${f.label} → (contribution to score)`);
      gAxes.append('text').attr('class', 'axis-label').attr('x', M.left).attr('y', M.top - 4)
        .text('↑ Life evaluation (0–10)');
    }

    yearLabel.attr('x', W - M.right - 6).attr('y', H - M.bottom - 12).attr('text-anchor', 'end').text(ey);

    current = data.rows(ey).filter((d) => d[f.key] != null);
    current.sort((a, b) => (b.c.pop ?? 0) - (a.c.pop ?? 0));
    const active = (d) => regionActive(state, d.c);
    const isSel = (d) => state.sel.includes(d.c.id);

    // Trend line (least squares) over the active countries.
    const act = current.filter(active);
    const reg = act.length > 2 ? linreg(act.map((d) => [d[f.key], d.score])) : null;
    gTrend.selectAll('line').data(reg ? [reg] : []).join('line').attr('class', 'trend')
      .transition().duration(t)
      .attr('x1', x(0)).attr('y1', (l) => y(l.b))
      .attr('x2', x(xMax[f.key])).attr('y2', (l) => y(l.b + l.m * xMax[f.key]));

    gDots.selectAll('circle').data(current, (d) => d.c.id)
      .join((enter) => enter.append('circle').attr('r', 0).attr('cx', (d) => x(d[f.key])).attr('cy', (d) => y(d.score)))
      .attr('class', 'bubble')
      .classed('is-selected', isSel)
      .classed('is-hover', (d) => d.c.id === state.hover)
      .attr('fill', (d) => d.c.region.color)
      .transition().duration(t).ease(d3.easeCubicInOut)
      .attr('cx', (d) => x(d[f.key]))
      .attr('cy', (d) => y(d.score))
      .attr('r', (d) => Math.max(2.5, r(d.c.pop ?? 2e5)))
      .attr('opacity', (d) => (isSel(d) ? 1 : active(d) ? 0.78 : 0.08));

    // Trails for selected countries across the factor years so far (optional via toggle).
    const trails = state.trails
      ? state.sel.map((id) => data.byId.get(id)).filter(Boolean).map((c) => ({
          c, pts: data.factorYears.filter((yy) => yy <= ey).map((yy) => data.get(c, yy)).filter((v) => v?.[f.key] != null),
        }))
      : [];
    gTrails.selectAll('path').data(trails, (d) => d.c.id).join('path').attr('class', 'trail')
      .attr('stroke', (d) => d.c.region.color)
      .transition().duration(t)
      .attr('d', (d) => d3.line().curve(d3.curveCatmullRom)(d.pts.map((v) => [x(v[f.key]), y(v.score)])));

    // Labels: selected + the extremes, so the chart reads without hovering.
    const ranked = d3.sort(act, (d) => -d.score);
    const labelled = new Set([...state.sel, ranked[0]?.c.id, ranked.at(-1)?.c.id]);
    gLabels.selectAll('text').data(current.filter((d) => labelled.has(d.c.id)), (d) => d.c.id)
      .join('text').attr('class', (d) => `bubble-label${isSel(d) ? ' is-selected' : ''}`)
      .text((d) => d.c.name)
      .transition().duration(t)
      .attr('x', (d) => x(d[f.key]))
      .attr('y', (d) => y(d.score) - Math.max(2.5, r(d.c.pop ?? 2e5)) - 6)
      .attr('text-anchor', 'middle');

    svg.attr('aria-label', `Bubble chart of happiness versus ${f.label} in ${ey}, ${act.length} countries. Bubble size shows population, colour shows region.`);
  }

  // Nearest-bubble hover via Delaunay: generous hit targets, also on touch.
  svg.on('pointermove', (event) => {
    if (!current.length) return;
    const [px, py] = d3.pointer(event);
    const f = store.get().x;
    const delaunay = d3.Delaunay.from(current, (d) => x(d[f]), (d) => y(d.score));
    const d = current[delaunay.find(px, py)];
    const dist = Math.hypot(x(d[f]) - px, y(d.score) - py);
    if (dist > 40) return leave();
    svg.style('cursor', 'pointer');
    if (store.get().hover !== d.c.id) store.set({ hover: d.c.id });
    const fl = FACTORS.find((ff) => ff.key === f);
    tooltip.show(event, `<p class="tt-title">${esc(d.c.name)}</p>
      <p class="tt-big">${fmt.score(d.score)}<span>/10</span></p>
      <p class="tt-muted">${esc(fl.label)}: ${d[f].toFixed(2)} · Pop. ${fmt.pop(d.c.pop)}</p>
      <p class="tt-muted">${esc(d.c.region.name)}</p><p class="tt-hint">Click to compare</p>`);
  });
  const leave = () => {
    svg.style('cursor', null);
    if (store.get().hover) store.set({ hover: null });
    tooltip.hide();
  };
  svg.on('pointerleave', leave);
  svg.on('click', () => {
    const id = store.get().hover;
    if (id) store.toggle(id);
  });

  observeWidth(el, layout);
  store.subscribe((s, changed) => {
    if (changed.size === 1 && changed.has('hover')) {
      gDots.selectAll('circle').classed('is-hover', (d) => d.c.id === s.hover);
      return;
    }
    update(s, changed);
  });
}

function linreg(pts) {
  const n = pts.length;
  const mx = d3.mean(pts, (p) => p[0]);
  const my = d3.mean(pts, (p) => p[1]);
  const m = d3.sum(pts, (p) => (p[0] - mx) * (p[1] - my)) / d3.sum(pts, (p) => (p[0] - mx) ** 2);
  return n ? { m, b: my - m * mx } : null;
}
