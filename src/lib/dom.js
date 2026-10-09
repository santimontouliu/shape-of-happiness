// Small DOM helpers shared by all charts.

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Transition duration that collapses to 0 for reduced-motion users. */
export const dur = (ms = 700) => (reducedMotion() ? 0 : ms);

/** Calls `cb(width)` now and whenever the element's width changes. */
export function observeWidth(el, cb) {
  let last = 0;
  const ro = new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w && Math.abs(w - last) > 4) {
      last = w;
      cb(w);
    }
  });
  ro.observe(el);
  return ro;
}

const tipEl = () => document.getElementById('tooltip');

export const tooltip = {
  show(event, html) {
    const el = tipEl();
    el.innerHTML = html;
    el.hidden = false;
    tooltip.move(event);
  },
  move(event) {
    const el = tipEl();
    const pad = 14;
    const { innerWidth: W, innerHeight: H } = window;
    const r = el.getBoundingClientRect();
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + r.width > W - 8) x = event.clientX - r.width - pad;
    if (y + r.height > H - 8) y = event.clientY - r.height - pad;
    el.style.translate = `${Math.max(8, x)}px ${Math.max(8, y)}px`;
  },
  hide() {
    tipEl().hidden = true;
  },
};

/** Escape text for safe interpolation into innerHTML. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** Renders a simple accessible table into a container. */
export function renderTable(container, caption, columns, rows) {
  const head = columns.map((c) => `<th scope="col">${esc(c.label)}</th>`).join('');
  const body = rows
    .map((r) => `<tr>${columns.map((c, i) => (i === 0 ? `<th scope="row">${esc(c.value(r))}</th>` : `<td>${esc(c.value(r))}</td>`)).join('')}</tr>`)
    .join('');
  container.innerHTML = `<table class="data-table"><caption>${esc(caption)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** Make an SVG mark keyboard-focusable and clickable with Enter/Space. */
export function makeFocusable(selection, label, onActivate) {
  selection
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', label)
    .on('keydown', (event, d) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onActivate(event, d);
      }
    });
}
