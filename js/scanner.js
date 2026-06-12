/* =============================================
   FRIGOCARNES WMS — Módulo de escaneo con IA
   Usa Claude Vision para leer etiquetas
   ============================================= */

const Scanner = (() => {
  let stream = null;
  let camActiva = false;
  let imgBase64 = null;

  // Prompt optimizado para etiquetas de carne chilenas
  const PROMPT_OCR = `Eres un sistema OCR especializado en etiquetas de cajas de carne para bodegas frigoríficas en Chile.

Analiza la imagen y extrae TODOS los datos visibles en la etiqueta. Responde ÚNICAMENTE con un objeto JSON válido. Sin explicaciones, sin markdown, sin backticks.

{
  "id": "ID único o código de caja (null si no hay)",
  "sku": "código SKU o código de producto",
  "nombre": "nombre del corte o producto cárnico",
  "tipo": "tipo de carne exacto: Vacuno, Cerdo, Pollo, Cordero, Pavo o Mixto",
  "categoria": "categoría del corte",
  "lote": "número de lote completo",
  "pesoNeto": "peso neto como número decimal (solo el número)",
  "pesoBruto": "peso bruto como número decimal (solo el número)",
  "piezas": "cantidad de piezas como número entero",
  "fechaProduccion": "fecha en formato YYYY-MM-DD",
  "fechaEnvasado": "fecha en formato YYYY-MM-DD",
  "fechaVencimiento": "fecha en formato YYYY-MM-DD",
  "horaProduccion": "hora en formato HH:MM",
  "proveedor": "nombre completo del proveedor o frigorífico",
  "planta": "nombre de la planta faenadora o procesadora",
  "pais": "país de origen del producto",
  "temperatura": "temperatura de conservación requerida",
  "codigoBarras": "número del código de barras si es visible",
  "certificaciones": "certificaciones sanitarias visibles (SEREMI, PABCO, Halal, etc.)",
  "observaciones": "cualquier otra información relevante visible"
}

Si un campo no está visible en la imagen, usa null. Para fechas con formato DD/MM/YYYY o DD-MM-YYYY, conviértelas a YYYY-MM-DD. Para pesos, extrae solo el número.`;

  function setEstado(tipo, msg, barId = 'estadoBar', msgId = 'estadoMsg') {
    const bar = document.getElementById(barId);
    const msgEl = document.getElementById(msgId);
    if (!bar || !msgEl) return;
    bar.className = `estado-bar estado-${tipo}`;
    const spinner = tipo === 'scanning' ? '<span class="spin-icon">⟳</span> ' : '';
    bar.innerHTML = `${spinner}<span id="${msgId}">${msg}</span>`;
  }

  async function toggleCam() {
    if (camActiva) { cerrarCam(); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      const video = document.getElementById('camVideo');
      video.srcObject = stream;
      document.getElementById('camIdle').style.display = 'none';
      document.getElementById('camOverlay').style.display = 'block';
      document.getElementById('btnCapture').style.display = 'flex';
      document.getElementById('btnCam').textContent = '✕ Cerrar cámara';
      camActiva = true;
      setEstado('scanning', 'Cámara activa — enfoca la etiqueta y captura');
    } catch (e) {
      setEstado('error', 'Sin acceso a cámara. Usa "Subir foto" para cargar una imagen.');
    }
  }

  function cerrarCam() {
    if (stream) stream.getTracks().forEach(t => t.stop());
    stream = null; camActiva = false;
    const video = document.getElementById('camVideo');
    if (video) video.srcObject = null;
    const idle = document.getElementById('camIdle');
    if (idle) idle.style.display = 'flex';
    const overlay = document.getElementById('camOverlay');
    if (overlay) overlay.style.display = 'none';
    const btnCap = document.getElementById('btnCapture');
    if (btnCap) btnCap.style.display = 'none';
    const btnCam = document.getElementById('btnCam');
    if (btnCam) btnCam.textContent = '📷 Abrir cámara';
    setEstado('idle', 'Abre la cámara o ingresa los datos manualmente');
  }

  function capturar() {
    const video = document.getElementById('camVideo');
    const canvas = document.getElementById('camCanvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext('2d').drawImage(video, 0, 0);
    imgBase64 = canvas.toDataURL('image/jpeg', 0.88).split(',')[1];
    cerrarCam();
    procesarImagen('data:image/jpeg;base64,' + imgBase64);
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      imgBase64 = src.split(',')[1];
      procesarImagen(src);
    };
    reader.readAsDataURL(file);
  }

  function procesarImagen(src) {
    // Mostrar preview
    const panelA = document.getElementById('panelAnalisis');
    if (panelA) {
      panelA.style.display = 'block';
      const img = document.getElementById('previewImg');
      if (img) img.src = src;
    }
    setEstado('scanning', '⟳ IA leyendo etiqueta...', 'estadoBar2', 'estadoMsg2');
    analizarConIA();
  }

  async function analizarConIA() {
    // Primero intentar leer como QR de Frigocarnes
    if (imgBase64) {
      try {
        const img = new Image();
        img.src = 'data:image/jpeg;base64,' + imgBase64;
        // jsQR attempt via canvas pixel data
        const canvas = document.createElement('canvas');
        // Skip jsQR - go straight to Claude Vision but check response for QR
      } catch(e) {}
    }

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imgBase64 } },
              { type: 'text', text: PROMPT_OCR }
            ]
          }]
        })
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      const txt = (data.content || []).map(b => b.text || '').join('').trim();

      let parsed;
      try {
        // Primero ver si Claude detectó un QR de Frigocarnes en la imagen
        const qrMatch = txt.match(/\{[^{}]*"src"\s*:\s*"FRIGOCARNES"[^{}]*\}/);
        if (qrMatch) {
          const qrParsed = procesarQRFrigocarnes(qrMatch[0]);
          if (qrParsed) {
            parsed = qrParsed;
            setEstado('ok', '✓ QR Frigocarnes detectado — todos los campos listos', 'estadoBar2', 'estadoMsg2');
            poblarFormulario(parsed);
            App.showToast('✓ QR Frigocarnes leído');
            return;
          }
        }
        parsed = JSON.parse(txt.replace(/```json|```/g, '').trim());
      } catch {
        parsed = extraerConRegex(txt);
      }

      poblarFormulario(parsed);
      setEstado('ok', `✓ Etiqueta leída — ${Object.values(parsed).filter(v=>v!==null).length} campos detectados`, 'estadoBar2', 'estadoMsg2');
      App.showToast('✓ Etiqueta leída por IA');

    } catch (err) {
      console.error('Scanner IA error:', err);
      setEstado('error', 'Error al leer. Completa los datos manualmente.', 'estadoBar2', 'estadoMsg2');
    }
  }

  function extraerConRegex(txt) {
    const get = rx => { const m = txt.match(rx); return m ? m[1].trim() : null; };
    return {
      nombre: get(/(?:nombre|corte|producto)[:\s]+([^\n,]+)/i),
      lote: get(/lote[:\s#]+([^\n,\s]+)/i),
      pesoNeto: parseFloat(get(/peso\s*neto[:\s]+([\d.,]+)/i)) || null,
      proveedor: get(/(?:proveedor|frigorífico)[:\s]+([^\n,]+)/i),
      fechaVencimiento: get(/(?:venc\w*|exp\w*)[:\s]+([\d\/\-]+)/i),
      tipo: get(/(?:especie|tipo)[:\s]+([^\n,]+)/i),
    };
  }

  // Detectar si es QR de Frigocarnes y parsear
  function procesarQRFrigocarnes(texto) {
    try {
      const d = JSON.parse(texto);
      if (d.src !== 'FRIGOCARNES') return null;
      return {
        sku: d.s, nombre: d.n, tipo: d.t, lote: d.l,
        pesoNeto: d.p, fechaProduccion: d.fp, fechaVencimiento: d.fv,
        proveedor: d.pr, pais: d.pa, temperatura: d.tm
      };
    } catch { return null; }
  }

  function poblarFormulario(d) {
    const set = (id, val) => {
      if (!val) return;
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val;
      el.classList.add('autofilled');
    };

    set('f-sku', d.sku);
    set('f-nombre', d.nombre);
    set('f-lote', d.lote);
    set('f-barras', d.codigoBarras);
    set('f-peso-neto', d.pesoNeto);
    set('f-peso-bruto', d.pesoBruto);
    set('f-piezas', d.piezas || 1);
    set('f-fprod', d.fechaProduccion);
    set('f-fenv', d.fechaEnvasado);
    set('f-fvcto', d.fechaVencimiento);
    set('f-hprod', d.horaProduccion);
    set('f-prov', d.proveedor);
    set('f-planta', d.planta);
    set('f-cert', d.certificaciones);
    set('f-obs', d.observaciones);

    // Selects con match flexible
    matchSelect('f-tipo', d.tipo);
    matchSelect('f-pais', d.pais);
    matchSelect('f-temp', d.temperatura);

    // Generar ID si no hay
    if (!document.getElementById('f-id').value) {
      document.getElementById('f-id').value = DB.getNextId();
    }

    // Operario = usuario logueado
    const session = DB.getSession();
    if (session) {
      const opEl = document.getElementById('f-op');
      if (opEl) opEl.value = session.usuario;
    }

    // Generar QR automáticamente
    setTimeout(() => {
      if (typeof generarQRAuto === 'function') generarQRAuto();
    }, 300);
  }

  function matchSelect(id, val) {
    if (!val) return;
    const sel = document.getElementById(id);
    if (!sel) return;
    const opts = [...sel.options];
    const match = opts.find(o => o.value.toLowerCase().includes(val.toLowerCase()) || val.toLowerCase().includes(o.value.toLowerCase()));
    if (match) sel.value = match.value;
  }

  // Demo con datos de ejemplo
  function usarDemo() {
    const demos = [
      { sku:'VAC-LOM-001', nombre:'Lomo liso vacuno', tipo:'Vacuno', lote:'L-2025-088', pesoNeto:21.4, pesoBruto:23.0, piezas:1, fechaProduccion:'2025-06-01', fechaEnvasado:'2025-06-01', fechaVencimiento:'2025-12-01', horaProduccion:'06:30', proveedor:'Frigorífico Sur SpA', planta:'Planta Maipú', pais:'Chile', temperatura:'-18°C a -20°C', codigoBarras:'7802345678912', certificaciones:'SEREMI N°456, PABCO' },
      { sku:'CER-COT-002', nombre:'Costilla cerdo', tipo:'Cerdo', lote:'L-2025-089', pesoNeto:16.8, pesoBruto:18.0, piezas:1, fechaProduccion:'2025-06-02', fechaEnvasado:'2025-06-02', fechaVencimiento:'2025-12-02', horaProduccion:'07:45', proveedor:'CarnesCL Ltda.', planta:'Planta Lampa', pais:'Chile', temperatura:'0°C a 4°C', codigoBarras:'7801112223334', certificaciones:'SEREMI N°123' },
      { sku:'COR-PIE-003', nombre:'Pierna cordero', tipo:'Cordero', lote:'L-2025-090', pesoNeto:8.5, pesoBruto:9.2, piezas:2, fechaProduccion:'2025-05-30', fechaEnvasado:'2025-05-30', fechaVencimiento:'2025-11-30', horaProduccion:'08:00', proveedor:'Ovinos del Sur', planta:'Silver Fern Farms', pais:'Nueva Zelanda', temperatura:'-18°C a -20°C', codigoBarras:'7809998887776', certificaciones:'Halal, ISO 22000' }
    ];
    const d = demos[Math.floor(Math.random() * demos.length)];

    // Simular proceso visual
    const panelA = document.getElementById('panelAnalisis');
    if (panelA) {
      panelA.style.display = 'block';
      const img = document.getElementById('previewImg');
      if (img) img.src = generarSVGDemo(d);
    }
    setEstado('scanning', '⟳ IA leyendo etiqueta de ejemplo...', 'estadoBar2', 'estadoMsg2');

    setTimeout(() => {
      poblarFormulario(d);
      setEstado('ok', `✓ Demo: ${d.nombre} — ${Object.values(d).filter(v=>v).length} campos detectados`, 'estadoBar2', 'estadoMsg2');
      App.showToast('✓ Demo cargado: ' + d.sku);
    }, 1800);
  }

  function generarSVGDemo(d) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="380" style="background:#fff;font-family:Arial,sans-serif;">
      <rect x="10" y="10" width="620" height="360" rx="8" fill="none" stroke="#333" stroke-width="2"/>
      <rect x="10" y="10" width="620" height="55" rx="8" fill="#0a1628"/>
      <text x="30" y="46" fill="#fff" font-size="20" font-weight="bold">FRIGOCARNES — ${d.proveedor}</text>
      <text x="30" y="90" fill="#333" font-size="15">PRODUCTO: ${d.nombre}</text>
      <text x="30" y="115" fill="#333" font-size="14">SKU: ${d.sku}</text>
      <text x="30" y="140" fill="#333" font-size="14">LOTE: ${d.lote}</text>
      <text x="30" y="165" fill="#333" font-size="14">PESO NETO: ${d.pesoNeto} kg  |  PESO BRUTO: ${d.pesoBruto} kg</text>
      <text x="30" y="190" fill="#333" font-size="14">PIEZAS: ${d.piezas}  |  TIPO: ${d.tipo}</text>
      <text x="30" y="215" fill="#333" font-size="14">F. PRODUCCIÓN: ${d.fechaProduccion}  |  HORA: ${d.horaProduccion}</text>
      <text x="30" y="240" fill="#333" font-size="14">F. VENCIMIENTO: ${d.fechaVencimiento}</text>
      <text x="30" y="265" fill="#333" font-size="14">PLANTA: ${d.planta} — ${d.pais}</text>
      <text x="30" y="290" fill="#333" font-size="14">CERTIFICACIONES: ${d.certificaciones}</text>
      <text x="30" y="320" fill="#555" font-size="12">Conservar a ${d.temperatura}</text>
      <text x="30" y="345" fill="#555" font-size="12">Código: ${d.codigoBarras}</text>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // API pública del módulo
  return { toggleCam, cerrarCam, capturar, handleFile, usarDemo };
})();

// Exponer funciones globalmente para los onclick del HTML
function toggleCam() { Scanner.toggleCam(); }
function capturar() { Scanner.capturar(); }
function handleFile(e) { Scanner.handleFile(e); }
function usarDemo() { Scanner.usarDemo(); }
