/* =====================  IMPORTADOR DE EXCEL  ===================== */
const IMP = { plan: null, busy: false };

const serialISO = n => { const d = new Date(Math.round((n - 25569) * 864e5)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
function cellDate(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return isoOf(v);
  if (typeof v === 'number') return v > 20000 && v < 80000 ? serialISO(v) : null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m) return m[1] + '-' + pad(m[2]) + '-' + pad(m[3]);
  m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return y + '-' + pad(m[2]) + '-' + pad(m[1]); }
  return null;
}
function cellNum(v) {
  if (v == null || v === '') return null;
  if (typeof v === 'number') return v;
  let s = String(v).replace(/[^\d.,-]/g, ''); if (!s) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  if (lc >= 0 && ld >= 0) s = lc > ld ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lc >= 0) s = /,\d{1,2}$/.test(s) ? s.replace(',', '.') : s.replace(/,/g, '');
  else if (ld >= 0 && /\.\d{3}$/.test(s) && (s.match(/\./g) || []).length > 0 && !/\.\d{1,2}$/.test(s)) s = s.replace(/\./g, '');
  const n = parseFloat(s); return isFinite(n) ? n : null;
}
const cellStr = v => { if (v == null) return ''; if (v instanceof Date) return isoOf(v); return String(v).replace(/\s+/g, ' ').trim(); };
function quoteNo(v) {
  if (v == null || v === '') return null;
  if (v instanceof Date) return v.getFullYear() > 3000 ? (v.getMonth() + 1) + '-' + v.getFullYear() : null;
  if (typeof v === 'number') { if (v > 200000) { const d = serialISO(v); return (+d.slice(5, 7)) + '-' + d.slice(0, 4); } return String(v); }
  return cellStr(v) || null;
}
const normMercado = v => { const n = norm(v); return n.startsWith('public') ? 'PUBLICO' : n.startsWith('priv') ? 'PRIVADO' : null; };
const normCanal = v => { const n = norm(v); return n.startsWith('indirec') ? 'Indirecto' : n.startsWith('direc') ? 'Directo' : null; };
function normEstado(v) {
  const n = norm(v); if (!n) return null;
  const hit = ESTADOS.find(e => norm(e) === n); if (hit) return hit;
  if (n.startsWith('a presup')) return 'A presupuestar'; if (n.startsWith('presup')) return 'Presupuestado'; if (n.startsWith('vend')) return 'Vendido';
  if (n.startsWith('perd')) return 'Perdido'; if (n.startsWith('desest')) return 'Desestimado'; if (n.startsWith('reempl')) return 'Reemplazado';
  return null;
}
const normProv = v => cellStr(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase() || null;

function sheetRows(wb, name) {
  const sn = wb.SheetNames.find(n => norm(n) === name); if (!sn) return null;
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: null, blankrows: false });
  let hi = aoa.findIndex(r => r.some(c => c != null && /cliente/.test(norm(c)))); if (hi < 0) hi = 0;
  const head = (aoa[hi] || []).map(h => norm(h));
  return { head, rows: aoa.slice(hi + 1) };
}
const hcol = (head, ...names) => { for (const n of names) { const i = head.findIndex(h => h === n); if (i >= 0) return i; } for (const n of names) { const i = head.findIndex(h => h.startsWith(n)); if (i >= 0) return i; } return -1; };

async function impAnalyze(file, zonaId) {
  await loadXLSX();
  const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const so = sheetRows(wb, 'oportunidades'), sc = sheetRows(wb, 'clientes');
  if (!so && !sc) throw new Error('No encontré las hojas OPORTUNIDADES ni CLIENTES en el archivo.');
  const cat = t => new Map(S.catalogo.filter(c => c.tipo === t).map(c => [norm(c.valor), c.valor]));
  const lineas = cat('linea'), marcas = cat('marca'), prods = cat('producto');
  const existing = new Map(S.clientes.filter(c => c.zona_id === zonaId).map(c => [norm(c.nombre), c]));
  const P = { zonaId, clientes: [], existCli: 0, upd: [], visitas: [], opps: [], dup: 0, sinCliente: 0, sinFecha: 0, extraCli: new Map(), estadosRaros: new Set(), nuevasMarcas: new Map(), nuevosProd: new Map(), nuevasLineas: new Map(), notasVis: 0, filasCli: 0 };
  const seenCli = new Map();
  // ---- clientes ----
  if (sc) {
    const h = sc.head, I = { nombre: hcol(h, 'cliente'), mercado: hcol(h, 'mercado'), dir: hcol(h, 'direccion'), prov: hcol(h, 'provincia'), ciudad: hcol(h, 'ciudad'), contacto: hcol(h, 'contacto'), area: hcol(h, 'area'), tel: hcol(h, 'telefono'), email: hcol(h, 'e-mail', 'email', 'correo'), cat: hcol(h, 'categoria') };
    sc.rows.forEach(r => {
      const nombre = cellStr(r[I.nombre]); if (!nombre) return; P.filasCli++;
      const key = norm(nombre); if (seenCli.has(key)) return;
      const rec = {
        nombre, mercado: normMercado(r[I.mercado]), direccion: cellStr(r[I.dir]) || null, provincia: normProv(r[I.prov]), ciudad: cellStr(r[I.ciudad]) || null, contacto: cellStr(r[I.contacto]) || null,
        area: cellStr(r[I.area]) || null, telefono: cellStr(r[I.tel]) || null, email: (cellStr(r[I.email]) || '').toLowerCase() || null, categoria: (cellStr(r[I.cat]).toUpperCase().match(/^[ABCD]/) || [null])[0]
      };
      // visitas del Excel (VISITA n / PROXIMO PASO n)
      const vis = [], notas = [];
      for (let n = 1; n <= 12; n++) {
        const iv = hcol(h, 'visita ' + n), ip = hcol(h, 'proximo paso ' + n); if (iv < 0) continue;
        const raw = r[iv], f = cellDate(raw), paso = ip >= 0 ? cellStr(r[ip]) : '';
        if (f) vis.push({ fecha: f, detalle: null, proximo_paso: paso || null, tipo: null });
        else if (cellStr(raw) || paso) notas.push('Visita ' + n + ': ' + [cellStr(raw), paso && ('Próximo paso: ' + paso)].filter(Boolean).join(' · '));
      }
      if (notas.length) { rec.notas = notas.join('\n'); P.notasVis += notas.length; }
      seenCli.set(key, rec);
      const ex = existing.get(key);
      if (ex) {
        P.existCli++;
        const patch = {}; ['mercado', 'direccion', 'provincia', 'ciudad', 'contacto', 'area', 'telefono', 'email', 'categoria'].forEach(k => { if (!ex[k] && rec[k]) patch[k] = rec[k]; });
        if (Object.keys(patch).length) P.upd.push({ id: ex.id, patch });
      } else { P.clientes.push(rec); vis.forEach(v => P.visitas.push(Object.assign({ cliKey: key }, v))); }
    });
  }
  // ---- oportunidades ----
  if (so) {
    const h = so.head, I = { fecha: hcol(h, 'fecha'), canal: hcol(h, 'canal'), nro: hcol(h, 'n cotizacion', 'no cotizacion', 'nº cotizacion', 'cotizacion'), cli: hcol(h, 'nombre del cliente', 'cliente'), mercado: hcol(h, 'mercado'), anio: hcol(h, 'fecha probable'), trim: hcol(h, 'trimestre'), prob: hcol(h, 'probabilidad'), marca: hcol(h, 'marca'), linea: hcol(h, 'linea'), prod: hcol(h, 'productos', 'producto'), info: hcol(h, 'informacion extra', 'info'), cant: hcol(h, 'cantidad'), monto: hcol(h, 'monto estimado', 'monto'), estado: hcol(h, 'estado'), det: hcol(h, 'detalle') };
    const exOpp = new Set(S.opps.filter(o => o.zona_id === zonaId).map(o => [o.cliente_id, o.fecha, o.nro_cotizacion || '', norm(o.producto), Number(o.monto) || 0, Number(o.cantidad) || 0].join('|')));
    so.rows.forEach(r => {
      const cn = cellStr(r[I.cli]); if (!cn) { if (r.some(c => c != null && c !== '')) P.sinCliente++; return; }
      const fecha = cellDate(r[I.fecha]); if (!fecha) P.sinFecha++;
      const key = norm(cn), mercado = normMercado(r[I.mercado]);
      let estado = normEstado(r[I.estado]); if (!estado) { if (cellStr(r[I.estado])) P.estadosRaros.add(cellStr(r[I.estado])); estado = 'Lead'; }
      let trim = cellStr(r[I.trim]).toUpperCase(); if (!TRIMS.includes(trim)) trim = fecha ? 'Q' + (Math.floor((+fecha.slice(5, 7) - 1) / 3) + 1) : null;
      let prob = cellNum(r[I.prob]); if (prob != null && prob > 0 && prob <= 1) prob = Math.round(prob * 100); if (prob != null) prob = Math.max(0, Math.min(100, Math.round(prob)));
      const marcaRaw = cellStr(r[I.marca]), lineaRaw = cellStr(r[I.linea]), prodRaw = cellStr(r[I.prod]);
      const marca = marcaRaw ? (marcas.get(norm(marcaRaw)) || marcaRaw) : null, linea = lineaRaw ? (lineas.get(norm(lineaRaw)) || lineaRaw) : null, producto = prodRaw ? (prods.get(norm(prodRaw)) || prodRaw) : null;
      if (marca && !marcas.has(norm(marca))) P.nuevasMarcas.set(norm(marca), marca);
      if (linea && !lineas.has(norm(linea))) P.nuevasLineas.set(norm(linea), linea);
      if (producto && !prods.has(norm(producto))) P.nuevosProd.set(norm(producto), { valor: producto, marca, linea });
      const rowo = {
        fecha, canal: normCanal(r[I.canal]), nro_cotizacion: quoteNo(r[I.nro]), mercado, anio_probable: cellNum(r[I.anio]) ? Math.round(cellNum(r[I.anio])) : null, trimestre: trim, probabilidad: prob,
        marca, linea, producto, info_extra: cellStr(r[I.info]) || null, cantidad: cellNum(r[I.cant]), monto: cellNum(r[I.monto]), estado, detalle: cellStr(r[I.det]) || null
      };
      const ex = existing.get(key);
      if (ex && exOpp.has([ex.id, fecha, rowo.nro_cotizacion || '', norm(producto), Number(rowo.monto) || 0, Number(rowo.cantidad) || 0].join('|'))) { P.dup++; return; }
      if (!ex && !seenCli.has(key) && !P.extraCli.has(key)) P.extraCli.set(key, { nombre: cn, mercado });
      P.opps.push({ cliKey: key, row: rowo });
    });
  }
  P.extraCli.forEach((rec, key) => { P.clientes.push({ nombre: rec.nombre, mercado: rec.mercado, _implicito: true }); });
  return P;
}
function impPreviewHTML(P) {
  const z = zonaName(P.zonaId), warn = [];
  if (P.sinCliente) warn.push(`${P.sinCliente} filas de oportunidades sin nombre de cliente (se omiten).`);
  if (P.sinFecha) warn.push(`${P.sinFecha} oportunidad(es) sin fecha en el Excel: se cargan igual, con la fecha vacía.`);
  if (P.estadosRaros.size) warn.push('Estados no reconocidos, se cargan como "Lead": ' + [...P.estadosRaros].slice(0, 6).join(', '));
  const impl = P.clientes.filter(c => c._implicito).length;
  return `<div class="kv"><div><b>${num(P.clientes.length - impl)}</b><span>clientes nuevos</span></div><div><b>${num(P.existCli)}</b><span>clientes que ya existían</span></div><div><b>${num(P.opps.length)}</b><span>oportunidades nuevas</span></div><div><b>${num(P.dup)}</b><span>oportunidades repetidas (se omiten)</span></div>${impl ? `<div><b>${num(impl)}</b><span>clientes creados desde oportunidades</span></div>` : ''}${P.visitas.length ? `<div><b>${num(P.visitas.length)}</b><span>visitas del historial</span></div>` : ''}</div>
  <p class="hint">Destino: <b>${esc(z)}</b>. ${P.upd.length ? `Se completarán datos faltantes en ${num(P.upd.length)} clientes existentes. ` : ''}${P.nuevasMarcas.size + P.nuevosProd.size ? `Se agregarán al catálogo ${num(P.nuevasMarcas.size)} marcas y ${num(P.nuevosProd.size)} productos nuevos.` : ''}</p>
  ${warn.length ? `<p class="err" style="margin:10px 0">${warn.map(esc).join('<br>')}</p>` : ''}
  <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap"><button class="btn pri" data-a="imp-go" ${(P.clientes.length + P.opps.length + P.upd.length) ? '' : 'disabled'}>Importar ahora</button><button class="btn" data-a="imp-cancel">Cancelar</button></div>
  ${(P.clientes.length + P.opps.length + P.upd.length) ? '' : '<p class="hint" style="margin-top:8px">No hay nada nuevo para cargar: todo ya está en la base.</p>'}`;
}
async function impRun(P, out) {
  const setP = (pct, txt) => { out.innerHTML = `<p><b>${esc(txt)}</b></p><div class="prog"><i style="width:${pct}%"></i></div>`; };
  IMP.busy = true;
  try {
    setP(3, 'Preparando…');
    // catálogo
    const addCat = [];
    P.nuevasLineas.forEach(v => addCat.push({ tipo: 'linea', valor: v }));
    P.nuevasMarcas.forEach(v => addCat.push({ tipo: 'marca', valor: v }));
    P.nuevosProd.forEach(p => addCat.push({ tipo: 'producto', valor: p.valor, marca: p.marca, linea: p.linea }));
    if (addCat.length) { try { S.catalogo.push(...await DB.insertMany('catalogo', addCat)); } catch (e) { /* duplicados: sigue */ } }
    // clientes nuevos
    const idByKey = new Map(S.clientes.filter(c => c.zona_id === P.zonaId).map(c => [norm(c.nombre), c.id]));
    setP(8, 'Cargando clientes…');
    const cli = P.clientes.map(c => { const r = Object.assign({}, c, { zona_id: P.zonaId }); delete r._implicito; return r; });
    const ins = await DB.insertMany('clientes', cli, (d, t) => setP(8 + 30 * d / Math.max(1, t), 'Cargando clientes… ' + d + ' de ' + t));
    ins.forEach(c => idByKey.set(norm(c.nombre), c.id));
    // completar datos de existentes
    for (let i = 0; i < P.upd.length; i += 6) {
      await Promise.all(P.upd.slice(i, i + 6).map(u => DB.update('clientes', u.id, u.patch)));
      setP(38 + 7 * i / P.upd.length, 'Completando datos de clientes… ' + Math.min(P.upd.length, i + 6) + ' de ' + P.upd.length);
    }
    // visitas
    if (P.visitas.length) {
      const vrows = P.visitas.map(v => ({ cliente_id: idByKey.get(v.cliKey), fecha: v.fecha, detalle: v.detalle, proximo_paso: v.proximo_paso, tipo: v.tipo })).filter(v => v.cliente_id);
      await DB.insertMany('visitas', vrows, (d, t) => setP(45 + 10 * d / Math.max(1, t), 'Cargando visitas… ' + d + ' de ' + t));
    }
    // oportunidades
    const orows = P.opps.map(o => Object.assign({ cliente_id: idByKey.get(o.cliKey) }, o.row)).filter(o => o.cliente_id);
    await DB.insertMany('oportunidades', orows, (d, t) => setP(55 + 40 * d / Math.max(1, t), 'Cargando oportunidades… ' + d + ' de ' + t));
    setP(97, 'Actualizando…');
    await loadAll();
    out.innerHTML = `<div class="card" style="border-color:var(--green)"><div class="cb"><p><b>✔ Importación lista.</b></p><div class="kv"><div><b>${num(ins.length)}</b><span>clientes creados</span></div><div><b>${num(orows.length)}</b><span>oportunidades cargadas</span></div></div><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn pri" data-a="goto" data-v="oportunidades">Ver oportunidades</button><button class="btn" data-a="goto" data-v="resumen">Ver estadísticas</button></div></div></div>`;
    IMP.plan = null;
  } catch (e) {
    out.innerHTML = `<p class="err">La importación se interrumpió: ${esc(errMsg(e))}</p><p class="hint" style="margin:8px 0">Lo que ya se cargó queda guardado. Podés volver a subir el mismo archivo: no se duplica lo que ya está.</p><button class="btn" data-a="imp-cancel">Aceptar</button>`;
    try { await loadAll(); } catch (e2) { }
  }
  IMP.busy = false;
}
