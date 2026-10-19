/* =====================  VISTAS  ===================== */
const isMobile = () => window.innerWidth < 720;
const multiZona = () => S.zonaSel === 'todas' && S.myZonas.length > 1;
const estadoPill = e => `<span class="pill ${slug(e)}">${esc(e)}</span>`;
const F = k => S.ui.filt[k] || (S.ui.filt[k] = {});
const optSel = (arr, cur, all) => (all ? `<option value="">${all}</option>` : '') + arr.map(v => { const [val, lab] = Array.isArray(v) ? v : [v, v]; return `<option value="${esc(val)}"${val === cur ? ' selected' : ''}>${esc(lab)}</option>`; }).join('');
const sumBy = (rows, f) => rows.reduce((s, r) => s + (Number(f(r)) || 0), 0);

/* ---------- OPORTUNIDADES ---------- */
function oppRows() {
  const f = F('opp'), q = norm(f.q || '');
  return S.opps.filter(inZona).filter(o => {
    if (f.estado && f.estado.length && !f.estado.includes(o.estado)) return false;
    if (f.trim && o.trimestre !== f.trim) return false;
    if (f.marca && o.marca !== f.marca) return false;
    if (f.linea && o.linea !== f.linea) return false;
    if (f.producto && o.producto !== f.producto) return false;
    if (f.anio && String(oppYear(o)) !== String(f.anio)) return false;
    if (f.canal && o.canal !== f.canal) return false;
    if (f.mercado && o.mercado !== f.mercado) return false;
    if (f.cliente && o.cliente_id !== f.cliente) return false;
    if (q && !norm([cliName(o.cliente_id), o.producto, o.marca, o.linea, o.nro_cotizacion, o.detalle, o.info_extra].join(' ')).includes(q)) return false;
    return true;
  });
}
function oppCols() {
  const c = [
    { k: 'cliente', l: 'Cliente', get: o => cliName(o.cliente_id) },
    { k: 'fecha', l: 'Fecha', get: o => o.fecha || '', show: o => fmtDate(o.fecha) }
  ];
  if (multiZona()) c.push({ k: 'zona', l: 'Zona', get: o => zonaName(o.zona_id) });
  c.push(
    { k: 'canal', l: 'Canal', get: o => o.canal || '' },
    { k: 'nro', l: 'Nº cotiz.', get: o => o.nro_cotizacion || '' },
    { k: 'mercado', l: 'Mercado', get: o => mercadoTxt(o.mercado) },
    { k: 'trim', l: 'Trim.', get: o => o.trimestre || '' },
    { k: 'prob', l: 'Prob.', n: 1, get: o => o.probabilidad, show: o => o.probabilidad == null ? '' : o.probabilidad + '%' },
    { k: 'marca', l: 'Marca', get: o => o.marca || '' },
    { k: 'linea', l: 'Línea', get: o => o.linea || '' },
    { k: 'producto', l: 'Producto', get: o => o.producto || '' },
    { k: 'cant', l: 'Cant.', n: 1, get: o => o.cantidad, show: o => o.cantidad == null ? '' : num(o.cantidad) },
    { k: 'monto', l: 'Monto estimado', n: 1, get: o => o.monto, show: o => o.monto == null ? '' : money(o.monto) },
    { k: 'estado', l: 'Estado', get: o => o.estado, show: o => estadoPill(o.estado) },
    { k: 'detalle', l: 'Detalle', w: 1, get: o => o.detalle || '' }
  );
  return c;
}
function vOpp() {
  const f = F('opp'), all = S.opps.filter(inZona);
  const cnt = e => all.filter(o => o.estado === e).length;
  const sel = f.estado || [];
  const marcas = [...new Set(all.map(o => o.marca).filter(Boolean))].sort(cmp), lineas = [...new Set(all.map(o => o.linea).filter(Boolean))].sort(cmp);
  const cf = f.cliente ? `<span class="chip" aria-pressed="true">Cliente: ${esc(cliName(f.cliente))} ✕</span>` : '';
  return `<div class="tools"><input class="q" id="q-opp" data-q="opp" type="search" placeholder="Buscar cliente, producto, cotización…" value="${esc(f.q || '')}" aria-label="Buscar"><span class="grow"></span>
      <button class="btn" data-a="exp-opp">Exportar Excel</button><button class="btn pri" data-a="opp-new">+ Nueva oportunidad</button></div>
    <div class="tools"><div class="chips">${ESTADOS.map(e => `<button class="chip" data-a="chip-estado" data-v="${esc(e)}" aria-pressed="${sel.includes(e)}">${esc(e)}<small>${cnt(e)}</small></button>`).join('')}${f.cliente ? `<button class="chip" data-a="clear-cliente" aria-pressed="true">Cliente: ${esc(cliName(f.cliente))} ✕</button>` : ''}</div></div>
    <div class="tools"><select data-f="opp.trim" aria-label="Trimestre">${optSel(TRIMS, f.trim, 'Trimestre')}</select>
      <select data-f="opp.marca" aria-label="Marca">${optSel(marcas, f.marca, 'Marca')}</select>
      <select data-f="opp.linea" aria-label="Línea">${optSel(lineas, f.linea, 'Línea')}</select>
      <select data-f="opp.canal" aria-label="Canal">${optSel(CANALES, f.canal, 'Canal')}</select>
      <select data-f="opp.mercado" aria-label="Mercado">${optSel(Object.entries(MERCADOS), f.mercado, 'Mercado')}</select>
      ${f.producto ? `<span class="chip" aria-pressed="true">Producto: ${esc(f.producto)}</span>` : ''}${f.anio ? `<span class="chip" aria-pressed="true">Año ${esc(f.anio)}</span>` : ''}${(f.estado && f.estado.length) || f.trim || f.marca || f.linea || f.canal || f.mercado || f.q || f.cliente || f.producto || f.anio ? '<button class="btn sm" data-a="clear-opp">Quitar filtros</button>' : ''}</div>
    ${oppResult()}`;
}
function oppResult() {
  const rows = oppRows();
  if (!rows.length) return `<div class="card"><div class="empty">${S.opps.length ? 'Ninguna oportunidad coincide con los filtros.' : 'Todavía no cargaste oportunidades.'}</div></div>`;
  const tot = sumBy(rows, o => o.monto);
  if (isMobile()) {
    const st = S.ui.sort.oppm || (S.ui.sort.oppm = { k: 'fecha', d: -1 });
    const s = rows.slice().sort((a, b) => cmp(b.fecha, a.fecha)).slice(0, S.ui.lim.oppm || 60);
    return `<p class="hint" style="margin-bottom:8px">${num(rows.length)} oportunidades · ${money(tot)}</p><div class="cards">${s.map(o => `<button class="rc" data-a="row" data-id="${o.id}"><div class="t">${esc(cliName(o.cliente_id))}</div><div class="r"><span>${esc(o.producto || o.linea || 'Sin producto')}${o.cantidad > 1 ? ' ×' + num(o.cantidad) : ''}</span><b>${o.monto == null ? '' : money(o.monto)}</b></div><div class="r"><span>${fmtDate(o.fecha)} · ${esc(o.trimestre || '')}${multiZona() ? ' · ' + esc(zonaName(o.zona_id)) : ''}</span>${estadoPill(o.estado)}</div></button>`).join('')}</div>${rows.length > s.length ? '<button class="btn more" data-more="oppm">Mostrar más</button>' : ''}`;
  }
  const g = gridHTML('opp', oppCols(), rows, {
    sortK: 'fecha', sortD: -1, act: 'row',
    foot: (c, i, r) => i === 0 ? num(r.length) + ' oportunidades' : c.k === 'monto' ? money(sumBy(r, o => o.monto)) : c.k === 'cant' ? num(sumBy(r, o => o.cantidad)) : ''
  });
  return g.html;
}

function oppFormHTML(o) {
  const cliOpts = cliOptions();
  const prods = S.catalogo.filter(c => c.tipo === 'producto');
  const lineas = catVals('linea'); if (o.linea && !lineas.includes(o.linea)) lineas.push(o.linea);
  const c = o.cliente_id ? S.cli.get(o.cliente_id) : null;
  return `<div class="form" id="oppf">
    <div class="fld"><label for="f-fecha">Fecha</label><input id="f-fecha" type="date" value="${esc(o.fecha || TODAY)}"></div>
    <div class="fld"><label for="f-canal">Canal</label><select id="f-canal">${optSel(CANALES, o.canal || '', '—')}</select></div>
    <div class="fld full">${comboHTML('f-cli', 'Cliente', c ? c.nombre : '', 'Escribí para buscar…').replace('<div class="fld combo"', '<div class="combo"').replace('class="combo"', 'class="combo" style="width:100%"')}<a class="lnk hint" href="#" data-m="newcli" style="margin-top:4px;display:inline-block">+ Crear cliente nuevo</a></div>
    <div class="fld"><label for="f-nro">Nº de cotización</label><input id="f-nro" value="${esc(o.nro_cotizacion || '')}" placeholder="Ej.: 9140 o 1-10264"></div>
    <div class="fld"><label for="f-mercado">Mercado</label><select id="f-mercado">${optSel(Object.entries(MERCADOS), o.mercado || '', '—')}</select></div>
    <div class="fld"><label for="f-anio">Año probable</label><input id="f-anio" type="number" min="2020" max="2100" value="${esc(o.anio_probable || new Date().getFullYear())}"></div>
    <div class="fld"><label for="f-trim">Trimestre probable</label><select id="f-trim">${optSel(TRIMS, o.trimestre || '', '—')}</select></div>
    <div class="fld"><label for="f-estado">Estado</label><select id="f-estado">${optSel(ESTADOS, o.estado || 'Presupuestado')}</select></div>
    <div class="fld"><label for="f-prob">Probabilidad (%)</label><input id="f-prob" type="number" min="0" max="100" step="10" value="${o.probabilidad == null ? '' : o.probabilidad}"></div>
    ${comboHTML('f-prod', 'Producto', o.producto || '', 'Buscar o escribir el modelo…')}
    ${comboHTML('f-marca', 'Marca', o.marca || '', 'Buscar o escribir…')}
    <div class="fld"><label for="f-linea">Línea</label><select id="f-linea">${optSel(lineas, o.linea || '', '—')}</select></div>
    <div class="fld"><label for="f-cant">Cantidad</label><input id="f-cant" type="number" min="0" step="1" value="${o.cantidad == null ? '1' : o.cantidad}"></div>
    <div class="fld"><label for="f-monto">Monto estimado (${esc(CFG.MONEDA)})</label><input id="f-monto" type="number" min="0" step="0.01" value="${o.monto == null ? '' : o.monto}"></div>
    <div class="fld full"><label for="f-info">Información extra</label><input id="f-info" value="${esc(o.info_extra || '')}" placeholder="Accesorios, opciones, etc."></div>
    <div class="fld full"><label for="f-detalle">Detalle concreto de la oportunidad</label><textarea id="f-detalle" rows="3">${esc(o.detalle || '')}</textarea></div>
    <p class="err full" id="f-err" hidden></p></div>`;
}
function cliOptions() {
  return S.clientes.filter(inZona).sort((a, b) => cmp(a.nombre, b.nombre)).map(c => ({ id: c.id, label: c.nombre, sub: multiZona() ? zonaName(c.zona_id) : (c.ciudad || '') }));
}
function openOppForm(id, preset, onDone) {
  const cur = id ? S.opps.find(x => x.id === id) : null;
  const o = cur || Object.assign({}, preset || {});
  if (!cur && !o.estado) { o.estado = 'Presupuestado'; o.probabilidad = 50; }
  const state = { cid: o.cliente_id || null, touchedTrim: !!cur, touchedProb: !!cur };
  const m = openModal({
    title: cur ? 'Editar oportunidad' : 'Nueva oportunidad', sub: cur ? cliName(cur.cliente_id) : '', wide: true,
    body: oppFormHTML(o),
    foot: `${cur ? '<button class="btn danger" data-m="del">Eliminar</button>' : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button>${cur ? '' : '<button class="btn" data-m="save-more">Guardar y agregar otro producto</button>'}<button class="btn pri" data-m="save">Guardar</button>`,
    onOpen: m => {
      comboSetup(m.el, 'f-cli', cliOptions, (opt, typed) => {
        if (opt) { state.cid = opt.id; const c = S.cli.get(opt.id); if (c && c.mercado) mq(m, '#f-mercado').value = c.mercado; }
        else { const hit = cliOptions().find(x => norm(x.label) === norm(typed)); state.cid = hit ? hit.id : null; }
      });
      const pl = () => S.catalogo.filter(c => c.tipo === 'producto').map(p => ({ label: p.valor, sub: [p.marca, p.linea].filter(Boolean).join(' · '), p }));
      comboSetup(m.el, 'f-prod', pl, opt => { if (opt && opt.p) { if (opt.p.marca) mq(m, '#f-marca').value = opt.p.marca; if (opt.p.linea) { const sl = mq(m, '#f-linea'); if (![...sl.options].some(x => x.value === opt.p.linea)) sl.add(new Option(opt.p.linea, opt.p.linea)); sl.value = opt.p.linea; } } });
      comboSetup(m.el, 'f-marca', () => catVals('marca').map(v => ({ label: v })), null);
    },
    onInput: (e, m) => { if (e.target.id === 'f-trim') state.touchedTrim = true; if (e.target.id === 'f-prob') state.touchedProb = true; },
    onChange: (e, m) => {
      if (e.target.id === 'f-trim') state.touchedTrim = true;
      if (e.target.id === 'f-fecha' && !state.touchedTrim) { const v = e.target.value; if (v) { mq(m, '#f-trim').value = 'Q' + (Math.floor((+v.slice(5, 7) - 1) / 3) + 1); mq(m, '#f-anio').value = v.slice(0, 4); } }
      if (e.target.id === 'f-estado' && !state.touchedProb) { const p = { Lead: 30, 'A presupuestar': 30, Presupuestado: 50, Vendido: 100, Perdido: 0, Desestimado: 0, Reemplazado: 0, 'Sin avance': 0 }[e.target.value]; mq(m, '#f-prob').value = p; }
    },
    onAct: async (a, b, m, ev) => {
      if (a === 'newcli') { ev.preventDefault(); return openClienteForm(null, c => { state.cid = c.id; mq(m, '#f-cli').value = c.nombre; if (c.mercado) mq(m, '#f-mercado').value = c.mercado; }); }
      if (a === 'del') return confirmBox('Eliminar oportunidad', '¿Seguro que querés eliminar esta oportunidad? No se puede deshacer.', 'Eliminar', async () => { await DB.remove('oportunidades', cur.id); S.opps = S.opps.filter(x => x.id !== cur.id); closeModal(m); renderMain(); toast('Oportunidad eliminada'); });
      if (a !== 'save' && a !== 'save-more') return;
      const v = id => mq(m, '#' + id).value.trim(), err = t => { const e = mq(m, '#f-err'); e.textContent = t; e.hidden = !t; };
      if (!state.cid) { const hit = cliOptions().find(x => norm(x.label) === norm(v('f-cli'))); if (hit) state.cid = hit.id; }
      if (!state.cid) return err('Elegí un cliente de la lista (o creá uno nuevo).');
      const row = {
        cliente_id: state.cid, fecha: v('f-fecha') || null, canal: v('f-canal') || null, nro_cotizacion: v('f-nro') || null, mercado: v('f-mercado') || null,
        anio_probable: v('f-anio') ? +v('f-anio') : null, trimestre: v('f-trim') || null, probabilidad: v('f-prob') === '' ? null : Math.max(0, Math.min(100, +v('f-prob'))),
        marca: v('f-marca') || null, linea: v('f-linea') || null, producto: v('f-prod') || null, info_extra: v('f-info') || null,
        cantidad: v('f-cant') === '' ? null : +v('f-cant'), monto: v('f-monto') === '' ? null : +v('f-monto'), estado: v('f-estado'), detalle: v('f-detalle') || null
      };
      b.disabled = true;
      try {
        const saved = cur ? await DB.update('oportunidades', cur.id, row) : (await DB.insert('oportunidades', row))[0];
        fixOpp(saved);
        const i = S.opps.findIndex(x => x.id === saved.id); if (i >= 0) S.opps[i] = saved; else S.opps.push(saved);
        await addToCatalog(row);
        toast(cur ? 'Cambios guardados' : 'Oportunidad guardada');
        if (a === 'save-more') {
          ['f-prod', 'f-marca', 'f-info', 'f-monto'].forEach(id => mq(m, '#' + id).value = ''); mq(m, '#f-cant').value = '1'; mq(m, '#f-linea').value = ''; mq(m, '#f-prod').focus(); b.disabled = false; err('');
        } else closeModal(m);
        renderMain();
      } catch (e) { b.disabled = false; err(errMsg(e)); }
    }
  });
}
async function addToCatalog(row) {
  const add = [];
  if (row.marca && !S.catalogo.some(c => c.tipo === 'marca' && c.valor === row.marca)) add.push({ tipo: 'marca', valor: row.marca });
  if (row.producto && !S.catalogo.some(c => c.tipo === 'producto' && c.valor === row.producto)) add.push({ tipo: 'producto', valor: row.producto, marca: row.marca, linea: row.linea });
  if (!add.length) return;
  try { S.catalogo.push(...await DB.insert('catalogo', add)); } catch (e) { /* no es crítico */ }
}

/* ---------- CLIENTES ---------- */
function cliRows() {
  const f = F('cli'), q = norm(f.q || '');
  return S.clientes.filter(inZona).filter(c => {
    if (f.mercado && c.mercado !== f.mercado) return false;
    if (f.categoria && (c.categoria || '-') !== f.categoria) return false;
    if (f.provincia && c.provincia !== f.provincia) return false;
    if (q && !norm([c.nombre, c.contacto, c.ciudad, c.provincia, c.email, c.telefono, c.area].join(' ')).includes(q)) return false;
    return true;
  });
}
function cliCols() {
  const c = [{ k: 'nombre', l: 'Cliente', get: c => c.nombre }];
  if (multiZona()) c.push({ k: 'zona', l: 'Zona', get: c => zonaName(c.zona_id) });
  c.push(
    { k: 'mercado', l: 'Mercado', get: c => mercadoTxt(c.mercado) },
    { k: 'cat', l: 'Categ.', get: c => c.categoria || '' },
    { k: 'prov', l: 'Provincia', get: c => c.provincia || '' },
    { k: 'ciudad', l: 'Ciudad', get: c => c.ciudad || '' },
    { k: 'contacto', l: 'Contacto', get: c => c.contacto || '' },
    { k: 'area', l: 'Área', get: c => c.area || '' },
    { k: 'tel', l: 'Teléfono', get: c => c.telefono || '' },
    { k: 'email', l: 'E-mail', get: c => c.email || '' },
    { k: 'ult', l: 'Última visita', get: c => (segInfo(c).last || ''), show: c => fmtDate(segInfo(c).last) },
    { k: 'prox', l: 'Próxima visita', get: c => segInfo(c).due || '', show: c => { const s = segInfo(c); return s.t === 'none' ? '' : `<span class="pill ${s.t === 'never' ? 'late' : s.t}">${esc(s.t === 'never' ? 'Sin primera visita' : fmtDate(s.due))}</span>`; } }
  );
  return c;
}
function vClientes() {
  const f = F('cli'), all = S.clientes.filter(inZona);
  const provs = [...new Set(all.map(c => c.provincia).filter(Boolean))].sort(cmp);
  return `<div class="tools"><input class="q" id="q-cli" data-q="cli" type="search" placeholder="Buscar cliente, contacto, ciudad…" value="${esc(f.q || '')}" aria-label="Buscar"><span class="grow"></span>
    <button class="btn" data-a="exp-cli">Exportar Excel</button><button class="btn pri" data-a="cli-new">+ Nuevo cliente</button></div>
    <div class="tools"><select data-f="cli.mercado" aria-label="Mercado">${optSel(Object.entries(MERCADOS), f.mercado, 'Mercado')}</select>
      <select data-f="cli.categoria" aria-label="Categoría">${optSel([['A', 'Categoría A'], ['B', 'Categoría B'], ['C', 'Categoría C'], ['D', 'Categoría D'], ['-', 'Sin categoría']], f.categoria, 'Categoría')}</select>
      <select data-f="cli.provincia" aria-label="Provincia">${optSel(provs, f.provincia, 'Provincia')}</select>
      ${f.q || f.mercado || f.categoria || f.provincia ? '<button class="btn sm" data-a="clear-cli">Quitar filtros</button>' : ''}</div>${cliResult()}`;
}
function cliResult() {
  const rows = cliRows();
  if (!rows.length) return `<div class="card"><div class="empty">${S.clientes.length ? 'Ningún cliente coincide.' : 'Todavía no cargaste clientes. Importá tu Excel o creá el primero.'}</div></div>`;
  if (isMobile()) {
    const s = rows.slice().sort((a, b) => cmp(a.nombre, b.nombre)).slice(0, S.ui.lim.clim || 60);
    return `<p class="hint" style="margin-bottom:8px">${num(rows.length)} clientes</p><div class="cards">${s.map(c => { const sg = segInfo(c); return `<button class="rc" data-a="cli" data-id="${c.id}"><div class="t">${esc(c.nombre)}</div><div class="r"><span>${esc([c.ciudad, c.provincia].filter(Boolean).join(', ') || '—')}</span>${c.categoria ? `<span class="pill mk">Cat. ${c.categoria}</span>` : ''}</div><div class="r"><span>${esc(c.contacto || c.telefono || '')}</span><span class="pill ${sg.t === 'never' ? 'late' : sg.t}">${esc(segLabel(sg))}</span></div></button>`; }).join('')}</div>${rows.length > s.length ? '<button class="btn more" data-more="clim">Mostrar más</button>' : ''}`;
  }
  return gridHTML('cli', cliCols(), rows, { sortK: 'nombre', sortD: 1, act: 'cli', foot: (c, i, r) => i === 0 ? num(r.length) + ' clientes' : '' }).html;
}

function openClienteForm(id, onDone) {
  const cur = id ? S.cli.get(id) : null, c = cur || {};
  const zs = S.zonas.filter(z => S.myZonas.includes(z.id));
  const zdef = c.zona_id || (S.zonaSel !== 'todas' ? S.zonaSel : (zs[0] && zs[0].id));
  const provs = [...new Set(S.clientes.map(x => x.provincia).filter(Boolean))].sort(cmp), ciudades = [...new Set(S.clientes.map(x => x.ciudad).filter(Boolean))].sort(cmp);
  const m = openModal({
    title: cur ? 'Editar cliente' : 'Nuevo cliente', sub: cur ? '' : '', wide: true,
    body: `<div class="form">
      <div class="fld full"><label for="c-nombre">Cliente / institución</label><input id="c-nombre" value="${esc(c.nombre || '')}"></div>
      <div class="fld"><label for="c-zona">Zona</label><select id="c-zona">${zs.map(z => `<option value="${z.id}"${z.id === zdef ? ' selected' : ''}>${esc(z.nombre)}</option>`).join('')}</select></div>
      <div class="fld"><label for="c-mercado">Mercado</label><select id="c-mercado">${optSel(Object.entries(MERCADOS), c.mercado || '', '—')}</select></div>
      <div class="fld"><label for="c-cat">Categoría de visitas</label><select id="c-cat">${optSel(Object.entries(CATEG), c.categoria || '', 'Sin categoría')}</select></div>
      <div class="fld"><label for="c-contacto">Contacto</label><input id="c-contacto" value="${esc(c.contacto || '')}"></div>
      <div class="fld"><label for="c-tel">Teléfono</label><input id="c-tel" type="tel" value="${esc(c.telefono || '')}"></div>
      <div class="fld"><label for="c-email">E-mail</label><input id="c-email" type="email" value="${esc(c.email || '')}"></div>
      ${comboHTML('c-area', 'Área / servicio', c.area || '', 'UTI, Cirugía…')}
      <div class="fld full"><label for="c-dir">Dirección</label><input id="c-dir" value="${esc(c.direccion || '')}"></div>
      <div class="fld"><label for="c-prov">Provincia</label><input id="c-prov" list="dl-prov" value="${esc(c.provincia || '')}"><datalist id="dl-prov">${provs.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="fld"><label for="c-ciudad">Ciudad</label><input id="c-ciudad" list="dl-ciu" value="${esc(c.ciudad || '')}"><datalist id="dl-ciu">${ciudades.map(p => `<option value="${esc(p)}">`).join('')}</datalist></div>
      <div class="fld full"><label for="c-notas">Notas</label><textarea id="c-notas" rows="3">${esc(c.notas || '')}</textarea></div>
      <p class="err full" id="f-err" hidden></p></div>`,
    foot: `${cur && S.me.rol === 'admin' ? '<button class="btn danger" data-m="del">Eliminar</button>' : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn pri" data-m="save">Guardar</button>`,
    onOpen: m => comboSetup(m.el, 'c-area', () => catVals('area').map(v => ({ label: v })), null),
    onAct: async (a, b, m) => {
      if (a === 'del') return confirmBox('Eliminar cliente', 'Se elimina el cliente y su historial de visitas. Si tiene oportunidades cargadas no se podrá borrar.', 'Eliminar', async () => { await DB.remove('clientes', cur.id); S.clientes = S.clientes.filter(x => x.id !== cur.id); delete S.seg[cur.id]; reindex(); closeAllModals(); renderMain(); toast('Cliente eliminado'); });
      if (a !== 'save') return;
      const v = id => mq(m, '#' + id).value.trim(), err = t => { const e = mq(m, '#f-err'); e.textContent = t; e.hidden = !t; };
      if (!v('c-nombre')) return err('Escribí el nombre del cliente.');
      if (!v('c-zona')) return err('Elegí una zona.');
      const row = { nombre: v('c-nombre'), zona_id: +v('c-zona'), mercado: v('c-mercado') || null, categoria: v('c-cat') || null, contacto: v('c-contacto') || null, telefono: v('c-tel') || null, email: v('c-email') || null, area: v('c-area') || null, direccion: v('c-dir') || null, provincia: v('c-prov') || null, ciudad: v('c-ciudad') || null, notas: v('c-notas') || null };
      b.disabled = true;
      try {
        const saved = cur ? await DB.update('clientes', cur.id, row) : (await DB.insert('clientes', row))[0];
        const i = S.clientes.findIndex(x => x.id === saved.id); if (i >= 0) S.clientes[i] = saved; else S.clientes.push(saved);
        if (cur && cur.zona_id !== saved.zona_id) { S.opps.forEach(o => { if (o.cliente_id === saved.id) o.zona_id = saved.zona_id; }); }
        if (!S.seg[saved.id]) S.seg[saved.id] = { cliente_id: saved.id, visitas: 0, ultima_visita: null, proxima_manual: saved.proxima_visita || null };
        reindex();
        if (row.area && !S.catalogo.some(x => x.tipo === 'area' && x.valor === row.area)) { try { S.catalogo.push(...await DB.insert('catalogo', { tipo: 'area', valor: row.area })); } catch (e) { } }
        closeModal(m); renderMain(); toast(cur ? 'Cambios guardados' : 'Cliente creado');
        if (onDone) onDone(saved);
        else if (MODALS.length) refreshFicha();
      } catch (e) { b.disabled = false; err(errMsg(e)); }
    }
  });
}

/* ---------- Ficha de cliente ---------- */
let fichaM = null;
async function openFicha(id) {
  const m = openModal({ title: 'Cliente', body: '<div class="spin"><i></i></div>', wide: true, onClose: () => { if (fichaM === m) fichaM = null; }, onAct: (a, b, mm) => fichaAct(a, b, id) });
  fichaM = m; m.cid = id; await refreshFicha();
}
async function refreshFicha() {
  const m = fichaM; if (!m || !m.el.isConnected) return;
  const c = S.cli.get(m.cid); if (!c) return closeModal(m);
  let vs = []; try { vs = await DB.visitasDe(c.id); } catch (e) { toast(errMsg(e), true); }
  m.visitas = vs; segFrom(c.id, vs);
  const sg = segInfo(c), os = S.opps.filter(o => o.cliente_id === c.id).sort((a, b) => cmp(b.fecha, a.fecha));
  const mv = v => v ? esc(v) : '<span class="hint">—</span>';
  $('.md-h h2', m.el).textContent = c.nombre; $('.md-h', m.el).querySelector('div').innerHTML = `<h2>${esc(c.nombre)}</h2><p>${esc(zonaName(c.zona_id))}${c.mercado ? ' · ' + mercadoTxt(c.mercado) : ''}${c.categoria ? ' · Categoría ' + c.categoria : ''}</p>`;
  $('.md-b', m.el).innerHTML = `
    <div class="grid2" style="margin-bottom:0"><dl class="dl"><dt>Contacto</dt><dd>${mv(c.contacto)}</dd><dt>Área</dt><dd>${mv(c.area)}</dd><dt>Teléfono</dt><dd>${c.telefono ? `<a href="tel:${esc(c.telefono)}">${esc(c.telefono)}</a>` : mv('')}</dd><dt>E-mail</dt><dd>${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : mv('')}</dd></dl>
    <dl class="dl"><dt>Dirección</dt><dd>${mv([c.direccion, c.ciudad, c.provincia].filter(Boolean).join(', '))}</dd><dt>Última visita</dt><dd>${mv(fmtDate(sg.last))}</dd><dt>Próxima visita</dt><dd>${sg.due ? fmtDate(sg.due) + (sg.manual ? ' <span class="hint">· fijada a mano</span>' : '') : (sg.t === 'never' ? 'Pendiente de primera visita' : '<span class="hint">Asigná una categoría para activar el seguimiento</span>')} ${sg.t !== 'none' ? `<span class="pill ${sg.t === 'never' ? 'late' : sg.t}">${esc(segLabel(sg))}</span>` : ''}</dd></dl></div>
    ${c.notas ? `<p class="hint" style="margin-top:10px;white-space:pre-wrap">${esc(c.notas)}</p>` : ''}
    <div class="sub-h"><span>Visitas (${vs.length})</span><span style="display:flex;gap:8px"><button class="btn sm" data-m="resched">Reprogramar</button><button class="btn sm pri" data-m="visita">+ Registrar visita</button></span></div>
    ${vs.length ? `<div class="li">${vs.map(v => `<div><div class="m"><span><b>${fmtDate(v.fecha)}</b>${v.tipo ? ' · ' + esc(v.tipo) : ''}${v.editado ? ' · editada' : ''}</span><span style="display:flex;gap:14px"><button class="lnk" data-m="vedit" data-id="${v.id}">Editar</button><button class="lnk d" data-m="vdel" data-id="${v.id}">Eliminar</button></span></div><div class="tx">${esc(v.detalle || 'Sin comentarios')}</div>${v.proximo_paso ? `<div class="hint" style="margin-top:4px"><b>Próximo paso:</b> ${esc(v.proximo_paso)}</div>` : ''}</div>`).join('')}</div>` : '<p class="hint">Todavía no hay visitas registradas.</p>'}
    <div class="sub-h"><span>Oportunidades (${os.length})</span><button class="btn sm" data-m="opp-new">+ Nueva oportunidad</button></div>
    ${os.length ? `<div class="li">${os.map(o => `<div style="cursor:pointer" data-m="opp" data-id="${o.id}"><div class="m"><span>${fmtDate(o.fecha)} · ${esc(o.trimestre || '')}${o.nro_cotizacion ? ' · Cot. ' + esc(o.nro_cotizacion) : ''}</span>${estadoPill(o.estado)}</div><div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(o.producto || o.linea || 'Sin producto')}${o.cantidad > 1 ? ' ×' + num(o.cantidad) : ''} <span class="hint">${esc(o.marca || '')}</span></span><b class="num">${o.monto == null ? '' : money(o.monto)}</b></div></div>`).join('')}</div>` : '<p class="hint">Sin oportunidades.</p>'}`;
  $('.md-f', m.el)?.remove();
  const f = document.createElement('div'); f.className = 'md-f'; f.innerHTML = '<span class="grow"></span><button class="btn" data-m="edit">Editar datos</button><button class="btn pri" data-close>Cerrar</button>'; $('.md', m.el).appendChild(f);
}
function segFrom(cid, vs) {
  const c = S.cli.get(cid);
  S.seg[cid] = { cliente_id: cid, visitas: vs.length, ultima_visita: vs.length ? vs.map(v => v.fecha).sort().pop() : null, proxima_manual: c ? c.proxima_visita || null : null };
}
function fichaAct(a, b, cid) {
  const c = S.cli.get(cid);
  if (a === 'edit') return openClienteForm(cid);
  if (a === 'visita') return openVisitaForm(cid);
  if (a === 'resched') return openReprogForm(cid);
  if (a === 'opp-new') return openOppForm(null, { cliente_id: cid, mercado: c && c.mercado }, () => refreshFicha());
  if (a === 'opp') return openOppForm(b.dataset.id);
  if (a === 'vedit') return openVisitaForm(cid, fichaM.visitas.find(v => v.id === b.dataset.id));
  if (a === 'vdel') return confirmBox('Eliminar visita', '¿Eliminar esta visita del historial?', 'Eliminar', async () => { await DB.remove('visitas', b.dataset.id); await refreshFicha(); renderMain(); toast('Visita eliminada'); });
}
function refreshFichaSoon() { if (fichaM) refreshFicha(); renderMain(); }

/* ---------- Visitas ---------- */
function defNext(c, fecha) { const mm = CAT_MESES[c.categoria]; return mm && fecha ? addMonths(fecha, mm) : ''; }
function openVisitaForm(cid, cur) {
  const c = S.cli.get(cid), touched = { v: false };
  const hasDef = !!CAT_MESES[c.categoria];
  const m = openModal({
    title: cur ? 'Editar visita' : 'Registrar visita', sub: c.nombre,
    body: `<div class="form"><div class="fld"><label for="v-fecha">Fecha de la visita</label><input id="v-fecha" type="date" value="${esc(cur ? cur.fecha : TODAY)}"></div>
      <div class="fld"><label for="v-tipo">Tipo</label><select id="v-tipo">${optSel(VTIPOS, cur ? cur.tipo : 'Presencial', '—')}</select></div>
      <div class="fld full"><label for="v-det">Qué se habló</label><textarea id="v-det" rows="4" placeholder="Resumen de la visita…">${esc(cur ? cur.detalle || '' : '')}</textarea></div>
      <div class="fld full"><label for="v-paso">Próximo paso</label><input id="v-paso" value="${esc(cur ? cur.proximo_paso || '' : '')}" placeholder="Ej.: enviar cotización de monitores"></div>
      ${cur ? '' : `<div class="fld full"><label for="v-prox">Próxima visita</label><input id="v-prox" type="date" value="${esc(c.proxima_visita || defNext(c, TODAY))}"><span class="hint" id="v-hint">${hasDef ? 'Sugerida según la categoría ' + c.categoria + '. Podés cambiarla.' : 'Opcional. Asigná una categoría al cliente para que se calcule sola.'}</span></div>`}
      <p class="err full" id="f-err" hidden></p></div>`,
    foot: `<button class="btn" data-close>Cancelar</button><button class="btn pri" data-m="save">Guardar</button>`,
    onInput: (e, m) => { if (e.target.id === 'v-prox') touched.v = true; },
    onChange: (e, m) => { if (e.target.id === 'v-fecha' && !cur && !touched.v && !c.proxima_visita) { const p = mq(m, '#v-prox'); if (p) p.value = defNext(c, e.target.value); } },
    onAct: async (a, b, m) => {
      if (a !== 'save') return;
      const v = id => (mq(m, '#' + id) || { value: '' }).value.trim(), err = t => { const e = mq(m, '#f-err'); e.textContent = t; e.hidden = !t; };
      if (!v('v-fecha')) return err('Indicá la fecha de la visita.');
      const row = { cliente_id: cid, fecha: v('v-fecha'), tipo: v('v-tipo') || null, detalle: v('v-det') || null, proximo_paso: v('v-paso') || null };
      if (cur) row.editado = new Date().toISOString();
      const px = v('v-prox');
      if (!cur && px && px <= row.fecha) return err('La próxima visita debe ser posterior a esta visita.');
      b.disabled = true;
      try {
        if (cur) await DB.update('visitas', cur.id, row); else await DB.insert('visitas', row);
        if (!cur) {
          const last = (S.seg[cid] || {}).ultima_visita, isLatest = !last || row.fecha >= last;
          if (isLatest) {
            const manual = px && px !== defNext(c, row.fecha) ? px : null;
            if ((c.proxima_visita || null) !== manual) { const sv = await DB.update('clientes', cid, { proxima_visita: manual }); Object.assign(c, sv); }
          }
        }
        closeModal(m); toast(cur ? 'Visita actualizada' : 'Visita registrada');
        if (fichaM) await refreshFicha(); else { segFrom(cid, await DB.visitasDe(cid)); }
        renderMain();
      } catch (e) { b.disabled = false; err(errMsg(e)); }
    }
  });
}
function openReprogForm(cid) {
  const c = S.cli.get(cid), sg = segInfo(c);
  openModal({
    title: 'Reprogramar próxima visita', sub: c.nombre,
    body: `<div class="form"><div class="fld full"><label for="r-fecha">Fecha de la próxima visita</label><input id="r-fecha" type="date" value="${esc(sg.due || '')}"></div>
      <p class="hint full">${CAT_MESES[c.categoria] ? `Por la categoría ${c.categoria}, se calcularía el ${fmtDate(sg.last ? addMonths(sg.last, CAT_MESES[c.categoria]) : '') || 'día de la primera visita'}.` : 'Este cliente no tiene categoría: solo se avisa si fijás una fecha.'}</p><p class="err full" id="f-err" hidden></p></div>`,
    foot: `${c.proxima_visita ? '<button class="btn" data-m="auto">Usar la de la categoría</button>' : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn pri" data-m="save">Guardar fecha</button>`,
    onAct: async (a, b, m) => {
      if (a !== 'save' && a !== 'auto') return;
      const val = a === 'auto' ? null : mq(m, '#r-fecha').value;
      if (a === 'save' && !val) { const e = mq(m, '#f-err'); e.textContent = 'Elegí una fecha.'; e.hidden = false; return; }
      b.disabled = true;
      try { const sv = await DB.update('clientes', cid, { proxima_visita: val }); Object.assign(c, sv); S.seg[cid] = Object.assign(S.seg[cid] || { cliente_id: cid }, { proxima_manual: val }); closeModal(m); toast('Fecha actualizada'); if (fichaM) await refreshFicha(); renderMain(); }
      catch (e) { b.disabled = false; toast(errMsg(e), true); }
    }
  });
}

/* ---------- SEGUIMIENTO ---------- */
function vSeg() {
  const f = F('seg'); f.st = f.st || 'pendientes';
  const q = norm(f.q || '');
  const all = S.clientes.filter(inZona).filter(c => (!f.cat || (c.categoria || '-') === f.cat) && (!q || norm([c.nombre, c.contacto, c.ciudad].join(' ')).includes(q))).map(c => ({ c, s: segInfo(c), id: c.id }));
  const P = { pendientes: x => segPending(x.s), proximas: x => x.s.t === 'soon', aldia: x => x.s.t === 'ok', sin: x => x.s.t === 'none' };
  const L = { pendientes: 'Pendientes', proximas: 'Próximas (7 días)', aldia: 'Al día', sin: 'Sin seguimiento' };
  const rows = all.filter(P[f.st]).sort((a, b) => a.s.key - b.s.key || cmp(a.c.nombre, b.c.nombre));
  const cols = [
    { k: 'nombre', l: 'Cliente', get: x => x.c.nombre }
  ].concat(multiZona() ? [{ k: 'zona', l: 'Zona', get: x => zonaName(x.c.zona_id) }] : []).concat([
    { k: 'cat', l: 'Categ.', get: x => x.c.categoria || '' },
    { k: 'contacto', l: 'Contacto', get: x => x.c.contacto || '' },
    { k: 'tel', l: 'Teléfono', get: x => x.c.telefono || '' },
    { k: 'ult', l: 'Última visita', get: x => x.s.last || '', show: x => fmtDate(x.s.last) },
    { k: 'prox', l: 'Próxima visita', get: x => x.s.due || '', show: x => fmtDate(x.s.due) + (x.s.manual ? ' ✎' : '') },
    { k: 'est', l: 'Estado', get: x => x.s.key, show: x => `<span class="pill ${x.s.t === 'never' ? 'late' : x.s.t}">${esc(segLabel(x.s))}</span>` },
    { k: 'acc', l: 'Acción', get: x => '', show: x => `<button class="btn sm" data-a="visita" data-id="${x.c.id}">Registrar visita</button>` }
  ]);
  let res;
  if (!rows.length) res = `<div class="card"><div class="empty">${f.st === 'pendientes' ? 'No hay visitas pendientes. 🎉' : 'No hay clientes en esta categoría.'}${f.st === 'sin' || !S.clientes.length ? '' : ''}</div></div>`;
  else if (isMobile()) res = `<div class="cards">${rows.slice(0, S.ui.lim.segm || 60).map(x => `<div class="rc"><button style="text-align:left;width:100%" data-a="cli" data-id="${x.c.id}"><div class="t">${esc(x.c.nombre)}</div><div class="r"><span>${esc(x.c.contacto || x.c.ciudad || '')}</span><span class="pill ${x.s.t === 'never' ? 'late' : x.s.t}">${esc(segLabel(x.s))}</span></div></button><button class="btn sm" style="margin-top:8px" data-a="visita" data-id="${x.c.id}">Registrar visita</button></div>`).join('')}</div>${rows.length > (S.ui.lim.segm || 60) ? '<button class="btn more" data-more="segm">Mostrar más</button>' : ''}`;
  else res = gridHTML('seg', cols, rows, { sortK: 'est', sortD: 1, act: 'cli' }).html;
  return `<div class="tools"><input class="q" id="q-seg" data-q="seg" type="search" placeholder="Buscar cliente…" value="${esc(f.q || '')}" aria-label="Buscar"><select data-f="seg.cat" aria-label="Categoría">${optSel([['A', 'Categoría A'], ['B', 'Categoría B'], ['C', 'Categoría C'], ['-', 'Sin categoría']], f.cat, 'Todas las categorías')}</select></div>
    <div class="tools"><div class="chips">${Object.keys(P).map(k => `<button class="chip" data-a="seg-st" data-v="${k}" aria-pressed="${f.st === k}">${L[k]}<small>${all.filter(P[k]).length}</small></button>`).join('')}</div></div>
    <p class="hint" style="margin-bottom:10px">Frecuencia por categoría: <b>A</b> 12 visitas/año (mensual) · <b>B</b> 6 (bimestral) · <b>C</b> 2 (semestral). Un ✎ indica fecha fijada a mano.</p>${res}`;
}

/* ---------- CATÁLOGO ---------- */
function vCatalogo() {
  const f = F('cat'); f.t = f.t || 'marca';
  const T = { marca: 'Marcas', linea: 'Líneas', producto: 'Productos', area: 'Áreas' };
  const q = norm(f.q || ''), admin = S.me.rol === 'admin';
  const rows = S.catalogo.filter(c => c.tipo === f.t && (!q || norm(c.valor + ' ' + (c.marca || '')).includes(q))).sort((a, b) => cmp(a.valor, b.valor));
  const cols = [{ k: 'valor', l: T[f.t].slice(0, -1) === 'Marca' ? 'Marca' : T[f.t], get: c => c.valor }];
  if (f.t === 'producto') cols.push({ k: 'marca', l: 'Marca', get: c => c.marca || '' }, { k: 'linea', l: 'Línea', get: c => c.linea || '' });
  return `<div class="tools"><div class="seg">${Object.entries(T).map(([k, v]) => `<button data-a="cat-t" data-v="${k}" aria-pressed="${f.t === k}">${v}</button>`).join('')}</div><input class="q" id="q-cat" data-q="cat" type="search" placeholder="Buscar…" value="${esc(f.q || '')}" aria-label="Buscar"><span class="grow"></span><button class="btn pri" data-a="cat-new">+ Agregar</button></div>
  <p class="hint" style="margin-bottom:10px">Estas listas alimentan los desplegables al cargar oportunidades. ${admin ? 'Tocá una fila para editarla o eliminarla.' : 'Solo el administrador puede editar o eliminar.'} Las marcas y productos nuevos que escribas en una oportunidad se agregan solos.</p>
  ${rows.length ? gridHTML('cat', cols, rows, { sortK: 'valor', act: 'cat-edit', foot: (c, i, r) => i === 0 ? num(r.length) + ' registros' : '' }).html : '<div class="card"><div class="empty">Sin registros.</div></div>'}`;
}
function openCatForm(id) {
  const f = F('cat'), cur = id ? S.catalogo.find(c => c.id == id) : null, tipo = cur ? cur.tipo : f.t;
  const admin = S.me.rol === 'admin';
  if (cur && !admin) return toast('Solo el administrador puede editar el catálogo.', true);
  const lineas = catVals('linea'), marcas = catVals('marca');
  openModal({
    title: (cur ? 'Editar ' : 'Agregar ') + { marca: 'marca', linea: 'línea', producto: 'producto', area: 'área' }[tipo],
    body: `<div class="form"><div class="fld full"><label for="k-v">Nombre</label><input id="k-v" value="${esc(cur ? cur.valor : '')}"></div>${tipo === 'producto' ? `<div class="fld"><label for="k-m">Marca</label><select id="k-m">${optSel(marcas, cur ? cur.marca : '', '—')}</select></div><div class="fld"><label for="k-l">Línea</label><select id="k-l">${optSel(lineas, cur ? cur.linea : '', '—')}</select></div>` : ''}<p class="err full" id="f-err" hidden></p></div>`,
    foot: `${cur ? '<button class="btn danger" data-m="del">Eliminar</button>' : ''}<span class="grow"></span><button class="btn" data-close>Cancelar</button><button class="btn pri" data-m="save">Guardar</button>`,
    onAct: async (a, b, m) => {
      if (a === 'del') return confirmBox('Eliminar', 'Se quita de las listas desplegables. Las oportunidades ya cargadas no cambian.', 'Eliminar', async () => { await DB.remove('catalogo', cur.id); S.catalogo = S.catalogo.filter(x => x.id !== cur.id); closeModal(m); renderMain(); });
      if (a !== 'save') return;
      const val = mq(m, '#k-v').value.trim(); if (!val) { const e = mq(m, '#f-err'); e.textContent = 'Escribí un nombre.'; e.hidden = false; return; }
      const row = { tipo, valor: val }; if (tipo === 'producto') { row.marca = mq(m, '#k-m').value || null; row.linea = mq(m, '#k-l').value || null; }
      b.disabled = true;
      try { const sv = cur ? await DB.update('catalogo', cur.id, row) : (await DB.insert('catalogo', row))[0]; const i = S.catalogo.findIndex(x => x.id === sv.id); if (i >= 0) S.catalogo[i] = sv; else S.catalogo.push(sv); closeModal(m); renderMain(); toast('Guardado'); }
      catch (e) { b.disabled = false; const er = mq(m, '#f-err'); er.textContent = errMsg(e); er.hidden = false; }
    }
  });
}

/* ---------- USUARIOS (admin) ---------- */
async function vUsuarios() {
  if (S.demo) return `<div class="card"><div class="empty">La gestión de usuarios está disponible cuando la app está conectada a Supabase.</div></div>`;
  S.perfiles = await sbAll('perfiles', { order: 'creado' }); S.pzonas = await sbAll('perfil_zonas', { order: 'zona_id' });
  return `<p class="hint" style="margin-bottom:12px">Para <b>crear un usuario nuevo</b>: en Supabase → <i>Authentication → Users → Add user</i> (correo y contraseña). Después aparece acá y le asignás rol y zonas. Los <b>administradores</b> ven todas las zonas; los <b>vendedores</b> solo las que tengan tildadas.</p>
  <div class="tw"><table class="grid"><thead><tr><th><button>Usuario</button></th><th><button>Rol</button></th><th><button>Activo</button></th>${S.zonas.map(z => `<th><button>${esc(z.nombre)}</button></th>`).join('')}</tr></thead><tbody>
  ${S.perfiles.map(p => `<tr><td>${esc(p.nombre || '')}<br><span class="hint">${esc(p.email || '')}</span></td>
    <td><select data-u="rol" data-id="${p.id}" style="min-width:120px"><option value="vendedor"${p.rol === 'vendedor' ? ' selected' : ''}>Vendedor</option><option value="admin"${p.rol === 'admin' ? ' selected' : ''}>Administrador</option></select></td>
    <td><input type="checkbox" data-u="activo" data-id="${p.id}" ${p.activo ? 'checked' : ''} ${p.id === S.me.id ? 'disabled' : ''} style="width:20px;min-height:20px" aria-label="Activo"></td>
    ${S.zonas.map(z => `<td style="text-align:center"><input type="checkbox" data-u="zona" data-id="${p.id}" data-z="${z.id}" ${S.pzonas.some(x => x.user_id === p.id && x.zona_id === z.id) ? 'checked' : ''} ${p.rol === 'admin' ? 'disabled title="Los administradores ven todas las zonas"' : ''} style="width:20px;min-height:20px" aria-label="${esc(z.nombre)}"></td>`).join('')}</tr>`).join('')}
  </tbody></table></div>`;
}
async function usuarioChange(el) {
  const id = el.dataset.id, k = el.dataset.u;
  try {
    if (k === 'rol') { const { error } = await sb.from('perfiles').update({ rol: el.value }).eq('id', id); if (error) throw error; }
    if (k === 'activo') { const { error } = await sb.from('perfiles').update({ activo: el.checked }).eq('id', id); if (error) throw error; }
    if (k === 'zona') {
      const z = +el.dataset.z;
      if (el.checked) { const { error } = await sb.from('perfil_zonas').insert({ user_id: id, zona_id: z }); if (error) throw error; }
      else { const { error } = await sb.from('perfil_zonas').delete().eq('user_id', id).eq('zona_id', z); if (error) throw error; }
    }
    toast('Guardado'); if (k === 'rol') renderMain();
  } catch (e) { toast(errMsg(e), true); el.checked = !el.checked; }
}

/* ---------- IMPORTAR / EXPORTAR ---------- */
function vImportar() {
  const zs = S.zonas.filter(z => S.myZonas.includes(z.id));
  return `<div class="grid2"><div class="card"><div class="ch"><h2>Importar desde Excel</h2></div><div class="cb">
    <p class="hint" style="margin-bottom:12px">Subí el archivo de tu zona (el mismo que usabas: hojas <b>OPORTUNIDADES</b> y <b>CLIENTES</b>). Primero te muestro un resumen y recién después se carga. Lo que ya existe no se duplica.</p>
    <div class="fld" style="margin-bottom:12px"><label for="imp-zona">Zona de destino</label><select id="imp-zona">${zs.map(z => `<option value="${z.id}"${(S.zonaSel === z.id) ? ' selected' : ''}>${esc(z.nombre)}</option>`).join('')}</select></div>
    <div class="drop"><input id="imp-file" type="file" accept=".xlsx,.xlsm,.xls,.csv" aria-label="Archivo de Excel"></div><div id="imp-out" style="margin-top:14px"></div></div></div>
  <div class="card"><div class="ch"><h2>Exportar a Excel</h2></div><div class="cb"><p class="hint" style="margin-bottom:14px">Descargá los datos de ${S.zonaSel === 'todas' ? 'todas tus zonas' : esc(zonaName(S.zonaSel))} con el mismo formato de columnas que tu planilla.</p>
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn pri" data-a="exp-all">Todo (oportunidades + clientes)</button><button class="btn" data-a="exp-opp">Solo oportunidades</button><button class="btn" data-a="exp-cli">Solo clientes</button></div></div></div></div>`;
}
const OPP_HEAD = ['Fecha', 'Canal', 'Nº Cotización', 'Nombre del Cliente', 'MERCADO', 'Fecha probable', 'Trimestre', 'Probabilidad', 'Marca', 'Línea', 'Productos', 'Información extra', 'Cantidad', 'Monto estimado', 'Estado', 'Detalle concreto de la oportunidad', 'Zona'];
const CLI_HEAD = ['ZONA', 'CLIENTE', 'Mercado', 'Dirección', 'Provincia', 'Ciudad', 'CONTACTO', 'AREA', 'TELEFONO', 'E-MAIL', 'CATEGORIA', 'Última visita', 'Próxima visita', 'Notas'];
const oppExportRows = rows => rows.map(o => [o.fecha ? fmtDate(o.fecha) : '', o.canal || '', o.nro_cotizacion || '', cliName(o.cliente_id), (mercadoTxt(o.mercado) || '').toUpperCase(), o.anio_probable || '', o.trimestre || '', o.probabilidad == null ? '' : o.probabilidad, o.marca || '', o.linea || '', o.producto || '', o.info_extra || '', o.cantidad == null ? '' : o.cantidad, o.monto == null ? '' : o.monto, o.estado, o.detalle || '', zonaName(o.zona_id)]);
const cliExportRows = rows => rows.map(c => { const s = segInfo(c); return [zonaName(c.zona_id), c.nombre, mercadoTxt(c.mercado), c.direccion || '', c.provincia || '', c.ciudad || '', c.contacto || '', c.area || '', c.telefono || '', c.email || '', c.categoria || '', s.last ? fmtDate(s.last) : '', s.due ? fmtDate(s.due) : '', c.notas || '']; });
async function doExport(kind) {
  try {
    const stamp = TODAY, sheets = [];
    if (kind === 'opp' || kind === 'all') sheets.push({ name: 'OPORTUNIDADES', head: OPP_HEAD, rows: oppExportRows(kind === 'opp' && S.tab === 'oportunidades' ? oppRows() : S.opps.filter(inZona)) });
    if (kind === 'cli' || kind === 'all') sheets.push({ name: 'CLIENTES', head: CLI_HEAD, rows: cliExportRows(kind === 'cli' && S.tab === 'clientes' ? cliRows() : S.clientes.filter(inZona)) });
    await downloadXLSX('crm-' + (kind === 'all' ? 'datos' : kind === 'opp' ? 'oportunidades' : 'clientes') + '-' + stamp + '.xlsx', sheets);
    toast('Archivo descargado');
  } catch (e) { toast(errMsg(e), true); }
}
