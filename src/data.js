// Data model: turns the compact JSON into convenient lookups + shared metadata.

export const FACTORS = [
  { key: 'gdp', label: 'GDP per capita', short: 'GDP', color: '#E6A23C' },
  { key: 'social', label: 'Social support', short: 'Social', color: '#5FB3E8' },
  { key: 'health', label: 'Healthy life expectancy', short: 'Health', color: '#2FB58F' },
  { key: 'freedom', label: 'Freedom to choose', short: 'Freedom', color: '#E9DE6A' },
  { key: 'generosity', label: 'Generosity', short: 'Generosity', color: '#D58AB8' },
  { key: 'corruption', label: 'Low corruption', short: 'Trust', color: '#E8774A' },
];
export const RESIDUAL = { key: 'dystopia', label: 'Baseline + unexplained', short: 'Residual', color: '#4A5060' };

// Okabe–Ito based, lightened for a dark background (colour-blind safe).
export const REGIONS = [
  { key: 'weu', name: 'Western Europe', color: '#56B4E9' },
  { key: 'nao', name: 'North America & Oceania', color: '#7FA8FF' },
  { key: 'lac', name: 'Latin America & Caribbean', color: '#F0B43C' },
  { key: 'eeca', name: 'Eastern Europe & Central Asia', color: '#CC79A7' },
  { key: 'mena', name: 'Middle East & North Africa', color: '#E5653A' },
  { key: 'ssa', name: 'Sub-Saharan Africa', color: '#2FB58F' },
  { key: 'sas', name: 'South Asia', color: '#E9DE6A' },
  { key: 'esa', name: 'East & Southeast Asia', color: '#B9BEC8' },
];
const REGION_BY_NAME = new Map(REGIONS.map((r) => [r.name, r]));

export function prepare(raw) {
  const { years, fields } = raw;
  const countries = raw.countries.map((c) => {
    const region = REGION_BY_NAME.get(c.region) ?? REGIONS[7];
    const series = c.v.map((row, i) => {
      if (!row) return null;
      const o = { year: years[i] };
      fields.forEach((f, j) => (o[f] = row[j]));
      return o;
    });
    return { id: c.id, name: c.name, num: c.num, mapName: c.mapName, pop: c.pop, region, series };
  });
  const byId = new Map(countries.map((c) => [c.id, c]));
  const yearIndex = new Map(years.map((y, i) => [y, i]));
  const factorYears = years.filter((y) =>
    countries.some((c) => c.series[yearIndex.get(y)]?.gdp != null),
  );

  const get = (c, year) => c.series[yearIndex.get(year)] ?? null;
  /** All countries with a score in `year`, as { c, ...values }. */
  const rows = (year) =>
    countries.flatMap((c) => {
      const v = get(c, year);
      return v && v.score != null ? [{ c, ...v }] : [];
    });

  return { years, countries, byId, get, rows, factorYears, source: raw.source };
}

export const regionActive = (state, c) =>
  state.regions.length === 0 || state.regions.includes(c.region.key);

export const fmt = {
  score: (v) => (v == null ? '—' : v.toFixed(2)),
  delta: (v) => `${v > 0 ? '+' : v < 0 ? '−' : '±'}${Math.abs(v).toFixed(2)}`,
  pop: (v) => (v == null ? 'n/a' : v >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1e3)}K`),
  ordinal: (n) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  },
};

/** Pearson correlation for paired arrays. */
export function pearson(xs, ys) {
  const n = xs.length;
  if (n < 3) return NaN;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return num / Math.sqrt(dx * dy);
}
