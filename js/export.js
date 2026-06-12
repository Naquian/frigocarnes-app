/* =============================================
   FRIGOCARNES WMS — Módulo de exportación
   Excel (xlsx), CSV, PDF imprimible, JSON
   ============================================= */

// --- EXCEL (xlsx via SheetJS CDN) ---
async function exportarExcel() {
  App.showToast('⏳ Generando Excel...');
  try {
    // Cargar SheetJS si no está disponible
    if (typeof XLSX === 'undefined') {
      await cargarScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
    }
    const stock = DB.getStock();
    const headers = [
      'ID Caja','SKU','Nombre / Corte','Tipo de Carne','Categoría','N° Lote',
      'F. Producción','F. Envasado','F. Vencimiento','Hora Producción',
      'Peso Neto (kg)','Peso Bruto (kg)','Piezas','Unidad','País Origen',
      'Planta Faenadora','Proveedor','Temp. Conservación','Estado',
      'Cámara Frío','Rack','Fila','Nivel','N° Pallet',
      'Cliente Destino','Orden de Compra',
      'F. Ingreso Bodega','Hora Ingreso','F. Salida Bodega','Hora Salida',
      'Op. Ingreso','Op. Despacho',
      'Código Barras','Estado Inspección','Certificaciones','Observaciones'
    ];
    const rows = stock.map(c => [
      c.id, c.sku, c.nombre, c.tipo, c.categoria, c.lote,
      c.fecProd, c.fecEnv, c.fecVcto, c.horaProd,
      c.pesoNeto, c.pesoBruto, c.piezas, c.unidad, c.pais,
      c.planta, c.proveedor, c.temp, c.estado,
      c.camara, c.rack, c.fila, c.nivel, c.pallet,
      c.cliente, c.oc,
      c.fecIngreso, c.horaIngreso, c.fecSalida, c.horaSalida,
      c.operarioIngreso, c.operarioDespacho,
      c.codigoBarras, c.inspeccion, c.cert, c.obs
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    // Ancho de columnas
    ws['!cols'] = headers.map((h,i) => ({ wch: Math.max(h.length, ...(rows.map(r=>String(r[i]||'').length))) + 2 }));
    // Estilo encabezado (color)
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({r:0, c:C})];
      if (cell) cell.s = { fill:{fgColor:{rgb:'1E6FD9'}}, font:{color:{rgb:'FFFFFF'}, bold:true} };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Stock FrigoCarnes');

    // Hoja de resumen
    const stats = DB.getStats();
    const wsRes = XLSX.utils.aoa_to_sheet([
      ['FrigoCarnes WMS — Resumen de Stock'],
      ['Exportado:', new Date().toLocaleString('es-CL')],
      [],
      ['Cámara','Cajas','Kg totales'],
      ...stats.porCamara.map(r=>[r.camara, r.count, r.kg]),
      [],
      ['Tipo de carne','Cajas','Kg totales'],
      ...stats.porTipo.map(r=>[r.tipo, r.count, r.kg]),
      [],
      ['Total cajas en stock:', stats.total],
      ['Total kg:', stats.kgTotal],
      ['Por vencer (7d):', stats.porVencer],
    ]);
    XLSX.utils.book_append_sheet(wb, wsRes, 'Resumen');

    const fecha = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `FrigoCarnes_Stock_${fecha}.xlsx`);
    App.showToast('✓ Excel descargado');
  } catch(e) {
    console.error(e);
    App.showToast('Error al generar Excel');
  }
}

// --- CSV ---
function exportarCSV() {
  const stock = DB.getStock();
  const headers = ['ID','SKU','Nombre','Tipo','Lote','Peso_Neto_kg','Peso_Bruto_kg','F_Vencimiento','Proveedor','Estado','Camara','Rack','Fila','Nivel','Pallet','Cliente','OC','F_Ingreso','Operario'];
  const rows = stock.map(c => [
    c.id, c.sku, c.nombre, c.tipo, c.lote, c.pesoNeto, c.pesoBruto,
    c.fecVcto, c.proveedor, c.estado, c.camara, c.rack, c.fila, c.nivel,
    c.pallet, c.cliente, c.oc, c.fecIngreso, c.operarioIngreso
  ].map(v => `"${String(v||'').replace(/"/g,'""')}"`));

  const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
  const bom = '\uFEFF'; // BOM para Excel en español
  descargar(bom + csv, `FrigoCarnes_Stock_${hoyStr()}.csv`, 'text/csv;charset=utf-8');
  App.showToast('✓ CSV descargado');
}

// --- PDF imprimible ---
function exportarPDF() {
  const stock = DB.getStock();
  const stats = DB.getStats();
  const fechaEx = new Date().toLocaleString('es-CL');

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>FrigoCarnes — Inventario ${hoyStr()}</title>
<style>
  * { margin:0;padding:0;box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #0f172a; }
  .header { background: #0a1628; color: white; padding: 16px 24px; display: flex; justify-content: space-between; align-items: center; }
  .header h1 { font-size: 20px; } .header p { font-size: 11px; opacity:.8; }
  .meta { padding: 12px 24px; background: #f4f6f9; border-bottom: 1px solid #e2e8f0; display: flex; gap: 24px; }
  .meta-item { text-align: center; } .meta-item strong { display: block; font-size: 18px; color: #1e6fd9; }
  .meta-item span { font-size: 10px; color: #64748b; }
  table { width: 100%; border-collapse: collapse; margin: 0; }
  th { background: #1e6fd9; color: white; padding: 6px 8px; text-align: left; font-size: 10px; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; font-size: 10px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .badge { padding: 2px 6px; border-radius: 10px; font-size: 9px; font-weight: 600; }
  .badge-Disponible { background:#d1fae5;color:#065f46; }
  .badge-Reservado { background:#fef3c7;color:#92400e; }
  .badge-Despachado { background:#e0e7ff;color:#3730a3; }
  .badge-Vencido { background:#fee2e2;color:#991b1b; }
  .badge-Cuarentena { background:#fce7f3;color:#9d174d; }
  .footer { padding: 12px 24px; font-size: 10px; color: #64748b; border-top: 1px solid #e2e8f0; text-align: center; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="header">
  <div><h1>❄ FrigoCarnes WMS</h1><p>Reporte de Inventario</p></div>
  <div style="text-align:right"><p>${fechaEx}</p><p>Total: ${stock.length} cajas</p></div>
</div>
<div class="meta">
  <div class="meta-item"><strong>${stats.total}</strong><span>En stock</span></div>
  <div class="meta-item"><strong>${stats.kgTotal} kg</strong><span>Peso total</span></div>
  <div class="meta-item"><strong>${stats.porVencer}</strong><span>Por vencer</span></div>
  <div class="meta-item"><strong>${stats.despHoy}</strong><span>Desp. hoy</span></div>
</div>
<table>
  <thead><tr>
    <th>ID Caja</th><th>Corte</th><th>Tipo</th><th>Lote</th>
    <th>Peso</th><th>Vencimiento</th><th>Proveedor</th>
    <th>Ubicación</th><th>Estado</th>
  </tr></thead>
  <tbody>
    ${stock.map(c => {
      const dias = Math.ceil((new Date(c.fecVcto)-new Date())/86400000);
      const vctoStyle = dias<0?'color:#dc2626;font-weight:bold':dias<=7?'color:#d97706;font-weight:bold':'';
      return `<tr>
        <td>${c.id}</td>
        <td>${c.nombre}</td>
        <td>${c.tipo}</td>
        <td>${c.lote}</td>
        <td>${c.pesoNeto} kg</td>
        <td style="${vctoStyle}">${c.fecVcto} (${dias<0?'VENCIDA':dias+'d'})</td>
        <td>${c.proveedor}</td>
        <td>${c.camara} ${c.rack||''} ${c.fila||''} ${c.nivel||''}</td>
        <td><span class="badge badge-${c.estado}">${c.estado}</span></td>
      </tr>`;
    }).join('')}
  </tbody>
</table>
<div class="footer">FrigoCarnes WMS — Generado el ${fechaEx} — Sistema de gestión frigorífica</div>
</body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 800);
  App.showToast('✓ Reporte PDF listo para imprimir');
}

// --- JSON Backup ---
function exportarJSON() {
  const json = DB.exportJSON();
  descargar(json, `FrigoCarnes_Backup_${hoyStr()}.json`, 'application/json');
  App.showToast('✓ Backup JSON descargado');
}

// --- Helpers ---
function descargar(contenido, nombre, tipo) {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function hoyStr() {
  return new Date().toISOString().split('T')[0];
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
