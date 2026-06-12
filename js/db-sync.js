/* =============================================
   FRIGOCARNES — DB Sincronizada con Backend
   Solo sobreescribe métodos de datos, no navegación
   ============================================= */

const DBSync = (() => {
  const KEY_STOCK   = 'frigocarnes_stock';
  const KEY_COUNTER = 'frigocarnes_counter';
  const KEY_SESSION = 'frigocarnes_session';

  let _stockCache = null;
  let _inicializado = false;

  // ── Cache local ───────────────────────────────────────
  function getStockLocal() {
    try {
      const raw = localStorage.getItem(KEY_STOCK);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  function saveStockLocal(stock) {
    if (!Array.isArray(stock)) return;
    localStorage.setItem(KEY_STOCK, JSON.stringify(stock));
    _stockCache = stock;
  }

  // ── getStock síncrono (para compatibilidad) ───────────
  function getStockSync() {
    if (_stockCache && Array.isArray(_stockCache)) return [..._stockCache];
    const local = getStockLocal();
    _stockCache = local;
    return [...local];
  }

  // ── Inicializar — cargar desde backend ────────────────
  async function inicializar() {
    if (_inicializado) return getStockSync();
    mostrarEstadoConexion(true);

    const remoto = await SupaDB.getStock();
    if (remoto !== null && Array.isArray(remoto)) {
      saveStockLocal(remoto);
      mostrarEstadoConexion(true);
      _inicializado = true;
      return [...remoto];
    } else {
      mostrarEstadoConexion(false);
      const local = getStockLocal();
      _stockCache = local;
      return [...local];
    }
  }

  async function refrescar() {
    _inicializado = false;
    _stockCache = null;
    return await inicializar();
  }

  // ── CRUD sincronizado ─────────────────────────────────
  async function addCaja(caja) {
    const stock = getStockSync();
    stock.unshift(caja);
    saveStockLocal(stock);
    await SupaDB.addCaja(caja);
    return stock;
  }

  async function updateCaja(id, changes) {
    const stock = getStockSync();
    const idx = stock.findIndex(c => c.id === id);
    if (idx === -1) return null;
    stock[idx] = { ...stock[idx], ...changes };
    saveStockLocal(stock);
    await SupaDB.updateCaja(id, stock[idx]);
    return stock[idx];
  }

  async function deleteCaja(id) {
    const stock = getStockSync().filter(c => c.id !== id);
    saveStockLocal(stock);
    await SupaDB.deleteCaja(id);
  }

  function addMovimiento(id, evento) {
    const stock = getStockSync();
    const idx = stock.findIndex(c => c.id === id);
    if (idx === -1) return;
    const ts = new Date().toLocaleString('es-CL', { dateStyle:'short', timeStyle:'short' });
    stock[idx].movimientos = [...(stock[idx].movimientos || []), `${ts} — ${evento}`];
    saveStockLocal(stock);
    SupaDB.updateCaja(id, stock[idx]);
  }

  function getNextId() {
    const n = parseInt(localStorage.getItem(KEY_COUNTER) || '0') + 1;
    localStorage.setItem(KEY_COUNTER, String(n));
    return `CJ-${new Date().getFullYear()}-${String(n).padStart(5,'0')}`;
  }

  function exportJSON() {
    return JSON.stringify({
      version: '1.0',
      exportDate: new Date().toISOString(),
      sistema: 'FrigoCarnes WMS',
      stock: getStockSync()
    }, null, 2);
  }

  async function importJSON(json) {
    try {
      const data = JSON.parse(json);
      const stock = data.stock || data;
      if (!Array.isArray(stock)) throw new Error('Formato inválido');
      saveStockLocal(stock);
      localStorage.setItem(KEY_COUNTER, String(stock.length));
      App.showToast('⟳ Subiendo datos al servidor...');
      await SupaDB.sincronizarDesdeLocal(stock);
      App.showToast('✓ ' + stock.length + ' cajas importadas');
      return { ok: true, count: stock.length };
    } catch(e) {
      return { ok: false, error: e.message };
    }
  }

  function getStats() {
    const stock = getStockSync();
    const hoy = new Date().toISOString().split('T')[0];
    return {
      total: stock.filter(c => c.estado === 'Disponible' || c.estado === 'Reservado').length,
      kgTotal: stock.filter(c => c.estado !== 'Despachado').reduce((s,c) => s+(c.pesoNeto||0), 0).toFixed(1),
      porVencer: stock.filter(c => {
        if (c.estado === 'Despachado') return false;
        const dias = Math.ceil((new Date(c.fecVcto) - new Date()) / 86400000);
        return dias >= 0 && dias <= 7;
      }).length,
      despHoy: stock.filter(c => c.fecSalida === hoy).length,
      porCamara: ['CF-01','CF-02','CF-03','CF-04'].map(cam => ({
        camara: cam,
        count: stock.filter(c => c.camara === cam && c.estado !== 'Despachado').length,
        kg: stock.filter(c => c.camara === cam && c.estado !== 'Despachado').reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1)
      })),
      porTipo: [...new Set(stock.map(c => c.tipo))].filter(Boolean).map(tipo => ({
        tipo,
        count: stock.filter(c => c.tipo === tipo && c.estado !== 'Despachado').length,
        kg: stock.filter(c => c.tipo === tipo && c.estado !== 'Despachado').reduce((s,c)=>s+(c.pesoNeto||0),0).toFixed(1)
      }))
    };
  }

  window.addEventListener('online', async () => {
    mostrarEstadoConexion(true);
    _inicializado = false;
    await inicializar();
  });
  window.addEventListener('offline', () => mostrarEstadoConexion(false));

  return { getStockSync, addCaja, updateCaja, deleteCaja, addMovimiento,
           getNextId, exportJSON, importJSON, getStats, inicializar, refrescar,
           saveStock: saveStockLocal };
})();

// Sobreescribir SOLO métodos de datos en DB — NO tocar navegación
window.addEventListener('DOMContentLoaded', () => {
  // Sobreescribir solo lo necesario
  DB.getStock    = DBSync.getStockSync.bind(DBSync);
  DB.addCaja     = DBSync.addCaja.bind(DBSync);
  DB.updateCaja  = DBSync.updateCaja.bind(DBSync);
  DB.deleteCaja  = DBSync.deleteCaja.bind(DBSync);
  DB.addMovimiento = DBSync.addMovimiento.bind(DBSync);
  DB.getNextId   = DBSync.getNextId.bind(DBSync);
  DB.exportJSON  = DBSync.exportJSON.bind(DBSync);
  DB.importJSON  = DBSync.importJSON.bind(DBSync);
  DB.getStats    = DBSync.getStats.bind(DBSync);
  DB.saveStock   = DBSync.saveStock.bind(DBSync);
  console.log('[DBSync] Métodos de datos sincronizados');
});
