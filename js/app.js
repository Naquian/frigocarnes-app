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
  // Mostrar/ocultar tabs de supervisor
  document.querySelectorAll('.supervisor-only').forEach(el => {
    el.style.display = esSupervisor ? '' : 'none';
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
  const logoSVG = `<svg viewBox="0 0 40 40" width="36" height="36" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0">
    <rect width="40" height="40" rx="10" fill="#C4953A"/>
    <text x="20" y="27" text-anchor="middle" font-size="18" font-family="Arial,sans-serif" font-weight="900" fill="#1a3a2a">FC</text>
  </svg>`;

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
