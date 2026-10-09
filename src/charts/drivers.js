// Chapter 3: "Anatomy of a score" — stacked contributions of each factor.
import * as d3 from 'd3';
import { FACTORS, RESIDUAL, fmt } from '../data.js';
import { dur, esc, observeWidth, renderTable, tooltip } from '../lib/dom.js';
import { effectiveYear } from './explorer.js';

const PARTS = [...FACTORS, RESIDUAL];

export function createDrivers(el, legendEl, tableEl, { data, store }) {
  const svg = d3.select(el).append('svg').attr('role', 'img');
  const gAxis = svg.append('g').attr('class', 'axis');
  const gRows = svg.append('g');
  const x = d3.scaleLinear().domain([0, 8]);
  let W = 0;
  let focus = null;

  // Legend doubles as a highlight toggle (real buttons, keyboard friendly).
  const legend = d3.select(legendEl);
  legend.selectAll('button').data(PARTS).join('button')
    .attr('type', 'button').attr('class', 'legend-chip').attr('aria-pressed', 'false')
    .html((p) => `<span class="swatch" style="background:${p.color}"></span>${esc(p.short)}`)
    .on('click', (event, p) => {
      focus = focus === p.key ? null : p.key;
      legend.selectAll('button').attr('aria-pressed', (q) => String(q.key === focus));
      render(store.get(), 0);
    });

  function rowsFor(state, year) {
    const all = data.rows(year).filter((r) => r.gdp != null);
    const avg = { label: 'World average', score: d3.mean(all, (r) => r.score), kind: 'avg' };
    PARTS.forEach((p) => (avg[p.key] = d3.mean(all, (r) => r[p.key])));
    const top = d3.greatest(all, (r) => r.score);
    const picked = state.sel.map((id) => all.find((r) => r.c.id === id)).filter(Boolean);
    const list = [...picked];
    if (top && !picked.includes(top)) list.push(top);
    const rows = list.map((r) => ({ ...r, label: r.c.name, kind: picked.includes(r) ? 'sel' : 'top' }));
    rows.push(avg);
    return d3.sort(rows, (r) => -r.score);
  }

  function render(state, t = dur(650)) {
    if (!W) return;
    const year = effectiveYear(data, state.year);
    const rows = rowsFor(state, year);
    const labelW = W < 480 ? 92 : 150;
    const rowH = 44;
    const H = rows.length * rowH + 30;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    x.range([labelW, W - 44]);
    gAxis.attr('transform', `translate(0,${H - 22})`)
      .call(d3.axisBottom(x).ticks(W < 480 ? 4 : 8).tickSize(-(H - 30)).tickPadding(6))
      .call((g) => g.select('.domain').remove());

    const row = gRows.selectAll('g.row').data(rows, (r) => r.label)
      .join((enter) => enter.append('g').attr('class', 'row').attr('transform', (_, i) => `translate(0,${i * rowH + 6})`)
        .call((g) => g.append('text').attr('class', 'row-label'))
        .call((g) => g.append('text').attr('class', 'row-total')));
    row.transition().duration(t).attr('transform', (_, i) => `translate(0,${i * rowH + 6})`);
    row.select('.row-label').attr('x', labelW - 10).attr('y', 17).attr('text-anchor', 'end')
      .classed('is-selected', (r) => r.kind === 'sel').text((r) => (r.kind === 'top' ? `${r.label} (#1)` : r.label));

    row.each(function (r) {
      let acc = 0;
      const segs = PARTS.map((p) => {
        const v = Math.max(0, r[p.key] ?? 0);
        const s = { p, r, x0: acc, v };
        acc += v;
        return s;
      });
      d3.select(this).selectAll('rect').data(segs, (s) => s.p.key)
        .join((enter) => enter.append('rect').attr('x', x(0)).attr('width', 0))
        .attr('y', 4).attr('height', 26).attr('fill', (s) => s.p.color)
        .attr('opacity', (s) => (!focus || focus === s.p.key ? 1 : 0.15))
        .on('pointerenter', (event, s) => tooltip.show(event, `<p class="tt-title">${esc(s.r.label)}</p>
          <p class="tt-muted">${esc(s.p.label)}</p><p class="tt-big">+${s.v.toFixed(2)}<span> pts</span></p>`))
        .on('pointermove', (event) => tooltip.move(event))
        .on('pointerleave', () => tooltip.hide())
        .transition().duration(t)
        .attr('x', (s) => x(s.x0)).attr('width', (s) => Math.max(0, x(s.x0 + s.v) - x(s.x0) - 1));
      d3.select(this).select('.row-total').attr('y', 22)
        .transition().duration(t).attr('x', x(acc) + 6).text(fmt.score(r.score));
    });

    svg.attr('aria-label', `Stacked bars showing how six factors add up to each country's happiness score in ${year}.`);
    renderTable(tableEl, `Score contributions, ${year}`,
      [{ label: 'Country', value: (r) => r.label }, { label: 'Score', value: (r) => fmt.score(r.score) },
        ...PARTS.map((p) => ({ label: p.short, value: (r) => (r[p.key] ?? 0).toFixed(2) }))], rows);
  }

  observeWidth(el, (w) => {
    W = w;
    render(store.get(), 0);
  });
  store.subscribe((s, changed) => {
    if (changed.has('year') || changed.has('sel')) render(s);
  });
}
