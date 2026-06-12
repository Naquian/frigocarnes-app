/* =============================================
   FRIGOCARNES WMS — Base de datos local
   Persiste en localStorage del navegador.
   ============================================= */

const DB = (() => {
  const KEY_STOCK   = 'frigocarnes_stock';
  const KEY_COUNTER = 'frigocarnes_counter';
  const KEY_USERS   = 'frigocarnes_users';
  const KEY_SESSION = 'frigocarnes_session';

  // --- Usuarios (PIN hasheado simple) ---
  const USERS = {
    'Juan Pérez':     '1234',
    'María González': '1234',
    'Carlos Rojas':   '1234',
    'Ana Silva':      '1234',
    'Admin':          '1234'
  };

  // --- Stock inicial de demo ---
  const DEMO_STOCK = [
    {
      id:'CJ-2025-00001', sku:'VAC-LOM-001', nombre:'Lomo liso vacuno',
      tipo:'Vacuno', categoria:'Corte mayor', lote:'L-2025-001',
      fecProd:'2025-01-10', fecEnv:'2025-01-10', fecVcto:'2025-06-20',
      horaProd:'06:30', pesoNeto:20.5, pesoBruto:22.0, piezas:1, unidad:'kg',
      pais:'Chile', planta:'Planta Maipú', proveedor:'Frigorífico Sur SpA',
      temp:'-18°C a -20°C', estado:'Disponible',
      camara:'CF-01', rack:'R-A', fila:'F-02', nivel:'N-1', pallet:'PAL-001',
      cliente:'', oc:'',
      fecIngreso:'2025-01-10', horaIngreso:'09:15', fecSalida:'', horaSalida:'',
      operarioIngreso:'Juan Pérez', operarioDespacho:'',
      codigoBarras:'7802345678901', inspeccion:'Aprobado',
      cert:'SEREMI N°456, PABCO', obs:'',
      movimientos:['2025-01-10 09:15 — Ingreso por Juan Pérez','2025-01-10 09:16 — Ubicado CF-01 R-A F-02 N-1']
    },
    {
      id:'CJ-2025-00002', sku:'CER-PAL-002', nombre:'Paleta cerdo deshuesada',
      tipo:'Cerdo', categoria:'Corte mayor', lote:'L-2025-002',
      fecProd:'2025-01-08', fecEnv:'2025-01-08', fecVcto:'2025-06-15',
      horaProd:'08:00', pesoNeto:18.0, pesoBruto:19.5, piezas:1, unidad:'kg',
      pais:'Chile', planta:'Planta Lampa', proveedor:'CarnesCL Ltda.',
      temp:'0°C a 4°C', estado:'Reservado',
      camara:'CF-02', rack:'R-B', fila:'F-05', nivel:'N-2', pallet:'PAL-002',
      cliente:'Supermercado Metro', oc:'OC-9981',
      fecIngreso:'2025-01-09', horaIngreso:'14:30', fecSalida:'', horaSalida:'',
      operarioIngreso:'María González', operarioDespacho:'',
      codigoBarras:'7801234567890', inspeccion:'Aprobado',
      cert:'PABCO, SEREMI N°123', obs:'',
      movimientos:['2025-01-09 14:30 — Ingreso por María González','2025-01-10 10:00 — Reservado para OC-9981']
    },
    {
      id:'CJ-2025-00003', sku:'POL-PEC-003', nombre:'Pechuga pollo sin hueso',
      tipo:'Pollo', categoria:'Congelado', lote:'L-2025-003',
      fecProd:'2025-01-05', fecEnv:'2025-01-05', fecVcto:'2025-07-05',
      horaProd:'05:30', pesoNeto:10.0, pesoBruto:10.8, piezas:8, unidad:'kg',
      pais:'Chile', planta:'Agrosuper Rosario', proveedor:'Agrosuper S.A.',
      temp:'-18°C a -20°C', estado:'Disponible',
      camara:'CF-01', rack:'R-D', fila:'F-04', nivel:'N-1', pallet:'PAL-003',
      cliente:'', oc:'',
      fecIngreso:'2025-01-06', horaIngreso:'08:00', fecSalida:'', horaSalida:'',
      operarioIngreso:'Ana Silva', operarioDespacho:'',
      codigoBarras:'7804567891230', inspeccion:'Aprobado',
      cert:'ISO 22000', obs:'',
      movimientos:['2025-01-06 08:00 — Ingreso por Ana Silva']
    },
    {
      id:'CJ-2025-00004', sku:'VAC-ENT-004', nombre:'Entraña vacuno',
      tipo:'Vacuno', categoria:'Corte mayor', lote:'L-2025-004',
      fecProd:'2025-01-03', fecEnv:'2025-01-03', fecVcto:'2025-06-12',
      horaProd:'06:00', pesoNeto:12.8, pesoBruto:14.0, piezas:1, unidad:'kg',
      pais:'Uruguay', planta:'Marfrig Tacuarembó', proveedor:'Importadora Sur',
      temp:'-1°C a 1°C', estado:'Cuarentena',
      camara:'CF-04', rack:'R-E', fila:'F-01', nivel:'N-1', pallet:'PAL-004',
      cliente:'', oc:'',
      fecIngreso:'2025-01-04', horaIngreso:'16:00', fecSalida:'', horaSalida:'',
      operarioIngreso:'Juan Pérez', operarioDespacho:'',
      codigoBarras:'7807654321098', inspeccion:'Pendiente',
      cert:'Pendiente SEREMI', obs:'Temperatura de cadena de frío con leve desviación',
      movimientos:['2025-01-04 16:00 — Ingreso por Juan Pérez','2025-01-05 09:00 — Enviado a cuarentena por inspección']
    },
    {
      id:'CJ-2025-00005', sku:'COR-PIE-005', nombre:'Pierna cordero',
      tipo:'Cordero', categoria:'Corte mayor', lote:'L-2025-005',
      fecProd:'2025-01-07', fecEnv:'2025-01-07', fecVcto:'2025-06-14',
      horaProd:'07:00', pesoNeto:8.5, pesoBruto:9.2, piezas:2, unidad:'kg',
      pais:'Nueva Zelanda', planta:'Silver Fern Farms', proveedor:'Importadora Ovinos',
      temp:'-18°C a -20°C', estado:'Disponible',
      camara:'CF-01', rack:'R-C', fila:'F-03', nivel:'N-2', pallet:'PAL-005',
      cliente:'', oc:'',
      fecIngreso:'2025-01-08', horaIngreso:'11:00', fecSalida:'', horaSalida:'',
      operarioIngreso:'Carlos Rojas', operarioDespacho:'',
      codigoBarras:'7809991112223', inspeccion:'Aprobado',
      cert:'Halal, ISO 22000', obs:'',
      movimientos:['2025-01-08 11:00 — Ingreso por Carlos Rojas']
    }
  ];

  // --- API pública ---
  return {
    // Auth
    login(usuario, pin) {
      if (USERS[usuario] && USERS[usuario] === pin) {
        sessionStorage.setItem(KEY_SESSION, JSON.stringify({ usuario, ts: Date.now() }));
        return true;
      }
      return false;
    },
    logout() { sessionStorage.removeItem(KEY_SESSION); },
    getSession() {
      try { return JSON.parse(sessionStorage.getItem(KEY_SESSION)); }
      catch { return null; }
    },

    // Stock CRUD
    getStock() {
      try {
        const raw = localStorage.getItem(KEY_STOCK);
        if (!raw) {
          // Primera vez: cargar demo
          localStorage.setItem(KEY_STOCK, JSON.stringify(DEMO_STOCK));
          localStorage.setItem(KEY_COUNTER, '5');
          return [...DEMO_STOCK];
        }
        return JSON.parse(raw);
      } catch { return []; }
    },

    saveStock(stock) {
      localStorage.setItem(KEY_STOCK, JSON.stringify(stock));
    },

    getNextId() {
      const n = parseInt(localStorage.getItem(KEY_COUNTER) || '0') + 1;
      localStorage.setItem(KEY_COUNTER, String(n));
      return `CJ-2025-${String(n).padStart(5,'0')}`;
    },

    addCaja(caja) {
      const stock = this.getStock();
      stock.unshift(caja);
      this.saveStock(stock);
      return stock;
    },

    updateCaja(id, changes) {
      const stock = this.getStock();
      const idx = stock.findIndex(c => c.id === id);
      if (idx === -1) return null;
      stock[idx] = { ...stock[idx], ...changes };
      this.saveStock(stock);
      return stock[idx];
    },

    deleteCaja(id) {
      const stock = this.getStock().filter(c => c.id !== id);
      this.saveStock(stock);
    },

    addMovimiento(id, evento) {
      const stock = this.getStock();
      const idx = stock.findIndex(c => c.id === id);
      if (idx === -1) return;
      const ts = new Date().toLocaleString('es-CL', { dateStyle:'short', timeStyle:'short' });
      stock[idx].movimientos = [...(stock[idx].movimientos || []), `${ts} — ${evento}`];
      this.saveStock(stock);
    },

    // Backup/Restore
    exportJSON() {
      return JSON.stringify({
        version: '1.0',
        exportDate: new Date().toISOString(),
        sistema: 'FrigoCarnes WMS',
        stock: this.getStock()
      }, null, 2);
    },

    importJSON(json) {
      try {
        const data = JSON.parse(json);
        const stock = data.stock || data;
        if (!Array.isArray(stock)) throw new Error('Formato inválido');
        this.saveStock(stock);
        localStorage.setItem(KEY_COUNTER, String(stock.length));
        return { ok: true, count: stock.length };
      } catch (e) {
        return { ok: false, error: e.message };
      }
    },

    // Stats
    getStats() {
      const stock = this.getStock();
      const hoy = new Date().toISOString().split('T')[0];
      return {
        total: stock.filter(c => c.estado === 'Disponible' || c.estado === 'Reservado').length,
        kgTotal: stock.filter(c => c.estado !== 'Despachado').reduce((s,c) => s + (c.pesoNeto||0), 0).toFixed(1),
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
  };
})();
