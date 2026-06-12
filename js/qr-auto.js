/* =============================================
   FRIGOCARNES WMS — QR automático post-escaneo
   Se activa después de poblarFormulario()
   ============================================= */

function generarQRAuto() {
  const get = id => document.getElementById(id)?.value || '';
  const sku    = get('f-sku');
  const nombre = get('f-nombre');
  const lote   = get('f-lote');

  // Solo generar si hay datos mínimos
  if (!sku && !nombre && !lote) return;

  const datos = {
    s: sku,
    n: nombre,
    t: get('f-tipo'),
    l: lote,
    p: get('f-peso-neto'),
    fp: get('f-fprod'),
    fv: get('f-fvcto'),
    pr: get('f-prov'),
    pa: get('f-pais') || 'Chile',
    tm: get('f-temp') || '-18°C a -20°C',
    src: 'FRIGOCARNES'
  };

  const panel = document.getElementById('qr-auto-panel');
  const canvas = document.getElementById('qr-auto-canvas');
  const datosEl = document.getElementById('qr-auto-datos');
  if (!panel || !canvas) return;

  // Limpiar QR anterior
  canvas.innerHTML = '';

  // Usar código guardado en la caja, o generar uno si no tiene
  const codigoBarras = datos.barras || datos.id || 
    (typeof generarCodigoBarras === 'function' ? generarCodigoBarras({id: datos.id||''}) : 'FRIGOCARNES');
  canvas.innerHTML = '<canvas id="qr-auto-barcode-canvas"></canvas>';
  setTimeout(() => {
    const bc = document.getElementById('qr-auto-barcode-canvas');
    if (!bc) return;
    try {
      Barcode.draw(bc, codigoBarras, {
        width: 1.8,
        height: 50,
        displayValue: true,
        fontSize: 10,
        margin: 4,
        lineColor: '#1a3a2a',
        background: '#ffffff'
      });
    } catch(e) {
      canvas.innerHTML = '<div style="font-size:10px;color:#999;padding:8px">'+codigoBarras+'</div>';
    }
  }, 150);

  const fmtDate = d => {
    if (!d) return '—';
    try { const [y,m,day] = d.split('-'); return day+'/'+m+'/'+y; } catch { return d; }
  };

  if (datosEl) {
    datosEl.innerHTML =
      '<strong style="color:var(--text);font-size:12px">'+nombre+'</strong><br>'
      + (sku ? 'SKU: '+sku+'<br>' : '')
      + (lote ? 'Lote: '+lote+'<br>' : '')
      + (datos.p ? 'Peso: '+datos.p+' kg<br>' : '')
      + (datos.fv ? 'Vcto: '+fmtDate(datos.fv)+'<br>' : '')
      + (datos.pr ? datos.pr : '');
  }

  panel.style.display = 'block';
  window._qrAutoData = datos;
}

function imprimirQRAuto() {
  const get = id => document.getElementById(id)?.value || '';
  const fmtDate = d => { try { const [y,m,day]=d.split('-'); return day+'/'+m+'/'+y; } catch { return d||'—'; }};

  const datos = window._qrAutoData;
  if (!datos) return;

  const canvas = document.getElementById('qr-auto-canvas');
  const imgSrc = canvas?.querySelector('img')?.src || canvas?.querySelector('canvas')?.toDataURL() || '';

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Etiqueta Frigocarnes</title>
    <style>
      * { margin:0;padding:0;box-sizing:border-box; }
      body { display:flex;justify-content:center;align-items:flex-start;padding:10px;background:#f0f0f0; }
      @media print { body{background:#fff;padding:0} @page{size:A6 landscape;margin:4mm} }
    </style>
  </head><body>
    <div style="font-family:Arial,sans-serif;width:148mm;background:#fff;border:1px solid #ddd">
      <div style="background:#1a3a2a;color:#fff;padding:8px 12px;display:flex;justify-content:space-between;align-items:center">
        <div><div style="font-size:14px;font-weight:800">❄ FRIGOCARNES</div><div style="font-size:9px;opacity:0.8">Etiqueta de Trazabilidad</div></div>
        <div style="font-size:9px;opacity:0.8">${new Date().toLocaleDateString('es-CL')}</div>
      </div>
      <div style="padding:10px;display:flex;gap:10px;align-items:flex-start">
        <div style="flex:1">
          <div style="font-size:14px;font-weight:800;color:#1a3a2a;margin-bottom:2px">${datos.n}</div>
          <div style="font-size:10px;color:#2d6a4f;font-weight:700;margin-bottom:8px">${datos.t} · ${datos.pa}</div>
          <table style="width:100%;font-size:10px;border-collapse:collapse">
            ${datos.s?'<tr><td style="color:#64748b;padding:2px 0;width:40%">SKU</td><td style="font-weight:700">'+datos.s+'</td></tr>':''}
            ${datos.l?'<tr><td style="color:#64748b;padding:2px 0">N° Lote</td><td style="font-weight:700">'+datos.l+'</td></tr>':''}
            ${datos.p?'<tr><td style="color:#64748b;padding:2px 0">Peso Neto</td><td style="font-weight:700">'+datos.p+' kg</td></tr>':''}
            ${datos.fp?'<tr><td style="color:#64748b;padding:2px 0">F. Producción</td><td>'+fmtDate(datos.fp)+'</td></tr>':''}
            ${datos.fv?'<tr style="background:#fff8e1"><td style="color:#64748b;padding:2px 4px;font-weight:700">F. Vencimiento</td><td style="font-weight:800;color:#c17b00">'+fmtDate(datos.fv)+'</td></tr>':''}
            ${datos.pr?'<tr><td style="color:#64748b;padding:2px 0">Proveedor</td><td>'+datos.pr+'</td></tr>':''}
            ${datos.tm?'<tr><td style="color:#64748b;padding:2px 0">Conservar a</td><td style="color:#1e40af;font-weight:700">'+datos.tm+'</td></tr>':''}
          </table>
        </div>
        <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
          ${imgSrc?'<img src="'+imgSrc+'" style="width:80px;height:80px;border:2px solid #1a3a2a;border-radius:4px">':'<div style="width:80px;height:80px;border:2px solid #1a3a2a;border-radius:4px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#999">QR</div>'}
          <div style="font-size:8px;color:#64748b;text-align:center">Código de barras</div>
        </div>
      </div>
      <div style="background:#d8f3dc;padding:4px 12px;font-size:9px;color:#1a3a2a;display:flex;justify-content:space-between">
        <span>🌡 ${datos.tm}</span>
        <span>Trazabilidad certificada · FRIGOCARNES</span>
      </div>
    </div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 500);
}
