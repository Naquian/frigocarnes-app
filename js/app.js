/* =============================================
   FRIGOCARNES WMS — Lógica principal
   ============================================= */

const App = (() => {
  let filtroActivo = 'todos';

  // --- Utilidades ---
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

  // --- Auth ---
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
      irA('dashboard');
      setTimeout(() => {
        DBSync.inicializar().then(() => { renderDashboard(); renderStock(); actualizarBadgeAlertas(); });
      }, 100);
    }

    // Intentar login con backend
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
      errEl.textContent = 'Error de conexión con el servidor';
      errEl.style.display = 'block';
    }
  }

function filtrarCajas() { renderStock(); }

  // --- Detalle ---
  function verDetalle(id) {
    const c = DB.getStock().find(x => x.id === id);
    if (!c) return;
    const dias = diasRestantes(c.fecVcto);

    document.getElementById('detalleContent').innerHTML = `
      <div class="det-header">
        <div class="det-title">${c.nombre}</div>
        <div class="det-sub">${c.id} · ${c.sku} · ${estadoBadge(c.estado)}</div>
      </div>
      <div class="det-body">
        <div class="det-section">
          <div class="det-sec-title">Identificación</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">ID Caja</div><div class="det-val">${c.id}</div></div>
            <div class="det-field"><div class="det-label">SKU</div><div class="det-val">${c.sku}</div></div>
            <div class="det-field"><div class="det-label">Lote</div><div class="det-val">${c.lote}</div></div>
            <div class="det-field"><div class="det-label">Tipo</div><div class="det-val">${c.tipo}</div></div>
            <div class="det-field"><div class="det-label">Categoría</div><div class="det-val">${c.categoria || '—'}</div></div>
            <div class="det-field"><div class="det-label">Cód. barras</div><div class="det-val">${c.codigoBarras || '—'}</div></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Peso y cantidad</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">Peso neto</div><div class="det-val">${c.pesoNeto} kg</div></div>
            <div class="det-field"><div class="det-label">Peso bruto</div><div class="det-val">${c.pesoBruto || '—'} kg</div></div>
            <div class="det-field"><div class="det-label">Piezas</div><div class="det-val">${c.piezas}</div></div>
            <div class="det-field"><div class="det-label">Unidad</div><div class="det-val">${c.unidad}</div></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Fechas</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">Producción</div><div class="det-val">${fmtDate(c.fecProd)} ${c.horaProd || ''}</div></div>
            <div class="det-field"><div class="det-label">Envasado</div><div class="det-val">${fmtDate(c.fecEnv)}</div></div>
            <div class="det-field"><div class="det-label">Vencimiento</div><div class="det-val" style="color:var(--${dias<0?'danger':dias<=7?'warn':'ok'})">${fmtDate(c.fecVcto)} ${dias<0?'(VENCIDA)':`(${dias}d)`}</div></div>
            <div class="det-field"><div class="det-label">Ingreso bodega</div><div class="det-val">${fmtDate(c.fecIngreso)} ${c.horaIngreso}</div></div>
            ${c.fecSalida ? `<div class="det-field"><div class="det-label">Salida bodega</div><div class="det-val">${fmtDate(c.fecSalida)} ${c.horaSalida}</div></div>` : ''}
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Ubicación</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">Cámara de frío</div><div class="det-val" style="color:var(--cold)">${c.camara}</div></div>
            <div class="det-field"><div class="det-label">Pallet</div><div class="det-val">${c.pallet || '—'}</div></div>
            <div class="det-field"><div class="det-label">Rack</div><div class="det-val">${c.rack || '—'}</div></div>
            <div class="det-field"><div class="det-label">Fila / Nivel</div><div class="det-val">${c.fila || '—'} / ${c.nivel || '—'}</div></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Origen</div>
          <div class="det-grid">
            <div class="det-field full"><div class="det-label">Proveedor</div><div class="det-val">${c.proveedor}</div></div>
            <div class="det-field full"><div class="det-label">Planta faenadora</div><div class="det-val">${c.planta || '—'}</div></div>
            <div class="det-field"><div class="det-label">País</div><div class="det-val">${c.pais}</div></div>
            <div class="det-field"><div class="det-label">Temp. req.</div><div class="det-val">${c.temp}</div></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Sanitario</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">Inspección</div><div class="det-val">${c.inspeccion}</div></div>
            <div class="det-field full"><div class="det-label">Certificaciones</div><div class="det-val">${c.cert || '—'}</div></div>
          </div>
        </div>
        <div class="det-section">
          <div class="det-sec-title">Responsables</div>
          <div class="det-grid">
            <div class="det-field"><div class="det-label">Op. ingreso</div><div class="det-val">${c.operarioIngreso}</div></div>
            <div class="det-field"><div class="det-label">Op. despacho</div><div class="det-val">${c.operarioDespacho || '—'}</div></div>
            ${c.cliente ? `<div class="det-field"><div class="det-label">Cliente</div><div class="det-val">${c.cliente}</div></div>` : ''}
            ${c.oc ? `<div class="det-field"><div class="det-label">Orden compra</div><div class="det-val">${c.oc}</div></div>` : ''}
          </div>
        </div>
        ${c.obs ? `<div class="det-section"><div class="det-sec-title">Observaciones</div><div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px">${c.obs}</div></div>` : ''}
        <div class="det-section">
          <div class="det-sec-title">Historial de trazabilidad</div>
          <div class="timeline">
            ${(c.movimientos || []).map((m, i, arr) => `
              <div class="tl-item">
                <div class="tl-line"><div class="tl-dot"></div>${i < arr.length-1 ? '<div class="tl-conn"></div>':''}</div>
                <div class="tl-content">
                  <div class="tl-event">${m.split(' — ')[1] || m}</div>
                  <div class="tl-meta">${m.split(' — ')[0] || ''}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn btn-secondary" onclick="cerrarOverlay()" style="flex:1">✕ Cerrar</button>
          ${c.estado !== 'Despachado' ? `<button class="btn btn-primary" onclick="despacharUna('${c.id}');cerrarOverlay()" style="flex:1">→ Despachar</button>` : ''}
          <button class="btn" style="background:#fee2e2;color:#991b1b;flex:0 0 auto;padding:11px 14px" onclick="if(confirm('¿Eliminar esta caja?'))eliminarCaja('${c.id}')">🗑</button>
        </div>
      </div>`;

    document.getElementById('detalleOverlay').style.display = 'block';
  }

  function cerrarOverlay(e) {
    if (!e || e.target === document.getElementById('detalleOverlay')) {
      document.getElementById('detalleOverlay').style.display = 'none';
    }
  }

  // --- Despacho ---
  function renderDespacho() {
    const search = (document.getElementById('despSearch')?.value || '').toLowerCase();
    const cajas = DB.getStock().filter(c => {
      if (c.estado === 'Despachado') return false;
      if (search) {
        return [c.id,c.sku,c.nombre,c.cliente,c.oc].join(' ').toLowerCase().includes(search);
      }
      return true;
    }).sort((a,b) => new Date(a.fecVcto) - new Date(b.fecVcto)); // FEFO

    document.getElementById('despachoList').innerHTML = cajas.length
      ? cajas.map(c => `
          <div class="caja-card">
            ${renderCajaCard(c).replace(`onclick="verDetalle('${c.id}')"`, '')}
            <div style="display:flex;gap:8px;margin-top:8px">
              <button class="btn btn-secondary" onclick="verDetalle('${c.id}')" style="flex:1;font-size:12px">Ver detalle</button>
              <button class="btn btn-primary" onclick="despacharUna('${c.id}')" style="flex:1;font-size:12px">→ Despachar</button>
            </div>
          </div>`).join('')
      : `<div class="empty-state"><span class="empty-icon">✓</span><div class="empty-text">Sin cajas para despachar</div></div>`;
  }

  function despacharCaja(id) {
    const session = DB.getSession();
    const hoy = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
    DB.updateCaja(id, { estado:'Despachado', fecSalida:hoy, horaSalida:hora, operarioDespacho: session?.usuario || 'Sistema' });
    DB.addMovimiento(id, `Despachado por ${session?.usuario || 'Sistema'}`);
    showToast('✓ Caja ' + id + ' despachada');
    renderDespacho();
    renderDashboard();
  }

  function eliminarCaja(id) {
    DB.deleteCaja(id);
    cerrarOverlay();
    showToast('Caja ' + id + ' eliminada');
    renderStock();
    renderDashboard();
  }

  // --- Formulario ingresar ---
  function generarID() {
    document.getElementById('f-id').value = DB.getNextId();
  }

  function limpiarForm() {
    document.getElementById('cajaForm').reset();
    document.querySelectorAll('input.autofilled, select.autofilled').forEach(el => el.classList.remove('autofilled'));
    document.getElementById('panelAnalisis').style.display = 'none';
    const session = DB.getSession();
    if (session) document.getElementById('f-op').value = session.usuario;
    document.getElementById('f-piezas').value = '1';
  }

  function guardarCaja(e) {
    e.preventDefault();
    const hoy = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString('es-CL', { hour:'2-digit', minute:'2-digit' });
    const get = id => document.getElementById(id)?.value || '';

    const caja = {
      id:               get('f-id') || DB.getNextId(),
      sku:              get('f-sku'),
      nombre:           get('f-nombre'),
      tipo:             get('f-tipo'),
      categoria:        get('f-cat') || 'Sin clasificar',
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
      planta:           get('f-planta'),
      proveedor:        get('f-prov'),
      temp:             get('f-temp'),
      estado:           'Disponible',
      camara:           get('f-camara'),
      rack:             get('f-rack'),
      fila:             get('f-fila'),
      nivel:            get('f-nivel'),
      pallet:           get('f-pallet'),
      cliente:          get('f-cliente'),
      oc:               get('f-oc'),
      fecIngreso:       hoy,
      horaIngreso:      hora,
      fecSalida:        '',
      horaSalida:       '',
      operarioIngreso:  get('f-op'),
      operarioDespacho: '',
      codigoBarras:     get('f-barras'),
      inspeccion:       get('f-insp'),
      cert:             get('f-cert'),
      obs:              get('f-obs'),
      movimientos:      [`${hoy} ${hora} — Ingreso por ${get('f-op')}`]
    };

    DB.addCaja(caja);
    showToast('✓ Caja ' + caja.id + ' registrada en stock');
    limpiarForm();
    setTimeout(() => irA('stock'), 600);
  }

  // --- Reportes ---
  function renderReportes() {
    const stats = DB.getStats();
    // Tabla por cámara
    document.getElementById('resumenStock').innerHTML = `
      <div class="resumen-wrap">
        <table class="resumen-table">
          <thead><tr><th>Cámara</th><th>Cajas</th><th>Kg totales</th></tr></thead>
          <tbody>${stats.porCamara.map(r => `<tr><td>${r.camara}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join('')}</tbody>
        </table>
      </div>`;
    // Tabla por tipo
    document.getElementById('resumenTipo').innerHTML = `
      <div class="resumen-wrap">
        <table class="resumen-table">
          <thead><tr><th>Tipo de carne</th><th>Cajas</th><th>Kg totales</th></tr></thead>
          <tbody>${stats.porTipo.length
            ? stats.porTipo.map(r => `<tr><td>${r.tipo}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join('')
            : '<tr><td colspan="3" style="text-align:center;color:var(--muted)">Sin datos</td></tr>'}</tbody>
        </table>
      </div>`;
  }

  // --- Alertas ---
  function renderAlertas() {
    const alertas = [];
    DB.getStock().forEach(c => {
      const dias = diasRestantes(c.fecVcto);
      if (c.estado === 'Despachado') return;
      if (dias < 0) alertas.push({ tipo:'danger', ico:'⛔', titulo:'VENCIDA: '+c.nombre, desc:`${c.id} · ${c.lote} · ${c.proveedor}` });
      else if (dias <= 3) alertas.push({ tipo:'danger', ico:'⚠', titulo:`Vence en ${dias}d: ${c.nombre}`, desc:`${c.id} · ${fmtDate(c.fecVcto)}` });
      else if (dias <= 7) alertas.push({ tipo:'warn', ico:'🕐', titulo:`Vence en ${dias}d: ${c.nombre}`, desc:`${c.id} · ${fmtDate(c.fecVcto)}` });
      if (c.estado === 'Cuarentena') alertas.push({ tipo:'warn', ico:'🔒', titulo:'En cuarentena: '+c.id, desc:c.obs||c.nombre });
      if (c.inspeccion === 'Pendiente') alertas.push({ tipo:'info', ico:'📋', titulo:'Inspección pendiente: '+c.id, desc:c.nombre+' · '+c.proveedor });
    });

    document.getElementById('alertaList').innerHTML = alertas.length
      ? `<div class="alerta-list">${alertas.map(a => `
          <div class="alerta-item">
            <span class="alerta-icon ${a.tipo}">${a.ico}</span>
            <div><div class="alerta-title">${a.titulo}</div><div class="alerta-desc">${a.desc}</div></div>
          </div>`).join('')}</div>`
      : `<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-text">Sin alertas activas</div></div>`;
  }

  // --- Importar JSON ---
  function importarJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const result = DB.importJSON(ev.target.result);
      if (result.ok) {
        showToast(`✓ ${result.count} cajas importadas`);
        renderReportes();
        renderDashboard();
      } else {
        showToast('Error al importar: ' + result.error);
      }
    };
    reader.readAsText(file);
  }

  // Verificar sesión al cargar
  function init() {
    const session = DB.getSession();
    if (session) {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('app').style.display = 'block';
      document.getElementById('topUser').textContent = session.usuario;
      document.getElementById('f-op').value = session.usuario;
      irA('dashboard');
    }
  }

  return { showToast, irA, init };
})();

// Exponer funciones globales para onclick del HTML
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
    irA('dashboard');
    setTimeout(() => {
      DBSync.inicializar().then(() => { renderDashboard(); renderStock(); actualizarBadgeAlertas(); });
    }, 100);
  }

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
    console.error('[Login] Error:', e);
    errEl.textContent = 'Error de conexión con el servidor';
    errEl.style.display = 'block';
  }
}


function logout() { if(confirm('¿Cerrar sesión?')){DB.logout();location.reload();} }
function irA(v,btn) {
  // Llamar al irA interno sin recursión
  const views = document.querySelectorAll('.view');
  views.forEach(el => el.classList.remove('active'));
  const target = document.getElementById('view-' + v);
  if (target) target.classList.add('active');
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  document.querySelectorAll('.bnav-btn').forEach(b => b.classList.toggle('active', b.dataset.v === v));
  // Ocultar badge al entrar a alertas
  if(v==='alertas'){
    const b1=document.getElementById('alerta-badge-top');
    const b2=document.getElementById('alerta-badge-bnav');
    if(b1)b1.style.display='none';
    if(b2)b2.style.display='none';
  }
  // Ejecutar render de la vista
  const renders = {
    dashboard: typeof renderDashboard === 'function' ? renderDashboard : null,
    stock: typeof renderStock === 'function' ? renderStock : null,
    despacho: typeof renderDespacho === 'function' ? renderDespacho : null,
    alertas: typeof renderAlertas === 'function' ? renderAlertas : null,
    reportes: typeof renderReportes === 'function' ? renderReportes : null,
  };
  if (renders[v]) renders[v]();
}
function setFiltro(f,btn) { document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active')); btn?.classList.add('active'); window._filtroActivo=f; filtrarCajas(); }

function filtroRapido(tipo) {
  const input = document.getElementById('searchInput');
  if (input) input.value = tipo;
  // Update chip styles
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('chip-active'));
  const chips = document.querySelectorAll('#filtros-rapidos .chip');
  chips.forEach(c => {
    if (c.textContent.includes(tipo) || (tipo==='' && c.id==='chip-todos')) {
      c.classList.add('chip-active');
    }
  });
  filtrarCajas();
}

function filtrarCajas() {
  const search=(document.getElementById('searchInput')?.value||'').toLowerCase();
  const f=window._filtroActivo||'todos';
  let cajas=DB.getStock().filter(c=>{
    if(search){const h=[c.id,c.sku,c.lote,c.nombre,c.proveedor,c.tipo,c.camara,c.cliente,c.cert].join(' ').toLowerCase(); if(!h.includes(search))return false;}
    if(f==='todos')return true;
    if(f==='vcto7'){const d=Math.ceil((new Date(c.fecVcto)-new Date())/86400000);return d>=0&&d<=7&&c.estado!=='Despachado';}
    return c.estado===f;
  }).sort((a,b)=>new Date(a.fecVcto)-new Date(b.fecVcto));
  const fmtDate=d=>{if(!d)return'—';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;};
  const diasR=v=>v?Math.ceil((new Date(v)-new Date())/86400000):9999;
  const vctoC=d=>d<0?'vcto-danger':d<=7?'vcto-warn':'vcto-ok';
  const badge=e=>`<span class="badge badge-${e}">${e}</span>`;
  document.getElementById('stockCount').textContent=`${cajas.length} caja${cajas.length!==1?'s':''} encontrada${cajas.length!==1?'s':''}`;
  document.getElementById('cajaList').innerHTML=cajas.length?cajas.map(c=>{const dias=diasR(c.fecVcto);const vl=dias<0?'⚠ VENCIDA':dias===0?'Vence HOY':`Vence en ${dias}d`;return`<div class="caja-card" onclick="verDetalle('${c.id}')"><div class="caja-header"><div><div class="caja-id">${c.id}</div><div class="caja-sku">${c.sku} · Lote: ${c.lote}</div></div>${badge(c.estado)}</div><div class="caja-meta"><span class="caja-meta-item"><strong>${c.nombre}</strong></span><span class="caja-meta-item">⚖ ${c.pesoNeto} kg</span><span class="caja-meta-item">🏭 ${c.proveedor}</span></div><div class="caja-footer"><span class="caja-ubicacion">📍 ${c.camara} ${c.rack} ${c.fila} ${c.nivel}</span><span class="caja-vcto ${vctoC(dias)}">${vl}</span></div></div>`;}).join(''):'<div class="empty-state"><span class="empty-icon">📦</span><div class="empty-text">Sin resultados</div></div>';
}
function verDetalle(id) {
  const c=DB.getStock().find(x=>x.id===id); if(!c)return;
  const fmtDate=d=>{if(!d)return'—';const[y,m,day]=d.split('-');return`${day}/${m}/${y}`;};
  const dias=Math.ceil((new Date(c.fecVcto)-new Date())/86400000);
  const badge=e=>`<span class="badge badge-${e}">${e}</span>`;
  document.getElementById('detalleContent').innerHTML=`<div class="det-header"><div class="det-title">${c.nombre}</div><div class="det-sub">${c.id} · ${badge(c.estado)}</div></div><div class="det-body"><div class="det-section"><div class="det-sec-title">Identificación</div><div class="det-grid"><div class="det-field"><div class="det-label">ID</div><div class="det-val">${c.id}</div></div><div class="det-field"><div class="det-label">SKU</div><div class="det-val">${c.sku}</div></div><div class="det-field"><div class="det-label">Lote</div><div class="det-val">${c.lote}</div></div><div class="det-field"><div class="det-label">Tipo</div><div class="det-val">${c.tipo}</div></div></div></div><div class="det-section"><div class="det-sec-title">Peso</div><div class="det-grid"><div class="det-field"><div class="det-label">Peso neto</div><div class="det-val">${c.pesoNeto} kg</div></div><div class="det-field"><div class="det-label">Peso bruto</div><div class="det-val">${c.pesoBruto||'—'} kg</div></div><div class="det-field"><div class="det-label">Piezas</div><div class="det-val">${c.piezas}</div></div><div class="det-field"><div class="det-label">País</div><div class="det-val">${c.pais}</div></div></div></div><div class="det-section"><div class="det-sec-title">Fechas</div><div class="det-grid"><div class="det-field"><div class="det-label">Producción</div><div class="det-val">${fmtDate(c.fecProd)}</div></div><div class="det-field"><div class="det-label">Vencimiento</div><div class="det-val" style="color:var(--${dias<0?'danger':dias<=7?'warn':'ok'})">${fmtDate(c.fecVcto)} (${dias<0?'VENCIDA':dias+'d'})</div></div><div class="det-field"><div class="det-label">Ingreso</div><div class="det-val">${fmtDate(c.fecIngreso)} ${c.horaIngreso}</div></div>${c.fecSalida?`<div class="det-field"><div class="det-label">Salida</div><div class="det-val">${fmtDate(c.fecSalida)} ${c.horaSalida}</div></div>`:''}</div></div><div class="det-section"><div class="det-sec-title">Ubicación</div><div class="det-grid"><div class="det-field"><div class="det-label">Cámara</div><div class="det-val" style="color:var(--cold)">${c.camara}</div></div><div class="det-field"><div class="det-label">Pallet</div><div class="det-val">${c.pallet||'—'}</div></div><div class="det-field"><div class="det-label">Rack</div><div class="det-val">${c.rack||'—'}</div></div><div class="det-field"><div class="det-label">Fila/Nivel</div><div class="det-val">${c.fila||'—'}/${c.nivel||'—'}</div></div></div></div><div class="det-section"><div class="det-sec-title">Origen y sanitario</div><div class="det-grid"><div class="det-field full"><div class="det-label">Proveedor</div><div class="det-val">${c.proveedor}</div></div><div class="det-field full"><div class="det-label">Planta</div><div class="det-val">${c.planta||'—'}</div></div><div class="det-field"><div class="det-label">Inspección</div><div class="det-val">${c.inspeccion}</div></div><div class="det-field"><div class="det-label">Certificaciones</div><div class="det-val">${c.cert||'—'}</div></div></div></div>${c.obs?`<div class="det-section"><div class="det-sec-title">Observaciones</div><div style="background:var(--bg2);border-radius:8px;padding:10px;font-size:13px">${c.obs}</div></div>`:''}<div class="det-section"><div class="det-sec-title">Trazabilidad</div><div class="timeline">${(c.movimientos||[]).map((m,i,arr)=>`<div class="tl-item"><div class="tl-line"><div class="tl-dot"></div>${i<arr.length-1?'<div class="tl-conn"></div>':''}</div><div class="tl-content"><div class="tl-event">${m.split(' — ')[1]||m}</div><div class="tl-meta">${m.split(' — ')[0]||''}</div></div></div>`).join('')}</div></div><div style="display:flex;gap:8px;margin-top:16px"><button class="btn btn-secondary" onclick="cerrarOverlay()" style="flex:1">✕ Cerrar</button>${c.estado!=='Despachado'?`<button class="btn btn-primary" onclick="despacharUna('${c.id}');cerrarOverlay()" style="flex:1">→ Despachar</button>`:''}<button class="btn" style="background:#fee2e2;color:#991b1b;padding:11px 14px" onclick="if(confirm('¿Eliminar?'))eliminarCaja('${c.id}')">🗑</button></div></div>`;
  document.getElementById('detalleOverlay').style.display='block';
}
function cerrarOverlay(e){if(!e||e.target===document.getElementById('detalleOverlay'))document.getElementById('detalleOverlay').style.display='none';}
function despacharCaja(id){const s=DB.getSession();const hoy=new Date().toISOString().split('T')[0];const hora=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});DB.updateCaja(id,{estado:'Despachado',fecSalida:hoy,horaSalida:hora,operarioDespacho:s?.usuario||'Sistema'});DB.addMovimiento(id,`Despachado por ${s?.usuario||'Sistema'}`);const caja=DB.getStock().find(c=>c.id===id);if(caja){enviarASheets({tipo:'despacho',id_caja:caja.id,sku:caja.sku,producto:caja.nombre,tipo_carne:caja.tipo,lote:caja.lote,fecha_vencimiento:caja.fecVcto,peso_neto:caja.pesoNeto,proveedor:caja.proveedor,camara_frio:caja.camara,n_pallet:caja.pallet,cliente_destino:caja.cliente,orden_compra:caja.oc||'',fecha_ingreso:caja.fecIngreso,fecha_despacho:hoy,hora_despacho:hora,operario_despacho:s?.usuario||'Sistema',observaciones:caja.obs||''});}App.showToast('✓ Caja '+id+' despachada');if(document.getElementById('view-despacho').classList.contains('active'))renderDespacho();renderDashboard();}
// ── Estado del pedido ────────────────────────────────────
const Pedido = {
  seleccion: new Set(),

  toggle(id) {
    if (this.seleccion.has(id)) this.seleccion.delete(id);
    else this.seleccion.add(id);
    this.actualizarBarra();
    renderDespacho();
  },

  limpiar() {
    this.seleccion.clear();
    this.actualizarBarra();
    renderDespacho();
  },

  actualizarBarra() {
    const ids = [...this.seleccion];
    const bar = document.getElementById('pedido-bar');
    if (!bar) return;
    if (ids.length === 0) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    const cajas = DB.getStock().filter(c => ids.includes(c.id));
    const kg = cajas.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1);
    // Resumen por tipo
    const porTipo = {};
    cajas.forEach(c => { porTipo[c.tipo] = (porTipo[c.tipo]||0)+1; });
    const tiposStr = Object.entries(porTipo).map(([t,n]) => n+'x '+t).join(', ');
    document.getElementById('pedido-resumen').innerHTML =
      ids.length+' cajas · '+kg+' kg<br><span style="font-size:10px;opacity:0.8">'+tiposStr+'</span>';
  }
};

function limpiarSeleccion() { Pedido.limpiar(); }

function toggleSeleccion(id) { Pedido.toggle(id); }

function confirmarPedido() {
  const ids = [...Pedido.seleccion];
  if (ids.length === 0) { App.showToast('Selecciona al menos una caja'); return; }

  const cliente = document.getElementById('pedido-cliente')?.value || '';
  const oc = document.getElementById('pedido-oc')?.value || '';

  if (!cliente) { App.showToast('⚠ Ingresa el cliente destino'); return; }

  const s = DB.getSession();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});

  // Generar N° de pedido único
  const numPed = parseInt(localStorage.getItem('frigocarnes_ped_counter')||'0') + 1;
  localStorage.setItem('frigocarnes_ped_counter', String(numPed));
  const numPedStr = 'PED-'+new Date().getFullYear()+'-'+String(numPed).padStart(4,'0');

  const cajas = DB.getStock().filter(c => ids.includes(c.id));
  const kgTotal = cajas.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1);

  if (!confirm('Confirmar despacho:\n\n'+numPedStr+'\nCliente: '+cliente+(oc?'\nOC: '+oc:'')+'\n\n'+ids.length+' cajas · '+kgTotal+' kg\n\n¿Continuar?')) return;

  // Despachar todas
  ids.forEach(id => {
    const caja = DB.getStock().find(c => c.id === id);
    if (!caja) return;
    DB.updateCaja(id, {
      estado: 'Despachado',
      fecSalida: hoy,
      horaSalida: hora,
      operarioDespacho: s?.usuario||'Sistema',
      cliente: cliente || caja.cliente,
      oc: oc || caja.oc,
      numeroPedido: numPedStr
    });
    DB.addMovimiento(id, 'Despachado en '+numPedStr+' para '+cliente+' por '+(s?.usuario||'Sistema'));

    // Enviar a Sheets
    enviarASheets({
      tipo: 'despacho',
      id_caja: caja.id,
      sku: caja.sku,
      producto: caja.nombre,
      tipo_carne: caja.tipo,
      lote: caja.lote,
      fecha_vencimiento: caja.fecVcto,
      peso_neto: caja.pesoNeto,
      proveedor: caja.proveedor,
      camara_frio: caja.camara,
      n_pallet: caja.pallet,
      cliente_destino: cliente,
      orden_compra: oc,
      numero_pedido: numPedStr,
      fecha_ingreso: caja.fecIngreso,
      fecha_despacho: hoy,
      hora_despacho: hora,
      operario_despacho: s?.usuario||'Sistema',
      observaciones: caja.obs||''
    });
  });

  App.showToast('✓ '+numPedStr+' — '+ids.length+' cajas despachadas');
  Pedido.limpiar();
  document.getElementById('pedido-cliente').value = '';
  document.getElementById('pedido-oc').value = '';
  renderDespacho();
  renderDashboard();
}

function renderDespacho(){
  const s=(document.getElementById('despSearch')?.value||'').toLowerCase();
  const modo=document.getElementById('fifo-modo')?.value||'fefo';
  const todas=DB.getStock().filter(c=>c.estado!=='Despachado'&&(!s||[c.id,c.sku,c.nombre,c.tipo,c.proveedor].join(' ').toLowerCase().includes(s)));

  const cajas=[...todas].sort((a,b)=>{
    if(modo==='fifo') return new Date(a.fecIngreso)-new Date(b.fecIngreso);
    return new Date(a.fecVcto)-new Date(b.fecVcto);
  });

  const fmtDate=d=>{if(!d)return'—';try{const[y,m,day]=d.split('-');return day+'/'+m+'/'+y;}catch(e){return d;}};
  const diasR=v=>v?Math.ceil((new Date(v)-new Date())/86400000):9999;
  const vctoC=d=>d<0?'vcto-danger':d<=7?'vcto-warn':'vcto-ok';
  const badge=e=>'<span class="badge badge-'+e+'">'+e+'</span>';

  const primerasPorSku={};
  cajas.forEach(c=>{if(!primerasPorSku[c.sku])primerasPorSku[c.sku]=c.id;});

  const kgTotal=cajas.filter(c=>diasR(c.fecVcto)>=0).reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1);
  const vencidas=cajas.filter(c=>diasR(c.fecVcto)<0).length;
  const urgentes=cajas.filter(c=>{const d=diasR(c.fecVcto);return d>=0&&d<=7;}).length;
  const selCount=Pedido.seleccion.size;

  if(!cajas.length){
    document.getElementById('despachoList').innerHTML='<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-text">Sin cajas para despachar</div></div>';
    return;
  }

  let html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding:10px 12px;background:var(--bg2);border-radius:10px">';
  html+='<div style="font-size:12px;color:#64748b"><strong style="color:var(--text)">'+cajas.length+'</strong> cajas · <strong style="color:var(--text)">'+kgTotal+' kg</strong>';
  if(vencidas>0) html+=' <span style="color:#dc2626;margin-left:6px">⚠ '+vencidas+' vencida'+(vencidas>1?'s':'')+'</span>';
  if(urgentes>0) html+=' <span style="color:#d97706;margin-left:6px">⏰ '+urgentes+' urgente'+(urgentes>1?'s':'')+'</span>';
  if(selCount>0) html+=' <span style="color:#2d6a4f;margin-left:6px;font-weight:700">✓ '+selCount+' seleccionada'+(selCount>1?'s':'')+'</span>';
  html+='</div>';
  html+='<select id="fifo-modo" onchange="renderDespacho()" style="font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;background:var(--bg);color:var(--text)">';
  html+='<option value="fefo"'+(modo==='fefo'?' selected':'')+'>FEFO</option>';
  html+='<option value="fifo"'+(modo==='fifo'?' selected':'')+'>FIFO</option>';
  html+='</select></div>';

  // Seleccionar todo / ninguno
  if(cajas.length > 1){
    const todosSeleccionados = cajas.every(c => Pedido.seleccion.has(c.id));
    html+='<div style="display:flex;gap:8px;margin-bottom:10px">';
    html+='<button onclick="seleccionarTodos()" class="btn btn-secondary" style="flex:1;font-size:12px">'+(todosSeleccionados?'☐ Deseleccionar todo':'☑ Seleccionar todo')+'</button>';
    html+='</div>';
  }

  cajas.forEach(function(c,i){
    const dias=diasR(c.fecVcto);
    const esPrimera=primerasPorSku[c.sku]===c.id;
    const seleccionada=Pedido.seleccion.has(c.id);
    const borderColor=seleccionada?'#52b788':dias<0?'#dc2626':dias<=7?'#d97706':esPrimera?'var(--primary)':'var(--border)';
    const bgSeleccion=seleccionada?'background:rgba(82,183,136,0.08);':'';
    const btnColor=dias<0?'background:#dc2626':dias<=7?'background:#d97706':'';

    html+='<div class="caja-card" style="border-left:3px solid '+borderColor+';position:relative;'+bgSeleccion+'" onclick="toggleSeleccion(\''+c.id+'\')">';

    // Badge FEFO/FIFO
    if(esPrimera){
      const tagBg=dias<0?'#dc2626':dias<=7?'#d97706':'var(--primary)';
      html+='<div style="position:absolute;top:-1px;right:-1px;background:'+tagBg+';color:#fff;font-size:9px;font-weight:700;padding:2px 8px;border-radius:0 8px 0 8px">#'+(i+1)+' '+(modo==='fifo'?'FIFO':'FEFO')+'</div>';
    }

    // Checkbox visual
    html+='<div style="display:flex;align-items:flex-start;gap:10px">';
    html+='<div style="width:22px;height:22px;border-radius:6px;border:2px solid '+(seleccionada?'#52b788':'var(--border)')+';background:'+(seleccionada?'#52b788':'transparent')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px">';
    if(seleccionada) html+='<span style="color:#fff;font-size:14px;font-weight:900">✓</span>';
    html+='</div>';

    html+='<div style="flex:1">';
    html+='<div class="caja-header" style="margin-bottom:4px"><div><div class="caja-id">'+c.id+'</div><div class="caja-sku">'+c.sku+' · '+c.lote+'</div></div>'+badge(c.estado)+'</div>';
    html+='<div class="caja-meta"><span class="caja-meta-item"><strong>'+c.nombre+'</strong></span><span class="caja-meta-item">⚖ '+c.pesoNeto+'kg</span><span class="caja-meta-item">📅 Ing: '+fmtDate(c.fecIngreso)+'</span></div>';

    if(esPrimera){
      const pBg=dias<0?'#fee2e2':dias<=7?'#fef3c7':'#d8f3dc';
      const pColor=dias<0?'#991b1b':dias<=7?'#92400e':'#1a3a2a';
      const pLabel=dias<0?'🔴 VENCIDA':dias<=7?'⚠ DESPACHAR HOY':'✅ PRIMERO SEGÚN '+(modo==='fifo'?'FIFO':'FEFO');
      html+='<div style="margin:4px 0"><span style="background:'+pBg+';color:'+pColor+';font-size:10px;font-weight:700;padding:2px 8px;border-radius:10px">'+pLabel+'</span></div>';
    }

    html+='<div class="caja-footer"><span class="caja-ubicacion">📍 '+c.camara+' '+(c.rack||'')+'</span><span class="caja-vcto '+vctoC(dias)+'">'+(dias<0?'VENCIDA':dias+'d')+'</span></div>';

    // Botón despacho individual (sin checkbox, solo si no hay selección activa)
    html+='<div style="display:flex;gap:8px;margin-top:8px" onclick="event.stopPropagation()">';
    html+='<button class="btn btn-secondary" onclick="verDetalle(\''+c.id+'\')" style="flex:1;font-size:12px">Ver</button>';
    if(!seleccionada && Pedido.seleccion.size===0){
      html+='<button class="btn btn-primary" onclick="despacharUna(\''+c.id+'\')" style="flex:1;font-size:12px;'+btnColor+'">→ Despachar</button>';
    } else {
      html+='<button class="btn '+(seleccionada?'btn-primary':'btn-secondary')+'" onclick="toggleSeleccion(\''+c.id+'\')" style="flex:1;font-size:12px">'+(seleccionada?'✓ Agregada':'+ Agregar')+'</button>';
    }
    html+='</div>';
    html+='</div></div></div>';
  });

  document.getElementById('despachoList').innerHTML=html;
}

function seleccionarTodos(){
  const cajas=DB.getStock().filter(c=>c.estado!=='Despachado');
  const todosSeleccionados=cajas.every(c=>Pedido.seleccion.has(c.id));
  if(todosSeleccionados){ Pedido.seleccion.clear(); }
  else { cajas.forEach(c=>Pedido.seleccion.add(c.id)); }
  Pedido.actualizarBarra();
  renderDespacho();
}

// Despacho individual rápido (sin pedido)
function despacharUna(id){
  const s=DB.getSession();
  const hoy=new Date().toISOString().split('T')[0];
  const hora=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  DB.updateCaja(id,{estado:'Despachado',fecSalida:hoy,horaSalida:hora,operarioDespacho:s?.usuario||'Sistema'});
  DB.addMovimiento(id,'Despachado por '+(s?.usuario||'Sistema'));
  const caja=DB.getStock().find(c=>c.id===id);
  if(caja){enviarASheets({tipo:'despacho',id_caja:caja.id,sku:caja.sku,producto:caja.nombre,tipo_carne:caja.tipo,lote:caja.lote,fecha_vencimiento:caja.fecVcto,peso_neto:caja.pesoNeto,proveedor:caja.proveedor,camara_frio:caja.camara,n_pallet:caja.pallet,cliente_destino:caja.cliente,orden_compra:caja.oc||'',fecha_ingreso:caja.fecIngreso,fecha_despacho:hoy,hora_despacho:hora,operario_despacho:s?.usuario||'Sistema',observaciones:caja.obs||''});}
  App.showToast('✓ Caja '+id+' despachada');
  renderDespacho();
  renderDashboard();
}
function eliminarCaja(id){DB.deleteCaja(id);document.getElementById('detalleOverlay').style.display='none';App.showToast('Caja eliminada');filtrarCajas();renderDashboard();}
function generarID(){document.getElementById('f-id').value=DB.getNextId();}
function limpiarForm(){document.getElementById('cajaForm').reset();document.querySelectorAll('.autofilled').forEach(e=>e.classList.remove('autofilled'));document.getElementById('panelAnalisis').style.display='none';const s=DB.getSession();if(s)document.getElementById('f-op').value=s.usuario;document.getElementById('f-piezas').value='1';}
function guardarCaja(e){e.preventDefault();const hoy=new Date().toISOString().split('T')[0];const hora=new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});const get=id=>document.getElementById(id)?.value||'';const caja={id:get('f-id')||DB.getNextId(),sku:get('f-sku'),nombre:get('f-nombre'),tipo:get('f-tipo'),categoria:get('f-cat')||'Sin clasificar',lote:get('f-lote'),fecProd:get('f-fprod'),fecEnv:get('f-fenv'),fecVcto:get('f-fvcto'),horaProd:get('f-hprod'),pesoNeto:parseFloat(get('f-peso-neto'))||0,pesoBruto:parseFloat(get('f-peso-bruto'))||0,piezas:parseInt(get('f-piezas'))||1,unidad:get('f-unidad'),pais:get('f-pais'),planta:get('f-planta'),proveedor:get('f-prov'),temp:get('f-temp'),estado:'Disponible',camara:get('f-camara'),rack:get('f-rack'),fila:get('f-fila'),nivel:get('f-nivel'),pallet:get('f-pallet'),cliente:get('f-cliente'),oc:get('f-oc'),fecIngreso:hoy,horaIngreso:hora,fecSalida:'',horaSalida:'',operarioIngreso:get('f-op'),operarioDespacho:'',codigoBarras:get('f-barras')||'',inspeccion:get('f-insp'),cert:get('f-cert'),obs:get('f-obs'),movimientos:[`${hoy} ${hora} — Ingreso por ${get('f-op')}`]};
// Generar código de barras automático si no tiene
if (!caja.codigoBarras) {
  caja.codigoBarras = generarCodigoBarras(caja);
}
// Guardar campo en formulario
const barrasEl = document.getElementById('f-barras');
if (barrasEl && !barrasEl.value) barrasEl.value = caja.codigoBarras;
DB.addCaja(caja);enviarASheets({tipo:'ingreso',id_caja:caja.id,sku:caja.sku,producto:caja.nombre,tipo_carne:caja.tipo,lote:caja.lote,fecha_produccion:caja.fecProd,fecha_vencimiento:caja.fecVcto,peso_neto:caja.pesoNeto,peso_bruto:caja.pesoBruto,proveedor:caja.proveedor,camara_frio:caja.camara,ubicacion:caja.rack+'/'+caja.fila+'/'+caja.nivel,n_pallet:caja.pallet,estado:caja.estado,pais_origen:caja.pais,operario:caja.operarioIngreso,fecha_ingreso:caja.fecIngreso,hora:caja.horaIngreso,cliente_destino:caja.cliente,observaciones:caja.obs});App.showToast('✓ '+caja.id+' registrada — generando etiqueta...');
  // Pre-llenar etiquetas con los datos de la caja recién ingresada
  setTimeout(()=>{
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v)el.value=v;};
    set('eq-sku', caja.sku);
    set('eq-nombre', caja.nombre);
    set('eq-tipo', caja.tipo);
    set('eq-lote', caja.lote);
    set('eq-peso', caja.pesoNeto);
    set('eq-fprod', caja.fecProd);
    set('eq-fvcto', caja.fecVcto);
    set('eq-prov', caja.proveedor);
    set('eq-pais', caja.pais);
    set('eq-temp', caja.temp);
    set('eq-planta', caja.planta);
    set('eq-cert', caja.cert);
    set('eq-barras', caja.codigoBarras);
    set('eq-piezas', caja.piezas);
    set('eq-pesobruto', caja.pesoBruto);
    set('eq-id', caja.id);
    // Guardar caja completa para la etiqueta
    window._cajaPendienteEtiqueta = caja;
    App.irA('etiquetas');
    // Generar etiqueta automáticamente
    setTimeout(()=>{ if(typeof generarEtiqueta==='function') generarEtiqueta(); }, 200);
  }, 400);
  limpiarForm();}
function importarJSON(e){const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=ev=>{const res=DB.importJSON(ev.target.result);App.showToast(res.ok?`✓ ${res.count} cajas importadas`:'Error: '+res.error);if(res.ok){renderReportes();renderDashboard();}};r.readAsText(f);}
function renderReportes(){const stats=DB.getStats();document.getElementById('resumenStock').innerHTML=`<div class="resumen-wrap"><table class="resumen-table"><thead><tr><th>Cámara</th><th>Cajas</th><th>Kg</th></tr></thead><tbody>${stats.porCamara.map(r=>`<tr><td>${r.camara}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join('')}</tbody></table></div>`;document.getElementById('resumenTipo').innerHTML=`<div class="resumen-wrap"><table class="resumen-table"><thead><tr><th>Tipo</th><th>Cajas</th><th>Kg</th></tr></thead><tbody>${stats.porTipo.length?stats.porTipo.map(r=>`<tr><td>${r.tipo}</td><td>${r.count}</td><td>${r.kg} kg</td></tr>`).join(''):'<tr><td colspan="3" style="text-align:center;color:var(--muted)">Sin datos</td></tr>'}</tbody></table></div>`;}
function renderDashboard(){actualizarBadgeAlertas();const stats=DB.getStats();document.getElementById('d-total').textContent=stats.total;document.getElementById('d-kg').textContent=stats.kgTotal;document.getElementById('d-vcto').textContent=stats.porVencer;document.getElementById('d-desp').textContent=stats.despHoy;const stock=DB.getStock().slice(0,6);const movs=[];stock.forEach(c=>{if(c.movimientos?.length){const last=c.movimientos[c.movimientos.length-1];movs.push({nombre:c.nombre,id:c.id,msg:last});}});document.getElementById('timeline-dash').innerHTML=movs.slice(0,5).map((m,i,arr)=>`<div class="tl-item"><div class="tl-line"><div class="tl-dot"></div>${i<arr.length-1?'<div class="tl-conn"></div>':''}</div><div class="tl-content"><div class="tl-event">${m.nombre}</div><div class="tl-meta">${m.id} · ${m.msg.split(' — ')[1]||m.msg}</div></div></div>`).join('')||'<div class="empty-state"><span class="empty-icon">📋</span><div class="empty-text">Sin movimientos</div></div>';}
function renderAlertas(){const alertas=[];DB.getStock().forEach(c=>{if(c.estado==='Despachado')return;const dias=Math.ceil((new Date(c.fecVcto)-new Date())/86400000);if(dias<0)alertas.push({tipo:'danger',ico:'⛔',t:'VENCIDA: '+c.nombre,d:`${c.id} · ${c.proveedor}`});else if(dias<=3)alertas.push({tipo:'danger',ico:'⚠',t:`Vence en ${dias}d: ${c.nombre}`,d:c.id});else if(dias<=7)alertas.push({tipo:'warn',ico:'🕐',t:`Vence en ${dias}d: ${c.nombre}`,d:c.id});if(c.estado==='Cuarentena')alertas.push({tipo:'warn',ico:'🔒',t:'Cuarentena: '+c.id,d:c.obs||c.nombre});if(c.inspeccion==='Pendiente')alertas.push({tipo:'info',ico:'📋',t:'Inspección pendiente: '+c.id,d:c.nombre});});document.getElementById('alertaList').innerHTML=alertas.length?`<div class="alerta-list">${alertas.map(a=>`<div class="alerta-item"><span class="alerta-icon ${a.tipo}">${a.ico}</span><div><div class="alerta-title">${a.t}</div><div class="alerta-desc">${a.d}</div></div></div>`).join('')}</div>`:'<div class="empty-state"><span class="empty-icon">✅</span><div class="empty-text">Sin alertas activas</div></div>';}

// Init
document.addEventListener('DOMContentLoaded', () => {
  const session = DB.getSession();
  if (session) {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').style.display = 'block';
    document.getElementById('topUser').textContent = session.usuario;
    document.getElementById('f-op').value = session.usuario;
    App.irA('dashboard');
  }
  // Enter en PIN
  document.getElementById('loginPin')?.addEventListener('keydown', e => { if(e.key==='Enter') login(); });
});

// ============================================================
//  HISTORIAL STOCK — Cierre de mes y consulta de historial
// ============================================================

// Nombres de meses para mostrar
const MESES_NOMBRES = {
  "01":"Enero","02":"Febrero","03":"Marzo","04":"Abril",
  "05":"Mayo","06":"Junio","07":"Julio","08":"Agosto",
  "09":"Septiembre","10":"Octubre","11":"Noviembre","12":"Diciembre"
};

// ── Ejecutar cierre de mes ────────────────────────────────
async function ejecutarCierreMes() {
  const mes  = document.getElementById('cierre-mes').value;
  const anio = document.getElementById('cierre-anio').value;
  const mesNom = MESES_NOMBRES[mes];
  const estado = document.getElementById('cierre-estado');

  if (!confirm(`¿Confirmar cierre de ${mesNom} ${anio}?\n\nSe enviará el historial completo a Google Sheets.\nLas cajas disponibles NO se eliminarán.`)) return;

  estado.style.display = 'block';
  estado.innerHTML = '<span style="color:#1e6fd9">⟳ Enviando cierre a Google Sheets...</span>';

  const stock = DB.getStock();

  // Filtrar ingresos del mes
  const ingMes = stock.filter(c => {
    if (!c.fecIngreso) return false;
    const f = new Date(c.fecIngreso);
    return String(f.getFullYear()) === anio &&
           String(f.getMonth()+1).padStart(2,'0') === mes;
  });

  // Filtrar despachos del mes
  const despMes = stock.filter(c => {
    if (!c.fecSalida) return false;
    const f = new Date(c.fecSalida);
    return String(f.getFullYear()) === anio &&
           String(f.getMonth()+1).padStart(2,'0') === mes;
  });

  // Stock disponible al cerrar
  const stockDisponible = stock.filter(c => c.estado !== 'Despachado' && c.estado !== 'Vencido');

  // Guardar cierre localmente
  const cierres = JSON.parse(localStorage.getItem('frigocarnes_cierres') || '{}');
  const key = `${anio}-${mes}`;
  cierres[key] = {
    periodo: key,
    mesNombre: mesNom,
    anio,
    generado: new Date().toISOString(),
    ingresos: ingMes,
    despachos: despMes,
    stockFinal: stockDisponible,
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

  // Enviar a Google Sheets
  try {
    await fetch(SHEETS_CONFIG.url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tipo: 'cierre_mes',
        periodo: key,
        mes_nombre: mesNom,
        anio,
        ingresos: ingMes.map(c => ({
          id_caja: c.id, sku: c.sku, producto: c.nombre, tipo_carne: c.tipo,
          lote: c.lote, fecha_vencimiento: c.fecVcto, peso_neto: c.pesoNeto,
          proveedor: c.proveedor, estado: c.estado, operario: c.operarioIngreso,
          fecha_ingreso: c.fecIngreso
        })),
        despachos: despMes.map(c => ({
          id_caja: c.id, sku: c.sku, producto: c.nombre, tipo_carne: c.tipo,
          lote: c.lote, peso_neto: c.pesoNeto, proveedor: c.proveedor,
          cliente: c.cliente, fecha_despacho: c.fecSalida, operario: c.operarioDespacho
        })),
        stock_final: stockDisponible.map(c => ({
          id_caja: c.id, sku: c.sku, producto: c.nombre, peso_neto: c.pesoNeto,
          estado: c.estado, camara: c.camara, fecha_vencimiento: c.fecVcto
        })),
        resumen: cierres[key].resumen
      })
    });

    estado.innerHTML = `<span style="color:#16a34a">✅ Cierre de ${mesNom} ${anio} enviado a Google Sheets correctamente.</span>`;
    App.showToast(`✓ Cierre ${mesNom} ${anio} guardado`);

    // Actualizar selector de historial al mismo mes/año
    document.getElementById('hist-mes').value = mes;
    document.getElementById('hist-anio').value = anio;
    buscarHistorial();

  } catch(err) {
    estado.innerHTML = `<span style="color:#dc2626">⚠️ Error al conectar con Sheets. El cierre se guardó localmente.</span>`;
    App.showToast('Cierre guardado localmente');
  }
}

// ── Buscar historial ──────────────────────────────────────
function buscarHistorial() {
  const mes  = document.getElementById('hist-mes').value;
  const anio = document.getElementById('hist-anio').value;
  const mesNom = MESES_NOMBRES[mes];
  const key  = `${anio}-${mes}`;
  const cierres = JSON.parse(localStorage.getItem('frigocarnes_cierres') || '{}');
  const cierre = cierres[key];
  const contenedor = document.getElementById('historial-resultado');

  if (!cierre) {
    // Si no hay cierre guardado, mostrar datos del stock actual filtrados por ese mes
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

    if (ingMes.length === 0 && despMes.length === 0) {
      contenedor.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📭</span>
          <div class="empty-text">No hay movimientos para ${mesNom} ${anio}</div>
          <div style="font-size:12px;color:#94a3b8;margin-top:4px">Para guardar un cierre oficial usa el botón de arriba</div>
        </div>`;
      return;
    }

    renderHistorialDatos(contenedor, mesNom, anio, {
      ingresos: ingMes,
      despachos: despMes,
      resumen: {
        cajasIngresadas: ingMes.length,
        kgIngresados: ingMes.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
        cajasDespachadas: despMes.length,
        kgDespachados: despMes.reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
        stockFinalCajas: '—',
        stockFinalKg: '—',
      }
    }, false);
    return;
  }

  renderHistorialDatos(contenedor, mesNom, anio, cierre, true);
}

function renderHistorialDatos(contenedor, mesNom, anio, datos, esCierre) {
  const r = datos.resumen;
  const fmtDate = d => {
    if (!d) return '—';
    try { const [y,m,day] = d.split('-'); return `${day}/${m}/${y}`; } catch { return d; }
  };

  const badgeCierre = esCierre
    ? `<span style="background:#d8f3dc;color:#1a3a2a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">✅ Cierre oficial</span>`
    : `<span style="background:#fff8e1;color:#7a5c00;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">📊 Datos actuales</span>`;

  contenedor.innerHTML = `
    <!-- Encabezado -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
      <div style="font-weight:700;font-size:16px;color:var(--primary)">${mesNom} ${anio}</div>
      ${badgeCierre}
    </div>

    <!-- Resumen -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--primary)">${r.cajasIngresadas}</div>
        <div style="font-size:11px;color:#64748b">Cajas ingresadas</div>
        <div style="font-size:12px;font-weight:600;color:#1a3a2a">${r.kgIngresados} kg</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#0a4a7a">${r.cajasDespachadas}</div>
        <div style="font-size:11px;color:#64748b">Cajas despachadas</div>
        <div style="font-size:12px;font-weight:600;color:#0a4a7a">${r.kgDespachados} kg</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#7a3a00">${r.stockFinalCajas}</div>
        <div style="font-size:11px;color:#64748b">Stock al cierre</div>
        <div style="font-size:12px;font-weight:600;color:#7a3a00">${r.stockFinalKg} kg</div>
      </div>
      <div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:#666">${datos.ingresos.length + datos.despachos.length}</div>
        <div style="font-size:11px;color:#64748b">Movimientos totales</div>
      </div>
    </div>

    <!-- Ingresos -->
    ${datos.ingresos.length > 0 ? `
    <div style="margin-bottom:14px">
      <div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px;display:flex;align-items:center;gap:6px">
        📦 Ingresos del mes <span style="background:var(--primary);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">${datos.ingresos.length}</span>
      </div>
      ${datos.ingresos.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--primary)">
          <div>
            <div style="font-weight:600;font-size:13px">${c.nombre || c.producto || '—'}</div>
            <div style="font-size:11px;color:#64748b">${c.id || c.id_caja} · ${c.lote}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:13px">${c.pesoNeto || c.peso_neto} kg</div>
            <div style="font-size:11px;color:#64748b">${fmtDate(c.fecIngreso || c.fecha_ingreso)}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}

    <!-- Despachos -->
    ${datos.despachos.length > 0 ? `
    <div>
      <div style="font-weight:700;font-size:13px;color:#0a4a7a;margin-bottom:8px;display:flex;align-items:center;gap:6px">
        🚚 Despachos del mes <span style="background:#0a4a7a;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">${datos.despachos.length}</span>
      </div>
      ${datos.despachos.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid #0a4a7a">
          <div>
            <div style="font-weight:600;font-size:13px">${c.nombre || c.producto || '—'}</div>
            <div style="font-size:11px;color:#64748b">${c.id || c.id_caja} · ${c.cliente || c.cliente_destino || '—'}</div>
          </div>
          <div style="text-align:right">
            <div style="font-weight:700;font-size:13px">${c.pesoNeto || c.peso_neto} kg</div>
            <div style="font-size:11px;color:#64748b">${fmtDate(c.fecSalida || c.fecha_despacho)}</div>
          </div>
        </div>`).join('')}
    </div>` : ''}
  `;
}

// ============================================================
//  ETIQUETAS QR — Generador de etiquetas imprimibles
// ============================================================

function generarCodigoBarras(caja) {
  // Formato: FC + año(2) + número(8) → ej: FC2600000042
  // Compatible con Code128 y pistolas lectoras
  const id = (caja.id || '').replace(/[^0-9]/g, '').slice(-8).padStart(8,'0');
  const anio = new Date().getFullYear().toString().slice(-2);
  const codigo = 'FC' + anio + id;
  return codigo;
}

// Generar códigos para cajas existentes sin código de barras
function generarCodigosExistentes() {
  const stock = DB.getStock();
  let actualizadas = 0;
  stock.forEach(c => {
    if (!c.codigoBarras) {
      c.codigoBarras = generarCodigoBarras(c);
      DB.updateCaja(c.id, { codigoBarras: c.codigoBarras });
      actualizadas++;
    }
  });
  if (actualizadas > 0) {
    App.showToast('✓ Códigos generados para ' + actualizadas + ' cajas');
  }
  return actualizadas;
}

function generarEtiqueta() {
  const get = id => document.getElementById(id)?.value || '';
  const caja = window._cajaPendienteEtiqueta || {};

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
    temp:      get('eq-temp')      || caja.temp       || '-18°C a -20°C',
    cert:      get('eq-cert')      || caja.cert       || '',
    barras:    get('eq-barras')    || caja.codigoBarras || '',
  };

  if (!datos.sku && !datos.nombre && !datos.lote) {
    App.showToast('⚠ Completa al menos SKU, producto y lote'); return;
  }

  // Generar código de barras automático si no hay uno
  if (!datos.barras && datos.id) {
    datos.barras = generarCodigoBarras({id: datos.id});
    // Guardarlo en el campo y en la caja
    const barrasEl = document.getElementById('eq-barras');
    if (barrasEl) barrasEl.value = datos.barras;
    if (caja.id) DB.updateCaja(caja.id, { codigoBarras: datos.barras });
  }

  const fmtDate = d => {
    if (!d) return '—';
    try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d; }
  };
  const hoy = new Date().toLocaleDateString('es-CL');
  const diasVcto = datos.fvcto ? Math.ceil((new Date(datos.fvcto)-new Date())/86400000) : null;
  const vctoColor = diasVcto!==null && diasVcto<0 ? '#dc2626' : diasVcto!==null && diasVcto<=7 ? '#d97706' : '#c17b00';

  const contenedor = document.getElementById('etiqueta-contenido');
  contenedor.innerHTML = `
  <div id="etiqueta-print" style="font-family:Arial,sans-serif;width:100%;max-width:480px;margin:0 auto;background:#fff">

    <!-- HEADER -->
    <div style="background:#1a3a2a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:17px;font-weight:800;letter-spacing:1px">❄ FRIGOCARNES</div>
        <div style="font-size:9px;opacity:0.75;margin-top:1px">ETIQUETA OFICIAL · TRAZABILIDAD SAG/SEREMI</div>
      </div>
      <div style="text-align:right;font-size:10px;opacity:0.85">
        <div>${hoy}</div>
        ${datos.id ? '<div style="font-weight:700">'+datos.id+'</div>' : ''}
      </div>
    </div>

    <!-- CUERPO -->
    <div style="padding:12px 14px;display:flex;gap:12px">
      <div style="flex:1;min-width:0">
        <div style="font-size:18px;font-weight:900;color:#1a3a2a;line-height:1.1;margin-bottom:2px">${datos.nombre||'—'}</div>
        <div style="font-size:12px;font-weight:700;color:#2d6a4f;margin-bottom:10px">${datos.tipo||'—'} · Origen: ${datos.pais||'—'}</div>

        <table style="width:100%;border-collapse:collapse;font-size:10.5px">
          <tr style="background:#f0f7f2">
            <td style="padding:3px 6px;color:#555;width:42%;font-weight:600">N° Lote</td>
            <td style="padding:3px 6px;font-weight:800;color:#1a3a2a">${datos.lote||'—'}</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;color:#555;font-weight:600">SKU</td>
            <td style="padding:3px 6px;font-weight:700">${datos.sku||'—'}</td>
          </tr>
          <tr style="background:#f0f7f2">
            <td style="padding:3px 6px;color:#555;font-weight:600">Peso Neto</td>
            <td style="padding:3px 6px;font-weight:700">${datos.peso ? datos.peso+' kg' : '—'}</td>
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
          <tr style="background:#fff8e1">
            <td style="padding:3px 6px;color:#7a5c00;font-weight:700">F. Vencimiento</td>
            <td style="padding:3px 6px;font-weight:900;color:${vctoColor}">
              ${fmtDate(datos.fvcto)}${diasVcto!==null?' ('+Math.abs(diasVcto)+'d '+(diasVcto<0?'VENCIDA':'restantes')+')':''}
            </td>
          </tr>
          <tr style="background:#f0f7f2">
            <td style="padding:3px 6px;color:#555;font-weight:600">Establecimiento</td>
            <td style="padding:3px 6px">${datos.planta||'—'}</td>
          </tr>
          <tr>
            <td style="padding:3px 6px;color:#555;font-weight:600">Proveedor</td>
            <td style="padding:3px 6px">${datos.prov||'—'}</td>
          </tr>
          ${datos.cert ? `<tr style="background:#f0f7f2"><td style="padding:3px 6px;color:#555;font-weight:600">Certificaciones</td><td style="padding:3px 6px;font-size:9.5px">${datos.cert}</td></tr>` : ''}
        </table>
      </div>

      <!-- TEMP -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex-shrink:0">
        <div style="background:#1e40af;color:#fff;border-radius:8px;padding:8px 10px;text-align:center;width:80px">
          <div style="font-size:8px;font-weight:700;opacity:0.85">CONSERVAR A</div>
          <div style="font-size:12px;font-weight:900;margin-top:2px">${datos.temp||'—'}</div>
        </div>
        <div style="background:#d8f3dc;border-radius:6px;padding:6px 8px;text-align:center;width:80px">
          <div style="font-size:8px;color:#1a3a2a;font-weight:700">CADENA FRÍO</div>
          <div style="font-size:9px;color:#2d6a4f;margin-top:1px">Certificada</div>
        </div>
      </div>
    </div>

    <!-- CÓDIGO DE BARRAS -->
    <div style="padding:8px 14px 10px;text-align:center;border-top:1px solid #e2e8f0">
      <canvas id="barcode-canvas" style="max-width:100%"></canvas>
      <div style="font-size:9px;color:#64748b;margin-top:2px">
        ${datos.barras||''}
      </div>
    </div>

    <!-- FOOTER NORMATIVO -->
    <div style="background:#1a3a2a;color:#fff;padding:5px 14px;font-size:8px;display:flex;justify-content:space-between">
      <span>Producto alimenticio de origen animal · Reglamento SAG · DS N°594</span>
      <span style="opacity:0.8">${datos.pais||'Chile'} · Trazabilidad certificada</span>
    </div>
  </div>`;

  // Asegurar que siempre haya un código
  if (!datos.barras) {
    datos.barras = generarCodigoBarras({ id: datos.id || datos.sku || Date.now().toString() });
  }

  // Generar código de barras con librería propia
  setTimeout(() => {
    const canvas = document.getElementById('barcode-canvas');
    if (!canvas || !datos.barras) return;
    try {
      Barcode.draw(canvas, datos.barras, {
        width: 2,
        height: 55,
        displayValue: true,
        fontSize: 11,
        margin: 4,
        lineColor: '#1a3a2a',
        background: '#ffffff'
      });
    } catch(e) {
      console.warn('Barcode error:', e);
    }
  }, 150);

  document.getElementById('etiqueta-preview').style.display = 'block';
  window._datosEtiquetaActual = datos;
  App.showToast('✓ Etiqueta con código de barras generada');
}
function imprimirEtiqueta() {
  const etiqueta = document.getElementById('etiqueta-print');
  if (!etiqueta) return;
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Etiqueta Frigocarnes</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { display:flex;justify-content:center;padding:20px;background:#f0f0f0; }
      @media print {
        body { background:#fff;padding:0; }
        @page { size: A6 landscape; margin: 5mm; }
      }
    </style>
  </head><body>${etiqueta.outerHTML}</body></html>`);
  win.document.close();
  setTimeout(() => { win.print(); }, 600);
}

function descargarEtiqueta() {
  App.showToast('💡 Usa "Imprimir" y guarda como PDF desde el diálogo de impresión');
}

// Cargar datos desde una caja del stock
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
  const cajas = DB.getStock().filter(c =>
    c.estado !== 'Despachado' &&
    [c.id, c.sku, c.nombre, c.lote].join(' ').toLowerCase().includes(s)
  );
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
  document.getElementById('eq-sku').value    = c.sku || '';
  document.getElementById('eq-nombre').value = c.nombre || '';
  document.getElementById('eq-tipo').value   = c.tipo || 'Vacuno';
  document.getElementById('eq-lote').value   = c.lote || '';
  document.getElementById('eq-peso').value   = c.pesoNeto || '';
  document.getElementById('eq-fprod').value  = c.fecProd || '';
  document.getElementById('eq-fvcto').value  = c.fecVcto || '';
  document.getElementById('eq-prov').value   = c.proveedor || '';
  document.getElementById('eq-pais').value   = c.pais || 'Chile';
  document.getElementById('eq-temp').value   = c.temp || '-18°C a -20°C';
  document.getElementById('modal-caja').style.display = 'none';
  App.showToast('✓ Datos cargados de ' + c.id);
}

// ============================================================
//  HISTORIAL STOCK — Cierre de mes y consulta
// ============================================================

async function ejecutarCierreMes() {
  const mes=document.getElementById('cierre-mes').value;
  const anio=document.getElementById('cierre-anio').value;
  const mesNom=MESES_NOMBRES[mes];
  const estado=document.getElementById('cierre-estado');
  if(!confirm('¿Confirmar cierre de '+mesNom+' '+anio+'?\n\nLas cajas disponibles NO se eliminarán.')) return;
  estado.style.display='block';
  estado.innerHTML='<span style="color:#1e6fd9">⟳ Enviando cierre a Google Sheets...</span>';
  const stock=DB.getStock();
  const ingMes=stock.filter(c=>{if(!c.fecIngreso)return false;const f=new Date(c.fecIngreso);return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes;});
  const despMes=stock.filter(c=>{if(!c.fecSalida)return false;const f=new Date(c.fecSalida);return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes;});
  const stockDisponible=stock.filter(c=>c.estado!=='Despachado'&&c.estado!=='Vencido');
  const cierres=JSON.parse(localStorage.getItem('frigocarnes_cierres')||'{}');
  const key=anio+'-'+mes;
  cierres[key]={periodo:key,mesNombre:mesNom,anio,generado:new Date().toISOString(),ingresos:ingMes,despachos:despMes,stockFinal:stockDisponible,resumen:{cajasIngresadas:ingMes.length,kgIngresados:ingMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1),cajasDespachadas:despMes.length,kgDespachados:despMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1),stockFinalCajas:stockDisponible.length,stockFinalKg:stockDisponible.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1)}};
  localStorage.setItem('frigocarnes_cierres',JSON.stringify(cierres));
  try {
    await fetch(SHEETS_CONFIG.url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body:JSON.stringify({tipo:'cierre_mes',periodo:key,mes_nombre:mesNom,anio,ingresos:ingMes.map(c=>({id_caja:c.id,sku:c.sku,producto:c.nombre,tipo_carne:c.tipo,lote:c.lote,fecha_vencimiento:c.fecVcto,peso_neto:c.pesoNeto,proveedor:c.proveedor,estado:c.estado,operario:c.operarioIngreso,fecha_ingreso:c.fecIngreso})),despachos:despMes.map(c=>({id_caja:c.id,sku:c.sku,producto:c.nombre,tipo_carne:c.tipo,lote:c.lote,peso_neto:c.pesoNeto,proveedor:c.proveedor,cliente:c.cliente,fecha_despacho:c.fecSalida,operario:c.operarioDespacho})),stock_final:stockDisponible.map(c=>({id_caja:c.id,sku:c.sku,producto:c.nombre,peso_neto:c.pesoNeto,estado:c.estado,camara:c.camara,fecha_vencimiento:c.fecVcto})),resumen:cierres[key].resumen})});
    estado.innerHTML='<span style="color:#16a34a">✅ Cierre de '+mesNom+' '+anio+' enviado a Google Sheets.</span>';
    App.showToast('✓ Cierre '+mesNom+' '+anio+' guardado');
    document.getElementById('hist-mes').value=mes;
    document.getElementById('hist-anio').value=anio;
    buscarHistorial();
  } catch(err) {
    estado.innerHTML='<span style="color:#dc2626">⚠️ Error al conectar. El cierre se guardó localmente.</span>';
  }
}

function buscarHistorial() {
  const mes=document.getElementById('hist-mes').value;
  const anio=document.getElementById('hist-anio').value;
  const mesNom=MESES_NOMBRES[mes];
  const key=anio+'-'+mes;
  const cierres=JSON.parse(localStorage.getItem('frigocarnes_cierres')||'{}');
  const cierre=cierres[key];
  const contenedor=document.getElementById('historial-resultado');
  if(!cierre){
    const stock=DB.getStock();
    const ingMes=stock.filter(c=>{if(!c.fecIngreso)return false;const f=new Date(c.fecIngreso);return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes;});
    const despMes=stock.filter(c=>{if(!c.fecSalida)return false;const f=new Date(c.fecSalida);return String(f.getFullYear())===anio&&String(f.getMonth()+1).padStart(2,'0')===mes;});
    if(!ingMes.length&&!despMes.length){contenedor.innerHTML='<div class="empty-state"><span class="empty-icon">📭</span><div class="empty-text">No hay movimientos para '+mesNom+' '+anio+'</div></div>';return;}
    renderHistorialDatos(contenedor,mesNom,anio,{ingresos:ingMes,despachos:despMes,resumen:{cajasIngresadas:ingMes.length,kgIngresados:ingMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1),cajasDespachadas:despMes.length,kgDespachados:despMes.reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1),stockFinalCajas:'—',stockFinalKg:'—'}},false);
    return;
  }
  renderHistorialDatos(contenedor,mesNom,anio,cierre,true);
}

function renderHistorialDatos(contenedor,mesNom,anio,datos,esCierre) {
  const r=datos.resumen;
  const fmtDate=d=>{if(!d)return'—';try{const[y,m,day]=d.split('-');return day+'/'+m+'/'+y;}catch{return d;}};
  const badge=esCierre?'<span style="background:#d8f3dc;color:#1a3a2a;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">✅ Cierre oficial</span>':'<span style="background:#fff8e1;color:#7a5c00;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700">📊 Datos actuales</span>';
  let html='<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><div style="font-weight:700;font-size:16px;color:var(--primary)">'+mesNom+' '+anio+'</div>'+badge+'</div>';
  html+='<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">';
  html+='<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:var(--primary)">'+r.cajasIngresadas+'</div><div style="font-size:11px;color:#64748b">Cajas ingresadas</div><div style="font-size:12px;font-weight:600;color:#1a3a2a">'+r.kgIngresados+' kg</div></div>';
  html+='<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#0a4a7a">'+r.cajasDespachadas+'</div><div style="font-size:11px;color:#64748b">Cajas despachadas</div><div style="font-size:12px;font-weight:600;color:#0a4a7a">'+r.kgDespachados+' kg</div></div>';
  html+='<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#7a3a00">'+r.stockFinalCajas+'</div><div style="font-size:11px;color:#64748b">Stock al cierre</div><div style="font-size:12px;font-weight:600;color:#7a3a00">'+r.stockFinalKg+' kg</div></div>';
  html+='<div style="background:var(--bg2);border-radius:10px;padding:12px;text-align:center"><div style="font-size:22px;font-weight:800;color:#666">'+(datos.ingresos.length+datos.despachos.length)+'</div><div style="font-size:11px;color:#64748b">Movimientos totales</div></div></div>';
  if(datos.ingresos.length>0){html+='<div style="font-weight:700;font-size:13px;color:var(--primary);margin-bottom:8px;display:flex;align-items:center;gap:6px">📦 Ingresos del mes <span style="background:var(--primary);color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">'+datos.ingresos.length+'</span></div>';datos.ingresos.forEach(c=>{html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid var(--primary)"><div><div style="font-weight:600;font-size:13px">'+(c.nombre||c.producto||'—')+'</div><div style="font-size:11px;color:#64748b">'+(c.id||c.id_caja)+' · '+c.lote+'</div></div><div style="text-align:right"><div style="font-weight:700;font-size:13px">'+(c.pesoNeto||c.peso_neto)+' kg</div><div style="font-size:11px;color:#64748b">'+fmtDate(c.fecIngreso||c.fecha_ingreso)+'</div></div></div>';});}
  if(datos.despachos.length>0){html+='<div style="font-weight:700;font-size:13px;color:#0a4a7a;margin-bottom:8px;margin-top:12px;display:flex;align-items:center;gap:6px">🚚 Despachos del mes <span style="background:#0a4a7a;color:#fff;border-radius:10px;padding:1px 8px;font-size:11px">'+datos.despachos.length+'</span></div>';datos.despachos.forEach(c=>{html+='<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg2);border-radius:8px;margin-bottom:6px;border-left:3px solid #0a4a7a"><div><div style="font-weight:600;font-size:13px">'+(c.nombre||c.producto||'—')+'</div><div style="font-size:11px;color:#64748b">'+(c.id||c.id_caja)+' · '+(c.cliente||c.cliente_destino||'—')+'</div></div><div style="text-align:right"><div style="font-weight:700;font-size:13px">'+(c.pesoNeto||c.peso_neto)+' kg</div><div style="font-size:11px;color:#64748b">'+fmtDate(c.fecSalida||c.fecha_despacho)+'</div></div></div>';});}
  contenedor.innerHTML=html;
}

// ============================================================
//  ETIQUETAS QR — Generador manual
// ============================================================
function generarEtiqueta() {
  const get=id=>document.getElementById(id)?.value||'';
  const datos={sku:get('eq-sku'),nombre:get('eq-nombre'),tipo:get('eq-tipo'),lote:get('eq-lote'),peso:get('eq-peso'),fprod:get('eq-fprod'),fvcto:get('eq-fvcto'),prov:get('eq-prov'),pais:get('eq-pais'),temp:get('eq-temp')};
  if(!datos.sku||!datos.nombre||!datos.lote){App.showToast('⚠ Completa SKU, producto y lote');return;}
  const qrData=JSON.stringify({s:datos.sku,n:datos.nombre,t:datos.tipo,l:datos.lote,p:datos.peso,fp:datos.fprod,fv:datos.fvcto,pr:datos.prov,pa:datos.pais,tm:datos.temp,src:'FRIGOCARNES'});
  const fmtDate=d=>{if(!d)return'—';try{const[y,m,day]=d.split('-');return day+'/'+m+'/'+y;}catch{return d;}};
  const contenedor=document.getElementById('etiqueta-contenido');
  contenedor.innerHTML=`<div id="etiqueta-print" style="font-family:Arial,sans-serif;max-width:420px;margin:0 auto"><div style="background:#1a3a2a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><div><div style="font-size:16px;font-weight:800">❄ FRIGOCARNES</div><div style="font-size:10px;opacity:0.8">Etiqueta de Trazabilidad</div></div><div style="font-size:10px;opacity:0.8">${new Date().toLocaleDateString('es-CL')}</div></div><div style="padding:12px 14px;background:#fff;display:flex;gap:12px"><div style="flex:1"><div style="font-size:17px;font-weight:800;color:#1a3a2a">${datos.nombre}</div><div style="font-size:12px;color:#2d6a4f;font-weight:700;margin-bottom:10px">${datos.tipo} · ${datos.pais}</div><table style="width:100%;font-size:11px;border-collapse:collapse"><tr style="background:#f8fffe"><td style="padding:4px 6px;color:#64748b;width:45%">SKU</td><td style="padding:4px 6px;font-weight:700">${datos.sku}</td></tr><tr><td style="padding:4px 6px;color:#64748b">N° Lote</td><td style="padding:4px 6px;font-weight:700">${datos.lote}</td></tr><tr style="background:#f8fffe"><td style="padding:4px 6px;color:#64748b">Peso Neto</td><td style="padding:4px 6px;font-weight:700">${datos.peso?datos.peso+' kg':'—'}</td></tr><tr><td style="padding:4px 6px;color:#64748b">F. Producción</td><td style="padding:4px 6px">${fmtDate(datos.fprod)}</td></tr><tr style="background:#fff8e1"><td style="padding:4px 6px;color:#64748b;font-weight:700">F. Vencimiento</td><td style="padding:4px 6px;font-weight:800;color:#c17b00">${fmtDate(datos.fvcto)}</td></tr><tr style="background:#f8fffe"><td style="padding:4px 6px;color:#64748b">Proveedor</td><td style="padding:4px 6px">${datos.prov}</td></tr><tr><td style="padding:4px 6px;color:#64748b">Conservar a</td><td style="padding:4px 6px;color:#1e40af;font-weight:700">${datos.temp}</td></tr></table></div><div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div id="qr-canvas-manual" style="border:2px solid #1a3a2a;border-radius:6px;padding:4px;background:#fff"></div><div style="font-size:9px;color:#64748b;text-align:center">Escanear<br>para registrar</div></div></div><div style="background:#d8f3dc;padding:6px 14px;display:flex;justify-content:space-between;font-size:10px;color:#1a3a2a"><span>🌡 ${datos.temp}</span><span>Trazabilidad certificada · FRIGOCARNES</span></div></div>`;
  document.getElementById('qr-canvas-manual').innerHTML='';
  try{new QRCode(document.getElementById('qr-canvas-manual'),{text:qrData,width:110,height:110,colorDark:'#1a3a2a',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}catch(e){}
  document.getElementById('etiqueta-preview').style.display='block';
  App.showToast('✓ Etiqueta generada');
}

function imprimirEtiqueta() {
  const el=document.getElementById('etiqueta-print');
  if(!el)return;
  const win=window.open('','_blank');
  win.document.write('<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Etiqueta Frigocarnes</title><style>*{margin:0;padding:0;box-sizing:border-box}body{display:flex;justify-content:center;padding:20px;background:#f0f0f0}@media print{body{background:#fff;padding:0}@page{size:A6 landscape;margin:5mm}}</style></head><body>'+el.outerHTML+'</body></html>');
  win.document.close();
  setTimeout(()=>win.print(),600);
}

function descargarEtiqueta(){App.showToast('💡 Usa "Imprimir" y guarda como PDF');}

function cargarDesdeCaja(){
  const modal=document.getElementById('modal-caja');
  const lista=document.getElementById('modal-lista');
  const cajas=DB.getStock().filter(c=>c.estado!=='Despachado');
  lista.innerHTML=cajas.map(c=>'<div onclick="seleccionarCajaEtiqueta(\''+c.id+'\')" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer"><div style="font-weight:700;font-size:13px">'+c.nombre+'</div><div style="font-size:11px;color:#64748b">'+c.id+' · '+c.sku+' · '+c.lote+'</div></div>').join('')||'<div style="text-align:center;color:#94a3b8;padding:20px">Sin cajas</div>';
  modal.style.display='block';
}

function filtrarModalCajas(){
  const s=document.getElementById('modal-search').value.toLowerCase();
  const cajas=DB.getStock().filter(c=>c.estado!=='Despachado'&&[c.id,c.sku,c.nombre,c.lote].join(' ').toLowerCase().includes(s));
  document.getElementById('modal-lista').innerHTML=cajas.map(c=>'<div onclick="seleccionarCajaEtiqueta(\''+c.id+'\')" style="padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;cursor:pointer"><div style="font-weight:700;font-size:13px">'+c.nombre+'</div><div style="font-size:11px;color:#64748b">'+c.id+' · '+c.sku+'</div></div>').join('')||'<div style="text-align:center;color:#94a3b8;padding:20px">Sin resultados</div>';
}

function seleccionarCajaEtiqueta(id){
  const c=DB.getStock().find(x=>x.id===id);if(!c)return;
  document.getElementById('eq-sku').value=c.sku||'';
  document.getElementById('eq-nombre').value=c.nombre||'';
  document.getElementById('eq-tipo').value=c.tipo||'Vacuno';
  document.getElementById('eq-lote').value=c.lote||'';
  document.getElementById('eq-peso').value=c.pesoNeto||'';
  document.getElementById('eq-fprod').value=c.fecProd||'';
  document.getElementById('eq-fvcto').value=c.fecVcto||'';
  document.getElementById('eq-prov').value=c.proveedor||'';
  document.getElementById('eq-pais').value=c.pais||'Chile';
  document.getElementById('eq-temp').value=c.temp||'-18°C a -20°C';
  document.getElementById('modal-caja').style.display='none';
  App.showToast('✓ Datos cargados de '+c.id);
}

// ============================================================
//  BADGE DE ALERTAS — Punto rojo intermitente en navegación
// ============================================================
function actualizarBadgeAlertas() {
  let stock = DB.getStock();
  if (!stock || !Array.isArray(stock)) stock = [];
  const hoy   = new Date();

  const hayAlertas = stock.some(c => {
    if (c.estado === 'Despachado') return false;
    if (c.estado === 'En Cuarentena' || c.estado === 'Bloqueado') return true;
    if (!c.fecVcto) return false;
    const dias = Math.ceil((new Date(c.fecVcto) - hoy) / 86400000);
    return dias <= 30;
  });

  const badgeTop  = document.getElementById('alerta-badge-top');
  const badgeBnav = document.getElementById('alerta-badge-bnav');
  if (badgeTop)  badgeTop.style.display  = hayAlertas ? 'block' : 'none';
  if (badgeBnav) badgeBnav.style.display = hayAlertas ? 'block' : 'none';
}

// Ocultar badge al entrar a Alertas
const _irAOriginal = typeof App !== 'undefined' ? null : null;
document.addEventListener('DOMContentLoaded', () => {
  // Revisar alertas al cargar
  setTimeout(actualizarBadgeAlertas, 500);
  // Revisar cada 5 minutos
  setInterval(actualizarBadgeAlertas, 5 * 60 * 1000);
});

// ============================================================
//  DESCUENTO POR CÓDIGO DE BARRAS
//  Escanea el código → identifica la caja → la despacha
// ============================================================
function buscarPorCodigoBarras(codigo) {
  if (!codigo) return null;
  const stock = DB.getStock();
  // Buscar por código de barras exacto
  let caja = stock.find(c => c.codigoBarras === codigo && c.estado !== 'Despachado');
  // Si no encuentra, buscar por ID de caja embebido en el código FC
  if (!caja && codigo.startsWith('FC')) {
    const idNum = codigo.slice(4); // quitar FC + 2 dígitos año
    caja = stock.find(c => c.id && c.id.replace(/[^0-9]/g,'').slice(-8).padStart(8,'0') === idNum && c.estado !== 'Despachado');
  }
  return caja || null;
}

function escanearYDescontarCodigo() {
  const input = document.getElementById('scan-barcode-input');
  const codigo = input?.value?.trim();
  if (!codigo) { App.showToast('⚠ Ingresa o escanea un código'); return; }

  const caja = buscarPorCodigoBarras(codigo);
  if (!caja) {
    App.showToast('⚠ Caja no encontrada o ya despachada: ' + codigo);
    if (input) input.value = '';
    return;
  }

  // Mostrar confirmación
  const fmtDate = d => { try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; }};
  if (!confirm('¿Descontar del stock?\n\n' + caja.nombre + '\n' + caja.id + ' · Lote ' + caja.lote + '\nPeso: ' + caja.pesoNeto + ' kg\nVcto: ' + fmtDate(caja.fecVcto))) {
    if (input) input.value = '';
    return;
  }

  // Despachar
  const s = DB.getSession();
  const hoy = new Date().toISOString().split('T')[0];
  const hora = new Date().toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'});
  DB.updateCaja(caja.id, { estado:'Despachado', fecSalida:hoy, horaSalida:hora, operarioDespacho:s?.usuario||'Sistema' });
  DB.addMovimiento(caja.id, 'Despachado por código de barras por '+(s?.usuario||'Sistema'));
  enviarASheets({ tipo:'despacho', id_caja:caja.id, sku:caja.sku, producto:caja.nombre, tipo_carne:caja.tipo, lote:caja.lote, fecha_vencimiento:caja.fecVcto, peso_neto:caja.pesoNeto, proveedor:caja.proveedor, camara_frio:caja.camara, fecha_despacho:hoy, hora_despacho:hora, operario_despacho:s?.usuario||'Sistema' });

  App.showToast('✓ ' + caja.id + ' (' + caja.nombre + ') descontado del stock');
  if (input) input.value = '';
  renderDashboard();
  actualizarBadgeAlertas();
}

// Permite escanear con Enter (pistola lectora) o botón
function handleBarcodeScan(e) {
  if (e.key === 'Enter') escanearYDescontarCodigo();
}
