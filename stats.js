/* =====================  ESTADÍSTICAS (réplica de la hoja ESTADISTICAS)  ===================== */
const PAL = ['#1F2933', '#2F6FB0', '#3EAE6B', '#7B8794', '#8FB8E0', '#1F7A4D', '#A8D8BB', '#4A5A6A'];
const C_V = '#3EAE6B', C_P = '#C5CFD6', C_G = '#2F6FB0';

const dAttr = d => 'data-a="drill"' + Object.entries(d).filter(([, v]) => v).map(([k, v]) => ` data-${k}="${esc(v)}"`).join('');
const dBase = () => { const f = (S.ui.filt.res || {}); return { anio: f.anio, canal: f.canal }; };
const cls = e => e === 'Vendido' ? 'v' : (e === 'Perdido' || e === 'Desestimado') ? 'p' : e === 'Presupuestado' ? 'g' : null;
function agg(list) {
  const a = { v: 0, p: 0, g: 0, nv: 0, np: 0, ng: 0, uv: 0 };
  list.forEach(o => {
    const c = cls(o.estado); if (!c) return;
    const m = Number(o.monto) || 0; a[c] += m; a['n' + c]++;
    if (c === 'v') a.uv += Number(o.cantidad) || 0;
  });
  a.t = a.v + a.p + a.g; a.nt = a.nv + a.np + a.ng;
  return a;
}
function groupSum(list, key, estado) {
  const m = new Map();
  list.forEach(o => {
    if (o.estado !== estado) return;
    const k = (key(o) || '').trim() || '(sin dato)';
    const r = m.get(k) || { k, monto: 0, cant: 0, n: 0 };
    r.monto += Number(o.monto) || 0; r.cant += Number(o.cantidad) || 0; r.n++; m.set(k, r);
  });
  return [...m.values()].sort((a, b) => b.monto - a.monto);
}

/* ---------- gráficos SVG ---------- */
function stackedBars(cats, series, o = {}) {
  const W = 520, H = 250, L = o.pct ? 40 : 62, B = 30, T = 14, R = 8;
  const tot = cats.map((_, i) => series.reduce((s, x) => s + (x.values[i] || 0), 0));
  const max = o.pct ? 100 : Math.max(1, ...tot);
  const nice = v => { const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  const top = o.pct ? 100 : nice(max), ph = H - B - T, pw = W - L - R, bw = Math.min(70, pw / cats.length * .56);
  const y = v => T + ph - ph * v / top;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(o.label || 'Gráfico de barras')}">`;
  for (let i = 0; i <= 4; i++) {
    const v = top * i / 4;
    s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${o.pct ? Math.round(v) + '%' : (v >= 1e6 ? nf1.format(v / 1e6) + ' M' : v >= 1e3 ? num(v / 1e3) + ' k' : num(v))}</text>`;
  }
  cats.forEach((c, i) => {
    const cx = L + pw * (i + .5) / cats.length; let acc = 0;
    series.forEach(sr => {
      const raw = sr.values[i] || 0, v = o.pct ? (tot[i] ? 100 * raw / tot[i] : 0) : raw;
      if (v <= 0) return;
      const y1 = y(acc + v), y0 = y(acc);
      s += `<rect x="${cx - bw / 2}" y="${y1}" width="${bw}" height="${Math.max(0, y0 - y1)}" fill="${sr.color}"><title>${esc(c)} · ${esc(sr.name)}: ${o.pct ? nf1.format(v) + '%' : money(raw)}</title></rect>`;
      acc += v;
    });
    s += `<text x="${cx}" y="${H - 10}" text-anchor="middle" style="font-weight:700;fill:var(--ink)">${esc(c)}</text>`;
    if (!o.pct && tot[i] > 0) s += `<text x="${cx}" y="${y(tot[i]) - 5}" text-anchor="middle" style="font-weight:700;fill:var(--ink)">${tot[i] >= 1e6 ? nf1.format(tot[i] / 1e6) + ' M' : num(tot[i] / 1e3) + ' k'}</text>`;
  });
  return `<div class="chart">${s}</svg></div><div class="legend">${series.map(x => `<span><i style="background:${x.color}"></i>${esc(x.name)}</span>`).join('')}</div>`;
}
function doughnut(items, centerTxt) {
  const total = items.reduce((s, x) => s + x.value, 0);
  if (!total) return `<div class="empty">Sin ventas en esta selección</div>`;
  const r = 70, c = 2 * Math.PI * r; let off = 0, s = `<svg viewBox="0 0 200 200" role="img" aria-label="Gráfico de anillo"><g transform="rotate(-90 100 100)">`;
  items.forEach(x => {
    const len = c * x.value / total;
    s += `<circle cx="100" cy="100" r="${r}" fill="none" stroke="${x.color}" stroke-width="34" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}"><title>${esc(x.label)}: ${money(x.value)} (${nf1.format(100 * x.value / total)}%)</title></circle>`;
    off += len;
  });
  s += `</g><text x="100" y="97" text-anchor="middle" style="font-size:11px;font-weight:700;fill:var(--muted)">TOTAL</text><text x="100" y="117" text-anchor="middle" style="font-size:16px;font-weight:800;fill:var(--ink)">${esc(centerTxt)}</text></svg>`;
  return `<div class="chart">${s}</div>`;
}
function colorize(rows, top = 8) {
  const items = rows.slice(0, top).map((r, i) => ({ label: r.k, value: r.monto, color: PAL[i % PAL.length] }));
  const rest = rows.slice(top).reduce((s, r) => s + r.monto, 0);
  if (rest > 0) items.push({ label: 'Otras', value: rest, color: '#C9D3DA' });
  return items;
}
function shortMoney(v) { return v >= 1e6 ? CFG.MONEDA + ' ' + nf1.format(v / 1e6) + ' M' : v >= 1e4 ? CFG.MONEDA + ' ' + num(v / 1e3) + ' k' : money(v); }

/* ---------- bloques ---------- */
function blockEstadoTrim(opps) {
  const rows = TRIMS.map(q => ({ q, a: agg(opps.filter(o => o.trimestre === q)) }));
  const T = agg(opps);
  const ser = [{ name: 'Vendida', color: C_V, values: rows.map(r => r.a.v) }, { name: 'Perdida / Desestimada', color: C_P, values: rows.map(r => r.a.p) }, { name: 'Presupuestado', color: C_G, values: rows.map(r => r.a.g) }];
  const mode = S.ui.filt.trimPct ? 'pct' : 'abs';
  return `<div class="card"><div class="ch"><h2>Estado de las oportunidades por trimestre</h2><div class="seg"><button data-a="trimmode" data-v="abs" aria-pressed="${mode === 'abs'}">$</button><button data-a="trimmode" data-v="pct" aria-pressed="${mode === 'pct'}">%</button></div></div><div class="cb">
    ${stackedBars(TRIMS, ser, { pct: mode === 'pct', label: 'Estado de oportunidades por trimestre' })}
    <table class="tbl" style="margin-top:14px"><thead><tr><th>Trimestre</th><th class="n">Vendida</th><th class="n">Perdida/Desest.</th><th class="n">Presupuestado</th><th class="n">Total</th><th class="n">% Vend.</th><th class="n">% Perd.</th><th class="n">% Vig.</th></tr></thead><tbody>
    ${rows.map(r => `<tr class="click" ${dAttr(Object.assign(dBase(), { e: 'Vendido|Presupuestado|Perdido|Desestimado', trim: r.q }))} title="Ver en lista"><td><b>${r.q}</b></td><td class="n">${money(r.a.v)}</td><td class="n">${money(r.a.p)}</td><td class="n">${money(r.a.g)}</td><td class="n">${money(r.a.t)}</td><td class="n">${pctTxt(r.a.v, r.a.t)}</td><td class="n">${pctTxt(r.a.p, r.a.t)}</td><td class="n">${pctTxt(r.a.g, r.a.t)}</td></tr>`).join('')}
    <tr class="tot click" ${dAttr(Object.assign(dBase(), { e: 'Vendido|Presupuestado|Perdido|Desestimado' }))}><td>Total</td><td class="n">${money(T.v)}</td><td class="n">${money(T.p)}</td><td class="n">${money(T.g)}</td><td class="n">${money(T.t)}</td><td class="n">${pctTxt(T.v, T.t)}</td><td class="n">${pctTxt(T.p, T.t)}</td><td class="n">${pctTxt(T.g, T.t)}</td></tr></tbody></table></div></div>`;
}
function blockMercado(opps) {
  const ms = ['PUBLICO', 'PRIVADO'].map(m => ({ m, a: agg(opps.filter(o => o.mercado === m)), n: opps.filter(o => o.mercado === m).length }));
  const sin = agg(opps.filter(o => !o.mercado));
  const ser = [{ name: 'Vendido', color: C_V, values: ms.map(x => x.a.v) }, { name: 'Perdida / Desestimada', color: C_P, values: ms.map(x => x.a.p) }, { name: 'Vigente', color: C_G, values: ms.map(x => x.a.g) }];
  return `<div class="card"><div class="ch"><h2>Mercado público vs. privado</h2></div><div class="cb">
    ${stackedBars(ms.map(x => mercadoTxt(x.m)), ser, { label: 'Estado por mercado' })}
    <table class="tbl" style="margin-top:14px"><thead><tr><th>Mercado</th><th class="n">Oport.</th><th class="n">Vendido</th><th class="n">Perd./Desest.</th><th class="n">Vigente</th><th class="n">Total</th><th>% de conversión</th></tr></thead><tbody>
    ${ms.map(x => `<tr class="click" ${dAttr(Object.assign(dBase(), { e: 'Vendido|Presupuestado|Perdido|Desestimado', mercado: x.m }))} title="Ver en lista"><td><b>${mercadoTxt(x.m)}</b></td><td class="n">${num(x.n)}</td><td class="n">${money(x.a.v)}</td><td class="n">${money(x.a.p)}</td><td class="n">${money(x.a.g)}</td><td class="n">${money(x.a.t)}</td><td><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:${pctVal(x.a.v, x.a.t)}%"></i></div><b>${pctTxt(x.a.v, x.a.t)}</b></div></td></tr>`).join('')}
    ${sin.t ? `<tr><td class="hint">Sin mercado cargado</td><td></td><td class="n hint">${money(sin.v)}</td><td class="n hint">${money(sin.p)}</td><td class="n hint">${money(sin.g)}</td><td class="n hint">${money(sin.t)}</td><td></td></tr>` : ''}
    </tbody></table></div></div>`;
}
function blockDonut(title, rows, sub, base, key) {
  const tot = rows.reduce((s, r) => s + r.monto, 0), items = colorize(rows);
  return `<div class="card"><div class="ch"><h2>${title}</h2><span class="hint">${sub || ''}</span></div><div class="cb"><div class="dn">${doughnut(items, shortMoney(tot))}
    <div style="max-height:260px;overflow:auto"><table class="tbl"><thead><tr><th>Categoría</th><th class="n">Monto</th><th class="n">%</th></tr></thead><tbody>
    ${rows.length ? rows.map((r, i) => `<tr class="click" ${dAttr(Object.assign(dBase(), base, { [key || 'linea']: r.k === '(sin dato)' ? '' : r.k }))} title="Ver en lista"><td><i class="sw" style="background:${i < 8 ? PAL[i % PAL.length] : '#C9D3DA'}"></i>${esc(r.k)}</td><td class="n">${money(r.monto)}</td><td class="n">${pctTxt(r.monto, tot)}</td></tr>`).join('') : '<tr><td colspan="3" class="hint">Sin datos</td></tr>'}
    <tr class="tot"><td>Total</td><td class="n">${money(tot)}</td><td class="n">${tot ? '100%' : '—'}</td></tr></tbody></table></div></div></div></div>`;
}
function blockEquip(opps, linea, marca) {
  const list = opps.filter(o => o.linea === linea && (!marca || o.marca === marca));
  const rows = groupSum(list, o => o.producto, 'Vendido');
  const tot = rows.reduce((s, r) => s + r.monto, 0), un = rows.reduce((s, r) => s + r.cant, 0);
  return `<div class="card"><div class="ch"><h2>Ventas por equipo · ${marca ? esc(marca) : 'todas las marcas'}</h2><span class="hint">${esc(linea || '')}</span></div><div class="cb"><div class="dn">${doughnut(colorize(rows), shortMoney(tot))}
    <div style="max-height:260px;overflow:auto"><table class="tbl"><thead><tr><th>Producto</th><th class="n">Monto vendido</th><th class="n">Unid.</th></tr></thead><tbody>
    ${rows.length ? rows.map((r, i) => `<tr class="click" ${dAttr(Object.assign(dBase(), { e: 'Vendido', linea, marca, producto: r.k === '(sin dato)' ? '' : r.k }))} title="Ver en lista"><td><i class="sw" style="background:${i < 8 ? PAL[i % PAL.length] : '#C9D3DA'}"></i>${esc(r.k)}</td><td class="n">${money(r.monto)}</td><td class="n">${num(r.cant)}</td></tr>`).join('') : '<tr><td colspan="3" class="hint">Sin ventas de esta categoría</td></tr>'}
    <tr class="tot"><td>Total</td><td class="n">${money(tot)}</td><td class="n">${num(un)}</td></tr></tbody></table></div></div></div></div>`;
}

/* ---------- vista Resumen ---------- */
function resumenData() {
  const f = S.ui.filt.res || (S.ui.filt.res = { canal: '', marca: '', linea: '' });
  const base = S.opps.filter(inZona);
  const years = [...new Set(base.map(oppYear).filter(Boolean))].sort((a, b) => b - a);
  if (f.anio === undefined) { const y = new Date().getFullYear(); f.anio = years.includes(y) ? String(y) : (years[0] ? String(years[0]) : ''); }
  if (f.anio && !years.map(String).includes(String(f.anio))) f.anio = years[0] ? String(years[0]) : '';
  const opps = base.filter(o => !f.canal || o.canal === f.canal).filter(o => !f.anio || String(oppYear(o)) === String(f.anio));
  return { f, opps, years };
}
function vResumen() {
  const { f, opps, years } = resumenData();
  const T = agg(opps);
  const marcas = [...new Set(opps.map(o => o.marca).filter(Boolean))].sort(cmp);
  const mk = f.marca && marcas.includes(f.marca) ? f.marca : (marcas.includes(CFG.MARCA_PRINCIPAL || 'Mindray') ? (CFG.MARCA_PRINCIPAL || 'Mindray') : marcas[0] || '');
  const vend = opps.filter(o => o.estado === 'Vendido');
  const lineasV = groupSum(opps, o => o.linea, 'Vendido');
  const lineasM = groupSum(opps.filter(o => o.marca === mk), o => o.linea, 'Vendido');
  const lineaSel = f.linea && lineasV.some(r => r.k === f.linea) ? f.linea : (lineasV[0] ? lineasV[0].k : '');
  const pend = groupSum(opps.filter(o => o.marca === mk), o => o.linea, 'Presupuestado');
  const pendientes = S.clientes.filter(inZona).filter(c => segPending(segInfo(c))).length;
  const zonas = S.zonaSel === 'todas' && S.myZonas.length > 1;
  const kp = (l, v, s, c, a) => `<${a ? 'button ' + a : 'div'} class="kpi" style="--c:${c}"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></${a ? 'button' : 'div'}>`;
  if (!opps.length && !S.clientes.length) {
    return `<div class="card"><div class="empty"><p><b>Todavía no hay datos cargados.</b></p><p style="margin:8px 0 14px">Importá tu Excel de oportunidades y clientes, o cargá la primera oportunidad a mano.</p><button class="btn pri" data-a="goto" data-v="importar">Importar desde Excel</button> <button class="btn" data-a="opp-new">Nueva oportunidad</button></div></div>`;
  }
  return `
  <div class="tools"><span class="hint">Estadísticas calculadas sobre ${num(opps.length)} oportunidades${S.zonaSel === 'todas' ? (S.myZonas.length > 1 ? ' de todas las zonas' : '') : ' de ' + esc(zonaName(S.zonaSel))}.</span><span class="grow"></span>
    <select data-f="res.anio" aria-label="Año"><option value="">Todos los años</option>${years.map(y => `<option value="${y}"${String(f.anio) === String(y) ? ' selected' : ''}>${y}</option>`).join('')}</select>
    <select data-f="res.canal" aria-label="Canal"><option value="">Todos los canales</option>${CANALES.map(c => `<option${f.canal === c ? ' selected' : ''}>${c}</option>`).join('')}</select></div>
  <div class="kpis">
    ${kp('Total cotizado', money(T.t), num(T.nt) + ' oportunidades', 'var(--navy)', dAttr(Object.assign(dBase(), { e: 'Vendido|Presupuestado|Perdido|Desestimado' })))}
    ${kp('Vendido', money(T.v), num(T.nv) + ' ventas · ' + pctTxt(T.v, T.t) + ' del total', 'var(--green)', dAttr(Object.assign(dBase(), { e: 'Vendido' })))}
    ${kp('Vigente (presupuestado)', money(T.g), num(T.ng) + ' oportunidades abiertas', 'var(--teal)', dAttr(Object.assign(dBase(), { e: 'Presupuestado' })))}
    ${kp('Perdido / desestimado', money(T.p), num(T.np) + ' oportunidades · ' + pctTxt(T.p, T.t), '#C5CFD6', dAttr(Object.assign(dBase(), { e: 'Perdido|Desestimado' })))}
    ${kp('Conversión', pctTxt(T.v, T.t), 'vendido sobre total cotizado', 'var(--navy-2)')}
    ${kp('Visitas pendientes', num(pendientes), 'clientes con visita vencida', pendientes ? 'var(--warn)' : 'var(--green)', 'data-a="goto" data-v="seguimiento"')}
  </div>
  ${zonas ? blockZonas(opps) : ''}
  <div class="sec-h"><span class="sec-t">Estado de las oportunidades</span><span class="rule"></span></div>
  <div class="grid2 one">${blockEstadoTrim(opps)}${blockMercado(opps)}</div>
  <div class="sec-h"><span class="sec-t">Ventas por categoría</span><span class="rule"></span></div>
  <div class="grid2">${blockDonut('Ventas por categoría · todas las marcas', lineasV, '', { e: 'Vendido' }, 'linea')}${blockDonut('Ventas por categoría · ' + esc(mk || '—'), lineasM, '', { e: 'Vendido', marca: mk }, 'linea')}</div>
  <div class="sec-h"><span class="sec-t">Ventas por equipamiento</span><span class="rule"></span>
    <select data-f="res.linea" aria-label="Categoría">${lineasV.map(r => `<option${r.k === lineaSel ? ' selected' : ''}>${esc(r.k)}</option>`).join('') || '<option>—</option>'}</select></div>
  <div class="grid2">${blockEquip(opps, lineaSel, '')}${blockEquip(opps, lineaSel, mk)}</div>
  <div class="sec-h"><span class="sec-t">Pendiente de cerrar</span><span class="rule"></span>
    <select data-f="res.marca" aria-label="Marca">${marcas.map(m => `<option${m === mk ? ' selected' : ''}>${esc(m)}</option>`).join('') || '<option>—</option>'}</select></div>
  <div class="grid2">${blockDonut('Pendiente de cerrar · ' + esc(mk || '—') + ' (presupuestado)', pend, 'por línea', { e: 'Presupuestado', marca: mk }, 'linea')}<div class="card"><div class="ch"><h2>Cómo se calcula</h2></div><div class="cb hint" style="line-height:1.6">
    <p><b>Vendido</b>: oportunidades en estado <i>Vendido</i>. <b>Perdida / desestimada</b>: estados <i>Perdido</i> y <i>Desestimado</i>. <b>Vigente</b>: estado <i>Presupuestado</i>.</p>
    <p style="margin-top:8px">El <b>total</b> es la suma de esos tres estados, igual que en la planilla. <i>Lead</i>, <i>A presupuestar</i> y <i>Reemplazado</i> no entran en los totales.</p>
    <p style="margin-top:8px">Los porcentajes por categoría se calculan sobre el total vendido de todas las categorías.</p></div></div></div>`;
}
function blockZonas(opps) {
  const zs = S.zonas.filter(z => S.myZonas.includes(z.id)).map(z => ({ z, a: agg(opps.filter(o => o.zona_id === z.id)) })).filter(x => x.a.nt);
  if (zs.length < 2) return '';
  const mx = Math.max(1, ...zs.map(x => x.a.t));
  return `<div class="sec-h"><span class="sec-t">Por zona</span><span class="rule"></span></div><div class="card" style="margin-bottom:16px"><div class="cb"><table class="tbl"><thead><tr><th>Zona</th><th class="n">Oport.</th><th class="n">Vendido</th><th class="n">Vigente</th><th class="n">Perd./Desest.</th><th class="n">Total</th><th>Conversión</th></tr></thead><tbody>
  ${zs.map(x => `<tr><td><button class="lnk" data-a="zona-go" data-v="${x.z.id}">${esc(x.z.nombre)}</button></td><td class="n">${num(x.a.nt)}</td><td class="n">${money(x.a.v)}</td><td class="n">${money(x.a.g)}</td><td class="n">${money(x.a.p)}</td><td class="n">${money(x.a.t)}</td><td><div style="display:flex;gap:8px;align-items:center"><div class="bar" style="flex:1"><i style="width:${pctVal(x.a.v, x.a.t)}%"></i></div><b>${pctTxt(x.a.v, x.a.t)}</b></div></td></tr>`).join('')}</tbody></table></div></div>`;
}
