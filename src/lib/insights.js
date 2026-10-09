// Generates short, data-driven sentences that update with the filters.
import * as d3 from 'd3';
import { FACTORS, fmt, pearson, regionActive } from '../data.js';

const strong = (s) => `<strong>${s}</strong>`;

export function mapInsight(data, state) {
  const rows = data.rows(state.year).filter((r) => regionActive(state, r.c));
  if (rows.length < 2) return 'Not enough data for this filter.';
  const sorted = d3.sort(rows, (r) => -r.score);
  const top = sorted[0];
  const bottom = sorted[sorted.length - 1];
  const scope = state.regions.length ? 'in the selected regions' : 'worldwide';
  return `In ${state.year}, ${strong(top.c.name)} is the happiest country ${scope} (${fmt.score(top.score)} / 10), while ${strong(bottom.c.name)} reports ${fmt.score(bottom.score)}. That's a gap of ${strong((top.score - bottom.score).toFixed(1))} points on the same 0–10 ladder.`;
}

export function countryInsight(data, state, year) {
  const c = data.byId.get(state.sel[0]);
  if (!c) return 'Pick a country to see how it compares.';
  const v = data.get(c, year);
  if (!v) return `No ${year} survey data for ${strong(c.name)}.`;
  const all = data.rows(year);
  const peers = all.filter((r) => r.c.region === c.region);
  const avg = d3.mean(peers, (r) => r.score);
  const diff = v.score - avg;
  const dir = diff >= 0 ? 'above' : 'below';
  return `${strong(c.name)} ranks ${strong(fmt.ordinal(v.rank))} of ${all.length} in ${year}, ${Math.abs(diff).toFixed(2)} points ${dir} the ${c.region.name} average.`;
}

export function factorInsight(data, state, year) {
  const f = FACTORS.find((d) => d.key === state.x);
  const rows = data.rows(year).filter((r) => r[f.key] != null && regionActive(state, r.c));
  const r = pearson(rows.map((d) => d[f.key]), rows.map((d) => d.score));
  const strength = Math.abs(r) > 0.7 ? 'strongly' : Math.abs(r) > 0.4 ? 'moderately' : 'only weakly';
  return `Across ${rows.length} countries in ${year}, ${strong(f.label.toLowerCase())} is ${strength} linked to happiness (r = ${strong(r.toFixed(2))}). Look for countries far above the trend: they're happier than this factor alone predicts.`;
}

export function moversInsight(rise, fall) {
  if (!rise.length || !fall.length) return '';
  const r = rise[0];
  const f = fall[0];
  return `${strong(r.c.name)} climbed the most (${fmt.delta(r.delta)}), while ${strong(f.c.name)} fell the furthest (${fmt.delta(f.delta)}).`;
}
