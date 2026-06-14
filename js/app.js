/* =============================================
   FRIGOCARNES WMS — Lógica principal
   ============================================= */

// Usuarios del sistema (verificación local + backend)
const USUARIOS_LOCAL = {
  'Carlos (Administrador)': { pin: '14181418', rol: 'supervisor', display: 'Carlos (Administrador)' },
  'Marlen (Administradora)': { pin: '14181418', rol: 'supervisor', display: 'Marlen (Administradora)' },
  'Operador': { pin: '2020fc', rol: 'operario', display: 'Operador' },
  // Compatibilidad con usuario Admin anterior
  'Admin': { pin: '14181418', rol: 'supervisor', display: 'Carlos (Administrador)' },
  'Administrador': { pin: '14181418', rol: 'supervisor', display: 'Carlos (Administrador)' },
};

const App = (() => {
  function fmtDate(d) {
    if (!d) return '—';
    const [y,m,day] = d.split('-');
    return `${day}/${m}/${y}`;
  }

  function diasRestantes(fecVcto) {
    if (!fecVcto) return 9999;
    return Math.ceil((new Date(fecVcto) - new Date()) / 86400000);
  }

  function vctoClass(dias) {
    if (dias < 0) return 'vcto-danger';
    if (dias <= 7) return 'vcto-warn';
    return 'vcto-ok';
  }

  function estadoBadge(estado) {
    return `<span class="badge badge-${estado}">${estado}</span>`;
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    document.getElementById('toastMsg').textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 2800);
  }

  function irA(v, btn) {
    const views = document.querySelectorAll('.view');
    views.forEach(el => el.classList.remove('active'));
    const target = document.getElementById('view-' + v);
    if (target) target.classList.add('active');
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
    document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
    if(v==='alertas'){
      const b1=document.getElementById('alerta-badge-top');
      const b2=document.getElementById('alerta-badge-bnav');
      if(b1)b1.style.display='none';
      if(b2)b2.style.display='none';
    }
    const renders = {
      dashboard: typeof renderDashboard === 'function' ? renderDashboard : null,
      stock: typeof renderStock === 'function' ? renderStock : null,
      alertas: typeof renderAlertas === 'function' ? renderAlertas : null,
      reportes: typeof renderReportes === 'function' ? renderReportes : null,
      ingresar: () => { if(typeof ScannerRemoto !== 'undefined') ScannerRemoto.iniciar(); },
    };
    if (renders[v]) renders[v]();
    if (v === 'ingresar' && typeof ScannerRemoto !== 'undefined') {
      ScannerRemoto.iniciar();
    }
  }

  return { showToast, irA };
})();

// ============================================================
//  AUTH
// ============================================================

async function login() {
  const u = document.getElementById('loginUser').value;
  const p = document.getElementById('loginPin').value;
  const errEl = document.getElementById('loginError');
  if (!u || !p) {
    errEl.textContent = 'Selecciona operario e ingresa PIN';
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  function entrarApp(nombre, rol) {
    sessionStorage.setItem('frigocarnes_session', JSON.stringify({ usuario: nombre, rol: rol||'operario', ts: Date.now() }));
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('topUser').textContent = nombre;
    const fop = document.getElementById('f-op'); if(fop) fop.value = nombre;
    aplicarPermisosRol(rol);
    irA('dashboard');
    setTimeout(() => {
      DBSync.inicializar().then(() => { renderDashboard(); renderStock(); actualizarBadgeAlertas(); if(typeof actualizarBadgePedidos==='function') actualizarBadgePedidos(); });
    }, 100);
  }

  // Verificar localmente primero
  const usuarioLocal = USUARIOS_LOCAL[u];
  if (usuarioLocal && String(p) === String(usuarioLocal.pin)) {
    entrarApp(usuarioLocal.display, usuarioLocal.rol);
    return;
  }

  // Intentar con backend
  try {
    const resultado = await SupaDB.login(u, p);
    if (resultado.ok) {
      entrarApp(resultado.usuario.nombre, resultado.usuario.rol);
      mostrarEstadoConexion(true);
    } else {
      errEl.textContent = resultado.error || 'Usuario o PIN incorrecto';
      errEl.style.display = 'block';
    }
  } catch(e) {
    errEl.textContent = 'Usuario o PIN incorrecto';
    errEl.style.display = 'block';
  }
}

function aplicarPermisosRol(rol) {
  const esSupervisor = rol === 'supervisor' || rol === 'admin';
  document.querySelectorAll('.supervisor-only').forEach(el => {
    el.style.display = esSupervisor ? 'inline-flex' : 'none';
  });
  // Chip Reservados en Generar Pedido (solo supervisores, y solo si hay reservados)
  if (typeof actualizarChipReservados === 'function') actualizarChipReservados();
}

function logout() {
  if(confirm('¿Cerrar sesión?')) { DB.logout(); location.reload(); }
}

// ============================================================
//  NAVEGACIÓN
// ============================================================

function irA(v, btn) {
  const views = document.querySelectorAll('.view');
  views.forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + v);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  if(v==='alertas'){
    const b1=document.getElementById('alerta-badge-top');
    const b2=document.getElementById('alerta-badge-bnav');
    if(b1)b1.style.display='none';
    if(b2)b2.style.display='none';
  }
  const renders = {
    dashboard: typeof renderDashboard === 'function' ? renderDashboard : null,
    stock: () => { if(typeof renderStock==='function') renderStock(); },
    alertas: typeof renderAlertas === 'function' ? renderAlertas : null,
    reportes: typeof renderReportes === 'function' ? renderReportes : null,
    ingresar: () => { if(typeof ScannerRemoto !== 'undefined') ScannerRemoto.iniciar(); },
    despacho: () => {
      if(typeof switchTabDespacho==='function') switchTabDespacho('nuevo');
      setTimeout(()=>{ if(typeof renderSelectorCajas==='function') renderSelectorCajas(); },50);
    },
  };
  if (renders[v]) renders[v]();
}

// ============================================================
//  DETALLE CAJA (sin botón despachar — solo cerrar y eliminar)
// ============================================================

function verDetalle(id) {
  const c = DB.getStock().find(x => x.id === id);
  if (!c) return;
  const fmtDate = d => { if(!d) return '—'; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
  const dias = Math.ceil((new Date(c.fecVcto) - new Date()) / 86400000);
  const badge = e => `<span class="badge badge-${e}">${e}</span>`;

  document.getElementById('detalleContent').innerHTML = `
    <div class="det-header">
      <div class="det-title">${c.nombre}</div>
      <div class="det-sub">${c.id} · ${badge(c.estado)}</div>
    </div>
    <div class="det-body">
      <div class="det-section">
        <div class="det-sec-title">Identificación</div>
        <div class="det-grid">
          <div class="det-field"><div class="det-label">ID</div><div class="det-val">${c.id}</div></div>
          <div class="det-field"><div class="det-label">SKU</div><div class="det-val">${c.sku}</div></div>
          <div class="det-field"><div class="det-label">Lote</div><div class="det-val">${c.lote}</div></div>
          <div class="det-field"><div class="det-label">Tipo</div><div class="det-val">${c.tipo}</div></div>
        </div>
      </div>
      <div class="det-section">
        <div class="det-sec-title">Peso</div>
        <div class="det-grid">
          <div class="det-field"><div class="det-label">Peso neto</div><div class="det-val">${c.pesoNeto} kg</div></div>
          <div class="det-field"><div class="det-label">Peso bruto</div><div class="det-val">${c.pesoBruto||'—'} kg</div></div>
          <div class="det-field"><div class="det-label">Piezas</div><div class="det-val">${c.piezas}</div></div>
          <div class="det-field"><div class="det-label">País</div><div class="det-val">${c.pais}</div></div>
        </div>
      </div>
      <div class="det-section">
        <div class="det-sec-title">Fechas</div>
        <div class="det-grid">
          <div class="det-field"><div class="det-label">Producción</div><div class="det-val">${fmtDate(c.fecProd)}</div></div>
          <div class="det-field"><div class="det-label">Vencimiento</div><div class="det-val" style="color:var(--${dias<0?'danger':dias<=7?'warn':'ok'})">${fmtDate(c.fecVcto)} (${dias<0?'VENCIDA':dias+'d'})</div></div>
          <div class="det-field"><div class="det-label">Ingreso</div><div class="det-val">${fmtDate(c.fecIngreso)} ${c.horaIngreso}</div></div>
          ${c.fecSalida?`<div class="det-field"><div class="det-label">Salida</div><div class="det-val">${fmtDate(c.fecSalida)} ${c.horaSalida}</div></div>`:''}
        </div>
      </div>
      <div class="det-section">
        <div class="det-sec-title">Ubicación</div>
        <div class="det-grid">
          <div class="det-field"><div class="det-label">Cámara</div><div class="det-val" style="color:var(--cold)">${c.camara}</div></div>
          <div class="det-field"><div class="det-label">Pallet</div><div class="det-val">${c.pallet||'—'}</div></div>
          <div class="det-field"><div class="det-label">Rack</div><div class="det-val">${c.rack||'—'}</div></div>
          <div class="det-field"><div class="det-label">Fila/Nivel</div><div class="det-val">${c.fila||'—'}/${c.nivel||'—'}</div></div>
        </div>
      </div>
      <div class="det-section">
        <div class="det-sec-title">Origen</div>
        <div class="det-grid">
          <div class="det-field full"><div class="det-label">Proveedor</div><div class="det-val">${c.proveedor}</div></div>
          <div class="det-field full"><div class="det-label">Planta</div><div class="det-val">${c.planta||'—'}</div></div>
        </div>
      </div>
      ${c.obs?`<div class="det-section"><div class="det-sec-title">Observaciones</div><div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px">${c.obs}</div></div>`:''}
      <div class="det-section">
        <div class="det-sec-title">Trazabilidad</div>
        <div class="timeline">${(c.movimientos||[]).map((m,i,arr)=>`<div class="tl-item"><div class="tl-line"><div class="tl-dot"></div>${i<arr.length-1?'<div class="tl-conn"></div>':''}</div><div class="tl-content"><div class="tl-event">${m.split(' — ')[1]||m}</div><div class="tl-meta">${m.split(' — ')[0]||''}</div></div></div>`).join('')}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-secondary" onclick="cerrarOverlay()" style="flex:1">✕ Cerrar</button>
        ${(()=>{const s=DB.getSession();return(s&&s.rol==='supervisor')?'<button class="btn" style="background:#fee2e2;color:#991b1b;padding:11px 14px" onclick="if(confirm(\'¿Eliminar esta caja? Esta acción se registrará en Sheets.\'))eliminarCaja(\'${c.id}\')">🗑 Eliminar</button>':'';})()}
      </div>
    </div>`;

  document.getElementById('detalleOverlay').style.display = 'block';
}

function cerrarOverlay(e) {
  if (!e || e.target === document.getElementById('detalleOverlay')) {
    document.getElementById('detalleOverlay').style.display = 'none';
  }
}

// ============================================================
//  STOCK
// ============================================================

function setFiltro(f, btn) {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  btn?.classList.add('active');
  window._filtroActivo = f;
  filtrarCajas();
}

function filtroRapido(tipo) {
  const input = document.getElementById('searchInput');
  if (input) input.value = tipo;
  document.querySelectorAll('#filtros-rapidos .chip').forEach(c => {
    c.classList.toggle('chip-active', c.textContent.includes(tipo) || (tipo==='' && c.id==='chip-todos'));
  });
  filtrarCajas();
}

function filtrarCajas() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const f = window._filtroActivo || 'todos';
  const hoy = new Date();
  
  // Actualizar estado de cajas vencidas automáticamente
  const stock = DB.getStock();
  stock.forEach(c => {
    if (c.estado === 'Disponible' && c.fecVcto) {
      const dias = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
      if (dias < 0) {
        DB.updateCaja(c.id, { estado: 'Vencido' });
        c.estado = 'Vencido';
      }
    }
  });

  let cajas = stock.filter(c => {
    // Nunca mostrar despachados en el stock
    if (c.estado === 'Despachado') return false;
    if (search) {
      const h = [c.id, c.sku, c.lote, c.nombre, c.proveedor, c.tipo, c.camara].join(' ').toLowerCase();
      if (!h.includes(search)) return false;
    }
    if (f === 'todos') return true;
    if (f === 'vcto7') {
      const d = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
      return d >= 0 && d <= 7;
    }
    return c.estado === f;
  }).sort((a, b) => new Date(a.fecVcto) - new Date(b.fecVcto));

  const fmtDate = d => { if(!d) return '—'; const [y,m,day]=d.split('-'); return `${day}/${m}/${y}`; };
  const diasR = v => v ? Math.ceil((new Date(v) - hoy) / 86400000) : 9999;
  const vctoC = d => d < 0 ? 'vcto-danger' : d <= 7 ? 'vcto-warn' : 'vcto-ok';
  const badge = e => `<span class="badge badge-${e}">${e}</span>`;

  document.getElementById('stockCount').textContent = `${cajas.length} caja${cajas.length!==1?'s':''} encontrada${cajas.length!==1?'s':''}`;
  document.getElementById('cajaList').innerHTML = cajas.length
    ? cajas.map(c => {
        const dias = diasR(c.fecVcto);
        const vl = dias < 0 ? '⚠ VENCIDA' : dias === 0 ? 'Vence HOY' : `Vence en ${dias}d`;
        return `<div class="caja-card" onclick="verDetalle('${c.id}')">
          <div class="caja-header"><div><div class="caja-id">${c.id}</div><div class="caja-sku">${c.sku} · Lote: ${c.lote}</div></div>${badge(c.estado)}</div>
          <div class="caja-meta"><span class="caja-meta-item"><strong>${c.nombre}</strong></span><span class="caja-meta-item">⚖ ${c.pesoNeto} kg</span><span class="caja-meta-item">🏭 ${c.proveedor}</span></div>
          <div class="caja-footer"><span class="caja-ubicacion">📍 ${c.camara} ${c.rack} ${c.fila} ${c.nivel}</span><span class="caja-vcto ${vctoC(dias)}">${vl}</span></div>
        </div>`;
      }).join('')
    : '<div class="empty-state"><span class="empty-icon">📦</span><div class="empty-text">Sin resultados</div></div>';
}

function renderStock() { filtrarCajas(); }

// ============================================================
//  FORMULARIO INGRESAR
// ============================================================

function limpiarForm() {
  document.getElementById('cajaForm').reset();
  document.querySelectorAll('.autofilled').forEach(e => e.classList.remove('autofilled'));
  document.getElementById('panelAnalisis').style.display = 'none';
  const s = DB.getSession();
  if (s) document.getElementById('f-op').value = s.usuario;
  document.getElementById('f-piezas').value = '1';
}

function guardarCaja(e) {
  e.preventDefault();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
  const get = id => document.getElementById(id)?.value || '';

  // Generar ID único
  const id = DB.getNextId();

  const caja = {
    id,
    sku:              get('f-sku'),
    nombre:           get('f-nombre'),
    tipo:             get('f-tipo'),
    lote:             get('f-lote'),
    fecProd:          get('f-fprod'),
    fecEnv:           get('f-fenv'),
    fecVcto:          get('f-fvcto'),
    horaProd:         get('f-hprod'),
    pesoNeto:         parseFloat(get('f-peso-neto')) || 0,
    pesoBruto:        parseFloat(get('f-peso-bruto')) || 0,
    piezas:           parseInt(get('f-piezas')) || 1,
    unidad:           get('f-unidad'),
    pais:             get('f-pais'),
    planta:           get('f-planta') || '',
    proveedor:        get('f-prov'),
    estado:           'Disponible',
    camara:           get('f-camara') || '',
    rack:             get('f-rack') || '',
    fila:             get('f-fila') || '',
    nivel:            get('f-nivel') || '',
    pallet:           get('f-pallet') || '',
    fecIngreso:       hoy,
    horaIngreso:      hora,
    fecSalida:        '',
    horaSalida:       '',
    operarioIngreso:  get('f-op'),
    operarioDespacho: '',
    codigoBarras:     get('f-barras') || generarCodigoBarras({ id }),
    cert:             get('f-cert') || '',
    obs:              get('f-obs') || '',
    movimientos:      [`${hoy} ${hora} — Ingreso por ${get('f-op')}`]
  };

  // Asegurar código de barras
  if (!caja.codigoBarras) caja.codigoBarras = generarCodigoBarras(caja);

  DB.addCaja(caja);
  App.showToast('✓ Caja ' + caja.id + ' guardada — genera la etiqueta');

  // Pre-llenar pestaña etiquetas
  setTimeout(() => {
    const set = (id, v) => { const el = document.getElementById(id); if(el && v) el.value = v; };
    set('eq-sku', caja.sku);
    set('eq-nombre', caja.nombre);
    set('eq-tipo', caja.tipo);
    set('eq-lote', caja.lote);
    set('eq-peso', caja.pesoNeto);
    set('eq-fprod', caja.fecProd);
    set('eq-fvcto', caja.fecVcto);
    set('eq-prov', caja.proveedor);
    set('eq-pais', caja.pais);
    set('eq-id', caja.id); // ID bloqueado en etiquetas
    // Guardar caja para botón "Añadir a Stock y Sheets"
    window._cajaPendienteSheets = caja;
    // Mostrar botón añadir stock
    const btnAdd = document.getElementById('btn-add-stock');
    if (btnAdd) btnAdd.style.display = '';
    window._etiquetaFijada = null; // nueva caja, desanclar
    // Limpiar etiqueta anterior antes de ir
    const prev = document.getElementById('etiqueta-preview');
    if (prev) prev.style.display = 'none';
    const cont = document.getElementById('etiqueta-contenido');
    if (cont) cont.innerHTML = '';
    const wrapper = document.getElementById('barcode-wrapper');
    if (wrapper) wrapper.innerHTML = '';
    irA('etiquetas');
    setTimeout(() => { if(typeof generarEtiqueta === 'function') generarEtiqueta(); }, 250);
  }, 300);

  limpiarForm();
}

// Botón manual "Añadir a Stock y Sheets"
function agregarAStockYSheets() {
  const caja = window._cajaPendienteSheets;
  if (!caja) { App.showToast('No hay caja pendiente'); return; }

  enviarASheets({
    tipo: 'ingreso',
    id_caja: caja.id,
    sku: caja.sku,
    producto: caja.nombre,
    tipo_carne: caja.tipo,
    lote: caja.lote,
    fecha_produccion: caja.fecProd,
    fecha_vencimiento: caja.fecVcto,
    peso_neto: caja.pesoNeto,
    peso_bruto: caja.pesoBruto,
    proveedor: caja.proveedor,
    pais_origen: caja.pais,
    operario_ingreso: caja.operarioIngreso,
    fecha_ingreso: caja.fecIngreso,
    hora_ingreso: caja.horaIngreso,
    codigo_barras: caja.codigoBarras
  });

  App.showToast('✓ Caja enviada a Google Sheets');
  window._cajaPendienteSheets = null;
  const btnAdd = document.getElementById('btn-add-stock');
  if (btnAdd) btnAdd.style.display = 'none';
}

// ============================================================
//  ELIMINAR CAJA (con notificación a Sheets)
// ============================================================

function eliminarCaja(id) {
  const caja = DB.getStock().find(c => c.id === id);
  const s = DB.getSession();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });

  DB.deleteCaja(id);
  document.getElementById('detalleOverlay').style.display = 'none';
  App.showToast('Caja ' + id + ' eliminada');
  filtrarCajas();
  renderDashboard();

  // Notificar a Sheets que se eliminó
  if (caja) {
    enviarASheets({
      tipo: 'eliminacion',
      id_caja: caja.id,
      sku: caja.sku,
      producto: caja.nombre,
      tipo_carne: caja.tipo,
      lote: caja.lote,
      peso_neto: caja.pesoNeto,
      proveedor: caja.proveedor,
      estado: 'ELIMINADO',
      operario: s?.usuario || 'Sistema',
      fecha_eliminacion: hoy,
      hora_eliminacion: hora,
      motivo: 'Eliminado manualmente desde la aplicación'
    });
  }
}

// ============================================================
//  DESPACHO
// ============================================================

function despacharCaja(id) {
  const s = DB.getSession();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
  DB.updateCaja(id, { estado:'Despachado', fecSalida:hoy, horaSalida:hora, operarioDespacho:s?.usuario||'Sistema' });
  DB.addMovimiento(id, `Despachado por ${s?.usuario||'Sistema'}`);
  const caja = DB.getStock().find(c => c.id === id);
  if (caja) {
    enviarASheets({ tipo:'despacho', id_caja:caja.id, sku:caja.sku, producto:caja.nombre, tipo_carne:caja.tipo,
      lote:caja.lote, fecha_vencimiento:caja.fecVcto, peso_neto:caja.pesoNeto, proveedor:caja.proveedor,
      camara_frio:caja.camara, n_pallet:caja.pallet, cliente_destino:caja.cliente, orden_compra:caja.oc||'',
      fecha_ingreso:caja.fecIngreso, fecha_despacho:hoy, hora_despacho:hora,
      operario_despacho:s?.usuario||'Sistema', observaciones:caja.obs||'' });
  }
  App.showToast('✓ Caja ' + id + ' despachada');
  renderDashboard();
}

function despacharUna(id) { despacharCaja(id); }

// ============================================================
//  DASHBOARD
// ============================================================

function renderDashboard() {
  actualizarBadgeAlertas();
  if (typeof actualizarBadgePedidos === 'function') actualizarBadgePedidos();
  if (typeof actualizarChipReservados === 'function') actualizarChipReservados();
  const stats = DB.getStats();
  document.getElementById('d-total').textContent = stats.total;
  document.getElementById('d-kg').textContent = stats.kgTotal;
  document.getElementById('d-vcto').textContent = stats.porVencer;
  document.getElementById('d-desp').textContent = stats.despHoy;
  const stock = DB.getStock().slice(0, 6);
  const movs = [];
  stock.forEach(c => {
    if (c.movimientos?.length) {
      const last = c.movimientos[c.movimientos.length - 1];
      movs.push({ nombre: c.nombre, id: c.id, msg: last });
    }
  });
  document.getElementById('timeline-dash').innerHTML = movs.slice(0, 5).map((m, i, arr) =>
    `<div class="tl-item"><div class="tl-line"><div class="tl-dot"></div>${i < arr.length-1 ? '<div class="tl-conn"></div>' : ''}</div>
    <div class="tl-content"><div class="tl-event">${m.nombre}</div><div class="tl-meta">${m.id} · ${m.msg.split(' — ')[1]||m.msg}</div></div></div>`
  ).join('') || '<div class="empty-state"><span class="empty-icon">📋</span><div class="empty-text">Sin movimientos</div></div>';
}

// ============================================================
//  ALERTAS
// ============================================================

function renderAlertas() {
  const alertas = [];
  const hoy = new Date();
  DB.getStock().forEach(c => {
    if (c.estado === 'Despachado') return;
    const dias = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
    if (dias < 0) alertas.push({ tipo:'danger', ico:'⛔', t:'VENCIDA: '+c.nombre, d:`${c.id} · ${c.proveedor}` });
    else if (dias <= 3) alertas.push({ tipo:'danger', ico:'⚠', t:`Vence en ${dias}d: ${c.nombre}`, d:c.id });
    else if (dias <= 7) alertas.push({ tipo:'warn', ico:'🕐', t:`Vence en ${dias}d: ${c.nombre}`, d:c.id });
    if (c.inspeccion === 'Pendiente') alertas.push({ tipo:'info', ico:'📋', t:'Inspección pendiente: '+c.id, d:c.nombre });
  });
  document.getElementById('alertaList').innerHTML = alertas.length
    ? `<div class="alerta-list">${alertas.map(a => `<div class="alerta-item"><span class="alerta-icon ${a.tipo}">${a.ico}</span><div><div class="alerta-title">${a.t}</div><div class="alerta-desc">${a.d}</div></div></div>`).join('')}</div>`
    : '<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-text">Sin alertas activas</div></div>';
}

// ============================================================
//  REPORTES
// ============================================================

function renderReportes() {
  const stats = DB.getStats();
  document.getElementById('resumenStock').innerHTML = `
    <div class="resumen-wrap"><table class="resumen-table">
      <thead><tr><th>Cámara</th><th>Cajas</th><th>Kg</th></tr></thead>
      <tbody>${stats.porCamara.map(r => `<tr><td>${r.camara}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join('')}</tbody>
    </table></div>`;
  document.getElementById('resumenTipo').innerHTML = `
    <div class="resumen-wrap"><table class="resumen-table">
      <thead><tr><th>Tipo</th><th>Cajas</th><th>Kg</th></tr></thead>
      <tbody>${stats.porTipo.length
        ? stats.porTipo.map(r => `<tr><td>${r.tipo}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join('')
        : '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Sin datos</td></tr>'}</tbody>
    </table></div>`;
}

function importarJSON(e) {
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader();
  r.onload = ev => {
    const res = DB.importJSON(ev.target.result);
    App.showToast(res.ok ? `✓ ${res.count} cajas importadas` : 'Error: ' + res.error);
    if(res.ok) { renderReportes(); renderDashboard(); }
  };
  r.readAsText(f);
}

// ============================================================
//  HISTORIAL — CIERRE DE MES (elimina despachadas al cerrar)
// ============================================================

const MESES_NOMBRES = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril",
  "05":"Mayo","06":"Junio","07":"Julio","08":"Agosto",
  "09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre"
};

async function ejecutarCierreMes() {
  const mes = document.getElementById('cierre-mes').value;
  const anio = document.getElementById('cierre-anio').value;
  const mesNom = MESES_NOMBRES[mes];
  const estado = document.getElementById('cierre-estado');
  if(!confirm(`¿Confirmar cierre de ${mesNom} ${anio}?\n\nSe enviará el historial a Google Sheets.\nLas cajas DESPACHADAS de ese mes serán eliminadas del sistema.`)) return;

  estado.style.display = 'block';
  estado.innerHTML = '<span style="color:#1e6fd9">⟳ Enviando cierre a Google Sheets...</span>';

  const stock = DB.getStock();
  const ingMes = stock.filter(c => {
    if (!c.fecIngreso) return false;
    const f = new Date(c.fecIngreso);
    return String(f.getFullYear()) === anio && String(f.getMonth()+1).padStart(2,'0') === mes;
  });
  const despMes = stock.filter(c => {
    if (!c.fecSalida) return false;
    const f = new Date(c.fecSalida);
    return String(f.getFullYear()) === anio && String(f.getMonth()+1).padStart(2,'0') === mes;
  });
  const stockDisponible = stock.filter(c => c.estado !== 'Despachado' && c.estado !== 'Vencido');

  const cierres = JSON.parse(localStorage.getItem('frigocarnes_cierres') || '{}');
  const key = `${anio}-${mes}`;
  cierres[key] = {
    periodo: key, mesNombre: mesNom, anio,
    generado: new Date().toISOString(),
    ingresos: ingMes, despachos: despMes, stockFinal: stockDisponible,
    resumen: {
      cajasIngresadas: ingMes.length,
      kgIngresados: ingMes.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
      cajasDespachadas: despMes.length,
      kgDespachados: despMes.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
      stockFinalCajas: stockDisponible.length,
      stockFinalKg: stockDisponible.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
    }
  };
  localStorage.setItem('frigocarnes_cierres', JSON.stringify(cierres));

  // Eliminar cajas despachadas del mes del stock local
  despMes.forEach(c => { try { DB.deleteCaja(c.id); } catch(e) {} });

  try {
    const cierrePayload = encodeURIComponent(JSON.stringify({
        tipo: 'cierre_mes', periodo: key, mes_nombre: mesNom, anio,
        ingresos: ingMes.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, tipo_carne:c.tipo, lote:c.lote, fecha_vencimiento:c.fecVcto, peso_neto:c.pesoNeto, proveedor:c.proveedor, estado:c.estado, operario_ingreso:c.operarioIngreso, fecha_ingreso:c.fecIngreso })),
        despachos: despMes.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, tipo_carne:c.tipo, lote:c.lote, peso_neto:c.pesoNeto, proveedor:c.proveedor, cliente:c.cliente, fecha_despacho:c.fecSalida, operario:c.operarioDespacho })),
        stock_final: stockDisponible.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, peso_neto:c.pesoNeto, estado:c.estado, camara:c.camara, fecha_vencimiento:c.fecVcto })),
        resumen: cierres[key].resumen
    }));
    await fetch(SHEETS_CONFIG.url + '?payload=' + cierrePayload, { method: 'GET', mode: 'no-cors' });
    estado.innerHTML = `<span style="color:#16a34a">✅ Cierre de ${mesNom} ${anio} enviado. ${despMes.length} cajas despachadas eliminadas.</span>`;
    App.showToast(`✓ Cierre ${mesNom} ${anio} guardado`);
    document.getElementById('hist-mes').value = mes;
    document.getElementById('hist-anio').value = anio;
    renderDashboard();
    renderStock();
    buscarHistorial();
  } catch(err) {
    estado.innerHTML = '<span style="color:#dc2626">⚠️ Error al conectar. El cierre se guardó localmente.</span>';
  }
}

function buscarHistorial() {
  const mes = document.getElementById('hist-mes').value;
  const anio = document.getElementById('hist-anio').value;
  const mesNom = MESES_NOMBRES[mes];
  const key = `${anio}-${mes}`;
  const cierres = JSON.parse(localStorage.getItem('frigocarnes_cierres') || '{}');
  const cierre = cierres[key];
  const contenedor = document.getElementById('historial-resultado');
  if (!cierre) {
    const stock = DB.getStock();
    const ingMes = stock.filter(c => { if(!c.fecIngreso)return false; const f=new Date(c.fecIngreso); return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes; });
    const despMes = stock.filter(c => { if(!c.fecSalida)return false; const f=new Date(c.fecSalida); return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes; });
    if (!ingMes.length && !despMes.length) {
      contenedor.innerHTML = '<div class="empty-state"><span class="empty-icon">📭</span><div class="empty-text">No hay movimientos para '+mesNom+' '+anio+'</div></div>';
      return;
    }
    renderHistorialDatos(contenedor, mesNom, anio, { ingresos:ingMes, despachos:despMes, resumen:{ cajasIngresadas:ingMes.length, kgIngresados:ingMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1), cajasDespachadas:despMes.length, kgDespachados:despMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1), stockFinalCajas:'—', stockFinalKg:'—' } }, false);
    return;
  }
  renderHistorialDatos(contenedor, mesNom, anio, cierre, true);
}

function renderHistorialDatos(contenedor, mesNom, anio, datos, esCierre) {
  const r = datos.resumen;
  const fmtDate = d => { if(!d)return'—'; try { const[y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d; } };
  const badge = esCierre
    ? '<span style="background:#d8f3dc;color:#1a3a2a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">✅ Cierre oficial</span>'
    : '<span style="background:#fff8e1;color:#7a5c00;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">📊 Datos actuales</span>';
  let html = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-weight:700;font-size:16px;color:var(--primary)">${mesNom} ${anio}</div>${badge}</div>`;
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  html += `<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--primary)">${r.cajasIngresadas}</div><div style="font-size:11px;color:#64748b">Cajas ingresadas</div><div style="font-size:12px;font-weight:600">${r.kgIngresados} kg</div></div>`;
  html += `<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0a4a7a">${r.cajasDespachadas}</div><div style="font-size:11px;color:#64748b">Cajas despachadas</div><div style="font-size:12px;font-weight:600;color:#0a4a7a">${r.kgDespachados} kg</div></div>`;
  html += `<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#7a3a00">${r.stockFinalCajas}</div><div style="font-size:11px;color:#64748b">Stock al cierre</div><div style="font-size:12px;font-weight:600;color:#7a3a00">${r.stockFinalKg} kg</div></div>`;
  html += `<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#666">${datos.ingresos.length + datos.despachos.length}</div><div style="font-size:11px;color:#64748b">Movimientos totales</div></div></div>`;
  if (datos.ingresos.length > 0) {
    html += `<div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px">📦 Ingresos del mes <span style="background:var(--primary);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">${datos.ingresos.length}</span></div>`;
    datos.ingresos.forEach(c => { html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--primary)"><div><div style="font-weight:600;font-size:13px">${c.nombre||c.producto||'—'}</div><div style="font-size:11px;color:#64748b">${c.id||c.id_caja} · ${c.lote}</div></div><div style="text-align:right"><div style="font-weight:700;font-size:13px">${c.pesoNeto||c.peso_neto} kg</div><div style="font-size:11px;color:#64748b">${fmtDate(c.fecIngreso||c.fecha_ingreso)}</div></div></div>`; });
  }
  if (datos.despachos.length > 0) {
    html += `<div style="font-weight:700;font-size:13px;color:#0a4a7a;margin-bottom:8px;margin-top:12px">🚚 Despachos del mes <span style="background:#0a4a7a;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">${datos.despachos.length}</span></div>`;
    datos.despachos.forEach(c => { html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid #0a4a7a"><div><div style="font-weight:600;font-size:13px">${c.nombre||c.producto||'—'}</div><div style="font-size:11px;color:#64748b">${c.id||c.id_caja} · ${c.cliente||c.cliente_destino||'—'}</div></div><div style="text-align:right"><div style="font-weight:700;font-size:13px">${c.pesoNeto||c.peso_neto} kg</div><div style="font-size:11px;color:#64748b">${fmtDate(c.fecSalida||c.fecha_despacho)}</div></div></div>`; });
  }
  contenedor.innerHTML = html;
}

// ============================================================
//  ETIQUETAS
// ============================================================

function generarCodigoBarras(caja) {
  const id = (caja.id || '').replace(/[^0-9]/g, '').slice(-8).padStart(8,'0');
  const anio = new Date().getFullYear().toString().slice(-2);
  return 'FC' + anio + id;
}

function generarEtiqueta() {
  // Si ya hay una etiqueta generada para esta caja, reusar esos datos (ancla)
  if (window._etiquetaFijada) {
    _renderizarEtiqueta(window._etiquetaFijada);
    return;
  }

  const get = id => document.getElementById(id)?.value || '';
  const caja = window._cajaPendienteSheets || {};

  const datos = {
    id:        get('eq-id')        || caja.id        || '',
    sku:       get('eq-sku')       || caja.sku        || '',
    nombre:    get('eq-nombre')    || caja.nombre     || '',
    tipo:      get('eq-tipo')      || caja.tipo       || '',
    lote:      get('eq-lote')      || caja.lote       || '',
    peso:      get('eq-peso')      || caja.pesoNeto   || '',
    pesoBruto: get('eq-pesobruto') || caja.pesoBruto  || '',
    piezas:    get('eq-piezas')    || caja.piezas     || '1',
    fprod:     get('eq-fprod')     || caja.fecProd    || '',
    fvcto:     get('eq-fvcto')     || caja.fecVcto    || '',
    prov:      get('eq-prov')      || caja.proveedor  || '',
    planta:    get('eq-planta')    || caja.planta     || '',
    pais:      get('eq-pais')      || caja.pais       || 'Chile',
    cert:      get('eq-cert')      || caja.cert       || '',
  };

  if (!datos.sku && !datos.nombre && !datos.lote) {
    App.showToast('⚠ Completa al menos SKU, producto y lote'); return;
  }

  // Generar ID único si no hay
  if (!datos.id) {
    datos.id = DB.getNextId();
    const idEl = document.getElementById('eq-id');
    if (idEl) idEl.value = datos.id;
  }

  // Siempre generar barras desde el ID (nunca desde campo cacheado)
  datos.barras = generarCodigoBarras({ id: datos.id });
  const barrasEl = document.getElementById('eq-barras');
  if (barrasEl) barrasEl.value = datos.barras;

  // Anclar etiqueta a estos datos
  window._etiquetaFijada = datos;
  _renderizarEtiqueta(datos);
}

function _renderizarEtiqueta(datos) {

  const fmtDate = d => { if(!d)return'—'; try { const[y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d; } };
  const hoy = new Date().toLocaleDateString('es-CL');
  const diasVcto = datos.fvcto ? Math.ceil((new Date(datos.fvcto)-new Date())/86400000) : null;
  const vctoColor = diasVcto!==null && diasVcto<0 ? '#dc2626' : diasVcto!==null && diasVcto<=7 ? '#d97706' : '#c17b00';

  // Logo SVG de la empresa (reemplaza el copo de nieve)
  const logoSVG = `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAABgAAAAJHCAYAAABW/J2sAAABCGlDQ1BJQ0MgUHJvZmlsZQAAeJxjYGA8wQAELAYMDLl5JUVB7k4KEZFRCuwPGBiBEAwSk4sLGHADoKpv1yBqL+viUYcLcKakFicD6Q9ArFIEtBxopAiQLZIOYWuA2EkQtg2IXV5SUAJkB4DYRSFBzkB2CpCtkY7ETkJiJxcUgdT3ANk2uTmlyQh3M/Ck5oUGA2kOIJZhKGYIYnBncAL5H6IkfxEDg8VXBgbmCQixpJkMDNtbGRgkbiHEVBYwMPC3MDBsO48QQ4RJQWJRIliIBYiZ0tIYGD4tZ2DgjWRgEL7AwMAVDQsIHG5TALvNnSEfCNMZchhSgSKeDHkMyQx6QJYRgwGDIYMZAKbWPz9HbOBQAADYGElEQVR4nOzdeZxkdXX///dda+nqdVZmGHYGEERRBAHBn0FQEUUxGHdFiDGiuKLBDfckbiQuGKPEuBBxN1FjXGLUr6KgsqmggMg24Kw9vdV2t98fzb3evnNr6e7qbeb1fDz6MT1VdW99qupW1e1zPp9zJAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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bNmyBR/4wAeO6++6l7/u9clb3/pWvOY1rwGAhtIncRwjDENYltU2ADzXEkDNCZJOA/Tz1a0EgGEYqgeAruvq5922bQDA/v378aUvfQm/fPzR4/L9O++885K/+Iu/wMtf/nIkSaL6D0RRpHZtyOsRQkA3rI7HXowlgLImAFqVEEqPL3d4yB0669atw43//CX+3UlERER0gvAXMSIiIqJF4K8/9enksssuwxlnnKECou0CqLP1ADjRCYBWc5hLAHK2EkAaBHRdx8TEBDRNw4oVK1Aul9U5TNOEbdt46qmn8PWvfx2PP/74cf2d90v/dGPy8pe/HD09PWpXh6ZpanW753ktj+tGAmAp7ACQTZNd10WSJAjDUJWLGRoawv/8k/9+3L5f733ve5PXvva1OPfcc2FZlgpey34cYRiqj0EQoL+/f8k3Ae52AqDV9cRxjNHRUXzpS1/Cww89yL85iYiIiE4g/jJGREREtEj83lv+S/J7v/d7OP/88xtWwDcEv18IJC/2BED6tfSx6QB1O60Cy80JgFKphFwuB9d1US6X1cp6GVDO5XIIggD1eh0PPvggPve5zx2333tffvErkw9/+MN49atfjfHxcQgh4LouwjCc1gw3rdPvm9xB0C4BIBsSL9YEgK7riOMYhmHA8zzouo6enh784he/wP/6yIeP2/fpH//xH5M1a9agUCjAcRwV5HccB0EQqAQFMLWqvaenB+VyGablzDhu1mD7iU4AzHX85n/fYRhi586deO97/oR/axIREREtAjMXoCQiIiKi4+bOO36gvfv//SNt755dGB8bgWObMHSgWikBSQzL1OF7NYg4RCIiIImnPRIRQdcSaBDqa/leDQK6lqhH83uaH3JMDSL1wAu12hNMxfF1aJoBTTOQJBqEADwvAKDDcXLQdRNBEAHQoesmfD9UQUyZCGhe0d4cJJfvFUJMrR4XQL7QA0034QcRbCcHTTeRQIemmxCJBsO0kUBHT28/3vLW38cNX/rnbMue52Drlqe1fM6BiENoECjkXUShDw0Cjm02BOt1XZ9zYD4daE/fO3l/5NftjmmlVcmldpoTD6o2/gtzaJW4ajjHCz9fYeABSQxdS+A6FirlyTndh/k659zzkm/835uTSy69DL19A9ANC5OlChw3D003EQvAMG2EkUAsgFgApuWg7gUwLafhXrV6AFMJgzAM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moP0zc9lHXMur3Wqv78fExMTqgTSyMgILrvssjmP88UvfhHLly/PPB8iIiIiopMZV8sQEREREXXZV77yleS8887DsmXL4Hke4jhGGIYAANNy1Puy7ABodWx6hX6rFfzzPeds552LKPQBALZtw7IsGIaBIAjwve99D1/+8pf59wkRERERURexBwARERERUZedffbZME0TlUoFnuchCAIYhoGenp6uniddqiddGqhVkL7TwH279zWXBZovwzDQ19eHJEkwMTGBiYkJ6LqO17/+9ZnHJiIiIiKiRkwAEBERERF10Y033phYloWenh7U63UV8DZNE6VSaUHPLev3N+u0T0Dz+xeCpmmoVqsAgGXLlgEAwjDEihUrcM011yzciYmIiIiITkFMABARERERddG5556L3t5ejI6OolgsApgKcNdqNeRyua6co1ur8TvR3HQ4qyiKYNs2hBAolUooFAoQQiCfz+P888/v6rmIiIiIiE51rLFJRERERNQlN33la8nFF1/cdsV98wr9+QTxdV1vOLZVCaB25+70nO2OTfcYkO9Lv9ZO+jUhRENPgvRYSZLgsccew1984uP8O4WIiIiIqAu4A4CIiIiIqAv+41X/OTn33HNnDLB3a9X+bCV9svQAWGi6rqtEiBACQgiVSNB1HatXr8bFr/h3i2OyRERERERLHBMARERERERdcNVVV+H0009XXx/vgPtiCfDPJr0TIf2Qr/X09OBP/uRPTuQUiYiIiIhOGkwAEBERERFl9IY3vjlZu3YtarXatNe6HZifafV/c2+AVl+faO36F8jn8/k8zjvvPLz6N37zxE+WiIiIiGiJYwKAiIiIiCijt771rejr60O5XAYwPUh/IgLviy3wLzWX/GkuCZQkCVzXxTve8Y4TPVUiIiIioiWPCQAiIiIiogz+n997a7JmzRrUajU4jjNjXf6F6AHQatyZegA0l95pVYpnIc3WI6FaraK/vx9r167FG9905eLJXBARERERLUFMABARERERZfC2t70NruuiVqvBtm31PHsAtDZbDwDHcTA5OQnXdfH7v//7J3KqRERERERLHhMARERERETz9P4PfCgpFovo7e2FbduoVqsnekqLvgdAc8mf5pJASZLAMAw4joPly5fjzVf+hxM/aSIiIiKiJYoJACIiIiKiebr44osxODgIIQSCIIBt24iiCLo+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ASGECrrLr3W9cX3OTCvqm1fht3pvq1JBuq63reU/UyNf+XwURTNc7fQERvN4gV9HkiRwHAf79+/HPffcw9X/REREREQLhAkAIiIiIqIFds899+Ccc87BihUrEISxWhEvEwAyIN8cnG9X67+Vmd7bLqifTh6kdw+0mkOnDX+jKJq2E0Eer2kawjDES17yEuzatQs333xzR2MSEREREdH8sAQQEREREdECu+OOO7QdO3YAwLQSOZKmaTAMo2VJnebyOungukwiyFJAae1W9LcK6svxTNOEZVkwTbOhxFCr8VuxLAuWZcG2bZim2TA3wzBQKBRQrVbxyCOP4LnnnuPqfyIiIiKiBcQdAEREREREx8Edd9yBVatWodjTB2Aq4B5FUUMyIIoi1RdAvif9EQAMw5j2fDqg3+r4dKBflhlqNXarhEDz67M1+pWljJIkQRzH6pyapiGOY7iOhUOHDuGuu+6acRwiIiIiIsqOOwCIiIiIiI6D+++/X9u7dy+EEGqVvQzGy5X6si9Ac03+9EOuzG9u1isTCc1NepsfzZpr9st+BPKR3nHQyfjNuxMMw4Bt2w27GzZu3IihoSGu/iciIiIiWmDcAUBEREREdJw8+uijeMUrL0GxWISu6wjDsKERsKzFDzSuxm9ewZ8OyDdrtYq/k5X98mNzkqA5IRGG4YzXmO5rIJMdpmkijmP4vo+nn3oCn/vc5xj8JyIiIiI6DpgAICIiIiI6Tm655RbtzJUvTZYvXw7XdRGGIQzDgGVZiONYlcxpV/8fmGqyCzQG92XQvTlA3yoBkC4hlH5NfvQ8b1pCID0Hef52giBQuxniOFa1/8MwRLVaxS8e/Pm87x8RERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERERnTL+fzLY/3oZwR6eAAAAAElFTkSuQmCC" width="60" height="38" style="object-fit:contain;display:block;flex-shrink:0" alt="FrigoCarnes">`;
  const contenedor = document.getElementById('etiqueta-contenido');
  contenedor.innerHTML = `
  <div id="etiqueta-print" style="font-family:Arial,sans-serif;width:100%;max-width:480px;margin:0 auto;background:#fff;color:#1a3a2a">
    <!-- HEADER -->
    <div style="background:#1a3a2a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <div style="display:flex;align-items:center;gap:10px">
        ${logoSVG}
        <div>
          <div style="font-size:17px;font-weight:800;letter-spacing:1px;color:#C4953A">FRIGOCARNES</div>
          <div style="font-size:9px;opacity:0.75;margin-top:1px;color:#fff">ETIQUETA OFICIAL · TRAZABILIDAD SAG/SEREMI</div>
        </div>
      </div>
      <div style="text-align:right;font-size:10px;opacity:0.85;color:#fff">
        <div>${hoy}</div>
        ${datos.id ? '<div style="font-weight:700;color:#C4953A">'+datos.id+'</div>' : ''}
      </div>
    </div>

    <!-- CUERPO -->
    <div style="padding:12px 14px;background:#fff">
      <div style="font-size:18px;font-weight:900;color:#1a3a2a;line-height:1.1;margin-bottom:2px">${datos.nombre||'—'}</div>
      <div style="font-size:12px;font-weight:700;color:#C4953A;margin-bottom:10px">${datos.tipo||'—'} · ${datos.pais||'Chile'}</div>

      <table style="width:100%;border-collapse:collapse;font-size:10.5px">
        <tr style="background:#f0f7f2">
          <td style="padding:3px 6px;color:#1a3a2a;width:42%;font-weight:600">N° Lote</td>
          <td style="padding:3px 6px;font-weight:800;color:#1a3a2a">${datos.lote||'—'}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px;color:#555;font-weight:600">SKU</td>
          <td style="padding:3px 6px;font-weight:700">${datos.sku||'—'}</td>
        </tr>
        <tr style="background:#f0f7f2">
          <td style="padding:3px 6px;color:#1a3a2a;font-weight:700">Peso Neto</td>
          <td style="padding:3px 6px;font-weight:800;color:#1a3a2a">${datos.peso ? datos.peso+' kg' : '—'}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px;color:#555;font-weight:600">Peso Bruto</td>
          <td style="padding:3px 6px">${datos.pesoBruto ? datos.pesoBruto+' kg' : '—'}</td>
        </tr>
        <tr style="background:#f0f7f2">
          <td style="padding:3px 6px;color:#555;font-weight:600">N° Piezas</td>
          <td style="padding:3px 6px">${datos.piezas||'1'}</td>
        </tr>
        <tr>
          <td style="padding:3px 6px;color:#555;font-weight:600">F. Producción</td>
          <td style="padding:3px 6px">${fmtDate(datos.fprod)}</td>
        </tr>
        <tr style="background:#fff3cd">
          <td style="padding:3px 6px;color:#7a5c00;font-weight:700">F. Vencimiento</td>
          <td style="padding:3px 6px;font-weight:900;color:${vctoColor}">
            ${fmtDate(datos.fvcto)}${diasVcto!==null?' ('+Math.abs(diasVcto)+'d '+(diasVcto<0?'VENCIDA':'restantes')+')':''}
          </td>
        </tr>
        <tr style="background:#f0f7f2">
          <td style="padding:3px 6px;color:#555;font-weight:600">Proveedor</td>
          <td style="padding:3px 6px">${datos.prov||'—'}</td>
        </tr>
        ${datos.planta ? `<tr><td style="padding:3px 6px;color:#555;font-weight:600">Establecimiento</td><td style="padding:3px 6px">${datos.planta}</td></tr>` : ''}
        ${datos.cert ? `<tr style="background:#f0f7f2"><td style="padding:3px 6px;color:#555;font-weight:600">Certificaciones</td><td style="padding:3px 6px;font-size:9.5px">${datos.cert}</td></tr>` : ''}
      </table>
    </div>

    <!-- CÓDIGO DE BARRAS -->
    <div style="padding:8px 14px 10px;text-align:center;border-top:1px solid #e2e8f0;background:#fff">
      <div id="barcode-wrapper"></div>
      <div style="font-size:9px;color:#64748b;margin-top:2px">${datos.barras||''}</div>
    </div>

    <!-- FOOTER -->
    <div style="background:#1a3a2a;color:#C4953A;padding:5px 14px;font-size:8px;display:flex;justify-content:space-between">
      <span style="color:#fff">Producto alimenticio de origen animal · Reglamento SAG · DS N°594</span>
      <span>${datos.pais||'Chile'} · Trazabilidad certificada</span>
    </div>
  </div>`;

  document.getElementById('etiqueta-preview').style.display = 'block';
  window._datosEtiquetaActual = datos;

  // Dibujar código de barras
  const wrapper = document.getElementById('barcode-wrapper');
  if (wrapper) {
    const canvas = document.createElement('canvas');
    canvas.style.maxWidth = '100%';
    wrapper.appendChild(canvas);
    try {
      Barcode.draw(canvas, datos.barras, { width:2, height:55, displayValue:true, fontSize:11, margin:4, lineColor:'#1a3a2a', background:'#ffffff' });
    } catch(e) { console.error('[Barcode]', e); }
  }

  // Mostrar botón añadir stock si hay caja pendiente
  const btnAdd = document.getElementById('btn-add-stock');
  if (btnAdd) btnAdd.style.display = window._cajaPendienteSheets ? '' : 'none';

  App.showToast('✓ Etiqueta generada');
}

function imprimirEtiqueta() {
  const etiqueta = document.getElementById('etiqueta-print');
  if (!etiqueta) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta FrigoCarnes</title>
    <style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;padding:20px;background:#f0f0f0}
    @media print{body{background:#fff;padding:0}@page{size:A6 landscape;margin:5mm}}</style>
  </head><body>${etiqueta.outerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

function descargarEtiqueta() {
  App.showToast('💡 Usa "Imprimir" y guarda como PDF desde el diálogo de impresión');
}

function cargarDesdeCaja() {
  const modal = document.getElementById('modal-caja');
  const lista = document.getElementById('modal-lista');
  const cajas = DB.getStock().filter(c => c.estado !== 'Despachado');
  lista.innerHTML = cajas.map(c => `
    <div onclick="seleccionarCajaEtiqueta('${c.id}')" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer">
      <div style="font-weight:700;font-size:13px">${c.nombre}</div>
      <div style="font-size:11px;color:#64748b">${c.id} · ${c.sku} · ${c.lote}</div>
    </div>
  `).join('') || '<div style="text-align:center;color:#94a3b8;padding:20px">Sin cajas en stock</div>';
  modal.style.display = 'block';
}

function filtrarModalCajas() {
  const s = document.getElementById('modal-search').value.toLowerCase();
  const cajas = DB.getStock().filter(c => c.estado !== 'Despachado' && [c.id, c.sku, c.nombre, c.lote].join(' ').toLowerCase().includes(s));
  document.getElementById('modal-lista').innerHTML = cajas.map(c => `
    <div onclick="seleccionarCajaEtiqueta('${c.id}')" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer">
      <div style="font-weight:700;font-size:13px">${c.nombre}</div>
      <div style="font-size:11px;color:#64748b">${c.id} · ${c.sku} · ${c.lote}</div>
    </div>
  `).join('') || '<div style="text-align:center;color:#94a3b8;padding:20px">Sin resultados</div>';
}

function seleccionarCajaEtiqueta(id) {
  window._etiquetaFijada = null; // nueva caja, desanclar
  const c = DB.getStock().find(x => x.id === id);
  if (!c) return;
  const set = (elId, v) => { const el = document.getElementById(elId); if(el) el.value = v || ''; };
  set('eq-sku', c.sku);
  set('eq-nombre', c.nombre);
  set('eq-tipo', c.tipo || 'Vacuno');
  set('eq-lote', c.lote);
  set('eq-peso', c.pesoNeto);
  set('eq-fprod', c.fecProd);
  set('eq-fvcto', c.fecVcto);
  set('eq-prov', c.proveedor);
  set('eq-pais', c.pais);
  set('eq-id', c.id);
  document.getElementById('modal-caja').style.display = 'none';
  App.showToast('✓ Datos cargados de ' + c.id);
}

// ============================================================
//  BADGE DE ALERTAS
// ============================================================

function actualizarBadgeAlertas() {
  let stock = DB.getStock();
  if (!stock || !Array.isArray(stock)) stock = [];
  const hoy = new Date();
  const hayAlertas = stock.some(c => {
    if (c.estado === 'Despachado') return false;
    if (!c.fecVcto) return false;
    const dias = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
    return dias <= 30;
  });
  const b1 = document.getElementById('alerta-badge-top');
  const b2 = document.getElementById('alerta-badge-bnav');
  if(b1) b1.style.display = hayAlertas ? 'block' : 'none';
  if(b2) b2.style.display = hayAlertas ? 'block' : 'none';
}

// ============================================================
//  CÓDIGO DE BARRAS POR SCANNER
// ============================================================

function buscarPorCodigoBarras(codigo) {
  if (!codigo) return null;
  const stock = DB.getStock();
  let caja = stock.find(c => c.codigoBarras === codigo && c.estado !== 'Despachado');
  if (!caja && codigo.startsWith('FC')) {
    const idNum = codigo.slice(4);
    caja = stock.find(c => c.id && c.id.replace(/[^0-9]/g,'').slice(-8).padStart(8,'0') === idNum && c.estado !== 'Despachado');
  }
  return caja || null;
}

function escanearYDescontarCodigo() {
  const input = document.getElementById('scan-barcode-input');
  const codigo = input?.value?.trim();
  if (!codigo) { App.showToast('⚠ Ingresa o escanea un código'); return; }
  const caja = buscarPorCodigoBarras(codigo);
  if (!caja) { App.showToast('⚠ Caja no encontrada: ' + codigo); if(input)input.value=''; return; }
  const fmtDate = d => { try { const[y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; } };
  if (!confirm('¿Descontar del stock?\n\n'+caja.nombre+'\n'+caja.id+' · Lote '+caja.lote+'\nPeso: '+caja.pesoNeto+' kg\nVcto: '+fmtDate(caja.fecVcto))) { if(input)input.value=''; return; }
  const s = DB.getSession();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  DB.updateCaja(caja.id, { estado:'Despachado', fecSalida:hoy, horaSalida:hora, operarioDespacho:s?.usuario||'Sistema' });
  DB.addMovimiento(caja.id, 'Despachado por código de barras por '+(s?.usuario||'Sistema'));
  enviarASheets({ tipo:'despacho', id_caja:caja.id, sku:caja.sku, producto:caja.nombre, tipo_carne:caja.tipo, lote:caja.lote, fecha_vencimiento:caja.fecVcto, peso_neto:caja.pesoNeto, proveedor:caja.proveedor, fecha_despacho:hoy, hora_despacho:hora, operario_despacho:s?.usuario||'Sistema' });
  App.showToast('✓ '+caja.id+' ('+caja.nombre+') descontado del stock');
  if(input)input.value='';
  renderDashboard();
  actualizarBadgeAlertas();
}

function handleBarcodeScan(e) {
  if (e.key === 'Enter') escanearYDescontarCodigo();
}

// ============================================================
//  ESCÁNER REMOTO
// ============================================================

const ScannerRemoto = (() => {
  let pollingActivo = false;
  let intervalId = null;
  const BACKEND = 'https://frigocarnes-backend-production.up.railway.app';

  function getUsuario() {
    try {
      const s = JSON.parse(sessionStorage.getItem('frigocarnes_session'));
      return s?.usuario || 'Carlos (Administrador)';
    } catch { return 'Carlos (Administrador)'; }
  }

  function actualizarEstadoPanel(estado, texto) {
    const el = document.getElementById('sr-estado');
    if (!el) return;
    const colores = {
      esperando:  { bg:'rgba(196,149,58,0.1)',  color:'#C4953A', border:'rgba(196,149,58,0.3)' },
      recibiendo: { bg:'rgba(255,255,255,0.05)', color:'#8C8880', border:'#3A3A36' },
      procesando: { bg:'rgba(255,255,255,0.05)', color:'#C4953A', border:'#3A3A36' },
      listo:      { bg:'rgba(74,124,89,0.15)',   color:'#6BAF84', border:'rgba(74,124,89,0.3)' },
      error:      { bg:'rgba(139,26,42,0.15)',   color:'#C4536A', border:'rgba(139,26,42,0.3)' }
    };
    const c = colores[estado] || colores.esperando;
    el.style.background = c.bg; el.style.color = c.color; el.style.border = '1px solid ' + c.border;
    el.textContent = texto;
  }

  async function procesarFoto(imagenBase64, mediaType, resultado) {
    actualizarEstadoPanel('procesando', '⟳ Leyendo la etiqueta...');
    try {
      const parsed = resultado || {};

      const set = (id, val) => {
        if (!val && val !== 0) return;
        const el = document.getElementById(id);
        if (el) { el.value = val; el.classList.add('autofilled'); }
      };

      set('f-sku', parsed.sku);
      set('f-nombre', parsed.nombre);
      set('f-lote', parsed.lote);
      set('f-barras', parsed.codigoBarras);
      set('f-peso-neto', parsed.pesoNeto);
      set('f-peso-bruto', parsed.pesoBruto);
      set('f-piezas', parsed.piezas || 1);
      set('f-fprod', parsed.fechaProduccion);
      set('f-fenv', parsed.fechaEnvasado);
      set('f-fvcto', parsed.fechaVencimiento);
      set('f-prov', parsed.proveedor);
      set('f-planta', parsed.planta);
      set('f-cert', parsed.certificaciones);
      set('f-obs', parsed.observaciones);

      // Tipo de carne — búsqueda flexible para cubrir variantes del OCR
      if (parsed.tipo) {
        const tipoEl = document.getElementById('f-tipo');
        if (tipoEl) {
          const tipoNorm = parsed.tipo.toLowerCase().trim();
          const match = [...tipoEl.options].find(o =>
            o.value.toLowerCase() === tipoNorm ||
            o.value.toLowerCase().includes(tipoNorm) ||
            tipoNorm.includes(o.value.toLowerCase())
          );
          if (match) tipoEl.value = match.value;
        }
      }

      // País
      if (parsed.pais) {
        const paisEl = document.getElementById('f-pais');
        if (paisEl) {
          const match = [...paisEl.options].find(o => o.value.toLowerCase().includes(parsed.pais.toLowerCase()) || parsed.pais.toLowerCase().includes(o.value.toLowerCase()));
          if (match) paisEl.value = match.value;
        }
      }

      const sess = DB.getSession();
      if (sess) { const op = document.getElementById('f-op'); if(op) op.value = sess.usuario; }

      actualizarEstadoPanel('listo', '✅ Formulario llenado — revisa y registra la caja');
      App.showToast('✓ Etiqueta leída desde el celular');

      // Limpiar la foto del servidor para poder recibir otra SIN salir de la app
      await fetch(BACKEND + '/api/scanner/pendiente/' + encodeURIComponent(getUsuario()), { method: 'DELETE' });

      // Resetear estado para recibir nueva foto después de 6 segundos
      setTimeout(() => actualizarEstadoPanel('esperando', '📷 Listo para nueva foto — escanea otra caja'), 6000);

    } catch(err) {
      console.error('[ScannerRemoto]', err);
      actualizarEstadoPanel('error', '❌ Error: ' + err.message);
      await fetch(BACKEND + '/api/scanner/pendiente/' + encodeURIComponent(getUsuario()), { method: 'DELETE' }).catch(()=>{});
      setTimeout(() => actualizarEstadoPanel('esperando', '📷 Esperando nueva foto del celular...'), 4000);
    }
  }

  async function poll() {
    if (!pollingActivo) return;
    try {
      const usuario = getUsuario();
      const res = await fetch(BACKEND + '/api/scanner/pendiente/' + encodeURIComponent(usuario));
      if (!res.ok) return;
      const data = await res.json();
      if (data.hay_foto) {
        actualizarEstadoPanel('recibiendo', '📥 Foto recibida, procesando...');
        await procesarFoto(data.imagenBase64, data.mediaType, data.resultado);
      }
    } catch(e) {}
  }

  function iniciar() {
    if (pollingActivo) return;
    pollingActivo = true;
    intervalId = setInterval(poll, 1000);
    actualizarEstadoPanel('esperando', '📷 Esperando nueva foto del celular...');
    const usuario = getUsuario();
    const link = document.getElementById('link-scanner-celular');
    if (link) {
      const base = link.href.split('?')[0];
      link.href = base + '?usuario=' + encodeURIComponent(usuario);
    }
    console.log('[ScannerRemoto] Iniciado para:', usuario);
  }

  function detener() {
    pollingActivo = false;
    if (intervalId) { clearInterval(intervalId); intervalId = null; }
  }

  return { iniciar, detener, activo: () => pollingActivo };
})();

// ============================================================
//  INIT
// ============================================================


function resetearAppCompleto() {
  // Solo supervisores
  const s = DB.getSession();
  if (!s || s.rol !== 'supervisor') return;

  const modal = document.getElementById('modal-reset');
  if (!modal) return;
  modal.style.display = 'flex';

  // Countdown de 5 segundos
  const btn = document.getElementById('btn-confirmar-reset');
  const span = document.getElementById('reset-countdown');
  btn.disabled = true;
  btn.style.background = '#9ca3af';
  btn.style.cursor = 'not-allowed';
  let secs = 5;
  span.textContent = secs;
  const interval = setInterval(() => {
    secs--;
    span.textContent = secs;
    if (secs <= 0) {
      clearInterval(interval);
      btn.disabled = false;
      btn.style.background = '#dc2626';
      btn.style.cursor = 'pointer';
      btn.innerHTML = 'Borrar todo';
    }
  }, 1000);
  btn._interval = interval;
}

function cerrarModalReset() {
  const modal = document.getElementById('modal-reset');
  if (modal) modal.style.display = 'none';
  const btn = document.getElementById('btn-confirmar-reset');
  if (btn && btn._interval) clearInterval(btn._interval);
}

async function ejecutarResetTotal() {
  const modal = document.getElementById('modal-reset');
  if (modal) modal.style.display = 'none';

  // Mostrar progreso
  const toast = document.getElementById('toast');
  if (toast) { toast.textContent = '⏳ Borrando datos...'; toast.style.display = 'block'; }

  // 1. Enviar reset a Sheets y esperar
  try {
    const resetPayload = encodeURIComponent(JSON.stringify({ tipo: 'reset_total' }));
    await fetch(SHEETS_CONFIG.url + '?payload=' + resetPayload, { method: 'GET', mode: 'no-cors' });
  } catch(e) {}

  // 2. Limpiar TODO el localStorage
  localStorage.clear();
  sessionStorage.clear();

  // 3. Recargar
  if (toast) { toast.textContent = '✓ Datos borrados — recargando...'; }
  setTimeout(() => { window.location.href = window.location.href.split('?')[0]; }, 1200);
}

function simularEtiquetaPrueba() {
  // Datos de etiqueta de prueba realistas
  const demos = [
    { sku:'VAC-LOM-001', nombre:'Lomo liso vacuno', tipo:'Vacuno', lote:'L-'+new Date().getFullYear()+'-001',
      pesoNeto:21.4, pesoBruto:23.0, piezas:1, fechaProduccion: (() => { const d=new Date(); d.setDate(d.getDate()-2); return d.toISOString().split('T')[0]; })(),
      fechaVencimiento: (() => { const d=new Date(); d.setDate(d.getDate()+150); return d.toISOString().split('T')[0]; })(),
      proveedor:'Frigorífico Sur SpA', pais:'Chile', planta:'Planta Maipú',
      codigoBarras:'7802345678901', certificaciones:'SEREMI N°456, PABCO' },
    { sku:'CER-PAL-002', nombre:'Paleta cerdo deshuesada', tipo:'Cerdo', lote:'L-'+new Date().getFullYear()+'-002',
      pesoNeto:18.5, pesoBruto:20.0, piezas:1, fechaProduccion: (() => { const d=new Date(); d.setDate(d.getDate()-1); return d.toISOString().split('T')[0]; })(),
      fechaVencimiento: (() => { const d=new Date(); d.setDate(d.getDate()+90); return d.toISOString().split('T')[0]; })(),
      proveedor:'CarnesCL Ltda.', pais:'Chile', planta:'Planta Lampa',
      codigoBarras:'7801234567890', certificaciones:'PABCO' },
    { sku:'POL-PEC-003', nombre:'Pechuga pollo sin hueso', tipo:'Pollo', lote:'L-'+new Date().getFullYear()+'-003',
      pesoNeto:12.0, pesoBruto:13.2, piezas:6, fechaProduccion: (() => { const d=new Date(); return d.toISOString().split('T')[0]; })(),
      fechaVencimiento: (() => { const d=new Date(); d.setDate(d.getDate()+60); return d.toISOString().split('T')[0]; })(),
      proveedor:'Agrosuper S.A.', pais:'Chile', planta:'Agrosuper Rosario',
      codigoBarras:'7804567891230', certificaciones:'ISO 22000' },
  ];
  const parsed = demos[Math.floor(Math.random() * demos.length)];

  const set = (id, val) => {
    if (!val && val !== 0) return;
    const el = document.getElementById(id);
    if (el) { el.value = val; el.classList.add('autofilled'); }
  };

  set('f-sku',       parsed.sku);
  set('f-nombre',    parsed.nombre);
  set('f-lote',      parsed.lote);
  set('f-barras',    parsed.codigoBarras);
  set('f-peso-neto', parsed.pesoNeto);
  set('f-peso-bruto',parsed.pesoBruto);
  set('f-piezas',    parsed.piezas || 1);
  set('f-fprod',     parsed.fechaProduccion);
  set('f-fvcto',     parsed.fechaVencimiento);
  set('f-prov',      parsed.proveedor);
  set('f-planta',    parsed.planta);
  set('f-cert',      parsed.certificaciones);

  // Tipo de carne — búsqueda flexible en las opciones del select
  if (parsed.tipo) {
    const tipoEl = document.getElementById('f-tipo');
    if (tipoEl) {
      const tipoNorm = parsed.tipo.toLowerCase().trim();
      // Búsqueda exacta primero, luego parcial
      const match = [...tipoEl.options].find(o =>
        o.value.toLowerCase() === tipoNorm ||
        o.value.toLowerCase().includes(tipoNorm) ||
        tipoNorm.includes(o.value.toLowerCase())
      );
      if (match) tipoEl.value = match.value;
    }
  }

  // País
  if (parsed.pais) {
    const paisEl = document.getElementById('f-pais');
    if (paisEl) {
      const match = [...paisEl.options].find(o =>
        o.value.toLowerCase().includes(parsed.pais.toLowerCase()) ||
        parsed.pais.toLowerCase().includes(o.value.toLowerCase())
      );
      if (match) paisEl.value = match.value;
    }
  }

  const sess = DB.getSession();
  if (sess) { const op = document.getElementById('f-op'); if(op) op.value = sess.usuario; }

  App.showToast('✓ Etiqueta de prueba cargada — ' + parsed.nombre);
}

document.addEventListener('DOMContentLoaded', () => {
  const session = DB.getSession();
  if (session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('topUser').textContent = session.usuario;
    const fop = document.getElementById('f-op'); if(fop) fop.value = session.usuario;
    aplicarPermisosRol(session.rol);
    irA('dashboard');
  }
  document.getElementById('loginPin')?.addEventListener('keydown', e => { if(e.key==='Enter') login(); });
  setTimeout(actualizarBadgeAlertas, 500);
  setTimeout(() => { if(typeof actualizarBadgePedidos==='function') actualizarBadgePedidos(); }, 600);
  setInterval(actualizarBadgeAlertas, 5 * 60 * 1000);
  setInterval(() => { if(typeof actualizarBadgePedidos==='function') actualizarBadgePedidos(); }, 60 * 1000);
});

// Estado de conexión
function mostrarEstadoConexion(ok) {
  // Visual feedback (opcional)
  console.log('[Conexión]', ok ? 'Online' : 'Offline');
}
