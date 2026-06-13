/* =============================================
   FRIGOCARNES WMS — Módulo de Despacho Profesional
   Pedidos, FEFO/FIFO, Remitos imprimibles
   ============================================= */

// ── Estado ────────────────────────────────────────────────
const DespachoState = {
  seleccion: new Set(),
  filtroActivo: 'pendiente',

  toggle(id) {
    if (this.seleccion.has(id)) this.seleccion.delete(id);
    else this.seleccion.add(id);
    this.actualizarResumen();
    renderSelectorCajas();
  },

  limpiar() {
    this.seleccion.clear();
    this.actualizarResumen();
    renderSelectorCajas();
  },

  actualizarResumen() {
    const ids = [...this.seleccion];
    const resumenEl = document.getElementById('np-resumen');
    const btnCrear = document.getElementById('btn-crear-pedido');
    if (!resumenEl) return;

    if (ids.length === 0) {
      resumenEl.style.display = 'none';
      if (btnCrear) btnCrear.style.opacity = '0.4';
      return;
    }

    const cajas = DB.getStock().filter(c => ids.includes(c.id));
    const kg = cajas.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1);
    const porTipo = {};
    cajas.forEach(c => { porTipo[c.tipo] = (porTipo[c.tipo]||0)+1; });
    const tiposStr = Object.entries(porTipo).map(([t,n]) => n+'× '+t).join(' · ');

    resumenEl.style.display = 'block';
    document.getElementById('np-resumen-texto').textContent = ids.length+' cajas seleccionadas · '+kg+' kg';
    document.getElementById('np-resumen-detalle').textContent = tiposStr;
    if (btnCrear) btnCrear.style.opacity = '1';
  }
};

// ── Tabs ──────────────────────────────────────────────────
function switchTabDespacho(tab) {
  const panelNuevo   = document.getElementById('panel-nuevo-pedido');
  const panelActivos = document.getElementById('panel-pedidos-activos');
  const tabNuevo     = document.getElementById('tab-nuevo-pedido');
  const tabActivos   = document.getElementById('tab-pedidos-activos');

  if (tab === 'nuevo') {
    panelNuevo.style.display   = 'block';
    panelActivos.style.display = 'none';
    tabNuevo.style.color       = 'var(--primary)';
    tabNuevo.style.borderBottomColor = 'var(--primary)';
    tabActivos.style.color     = '#64748b';
    tabActivos.style.borderBottomColor = 'transparent';
    setTimeout(renderSelectorCajas, 50); // Mostrar stock inmediatamente
  } else {
    panelNuevo.style.display   = 'none';
    panelActivos.style.display = 'block';
    tabNuevo.style.color       = '#64748b';
    tabNuevo.style.borderBottomColor = 'transparent';
    tabActivos.style.color     = 'var(--primary)';
    tabActivos.style.borderBottomColor = 'var(--primary)';
    renderPedidosActivos();
  }
}

// ── Selector de cajas para nuevo pedido ──────────────────
function renderSelectorCajas() {
  const s    = (document.getElementById('np-search')?.value||'').toLowerCase();
  const modo = 'fefo'; // FEFO automático siempre
  const lista = document.getElementById('np-cajas-lista');
  if (!lista) return;

  const todas = DB.getStock().filter(c =>
    c.estado !== 'Despachado' &&
    (!s || [c.id,c.sku,c.nombre,c.tipo,c.proveedor].join(' ').toLowerCase().includes(s))
  );

  const cajas = [...todas].sort((a,b) =>
    modo === 'fifo'
      ? new Date(a.fecIngreso) - new Date(b.fecIngreso)
      : new Date(a.fecVcto)   - new Date(b.fecVcto)
  );

  const fmtDate = d => { try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; }};
  const diasR   = v => v ? Math.ceil((new Date(v)-new Date())/86400000) : 9999;

  // Primera por SKU = prioridad FEFO/FIFO
  const primerasPorSku = {};
  cajas.forEach(c => { if (!primerasPorSku[c.sku]) primerasPorSku[c.sku] = c.id; });

  if (!cajas.length) {
    lista.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><div class="empty-text">Sin cajas disponibles</div></div>';
    return;
  }

  // Botón seleccionar todo
  const todosSel = cajas.every(c => DespachoState.seleccion.has(c.id));
  let html = '<div style="display:flex;gap:8px;margin-bottom:10px">'
    + '<button onclick="seleccionarTodasNP()" class="btn btn-secondary" style="flex:1;font-size:12px">'
    + (todosSel ? '☐ Deseleccionar todo' : '☑ Seleccionar todo') + '</button></div>';

  cajas.forEach((c, i) => {
    const dias      = diasR(c.fecVcto);
    const sel       = DespachoState.seleccion.has(c.id);
    const esPrimera = primerasPorSku[c.sku] === c.id;
    const borderCol = sel ? '#52b788' : dias < 0 ? '#dc2626' : dias <= 7 ? '#d97706' : esPrimera ? 'var(--primary)' : 'var(--border)';
    const bgSel     = sel ? 'background:rgba(82,183,136,0.07);' : '';
    const vctoColor = dias < 0 ? '#dc2626' : dias <= 7 ? '#d97706' : '#2d6a4f';

    html += '<div onclick="DespachoState.toggle(\''+c.id+'\')" style="border:1px solid '+borderCol+';border-left:3px solid '+borderCol+';border-radius:10px;padding:12px;margin-bottom:8px;cursor:pointer;'+bgSel+'">';

    // Badge FEFO top-right
    if (esPrimera && dias <= 60) {
      const tagBg = dias < 0 ? '#dc2626' : dias <= 7 ? '#d97706' : '#2d6a4f';
      html += '<div style="float:right;background:'+tagBg+';color:#fff;font-size:9px;font-weight:700;padding:2px 7px;border-radius:10px;margin-left:8px">'+'FEFO'+' #'+(i+1)+'</div>';
    }

    html += '<div style="display:flex;align-items:flex-start;gap:10px">';
    // Checkbox
    html += '<div style="width:20px;height:20px;border-radius:5px;border:2px solid '+(sel?'#52b788':'#cbd5e1')+';background:'+(sel?'#52b788':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px">'+(sel?'<span style="color:#fff;font-size:12px;font-weight:900">✓</span>':'')+'</div>';

    html += '<div style="flex:1">';
    html += '<div style="font-weight:700;font-size:13px;color:var(--text)">'+c.nombre+'</div>';
    html += '<div style="font-size:11px;color:#64748b;margin:2px 0">'+c.id+' · '+c.sku+' · Lote '+c.lote+'</div>';
    html += '<div style="display:flex;gap:12px;font-size:12px;margin-top:4px">';
    html += '<span>⚖ <strong>'+c.pesoNeto+'kg</strong></span>';
    html += '<span>📍 '+c.camara+(c.rack?' '+c.rack:'')+'</span>';
    html += '<span style="color:'+vctoColor+';font-weight:700">📅 Vcto: '+fmtDate(c.fecVcto)+(dias<0?' ⚠ VENCIDA':' ('+dias+'d)')+'</span>';
    html += '</div>';

    if (esPrimera) {
      const pBg = dias<0?'#fee2e2':dias<=7?'#fef3c7':'#d8f3dc';
      const pColor = dias<0?'#991b1b':dias<=7?'#92400e':'#1a3a2a';
      const pLabel = dias<0?'🔴 VENCIDA — despachar urgente':dias<=7?'⚠ Despachar esta semana':'✅ Prioridad '+( 'FEFO');
      html += '<div style="margin-top:5px"><span style="background:'+pBg+';color:'+pColor+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+pLabel+'</span></div>';
    }

    html += '</div></div></div>';
  });

  lista.innerHTML = html;
  DespachoState.actualizarResumen();
}

function seleccionarTodasNP() {
  const cajas = DB.getStock().filter(c => c.estado !== 'Despachado');
  const todas = cajas.every(c => DespachoState.seleccion.has(c.id));
  if (todas) DespachoState.seleccion.clear();
  else cajas.forEach(c => DespachoState.seleccion.add(c.id));
  DespachoState.actualizarResumen();
  renderSelectorCajas();
}

function limpiarSeleccionNP() {
  DespachoState.limpiar();
}

// ── Crear pedido ──────────────────────────────────────────
function crearPedido() {
  const ids     = [...DespachoState.seleccion];
  const cliente = document.getElementById('np-cliente')?.value?.trim();
  const oc      = document.getElementById('np-oc')?.value?.trim() || '';
  const fecha   = document.getElementById('np-fecha')?.value || '';

  if (!ids.length)   { App.showToast('⚠ Selecciona al menos una caja'); return; }
  if (!cliente)      { App.showToast('⚠ Ingresa el nombre del cliente'); return; }

  const s     = DB.getSession();
  const hoy   = new Date().toISOString().split('T')[0];
  const hora  = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  const numPed = parseInt(localStorage.getItem('frigocarnes_ped_counter')||'0') + 1;
  localStorage.setItem('frigocarnes_ped_counter', String(numPed));
  const numPedStr = 'PED-'+new Date().getFullYear()+'-'+String(numPed).padStart(4,'0');

  const cajas  = DB.getStock().filter(c => ids.includes(c.id));
  const kgTotal = cajas.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1);
  const porTipo = {};
  cajas.forEach(c => { porTipo[c.tipo] = (porTipo[c.tipo]||0)+1; });

  // Guardar pedido
  const pedidos = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const pedido = {
    id: numPedStr,
    estado: 'pendiente',
    cliente,
    oc,
    fechaEntrega: fecha,
    fechaCreacion: hoy,
    horaCreacion: hora,
    operarioCreacion: s?.usuario||'Sistema',
    cajasIds: ids,
    cajas: cajas.map(c=>({
      id:c.id, sku:c.sku, nombre:c.nombre, tipo:c.tipo,
      lote:c.lote, pesoNeto:c.pesoNeto, fecVcto:c.fecVcto,
      camara:c.camara, rack:c.rack, proveedor:c.proveedor
    })),
    kgTotal: parseFloat(kgTotal),
    porTipo,
    fechaDespacho: null,
    horaDespacho: null,
    operarioDespacho: null,
  };
  pedidos.unshift(pedido);
  localStorage.setItem('frigocarnes_pedidos', JSON.stringify(pedidos));

  // Marcar cajas como Reservado
  ids.forEach(id => {
    DB.updateCaja(id, { estado:'Reservado', cliente, oc, numeroPedido: numPedStr });
    DB.addMovimiento(id, 'Reservado para '+numPedStr+' — '+cliente);
  });

  // Actualizar badge
  actualizarBadgePedidos();
  App.showToast('✓ '+numPedStr+' creado — '+ids.length+' cajas reservadas');
  DespachoState.limpiar();
  document.getElementById('np-cliente').value = '';
  document.getElementById('np-oc').value = '';
  renderDashboard();

  // Solo supervisores van a la pestaña Pedidos y ven el remito automáticamente
  const sesion = DB.getSession();
  if (sesion && sesion.rol === 'supervisor') {
    switchTabDespacho('activos');
    setTimeout(() => verRemito(numPedStr), 300);
  }
  // Operarios se quedan en Nuevo Pedido (sin acceso a remito ni confirmar salida)
}

// ── Pedidos activos ───────────────────────────────────────
function filtrarPedidos(tipo) {
  DespachoState.filtroActivo = tipo;
  const btnPend = document.getElementById('filtro-pendiente');
  const btnDesp = document.getElementById('filtro-despachado');
  if (btnPend && btnDesp) {
    if (tipo === 'pendiente') {
      btnPend.style.background = 'var(--primary)'; btnPend.style.color = '#fff'; btnPend.style.borderColor = 'var(--primary)';
      btnDesp.style.background = 'none'; btnDesp.style.color = '#64748b'; btnDesp.style.borderColor = 'var(--border)';
    } else {
      btnDesp.style.background = 'var(--primary)'; btnDesp.style.color = '#fff'; btnDesp.style.borderColor = 'var(--primary)';
      btnPend.style.background = 'none'; btnPend.style.color = '#64748b'; btnPend.style.borderColor = 'var(--border)';
    }
  }
  renderPedidosActivos();
}

function renderPedidosActivos() {
  const lista   = document.getElementById('pedidos-lista');
  if (!lista) return;
  const pedidos = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const filtrado = pedidos.filter(p => p.estado === DespachoState.filtroActivo);
  const fmtDate = d => { try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; }};

  actualizarBadgePedidos();

  if (!filtrado.length) {
    lista.innerHTML = '<div class="empty-state"><span class="empty-icon">'+(DespachoState.filtroActivo==='pendiente'?'📋':'✅')+'</span><div class="empty-text">Sin pedidos '+(DespachoState.filtroActivo==='pendiente'?'pendientes':'despachados')+'</div></div>';
    return;
  }

  lista.innerHTML = filtrado.map(p => {
    const tiposStr = Object.entries(p.porTipo||{}).map(([t,n])=>n+'× '+t).join(' · ');
    const isPend   = p.estado === 'pendiente';
    return `<div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;${isPend?'border-left:3px solid var(--primary)':'border-left:3px solid #52b788'}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
        <div>
          <div style="font-weight:800;font-size:15px;color:var(--primary)">${p.id}</div>
          <div style="font-weight:700;font-size:14px">${p.cliente}</div>
          ${p.oc?'<div style="font-size:11px;color:#64748b">OC: '+p.oc+'</div>':''}
        </div>
        <span style="background:${isPend?'#fff8e1':'#d8f3dc'};color:${isPend?'#7a5c00':'#1a3a2a'};padding:4px 10px;border-radius:10px;font-size:11px;font-weight:700">
          ${isPend?'⏳ Pendiente':'✅ Despachado'}
        </span>
      </div>
      <div style="display:flex;gap:16px;font-size:12px;color:#64748b;margin-bottom:8px">
        <span>📦 ${p.cajasIds?.length||p.cajas?.length||0} cajas</span>
        <span>⚖ ${p.kgTotal} kg</span>
        <span>📅 Creado: ${fmtDate(p.fechaCreacion)}</span>
        ${p.fechaEntrega?'<span>🚚 Entrega: '+fmtDate(p.fechaEntrega)+'</span>':''}
      </div>
      <div style="font-size:11px;color:#64748b;margin-bottom:10px">${tiposStr}</div>
      <div style="display:flex;gap:8px">
        <button onclick="verRemito('${p.id}')" class="btn btn-secondary" style="flex:1;font-size:12px">📄 Remito</button>
        ${(()=>{const s=DB.getSession();const esSup=s&&(s.rol==='supervisor'||s.rol==='admin');if(!isPend||!esSup)return'';return `<button onclick="cancelarPedido('${p.id}')" style="flex:1;background:#fff;color:#dc2626;border:1.5px solid #dc2626;border-radius:8px;padding:10px;font-size:12px;font-weight:700;cursor:pointer">✕ Cancelar</button><button onclick="confirmarSalida('${p.id}')" style="flex:2;background:#1a3a2a;color:#fff;border:none;border-radius:8px;padding:10px;font-size:13px;font-weight:700;cursor:pointer">🚚 Confirmar Salida</button>`;})()}
      </div>
    </div>`;
  }).join('');
}

function actualizarBadgePedidos() {
  const pedidos   = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const pendiente = pedidos.filter(p => p.estado==='pendiente').length;
  // Badge sub-tab Pedidos (dentro de Generar Pedido)
  const badge = document.getElementById('badge-pedidos');
  if (badge) {
    if (pendiente > 0) { badge.style.display='inline'; badge.textContent=pendiente; }
    else badge.style.display='none';
  }
  // Badge topbar "Generar Pedido"
  const badgeTop = document.getElementById('pedido-badge-top');
  if (badgeTop) {
    if (pendiente > 0) { badgeTop.style.display='inline-block'; badgeTop.textContent=pendiente; }
    else badgeTop.style.display='none';
  }
  // Badge bottom nav "Pedido"
  const badgeBnav = document.getElementById('pedido-badge-bnav');
  if (badgeBnav) {
    if (pendiente > 0) { badgeBnav.style.display='inline-block'; badgeBnav.textContent=pendiente; }
    else badgeBnav.style.display='none';
  }
}

// ── Confirmar salida ──────────────────────────────────────
function cancelarPedido(pedidoId) {
  if (!confirm('¿Cancelar el pedido '+pedidoId+'?\nLas cajas volverán a estar disponibles.')) return;
  const pedidos = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const idx     = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return;
  const p = pedidos[idx];
  // Liberar cajas reservadas
  (p.cajasIds||[]).forEach(id => {
    DB.updateCaja(id, { estado:'Disponible', cliente:null, oc:null, numeroPedido:null });
    DB.addMovimiento(id, 'Pedido cancelado — '+pedidoId);
  });
  // Eliminar pedido
  pedidos.splice(idx, 1);
  localStorage.setItem('frigocarnes_pedidos', JSON.stringify(pedidos));
  actualizarBadgePedidos();
  renderPedidosActivos();
  renderDashboard();
  App.showToast('✓ Pedido '+pedidoId+' cancelado — cajas liberadas');
}

function confirmarSalida(pedidoId) {
  const pedidos = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const idx     = pedidos.findIndex(p => p.id === pedidoId);
  if (idx === -1) return;
  const p = pedidos[idx];

  if (!confirm('¿Confirmar salida de '+pedidoId+'?\n\nCliente: '+p.cliente+'\n'+p.cajasIds.length+' cajas · '+p.kgTotal+' kg\n\nEsto despachará todas las cajas del pedido.')) return;

  const s    = DB.getSession();
  const hoy  = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});

  p.estado           = 'despachado';
  p.fechaDespacho    = hoy;
  p.horaDespacho     = hora;
  p.operarioDespacho = s?.usuario||'Sistema';
  pedidos[idx]       = p;
  localStorage.setItem('frigocarnes_pedidos', JSON.stringify(pedidos));

  // Despachar cajas en DB
  p.cajasIds.forEach(id => {
    const caja = DB.getStock().find(c => c.id === id);
    if (!caja) return;
    DB.updateCaja(id, {
      estado:'Despachado', fecSalida:hoy, horaSalida:hora,
      operarioDespacho: s?.usuario||'Sistema'
    });
    DB.addMovimiento(id, 'Salida confirmada — '+pedidoId+' — '+p.cliente);
    enviarASheets({
      tipo:'despacho', id_caja:caja.id, sku:caja.sku, producto:caja.nombre,
      tipo_carne:caja.tipo, lote:caja.lote, fecha_vencimiento:caja.fecVcto,
      peso_neto:caja.pesoNeto, proveedor:caja.proveedor, camara_frio:caja.camara,
      n_pallet:caja.pallet, cliente_destino:p.cliente, orden_compra:p.oc||'',
      numero_pedido:pedidoId, fecha_ingreso:caja.fecIngreso,
      fecha_despacho:hoy, hora_despacho:hora,
      operario_despacho:s?.usuario||'Sistema', observaciones:caja.obs||''
    });
  });

  App.showToast('✓ '+pedidoId+' despachado — '+p.cajasIds.length+' cajas');
  renderPedidosActivos();
  renderDashboard();
}

// ── Remito imprimible ─────────────────────────────────────
function verRemito(pedidoId) {
  const pedidos = JSON.parse(localStorage.getItem('frigocarnes_pedidos')||'[]');
  const p = pedidos.find(x => x.id === pedidoId);
  if (!p) return;

  const fmtDate = d => { try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; }};
  const hoy = new Date().toLocaleDateString('es-CL');

  let filasCajas = (p.cajas||[]).map((c,i) =>
    `<tr style="${i%2===0?'background:#f8fffe':''}">
      <td style="padding:5px 8px;font-size:11px">${c.id}</td>
      <td style="padding:5px 8px;font-size:11px">${c.nombre}</td>
      <td style="padding:5px 8px;font-size:11px">${c.tipo}</td>
      <td style="padding:5px 8px;font-size:11px">${c.lote}</td>
      <td style="padding:5px 8px;font-size:11px;text-align:right">${c.pesoNeto} kg</td>
      <td style="padding:5px 8px;font-size:11px">${fmtDate(c.fecVcto)}</td>
      <td style="padding:5px 8px;font-size:11px">${c.camara||'—'} ${c.rack||''}</td>
    </tr>`
  ).join('');

  document.getElementById('remito-contenido').innerHTML = `
    <div style="font-family:Arial,sans-serif;padding:20px" id="remito-print">
      <div style="background:#1a3a2a;color:#fff;padding:14px 20px;border-radius:10px 10px 0 0;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:18px;font-weight:800">❄ FRIGOCARNES</div><div style="font-size:11px;opacity:0.8">Remito de Despacho</div></div>
        <div style="text-align:right"><div style="font-size:16px;font-weight:800">${p.id}</div><div style="font-size:11px;opacity:0.8">${hoy}</div></div>
      </div>
      <div style="border:1px solid #e2e8f0;border-top:none;border-radius:0 0 10px 10px;padding:16px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
          <div style="background:#f8fffe;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#64748b;margin-bottom:2px">CLIENTE</div>
            <div style="font-weight:700;font-size:14px">${p.cliente}</div>
            ${p.oc?'<div style="font-size:11px;color:#64748b">OC: '+p.oc+'</div>':''}
          </div>
          <div style="background:#f8fffe;border-radius:8px;padding:10px">
            <div style="font-size:10px;color:#64748b;margin-bottom:2px">DESPACHO</div>
            <div style="font-weight:700">${p.fechaDespacho?fmtDate(p.fechaDespacho):fmtDate(p.fechaCreacion)}</div>
            <div style="font-size:11px;color:#64748b">Op: ${p.operarioDespacho||p.operarioCreacion||'—'}</div>
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-bottom:14px">
          <div style="flex:1;text-align:center;background:#d8f3dc;border-radius:8px;padding:10px">
            <div style="font-size:22px;font-weight:800;color:#1a3a2a">${p.cajasIds?.length||p.cajas?.length||0}</div>
            <div style="font-size:10px;color:#2d6a4f">Cajas</div>
          </div>
          <div style="flex:1;text-align:center;background:#d8f3dc;border-radius:8px;padding:10px">
            <div style="font-size:22px;font-weight:800;color:#1a3a2a">${p.kgTotal}</div>
            <div style="font-size:10px;color:#2d6a4f">Kg totales</div>
          </div>
          <div style="flex:1;text-align:center;background:${p.estado==='despachado'?'#d8f3dc':'#fff8e1'};border-radius:8px;padding:10px">
            <div style="font-size:13px;font-weight:800;color:${p.estado==='despachado'?'#1a3a2a':'#7a5c00'}">${p.estado==='despachado'?'✅ Despachado':'⏳ Pendiente'}</div>
          </div>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
          <thead><tr style="background:#1a3a2a;color:#fff">
            <th style="padding:6px 8px;font-size:10px;text-align:left">ID Caja</th>
            <th style="padding:6px 8px;font-size:10px;text-align:left">Producto</th>
            <th style="padding:6px 8px;font-size:10px;text-align:left">Tipo</th>
            <th style="padding:6px 8px;font-size:10px;text-align:left">Lote</th>
            <th style="padding:6px 8px;font-size:10px;text-align:right">Peso</th>
            <th style="padding:6px 8px;font-size:10px;text-align:left">Vcto</th>
            <th style="padding:6px 8px;font-size:10px;text-align:left">Ubicación</th>
          </tr></thead>
          <tbody>${filasCajas}</tbody>
          <tfoot><tr style="background:#1a3a2a;color:#fff">
            <td colspan="4" style="padding:6px 8px;font-size:11px;font-weight:700">TOTAL</td>
            <td style="padding:6px 8px;font-size:11px;font-weight:700;text-align:right">${p.kgTotal} kg</td>
            <td colspan="2"></td>
          </tr></tfoot>
        </table>
        <div style="border-top:1px dashed #e2e8f0;padding-top:14px;display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <div style="text-align:center">
            <div style="border-bottom:1px solid #333;height:40px;margin-bottom:6px"></div>
            <div style="font-size:10px;color:#64748b">Firma Despachador</div>
          </div>
          <div style="text-align:center">
            <div style="border-bottom:1px solid #333;height:40px;margin-bottom:6px"></div>
            <div style="font-size:10px;color:#64748b">Firma Recepción</div>
          </div>
        </div>
      </div>
    </div>`;

  document.getElementById('modal-remito').style.display = 'block';
}

function imprimirRemito() {
  const el = document.getElementById('remito-print');
  if (!el) return;
  const win = window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Remito Frigocarnes</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif}@media print{@page{margin:10mm}}</style></head><body>'+el.outerHTML+'</body></html>');
  win.document.close();
  setTimeout(()=>win.print(), 600);
}

// ── Render principal (compatibilidad) ─────────────────────
function renderDespacho() {
  switchTabDespacho('nuevo');
  actualizarBadgePedidos();
}
