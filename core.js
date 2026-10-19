'use strict';
/* =====================  INBIO CRM · núcleo  ===================== */
const CFG = Object.assign({ SUPABASE_URL: 'https://qilrajkqzzjjswnsqicb.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_gEVHBCqAuS6QlklIOq0UZg_Yf59P1jm', MONEDA: '$', MARCA_PRINCIPAL: 'Mindray' }, window.INBIO_CONFIG || {});
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf0 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const money = n => CFG.MONEDA + ' ' + nf0.format(Math.round(Number(n) || 0));
const num = n => nf0.format(Number(n) || 0);
const pctTxt = (a, b) => b ? nf1.format(100 * a / b) + '%' : '—';
const pctVal = (a, b) => b ? 100 * a / b : 0;
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const cmp = (a, b) => String(a == null ? '' : a).localeCompare(String(b == null ? '' : b), 'es', { sensitivity: 'base', numeric: true });
const pad = n => String(n).padStart(2, '0');
const isoOf = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const TODAY = isoOf(new Date());
const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const fmtDate = s => s ? s.slice(8, 10) + '/' + s.slice(5, 7) + '/' + s.slice(0, 4) : '';
const addMonths = (s, n) => { const d = parseISO(s), day = d.getDate(); d.setDate(1); d.setMonth(d.getMonth() + n); const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); d.setDate(Math.min(day, last)); return isoOf(d); };
const diffDays = (a, b) => Math.round((parseISO(a) - parseISO(b)) / 864e5);
const uuid = () => (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });

const ESTADOS = ['Lead', 'A presupuestar', 'Presupuestado', 'Vendido', 'Perdido', 'Desestimado', 'Reemplazado', 'Sin avance'];
const CANALES = ['Directo', 'Indirecto'];
const MERCADOS = { PUBLICO: 'Público', PRIVADO: 'Privado' };
const TRIMS = ['Q1', 'Q2', 'Q3', 'Q4'];
const CATEG = { A: 'A · 12 visitas/año', B: 'B · 6 visitas/año', C: 'C · 2 visitas/año', D: 'D · sin seguimiento' };
const CAT_MESES = { A: 1, B: 2, C: 6 };
const VTIPOS = ['Presencial', 'Telefónica', 'Mail', 'Videollamada'];
const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-');

/* ---------- estado global ---------- */
const S = {
  me: null, zonas: [], myZonas: [], catalogo: [], clientes: [], opps: [], seg: {}, perfiles: [], pzonas: [],
  zonaSel: 'todas', tab: 'resumen', demo: false,
  ui: { sort: {}, filt: {}, lim: {} }
};
let sb = null;

/* ---------- traducción de errores ---------- */
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e.details)) || String(e);
  const c = e && e.code;
  if (c === '23505') return 'Ya existe un registro igual (duplicado).';
  if (c === '23503') return 'No se puede borrar: tiene datos asociados (por ejemplo oportunidades).';
  if (c === '42501' || /row-level security/i.test(m)) return 'No tenés permiso para hacer esto en esa zona.';
  if (/Invalid login/i.test(m)) return 'Correo o contraseña incorrectos.';
  if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.';
  if (/JWT|expired/i.test(m)) return 'Tu sesión venció. Volvé a ingresar.';
  return m;
}

/* ---------- capa de datos: Supabase o demo local ---------- */
const LOCAL_KEY = 'inbio-crm-demo-v1';
const oppYear = o => o.anio_probable || (o.fecha ? +o.fecha.slice(0, 4) : null);
const Local = {
  d: null,
  load() {
    if (this.d) return this.d;
    let d = null;
    try { d = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); } catch (e) { }
    this.d = d || { clientes: [], oportunidades: [], visitas: [], catalogo: [] };
    return this.d;
  },
  save() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(this.d)); } catch (e) { } },
  fix(t, row) {
    const d = this.load();
    if (t === 'oportunidades' || t === 'visitas') {
      const c = d.clientes.find(x => x.id === row.cliente_id);
      if (!c) throw { message: 'Cliente inexistente' };
      row.zona_id = c.zona_id;
    }
    if (t === 'clientes') {
      const k = norm(row.nombre);
      if (d.clientes.some(x => x.id !== row.id && x.zona_id === row.zona_id && norm(x.nombre) === k)) throw { code: '23505', message: 'duplicate' };
    }
    if (t === 'catalogo' && d.catalogo.some(x => x.id !== row.id && x.tipo === row.tipo && x.valor === row.valor)) throw { code: '23505', message: 'duplicate' };
    return row;
  },
  async all(t) { return JSON.parse(JSON.stringify(this.load()[t] || [])); },
  async insert(t, rows) {
    const d = this.load(), out = [];
    rows.forEach(r => {
      const row = Object.assign({ id: t === 'catalogo' ? (d.catalogo.reduce((m, x) => Math.max(m, x.id), 0) + 1) : uuid(), creado: new Date().toISOString() }, r);
      this.fix(t, row); d[t].push(row); out.push(JSON.parse(JSON.stringify(row)));
    });
    this.save(); return out;
  },
  async update(t, id, patch) {
    const d = this.load(), i = d[t].findIndex(x => x.id === id);
    if (i < 0) throw { message: 'No existe el registro' };
    const row = Object.assign({}, d[t][i], patch); this.fix(t, row); d[t][i] = row;
    if (t === 'clientes' && patch.zona_id != null) { d.oportunidades.forEach(o => { if (o.cliente_id === id) o.zona_id = row.zona_id; }); d.visitas.forEach(o => { if (o.cliente_id === id) o.zona_id = row.zona_id; }); }
    this.save(); return JSON.parse(JSON.stringify(row));
  },
  async remove(t, id) {
    const d = this.load();
    if (t === 'clientes') { if (d.oportunidades.some(o => o.cliente_id === id)) throw { code: '23503', message: 'fk' }; d.visitas = d.visitas.filter(v => v.cliente_id !== id); }
    d[t] = d[t].filter(x => x.id !== id); this.save();
  },
  async seguimiento() {
    const d = this.load();
    return d.clientes.map(c => {
      const vs = d.visitas.filter(v => v.cliente_id === c.id).sort((a, b) => (b.fecha + (b.creado || '')).localeCompare(a.fecha + (a.creado || '')));
      return { cliente_id: c.id, visitas: vs.length, ultima_visita: vs.length ? vs[0].fecha : null, proxima_manual: c.proxima_visita || null };
    });
  },
  async list(t, col, val) { return (await this.all(t)).filter(x => x[col] === val); },
  reset() { this.d = { clientes: [], oportunidades: [], visitas: [], catalogo: [] }; this.save(); }
};

async function sbAll(table, o = {}) {
  const out = [], size = 1000;
  for (let from = 0; ; from += size) {
    let q = sb.from(table).select(o.select || '*').range(from, from + size - 1);
    if (o.order !== false) q = q.order(o.order || 'id', { ascending: true });
    if (o.eq) q = q.eq(o.eq[0], o.eq[1]);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...data);
    if (data.length < size) break;
  }
  return out;
}
const DB = {
  async all(t, o) { return S.demo ? Local.all(t) : sbAll(t, o); },
  async insert(t, rows) {
    rows = Array.isArray(rows) ? rows : [rows];
    if (S.demo) return Local.insert(t, rows);
    const { data, error } = await sb.from(t).insert(rows).select();
    if (error) throw error; return data;
  },
  async insertMany(t, rows, onProg) {
    const out = [], n = 300;
    for (let i = 0; i < rows.length; i += n) {
      out.push(...await this.insert(t, rows.slice(i, i + n)));
      if (onProg) onProg(Math.min(rows.length, i + n), rows.length);
    }
    return out;
  },
  async update(t, id, patch) {
    if (S.demo) return Local.update(t, id, patch);
    const { data, error } = await sb.from(t).update(patch).eq('id', id).select();
    if (error) throw error;
    if (!data || !data.length) throw { code: '42501', message: 'row-level security' };
    return data[0];
  },
  async remove(t, id) {
    if (S.demo) return Local.remove(t, id);
    const { data, error } = await sb.from(t).delete().eq('id', id).select();
    if (error) throw error;
    if (!data || !data.length) throw { code: '42501', message: 'row-level security' };
  },
  async seguimiento() { return S.demo ? Local.seguimiento() : sbAll('v_seguimiento', { order: 'cliente_id' }); },
  async visitasDe(cid) {
    const rows = S.demo ? await Local.list('visitas', 'cliente_id', cid) : await sbAll('visitas', { eq: ['cliente_id', cid], order: 'id' });
    return rows.sort((a, b) => (b.fecha + (b.creado || '')).localeCompare(a.fecha + (a.creado || '')));
  }
};

/* ---------- carga inicial ---------- */
const ZONAS_BASE = [{ id: 1, nombre: 'Zona 1', orden: 1 }, { id: 2, nombre: 'Zona 2', orden: 2 }, { id: 3, nombre: 'Zona 3', orden: 3 }, { id: 4, nombre: 'Zona 4', orden: 4 }, { id: 5, nombre: 'Zona 5', orden: 5 }, { id: 6, nombre: 'Laboratorio', orden: 6 }];
const LINEAS_BASE = ['Anestesia', 'Cardiologia', 'Cirugia', 'Desfibrilacion', 'Esterilizacion', 'Heridas', 'Iluminacion', 'Infusion', 'Laboratorio', 'Mobiliario', 'Monitoreo', 'Neo', 'Odontologia', 'Otros', 'Pesaje', 'RX', 'Ultrasonido', 'Ventilacion'];

async function loadAll() {
  if (S.demo) {
    S.zonas = ZONAS_BASE.slice();
    S.myZonas = S.zonas.map(z => z.id);
    const d = Local.load();
    if (!d.catalogo.length) { await Local.insert('catalogo', LINEAS_BASE.map(v => ({ tipo: 'linea', valor: v }))); }
  } else {
    const [zonas, pz] = await Promise.all([sbAll('zonas', { order: 'id' }), sbAll('perfil_zonas', { order: 'zona_id', eq: S.me.rol === 'admin' ? null : ['user_id', S.me.id] }).catch(() => [])]);
    S.zonas = zonas.sort((a, b) => a.orden - b.orden);
    S.pzonas = pz;
    S.myZonas = S.me.rol === 'admin' ? zonas.map(z => z.id) : pz.filter(x => x.user_id === S.me.id).map(x => x.zona_id);
  }
  const [cat, cli, opp, seg] = await Promise.all([DB.all('catalogo'), DB.all('clientes'), DB.all('oportunidades'), DB.seguimiento()]);
  S.catalogo = cat; S.clientes = cli; S.opps = opp.map(fixOpp);
  S.seg = {}; seg.forEach(s => S.seg[s.cliente_id] = s);
  reindex();
  if (S.zonaSel !== 'todas' && !S.myZonas.includes(S.zonaSel)) S.zonaSel = 'todas';
  if (S.myZonas.length === 1) S.zonaSel = S.myZonas[0];
}
function fixOpp(o) { o.monto = o.monto == null ? null : Number(o.monto); o.cantidad = o.cantidad == null ? null : Number(o.cantidad); return o; }
function reindex() {
  S.cli = new Map(S.clientes.map(c => [c.id, c]));
  S.zn = new Map(S.zonas.map(z => [z.id, z.nombre]));
}
const zonaName = id => S.zn.get(id) || ('Zona ' + id);
const inZona = r => S.zonaSel === 'todas' || r.zona_id === S.zonaSel;
const cliName = id => { const c = S.cli.get(id); return c ? c.nombre : '(cliente eliminado)'; };
const catVals = (tipo) => S.catalogo.filter(c => c.tipo === tipo).map(c => c.valor).sort(cmp);
const mercadoTxt = m => MERCADOS[m] || '';

/* ---------- seguimiento de visitas ---------- */
function segInfo(c) {
  const s = S.seg[c.id] || { visitas: 0, ultima_visita: null, proxima_manual: null };
  const meses = CAT_MESES[c.categoria];
  let due = s.proxima_manual || '', manual = !!due;
  if (!due) {
    if (!meses) return { t: 'none', key: 9e6, last: s.ultima_visita, visitas: s.visitas };
    if (!s.ultima_visita) return { t: 'never', key: -1e5, visitas: 0 };
    due = addMonths(s.ultima_visita, meses);
  }
  const dias = diffDays(due, TODAY);
  return { t: dias < 0 ? 'late' : dias <= 7 ? 'soon' : 'ok', due, dias, key: dias, manual, last: s.ultima_visita, visitas: s.visitas };
}
const segPending = s => s.t === 'late' || s.t === 'never';
function segLabel(s) {
  if (s.t === 'late') return 'Vencida hace ' + (-s.dias) + (s.dias === -1 ? ' día' : ' días');
  if (s.t === 'never') return 'Sin primera visita';
  if (s.t === 'soon') return s.dias === 0 ? 'Vence hoy' : 'Vence en ' + s.dias + (s.dias === 1 ? ' día' : ' días');
  if (s.t === 'ok') return 'Próx. ' + fmtDate(s.due);
  return 'Sin seguimiento';
}

/* ---------- UI helpers ---------- */
let toastT;
function toast(msg, bad) {
  $$('.toast').forEach(t => t.remove());
  const t = document.createElement('div'); t.className = 'toast' + (bad ? ' bad' : ''); t.textContent = msg; t.setAttribute('role', 'status');
  document.body.appendChild(t); clearTimeout(toastT); toastT = setTimeout(() => t.remove(), bad ? 6000 : 2600);
}
const ICON = {
  resumen: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/></svg>',
  opp: '<svg viewBox="0 0 24 24"><path d="M3 7h18M3 12h18M3 17h12"/></svg>',
  cli: '<svg viewBox="0 0 24 24"><path d="M3 21V8l9-5 9 5v13M9 21v-6h6v6M7 11h.01M12 11h.01M17 11h.01"/></svg>',
  vis: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg>',
  cat: '<svg viewBox="0 0 24 24"><path d="M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 17l9 5 9-5"/></svg>',
  imp: '<svg viewBox="0 0 24 24"><path d="M12 3v12M7 10l5 5 5-5M4 21h16"/></svg>',
  usr: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-7 7-7s7 3 7 7M17 4a4 4 0 0 1 0 8M22 21c0-3-2-5-4-6"/></svg>',
  mas: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>'
};

/* ---------- modales ---------- */
const MODALS = [];
function openModal(o) {
  const ov = document.createElement('div'); ov.className = 'ov';
  ov.innerHTML = `<div class="md${o.wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(o.title)}"><div class="md-h"><div><h2>${esc(o.title)}</h2>${o.sub ? `<p>${esc(o.sub)}</p>` : ''}</div><button class="xb" data-close aria-label="Cerrar">${ICON.x}</button></div><div class="md-b">${o.body || ''}</div>${o.foot ? `<div class="md-f">${o.foot}</div>` : ''}</div>`;
  const m = { el: ov, o };
  ov.addEventListener('mousedown', e => { if (e.target === ov) closeModal(m); });
  ov.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) return closeModal(m);
    const b = e.target.closest('[data-m]');
    if (b && o.onAct) o.onAct(b.dataset.m, b, m, e);
  });
  ov.addEventListener('input', e => { if (o.onInput) o.onInput(e, m); });
  ov.addEventListener('change', e => { if (o.onChange) o.onChange(e, m); });
  document.body.appendChild(ov); MODALS.push(m);
  document.body.style.overflow = 'hidden';
  const f = $('input:not([type=hidden]),select,textarea', ov.querySelector('.md-b')); if (f && o.focus !== false && window.innerWidth > 620) f.focus();
  if (o.onOpen) o.onOpen(m);
  return m;
}
function closeModal(m) {
  m = m || MODALS[MODALS.length - 1]; if (!m) return;
  m.el.remove(); const i = MODALS.indexOf(m); if (i >= 0) MODALS.splice(i, 1);
  if (!MODALS.length) document.body.style.overflow = '';
  if (m.o.onClose) m.o.onClose();
}
function closeAllModals() { while (MODALS.length) closeModal(); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && MODALS.length) closeModal(); });
const mq = (m, s) => $(s, m.el);
function confirmBox(title, text, okLabel, fn) {
  openModal({
    title, body: `<p>${esc(text)}</p>`, foot: `<button class="btn" data-close>Cancelar</button><button class="btn danger" data-m="ok">${esc(okLabel || 'Eliminar')}</button>`,
    onAct: async (a, b, m) => { if (a === 'ok') { b.disabled = true; try { await fn(); closeModal(m); } catch (e) { b.disabled = false; toast(errMsg(e), true); } } }
  });
}

/* ---------- combo con búsqueda ---------- */
function comboHTML(id, label, value, ph, full) {
  return `<div class="fld${full ? ' full' : ''} combo" data-combo="${id}"><label for="${id}">${label}</label><input id="${id}" type="text" value="${esc(value)}" placeholder="${esc(ph || '')}" autocomplete="off"><div class="cl" hidden></div></div>`;
}
function comboSetup(root, id, getOptions, onPick) {
  const wrap = $(`[data-combo="${id}"]`, root), inp = $('input', wrap), list = $('.cl', wrap);
  let idx = -1, cur = [];
  const draw = () => {
    const q = norm(inp.value);
    cur = getOptions().filter(o => !q || norm(o.label + ' ' + (o.sub || '')).includes(q)).slice(0, 40);
    idx = -1;
    list.innerHTML = cur.map((o, i) => `<button type="button" data-i="${i}">${esc(o.label)}${o.sub ? `<small>${esc(o.sub)}</small>` : ''}</button>`).join('');
    list.hidden = !cur.length;
  };
  const pick = i => { const o = cur[i]; if (!o) return; inp.value = o.label; list.hidden = true; onPick && onPick(o); };
  inp.addEventListener('input', () => { draw(); onPick && onPick(null, inp.value); });
  inp.addEventListener('focus', draw);
  inp.addEventListener('keydown', e => {
    if (list.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); idx = Math.min(idx + 1, cur.length - 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); idx = Math.max(idx - 1, 0); }
    else if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pick(idx); return; }
    else if (e.key === 'Escape') { list.hidden = true; e.stopPropagation(); return; }
    else return;
    $$('button', list).forEach((b, i) => b.classList.toggle('on', i === idx));
    const on = $('button.on', list); if (on) on.scrollIntoView({ block: 'nearest' });
  });
  list.addEventListener('mousedown', e => { const b = e.target.closest('button'); if (b) { e.preventDefault(); pick(+b.dataset.i); } });
  inp.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 120));
}

/* ---------- tabla tipo planilla ---------- */
// cols: [{k,l,get(r)->valor ordenable, show(r)->html opcional, n:true si numérica, w:true si texto largo}]
function gridHTML(id, cols, rows, o = {}) {
  const st = S.ui.sort[id] || (S.ui.sort[id] = { k: o.sortK || cols[0].k, d: o.sortD || 1 });
  const col = cols.find(c => c.k === st.k) || cols[0];
  const sorted = rows.map((r, i) => ({ r, i, v: col.get(r) })).sort((a, b) => {
    const ae = a.v === '' || a.v == null, be = b.v === '' || b.v == null;
    if (ae || be) return ae && be ? a.i - b.i : ae ? 1 : -1;
    const v = (typeof a.v === 'number' && typeof b.v === 'number') ? a.v - b.v : cmp(a.v, b.v);
    return (v * st.d) || (a.i - b.i);
  }).map(x => x.r);
  const lim = S.ui.lim[id] || 200, shown = sorted.slice(0, lim);
  const head = cols.map(c => `<th scope="col"${st.k === c.k ? ` aria-sort="${st.d > 0 ? 'ascending' : 'descending'}"` : ''}><button data-sort="${id}" data-k="${c.k}"${c.n ? ' style="justify-content:flex-end"' : ''}>${esc(c.l)}<i>${st.k === c.k ? (st.d > 0 ? '▲' : '▼') : ''}</i></button></th>`).join('');
  const body = shown.map(r => `<tr data-a="${o.act || 'row'}" data-id="${esc(r.id)}" tabindex="0">${cols.map(c => `<td class="${c.n ? 'n ' : ''}${c.w ? 'w' : ''}">${c.show ? c.show(r) : (esc(c.get(r)) || '')}</td>`).join('')}</tr>`).join('');
  const foot = o.foot ? `<tfoot><tr>${cols.map((c, i) => `<td class="${c.n ? 'n' : ''}">${o.foot(c, i, sorted)}</td>`).join('')}</tr></tfoot>` : '';
  const more = sorted.length > shown.length ? `<button class="btn more" data-more="${id}">Mostrar más (${sorted.length - shown.length})</button>` : '';
  return { html: `<div class="tw"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${foot}</table></div>${more}`, sorted };
}

/* ---------- XLSX (carga bajo demanda) ---------- */
let xlsxP = null;
function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  if (xlsxP) return xlsxP;
  xlsxP = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = 'vendor/xlsx.full.min.js';
    s.onload = res; s.onerror = () => { xlsxP = null; rej(new Error('No se pudo cargar el lector de Excel (vendor/xlsx.full.min.js).')); };
    document.head.appendChild(s);
  });
  return xlsxP;
}
async function downloadXLSX(filename, sheets) {
  await loadXLSX();
  const wb = XLSX.utils.book_new();
  sheets.forEach(sh => {
    const ws = XLSX.utils.aoa_to_sheet([sh.head].concat(sh.rows));
    ws['!cols'] = sh.head.map((h, i) => ({ wch: Math.min(48, Math.max(String(h).length + 2, ...sh.rows.slice(0, 80).map(r => String(r[i] == null ? '' : r[i]).length + 2))) }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name);
  });
  XLSX.writeFile(wb, filename);
}
