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
      DBSync.inicializar().then(() => { renderDashboard(); renderStock(); actualizarBadgeAlertas(); });
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
    stock: typeof renderStock === 'function' ? renderStock : null,
    alertas: typeof renderAlertas === 'function' ? renderAlertas : null,
    reportes: typeof renderReportes === 'function' ? renderReportes : null,
    ingresar: () => { if(typeof ScannerRemoto !== 'undefined') ScannerRemoto.iniciar(); },
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
        <button class="btn" style="background:#fee2e2;color:#991b1b;padding:11px 14px" onclick="if(confirm('¿Eliminar esta caja? Esta acción se registrará en Sheets.'))eliminarCaja('${c.id}')">🗑 Eliminar</button>
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
    if (search) {
      const h = [c.id, c.sku, c.lote, c.nombre, c.proveedor, c.tipo, c.camara].join(' ').toLowerCase();
      if (!h.includes(search)) return false;
    }
    if (f === 'todos') return true;
    if (f === 'vcto7') {
      const d = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
      return d >= 0 && d <= 7 && c.estado !== 'Despachado';
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
    irA('etiquetas');
    setTimeout(() => { if(typeof generarEtiqueta === 'function') generarEtiqueta(); }, 200);
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
    operario: caja.operarioIngreso,
    fecha_ingreso: caja.fecIngreso,
    hora: caja.horaIngreso,
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
    await fetch(SHEETS_CONFIG.url, {
      method: 'POST', mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'cierre_mes', periodo: key, mes_nombre: mesNom, anio,
        ingresos: ingMes.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, tipo_carne:c.tipo, lote:c.lote, fecha_vencimiento:c.fecVcto, peso_neto:c.pesoNeto, proveedor:c.proveedor, estado:c.estado, operario:c.operarioIngreso, fecha_ingreso:c.fecIngreso })),
        despachos: despMes.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, tipo_carne:c.tipo, lote:c.lote, peso_neto:c.pesoNeto, proveedor:c.proveedor, cliente:c.cliente, fecha_despacho:c.fecSalida, operario:c.operarioDespacho })),
        stock_final: stockDisponible.map(c => ({ id_caja:c.id, sku:c.sku, producto:c.nombre, peso_neto:c.pesoNeto, estado:c.estado, camara:c.camara, fecha_vencimiento:c.fecVcto })),
        resumen: cierres[key].resumen
      })
    });
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
    barras:    get('eq-barras')    || caja.codigoBarras || '',
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

  if (!datos.barras) {
    datos.barras = generarCodigoBarras({ id: datos.id });
    const barrasEl = document.getElementById('eq-barras');
    if (barrasEl) barrasEl.value = datos.barras;
  }

  const fmtDate = d => { if(!d)return'—'; try { const[y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d; } };
  const hoy = new Date().toLocaleDateString('es-CL');
  const diasVcto = datos.fvcto ? Math.ceil((new Date(datos.fvcto)-new Date())/86400000) : null;
  const vctoColor = diasVcto!==null && diasVcto<0 ? '#dc2626' : diasVcto!==null && diasVcto<=7 ? '#d97706' : '#c17b00';

  // Logo SVG de la empresa (reemplaza el copo de nieve)
  const logoSVG = `<img src="data:image/jpeg;base64,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" width="44" height="44" style="object-fit:contain;border-radius:8px;background:#fff;flex-shrink:0" alt="FrigoCarnes">`;
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

      // Tipo de carne: set directamente (opciones coinciden exactamente)
      if (parsed.tipo) {
        const tipoEl = document.getElementById('f-tipo');
        if (tipoEl) tipoEl.value = parsed.tipo;
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
  setInterval(actualizarBadgeAlertas, 5 * 60 * 1000);
});

// Estado de conexión
function mostrarEstadoConexion(ok) {
  // Visual feedback (opcional)
  console.log('[Conexión]', ok ? 'Online' : 'Offline');
}
