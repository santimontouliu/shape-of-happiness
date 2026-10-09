// Chapter 4: slope chart of the biggest risers and fallers.
import * as d3 from 'd3';
import { fmt, regionActive } from '../data.js';
import { dur, esc, makeFocusable, observeWidth, tooltip } from '../lib/dom.js';
import { moversInsight } from '../lib/insights.js';

const EARLY = [2011, 2012, 2014];
const LATE = [2023, 2024, 2025];
const UP = '#2bb3a0';
const DOWN = '#e8774a';

/** Push labels apart so they never overlap (simple 1-D relaxation). */
function dodge(items, minGap, lo, hi) {
  const s = d3.sort(items, (d) => d.ly);
  for (let pass = 0; pass < 30; pass++) {
    for (let i = 1; i < s.length; i++) {
      const gap = s[i].ly - s[i - 1].ly;
      if (gap < minGap) {
        const shift = (minGap - gap) / 2;
        s[i - 1].ly -= shift;
        s[i].ly += shift;
      }
    }
    s.forEach((d) => (d.ly = Math.max(lo, Math.min(hi, d.ly))));
  }
}

export function createSlope(el, insightEl, { data, store }) {
  const movers = data.countries.flatMap((c) => {
    const avg = (ys) => d3.mean(ys, (y) => data.get(c, y)?.score);
    const a = avg(EARLY);
    const b = avg(LATE);
    return a != null && b != null ? [{ c, a, b, delta: b - a }] : [];
  });
  const svg = d3.select(el).append('svg').attr('role', 'group');
  const y = d3.scaleLinear().domain([d3.min(movers, (m) => Math.min(m.a, m.b)) - 0.2, d3.max(movers, (m) => Math.max(m.a, m.b)) + 0.2]);
  let W = 0;

  function render(state, t = dur(600)) {
    if (!W) return;
    const n = W < 520 ? 6 : 8;
    const pool = movers.filter((m) => regionActive(state, m.c));
    const rise = d3.sort(pool, (m) => -m.delta).slice(0, n).filter((m) => m.delta > 0);
    const fall = d3.sort(pool, (m) => m.delta).slice(0, n).filter((m) => m.delta < 0);
    const shown = new Set([...rise, ...fall]);
    movers.filter((m) => state.sel.includes(m.c.id)).forEach((m) => shown.add(m));
    const list = [...shown].map((m) => ({ ...m, sel: state.sel.includes(m.c.id) }));

    const H = Math.max(420, Math.min(640, W * 0.75));
    const x0 = W < 520 ? 44 : 120;
    const x1 = W - (W < 520 ? 150 : 230);
    y.range([H - 28, 36]);
    svg.attr('viewBox', `0 0 ${W} ${H}`)
      .attr('aria-label', `Slope chart comparing average happiness in 2011–14 with 2023–25 for the biggest movers.`);

    const heads = svg.selectAll('text.slope-head').data([[x0, '2011–14'], [x1, '2023–25']]).join('text')
      .attr('class', 'slope-head').attr('y', 16).attr('text-anchor', 'middle');
    heads.attr('x', (d) => d[0]).text((d) => d[1]);
    svg.selectAll('line.slope-axis').data([x0, x1]).join('line').attr('class', 'slope-axis')
      .attr('x1', (d) => d).attr('x2', (d) => d).attr('y1', 28).attr('y2', H - 20);

    list.forEach((m) => (m.ly = y(m.b)));
    dodge(list, 15, 30, H - 10);
    const color = (m) => (m.sel ? '#ffffff' : m.delta >= 0 ? UP : DOWN);

    const g = svg.selectAll('g.slope').data(list, (m) => m.c.id)
      .join((enter) => {
        const e = enter.append('g').attr('class', 'slope').attr('opacity', 0);
        e.append('line').attr('class', 'slope-line');
        e.append('circle').attr('class', 'dot-a').attr('r', 3.5);
        e.append('circle').attr('class', 'dot-b').attr('r', 3.5);
        e.append('text').attr('class', 'slope-label');
        return e;
      })
      .classed('is-selected', (m) => m.sel);
    makeFocusable(g, (m) => `${m.c.name}: ${fmt.score(m.a)} to ${fmt.score(m.b)} (${fmt.delta(m.delta)}). Press Enter to compare.`, (_, m) => store.toggle(m.c.id));
    g.on('pointerenter focus', (event, m) => {
      svg.classed('has-focus', true);
      g.classed('is-focus', (o) => o === m);
      if (event.type === 'pointerenter') {
        tooltip.show(event, `<p class="tt-title">${esc(m.c.name)}</p><p class="tt-big">${fmt.delta(m.delta)}</p>
          <p class="tt-muted">${fmt.score(m.a)} → ${fmt.score(m.b)} · ${esc(m.c.region.name)}</p><p class="tt-hint">Click to compare</p>`);
      }
    })
      .on('pointermove', (event) => tooltip.move(event))
      .on('pointerleave blur', () => {
        svg.classed('has-focus', false);
        g.classed('is-focus', false);
        tooltip.hide();
      })
      .on('click', (_, m) => store.toggle(m.c.id));

    const tr = g.transition().duration(t).attr('opacity', 1);
    tr.select('.slope-line').attr('x1', x0).attr('x2', x1).attr('y1', (m) => y(m.a)).attr('y2', (m) => y(m.b)).attr('stroke', color);
    tr.select('.dot-a').attr('cx', x0).attr('cy', (m) => y(m.a)).attr('fill', color);
    tr.select('.dot-b').attr('cx', x1).attr('cy', (m) => y(m.b)).attr('fill', color);
    g.select('.slope-label').text((m) => `${m.c.name} ${fmt.delta(m.delta)}`).attr('fill', color);
    tr.select('.slope-label').attr('x', x1 + 10).attr('y', (m) => m.ly + 4);

    insightEl.innerHTML = moversInsight(d3.sort(pool, (m) => -m.delta), d3.sort(pool, (m) => m.delta));
  }

  observeWidth(el, (w) => {
    W = w;
    render(store.get(), 0);
  });
  store.subscribe((s, changed) => {
    if (changed.has('regions') || changed.has('sel')) render(s);
  });
}
