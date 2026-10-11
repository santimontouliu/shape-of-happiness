// Hero: every country as a dot on the 0–10 ladder (a beeswarm) + headline stats.
import * as d3 from 'd3';
import { fmt } from '../data.js';
import { dur, esc, observeWidth, tooltip } from '../lib/dom.js';

export function createHero(el, statsEl, { data, store, featured }) {
  const year = data.years.at(-1);
  const rows = data.rows(year);
  const svg = d3.select(el).append('svg').attr('role', 'img')
    .attr('aria-label', `Each of ${rows.length} countries plotted by its ${year} happiness score, from lowest on the left to highest on the right.`);
  let played = false;

  renderStats(statsEl, data, year, featured);

  function layout(W) {
    const H = W < 640 ? 220 : 280;
    const R = W < 640 ? 4.2 : 6;
    svg.attr('viewBox', `0 0 ${W} ${H}`);
    const x = d3.scaleLinear().domain([1, 8]).range([16, W - 16]);
    const nodes = rows.map((r) => ({ r, x: x(r.score), y: H / 2 }));
    const sim = d3.forceSimulation(nodes)
      .force('x', d3.forceX((d) => x(d.r.score)).strength(1))
      .force('y', d3.forceY(H / 2 - 10).strength(0.07))
      .force('collide', d3.forceCollide(R + 1.2))
      .stop();
    for (let i = 0; i < 220; i++) sim.tick();

    svg.selectAll('g.hero-axis').data([0]).join('g').attr('class', 'axis hero-axis')
      .attr('transform', `translate(0,${H - 22})`)
      .call(d3.axisBottom(x).tickValues(W < 640 ? [1, 3, 5, 8] : [1, 2, 3, 4, 5, 6, 7, 8]).tickSize(0).tickPadding(8).tickFormat((d) => (d === 1 ? 'Less happy  1' : d === 8 ? '8  Happier' : d)))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('.tick text').attr('text-anchor', (d) => d === 1 ? 'start' : d === 8 ? 'end' : 'middle'));

    const dots = svg.selectAll('circle.hero-dot').data(nodes, (d) => d.r.c.id)
      .join('circle').attr('class', 'hero-dot').attr('r', R)
      .attr('fill', (d) => d.r.c.region.color)
      .classed('is-featured', (d) => d.r.c.id === featured)
      .on('pointerenter', (event, d) => tooltip.show(event, `<p class="tt-title">${esc(d.r.c.name)}</p>
        <p class="tt-big">${fmt.score(d.r.score)}<span>/10</span></p><p class="tt-muted">${fmt.ordinal(d.r.rank)} of ${rows.length} · ${year}</p>`))
      .on('pointermove', (event) => tooltip.move(event))
      .on('pointerleave', () => tooltip.hide())
      .on('click', (_, d) => {
        if (store.add(d.r.c.id)) document.getElementById('compare').scrollIntoView({ behavior: 'smooth' });
      });

    if (!played && dur()) {
      played = true;
      dots.attr('cx', W / 2).attr('cy', H / 2).attr('opacity', 0)
        .transition().delay((d) => 200 + d.r.score * 140).duration(1100).ease(d3.easeCubicOut)
        .attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('opacity', 1);
    } else {
      dots.attr('cx', (d) => d.x).attr('cy', (d) => d.y).attr('opacity', 1);
    }

    const notes = [d3.greatest(nodes, (d) => d.r.score), nodes.find((d) => d.r.c.id === featured), d3.least(nodes, (d) => d.r.score)]
      .filter((d) => d && (W >= 640 || d.r.c.id !== featured));
    svg.selectAll('line.hero-leader').data(W < 640 ? notes : [], (d) => d.r.c.id).join('line')
      .attr('class', 'hero-leader').attr('x1', (d) => d.x).attr('x2', (d) => d.x)
      .attr('y1', 30).attr('y2', (d) => d.y - R - 4).attr('stroke', 'var(--color-muted)').attr('stroke-opacity', 0.5);
    svg.selectAll('text.hero-note').data(notes, (d) => d.r.c.id).join('text')
      .attr('class', (d) => `hero-note${d.r.c.id === featured ? ' is-featured' : ''}`)
      .attr('x', (d) => d.x).attr('y', (d) => W < 640 ? 24 : d.y - R - 8)
      .attr('text-anchor', (d) => (d.x > W - 80 ? 'end' : d.x < 80 ? 'start' : 'middle'))
      .text((d) => d.r.c.name);
  }

  observeWidth(el, layout);
}

function renderStats(el, data, year, featured) {
  const rows = data.rows(year);
  const top = d3.greatest(rows, (r) => r.score);
  let streak = 0;
  for (const yr of [...data.years].reverse()) {
    if (data.get(top.c, yr)?.rank === 1) streak++;
    else break;
  }
  const f = data.byId.get(featured);
  const fv = f && data.get(f, year);
  const stats = [
    { big: rows.length, label: `countries in the ${year - 2}–${year} ranking` },
    { big: top.c.name, label: `#1 for ${streak} editions in a row` },
    fv && { big: `#${fv.rank}`, label: `${f.name}, the happiest-ranked in ${f.region.name.split(' &')[0]}?`, id: 'featured' },
  ].filter(Boolean);
  if (fv) {
    const peers = rows.filter((r) => r.c.region === f.region);
    const best = d3.greatest(peers, (r) => r.score);
    stats[2].label = best.c.id === f.id
      ? `${f.name}: the happiest country in ${f.region.name}`
      : `${f.name} in ${year} (${f.region.name} leader: ${best.c.name})`;
  }
  el.innerHTML = stats.map((s) => `<div class="stat"><dt>${esc(s.label)}</dt><dd>${esc(s.big)}</dd></div>`).join('');
}
