'use strict';
/* =====================  ARRANQUE, NAVEGACIÓN Y EVENTOS  ===================== */
const NAV = [
  { k: 'resumen', l: 'Resumen', i: 'resumen' },
  { k: 'oportunidades', l: 'Oportunidades', i: 'opp' },
  { k: 'clientes', l: 'Clientes', i: 'cli' },
  { k: 'seguimiento', l: 'Seguimiento', i: 'vis' },
  { k: 'catalogo', l: 'Catálogos', i: 'cat', sep: 1 },
  { k: 'importar', l: 'Importar / Exportar', i: 'imp' },
  { k: 'usuarios', l: 'Usuarios', i: 'usr', admin: 1 }
];
const TITLES = { resumen: 'Resumen y estadísticas', oportunidades: 'Oportunidades', clientes: 'Clientes', seguimiento: 'Seguimiento de visitas', catalogo: 'Catálogos', importar: 'Importar / Exportar', usuarios: 'Usuarios' };
const VIEWS = { resumen: () => vResumen(), oportunidades: () => vOpp(), clientes: () => vClientes(), seguimiento: () => vSeg(), catalogo: () => vCatalogo(), importar: () => vImportar(), usuarios: () => vUsuarios() };
const UI_KEY = 'inbio-crm-ui';
const root = () => $('#app');
let lastLoad = 0, renderTok = 0, wasMobile = null;

function loadUi() { try { const u = JSON.parse(localStorage.getItem(UI_KEY) || '{}'); if (u.tab && TITLES[u.tab]) S.tab = u.tab; if (u.zona === 'todas' || typeof u.zona === 'number') S.zonaSel = u.zona; } catch (e) { } }
function saveUi() { try { localStorage.setItem(UI_KEY, JSON.stringify({ tab: S.tab, zona: S.zonaSel })); } catch (e) { } }

/* ---------- pantallas sin sesión ---------- */
function logoImg(cls) { return cls === 'logo-s' ? '' : cls === 'logo' ? '<div class="brand">CRM comercial</div>' : ''; }
function showFatal(msg) { root().innerHTML = `<div class="login"><div class="box">${logoImg('logo')}<h1>Algo salió mal</h1><p class="err" style="text-align:center">${esc(msg)}</p></div></div>`; }
function showSetup() {
  root().innerHTML = `<div class="login"><div class="box" style="max-width:520px">${logoImg('logo')}<h1>Ingresá con tu usuario</h1>
    <p style="margin-bottom:12px"><b>Falta conectar la base de datos.</b> Abrí el archivo <code>js/config.js</code> y completá <code>SUPABASE_URL</code> y <code>SUPABASE_ANON_KEY</code> con los datos de tu proyecto de Supabase (la guía paso a paso está en <code>LEEME.md</code>).</p>
    <p class="hint" style="margin-bottom:16px">Mientras tanto podés recorrer la app en <b>modo demostración</b>: los datos quedan solo en este navegador y no se comparten.</p>
    <button class="btn grn" data-a="demo">Probar en modo demostración</button></div></div>`;
}
function showLogin(msg) {
  root().innerHTML = `<div class="login"><form class="box" id="login-f" novalidate>${logoImg('logo')}<h1>Ingresá con tu usuario</h1>
    <div class="fld"><label for="l-mail">Correo</label><input id="l-mail" type="email" autocomplete="username" inputmode="email" required></div>
    <div class="fld"><label for="l-pass">Contraseña</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
    <p class="err" id="l-err" ${msg ? '' : 'hidden'}>${esc(msg || '')}</p>
    <button class="btn pri" type="submit">Ingresar</button>
    <div class="foot"><a href="#" data-a="forgot">Olvidé mi contraseña</a></div></form></div>`;
  const m = $('#l-mail'); if (m) m.focus();
}
function showNewPassword() {
  root().innerHTML = `<div class="login"><form class="box" id="newpw-f" novalidate>${logoImg('logo')}<h1>Elegí una contraseña nueva</h1>
    <div class="fld"><label for="n-pass">Contraseña nueva</label><input id="n-pass" type="password" autocomplete="new-password" minlength="8"></div>
    <div class="fld"><label for="n-pass2">Repetila</label><input id="n-pass2" type="password" autocomplete="new-password"></div>
    <p class="err" id="l-err" hidden></p><button class="btn pri" type="submit">Guardar contraseña</button></form></div>`;
}
function showBlocked(title, text) {
  root().innerHTML = `<div class="login"><div class="box">${logoImg('logo')}<h1>${esc(title)}</h1><p style="text-align:center;margin-bottom:16px">${esc(text)}</p><button class="btn" data-a="logout">Cerrar sesión</button></div></div>`;
}
function showSpin(t) { root().innerHTML = `<div class="spin"><i></i><div>${esc(t || 'Cargando…')}</div></div>`; }

/* ---------- sesión ---------- */
async function boot() {
  loadUi();
  const ok = CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY && !/TU-PROYECTO|TU-ANON/i.test(CFG.SUPABASE_URL + CFG.SUPABASE_ANON_KEY);
  if (!ok) return showSetup();
  if (!window.supabase) return showFatal('No se pudo cargar la librería de Supabase (vendor/supabase.js).');
  sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
  sb.auth.onAuthStateChange((ev) => { if (ev === 'PASSWORD_RECOVERY') showNewPassword(); else if (ev === 'SIGNED_OUT' && !S.demo) { S.me = null; showLogin(); } });
  showSpin('Conectando…');
  try {
    const { data } = await sb.auth.getSession();
    if (data && data.session && !/type=recovery/.test(location.hash)) await enter(data.session.user); else if (!/type=recovery/.test(location.hash)) showLogin();
  } catch (e) { showLogin(errMsg(e)); }
}
async function enter(user) {
  showSpin('Cargando tus datos…');
  try {
    const { data, error } = await sb.from('perfiles').select('*').eq('id', user.id).maybeSingle();
    if (error) throw error;
    if (!data) return showBlocked('Usuario sin perfil', 'Tu usuario existe pero todavía no tiene un perfil en el sistema. Avisale al administrador.');
    if (!data.activo) return showBlocked('Usuario desactivado', 'Tu acceso está desactivado. Consultá con el administrador.');
    S.me = data;
    await loadAll();
    if (S.me.rol !== 'admin' && !S.myZonas.length) return showBlocked('Sin zona asignada', 'Todavía no tenés ninguna zona asignada. Pedile al administrador que te asigne tu zona y volvé a ingresar.');
    lastLoad = Date.now();
    renderShell();
  } catch (e) { showBlocked('No se pudo ingresar', errMsg(e)); }
}
function enterDemo() {
  S.demo = true; S.me = { id: 'demo', rol: 'admin', nombre: 'Modo demostración', email: '', activo: true };
  showSpin('Preparando demostración…');
  loadAll().then(() => { lastLoad = Date.now(); renderShell(); }).catch(e => showFatal(errMsg(e)));
}
async function logout() {
  try { if (!S.demo && sb) await sb.auth.signOut(); } catch (e) { }
  closeAllModals(); S.me = null; S.opps = []; S.clientes = []; S.catalogo = []; S.seg = {};
  if (S.demo) { S.demo = false; showSetup(); } else showLogin();
}
async function reloadData(silent) {
  try {
    await loadAll(); lastLoad = Date.now();
    if (!silent) toast('Datos actualizados');
    renderShell(true);
  } catch (e) { toast(errMsg(e), true); }
}

/* ---------- estructura general ---------- */
const pendientesN = () => S.clientes.filter(inZona).filter(c => segPending(segInfo(c))).length;
function navBtn(n, mobile) {
  const bd = n.k === 'seguimiento' ? pendientesN() : 0;
  return `<button data-tab="${n.k}" ${S.tab === n.k ? 'aria-current="page"' : ''}>${ICON[n.i]}${mobile ? `<span>${n.l.split(' ')[0]}</span>` : `<span>${n.l}</span>`}${bd ? `<span class="bd">${bd > 999 ? '999+' : bd}</span>` : ''}</button>`;
}
function zonaSelect() {
  if (S.myZonas.length < 2) return S.myZonas.length === 1 ? `<span class="pill mk">${esc(zonaName(S.myZonas[0]))}</span>` : '';
  return `<select id="zsel" aria-label="Zona"><option value="todas">Todas las zonas</option>${S.zonas.filter(z => S.myZonas.includes(z.id)).map(z => `<option value="${z.id}"${S.zonaSel === z.id ? ' selected' : ''}>${esc(z.nombre)}</option>`).join('')}</select>`;
}
function renderShell(keepPage) {
  const nav = NAV.filter(n => !n.admin || S.me.rol === 'admin');
  const rolTxt = { admin: 'Administrador', vendedor: 'Vendedor', consulta: 'Consulta' }[S.me.rol] || S.me.rol;
  const mobNav = ['resumen', 'oportunidades', 'clientes', 'seguimiento'].map(k => nav.find(n => n.k === k));
  root().innerHTML = `<div class="app"><aside class="side">${logoImg('logo')}<nav class="nav" aria-label="Secciones">${nav.map(n => (n.sep ? '<div class="sep"></div>' : '') + navBtn(n)).join('')}</nav>
    <div class="who"><b>${esc(S.me.nombre || S.me.email || 'Usuario')}</b>${rolTxt}${S.myZonas.length && S.me.rol !== 'admin' ? ' · ' + S.myZonas.map(zonaName).join(', ') : ''}<br>${S.demo ? '' : '<button data-a="pw">Cambiar contraseña</button><br>'}<button data-a="logout">${S.demo ? 'Salir de la demostración' : 'Cerrar sesión'}</button></div></aside>
    <div class="main"><header class="top">${logoImg('logo-s')}<h1 id="ttl">${esc(TITLES[S.tab])}</h1><span class="grow"></span>${zonaSelect()}<button class="btn ico" data-a="reload" aria-label="Actualizar datos" title="Actualizar datos"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5"/></svg></button></header>
    ${S.demo ? '<div class="demo-bar"><b>Modo demostración</b> · los datos quedan solo en este navegador. Conectá Supabase en <code>js/config.js</code> para usar la base real.</div>' : ''}
    <main class="page" id="page"></main></div></div>
    <nav class="bnav" aria-label="Secciones">${mobNav.map(n => navBtn(n, true)).join('')}<button data-a="mas">${ICON.mas}<span>Más</span></button></nav>`;
  wasMobile = isMobile();
  renderMain();
}
function updateChrome() {
  $$('[data-tab]').forEach(b => { if (b.dataset.tab === S.tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const t = $('#ttl'); if (t) t.textContent = TITLES[S.tab];
  document.title = TITLES[S.tab] + ' · CRM comercial';
  const n = pendientesN();
  $$('[data-tab="seguimiento"]').forEach(b => { let bd = $('.bd', b); if (n) { if (!bd) { bd = document.createElement('span'); bd.className = 'bd'; b.appendChild(bd); } bd.textContent = n > 999 ? '999+' : n; } else if (bd) bd.remove(); });
}
async function renderMain() {
  const page = $('#page'); if (!page || !S.me) return;
  const tok = ++renderTok, y = window.scrollY, a = document.activeElement, aid = a && a.id && page.contains(a) ? a.id : '', ss = a && a.selectionStart, se = a && a.selectionEnd;
  let html;
  try { html = await VIEWS[S.tab](); } catch (e) { html = `<div class="card"><div class="empty err">${esc(errMsg(e))}</div></div>`; }
  if (tok !== renderTok) return;
  page.innerHTML = html;
  updateChrome();
  if (aid) { const n = document.getElementById(aid); if (n) { n.focus(); try { n.setSelectionRange(ss, se); } catch (e) { } } }
  window.scrollTo(0, y);
}
function setTab(t) { S.tab = t; saveUi(); closeAllModals(); renderMain(); window.scrollTo(0, 0); }

/* ---------- acciones ---------- */
function drill(d) {
  const f = {};
  if (d.e) f.estado = d.e.split('|');
  ['trim', 'mercado', 'marca', 'linea', 'producto', 'canal', 'anio'].forEach(k => { if (d[k]) f[k] = d[k]; });
  S.ui.filt.opp = f; S.ui.lim.opp = 0; S.ui.sort.opp = { k: 'monto', d: -1 };
  setTab('oportunidades');
}
function openPwForm() {
  openModal({
    title: 'Cambiar contraseña', body: `<div class="form"><div class="fld full"><label for="p1">Contraseña nueva (mínimo 8 caracteres)</label><input id="p1" type="password" autocomplete="new-password"></div><div class="fld full"><label for="p2">Repetila</label><input id="p2" type="password" autocomplete="new-password"></div><p class="err full" id="f-err" hidden></p></div>`,
    foot: '<button class="btn" data-close>Cancelar</button><button class="btn pri" data-m="save">Guardar</button>',
    onAct: async (a, b, m) => {
      if (a !== 'save') return; const e = mq(m, '#f-err'), p1 = mq(m, '#p1').value, p2 = mq(m, '#p2').value;
      if (p1.length < 8) { e.textContent = 'Usá al menos 8 caracteres.'; e.hidden = false; return; } if (p1 !== p2) { e.textContent = 'Las contraseñas no coinciden.'; e.hidden = false; return; }
      b.disabled = true; const { error } = await sb.auth.updateUser({ password: p1 }); b.disabled = false;
      if (error) { e.textContent = errMsg(error); e.hidden = false; } else { closeModal(m); toast('Contraseña actualizada'); }
    }
  });
}
function openMas() {
  const nav = NAV.filter(n => (!n.admin || S.me.rol === 'admin') && !['resumen', 'oportunidades', 'clientes', 'seguimiento'].includes(n.k));
  openModal({ title: 'Más opciones', body: `<div style="display:flex;flex-direction:column;gap:8px">${nav.map(n => `<button class="btn" style="justify-content:flex-start" data-m="go" data-k="${n.k}">${n.l}</button>`).join('')}${S.demo ? '' : '<button class="btn" style="justify-content:flex-start" data-m="pw">Cambiar contraseña</button>'}<button class="btn" style="justify-content:flex-start" data-m="out">${S.demo ? 'Salir de la demostración' : 'Cerrar sesión'}</button></div>`, onAct: (a, b, m) => { if (a === 'go') { closeModal(m); setTab(b.dataset.k); } if (a === 'pw') { closeModal(m); openPwForm(); } if (a === 'out') { closeModal(m); logout(); } } });
}
async function act(a, el, ev) {
  const id = el.dataset.id, v = el.dataset.v;
  switch (a) {
    case 'demo': return enterDemo();
    case 'logout': return logout();
    case 'pw': return openPwForm();
    case 'mas': return openMas();
    case 'reload': return reloadData();
    case 'forgot': { ev.preventDefault(); const mail = ($('#l-mail') || {}).value || ''; if (!mail.trim()) { const e = $('#l-err'); e.textContent = 'Escribí tu correo arriba y volvé a tocar «Olvidé mi contraseña».'; e.hidden = false; return; } const { error } = await sb.auth.resetPasswordForEmail(mail.trim(), { redirectTo: location.origin + location.pathname }); const e = $('#l-err'); e.hidden = false; e.style.color = error ? '' : 'var(--teal)'; e.textContent = error ? errMsg(error) : 'Listo: te enviamos un correo con el enlace para elegir una contraseña nueva.'; return; }
    case 'goto': return setTab(v);
    case 'zona-go': S.zonaSel = +v; saveUi(); return renderMain();
    case 'drill': return drill(el.dataset);
    case 'trimmode': S.ui.filt.trimPct = v === 'pct'; return renderMain();
    case 'opp-new': return openOppForm(null, {});
    case 'row': return openOppForm(id);
    case 'cli': return openFicha(id);
    case 'cli-new': return openClienteForm(null);
    case 'visita': return openVisitaForm(id);
    case 'chip-estado': { const f = F('opp'); f.estado = f.estado || []; const i = f.estado.indexOf(v); if (i >= 0) f.estado.splice(i, 1); else f.estado.push(v); S.ui.lim.opp = 0; return renderMain(); }
    case 'clear-opp': S.ui.filt.opp = {}; return renderMain();
    case 'clear-cliente': delete F('opp').cliente; return renderMain();
    case 'clear-cli': S.ui.filt.cli = {}; return renderMain();
    case 'seg-st': F('seg').st = v; return renderMain();
    case 'cat-t': F('cat').t = v; return renderMain();
    case 'cat-new': return openCatForm(null);
    case 'cat-edit': return openCatForm(id);
    case 'exp-opp': return doExport('opp');
    case 'exp-cli': return doExport('cli');
    case 'exp-all': return doExport('all');
    case 'imp-go': { const out = $('#imp-out'); if (IMP.plan && !IMP.busy) await impRun(IMP.plan, out); return; }
    case 'imp-cancel': IMP.plan = null; { const o = $('#imp-out'); if (o) o.innerHTML = ''; const fi = $('#imp-file'); if (fi) fi.value = ''; } return;
  }
}
document.addEventListener('click', e => {
  if (e.target.closest('.ov')) return;
  const tab = e.target.closest('[data-tab]'); if (tab) { return setTab(tab.dataset.tab); }
  const so = e.target.closest('[data-sort]'); if (so) { const id = so.dataset.sort, k = so.dataset.k, st = S.ui.sort[id] || (S.ui.sort[id] = { k, d: 1 }); if (st.k === k) st.d = -st.d; else { st.k = k; st.d = 1; } return renderMain(); }
  const mo = e.target.closest('[data-more]'); if (mo) { const id = mo.dataset.more, step = ['oppm', 'clim', 'segm'].includes(id) ? 60 : 200; S.ui.lim[id] = (S.ui.lim[id] || step) + step; return renderMain(); }
  const t = e.target.closest('[data-a]'); if (t) act(t.dataset.a, t, e);
});
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches && e.target.matches('tr[data-a]') && !e.target.closest('.ov')) { e.preventDefault(); e.target.click(); } });
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'zsel') { S.zonaSel = t.value === 'todas' ? 'todas' : +t.value; saveUi(); return renderMain(); }
  if (t.dataset && t.dataset.f) { const [g, k] = t.dataset.f.split('.'); F(g)[k] = t.value; S.ui.lim.opp = 0; return renderMain(); }
  if (t.dataset && t.dataset.u) return usuarioChange(t);
  if (t.id === 'imp-file' || t.id === 'imp-zona') return impPick();
});
let qT;
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.q || t.closest('.ov')) return;
  clearTimeout(qT); qT = setTimeout(() => { F(t.dataset.q).q = t.value; S.ui.lim.oppm = S.ui.lim.clim = S.ui.lim.segm = 0; renderMain(); }, 180);
});
document.addEventListener('submit', async e => {
  if (e.target.id === 'login-f') {
    e.preventDefault(); const em = $('#l-mail').value.trim(), pw = $('#l-pass').value, er = $('#l-err'), btn = $('button[type=submit]', e.target);
    if (!em || !pw) { er.textContent = 'Completá el correo y la contraseña.'; er.hidden = false; return; }
    btn.disabled = true; er.hidden = true;
    const { data, error } = await sb.auth.signInWithPassword({ email: em, password: pw });
    if (error) { btn.disabled = false; er.style.color = ''; er.textContent = errMsg(error); er.hidden = false; return; }
    await enter(data.user);
  }
  if (e.target.id === 'newpw-f') {
    e.preventDefault(); const p1 = $('#n-pass').value, p2 = $('#n-pass2').value, er = $('#l-err');
    if (p1.length < 8) { er.textContent = 'Usá al menos 8 caracteres.'; er.hidden = false; return; } if (p1 !== p2) { er.textContent = 'Las contraseñas no coinciden.'; er.hidden = false; return; }
    const { error } = await sb.auth.updateUser({ password: p1 }); if (error) { er.textContent = errMsg(error); er.hidden = false; return; }
    history.replaceState(null, '', location.pathname); const { data } = await sb.auth.getSession(); if (data.session) await enter(data.session.user); else showLogin();
  }
});
async function impPick() {
  const fi = $('#imp-file'), out = $('#imp-out'); if (!fi || !fi.files || !fi.files[0] || IMP.busy) return;
  out.innerHTML = '<div class="spin" style="min-height:90px"><i></i><div>Leyendo el archivo…</div></div>';
  try { IMP.plan = await impAnalyze(fi.files[0], +$('#imp-zona').value); out.innerHTML = impPreviewHTML(IMP.plan); }
  catch (err) { IMP.plan = null; out.innerHTML = `<p class="err">${esc(errMsg(err))}</p>`; }
}
window.addEventListener('resize', () => { if (S.me && wasMobile !== isMobile()) { wasMobile = isMobile(); renderMain(); } });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me && !S.demo && !MODALS.length && Date.now() - lastLoad > 180000) reloadData(true); });
boot();
