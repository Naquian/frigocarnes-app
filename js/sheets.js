// ============================================================
//  FRIGOCARNES — Integración Google Sheets
//  Archivo: js/sheets.js
//  
//  INSTRUCCIONES:
//  1. Reemplaza PEGA_AQUI_TU_URL por la URL que te dio Google
//  2. Incluye este archivo en index.html antes de app.js:
//     <script src="js/sheets.js"></script>
// ============================================================

const SHEETS_CONFIG = {
  url: "https://script.google.com/macros/s/AKfycbxO-j_u945doC3bmmGea_NB1B0Bxvl3EU_7ebCAfyYd5QTqHfn9oPowwNU9B7S5ITBUkA/exec",  // ← reemplaza esto
  version: "1.0",
  nombre: "Frigocarnes"
};

// ============================================================
//  COLA OFFLINE
//  Si no hay internet, guarda los registros localmente
//  y los sincroniza automáticamente cuando vuelve la conexión
// ============================================================

const SheetsQueue = {

  // Guardar un registro en la cola local
  agregar(datos) {
    const cola = this.obtener();
    cola.push({
      id: Date.now(),
      timestamp: new Date().toISOString(),
      datos: datos
    });
    localStorage.setItem("frigocarnes_cola", JSON.stringify(cola));
    console.log(`[Sheets] Registro guardado en cola offline. Total en cola: ${cola.length}`);
  },

  // Obtener todos los registros pendientes
  obtener() {
    try {
      return JSON.parse(localStorage.getItem("frigocarnes_cola") || "[]");
    } catch {
      return [];
    }
  },

  // Eliminar un registro de la cola una vez enviado
  eliminar(id) {
    const cola = this.obtener().filter(item => item.id !== id);
    localStorage.setItem("frigocarnes_cola", JSON.stringify(cola));
  },

  // Cantidad de registros pendientes
  cantidad() {
    return this.obtener().length;
  }
};

// ============================================================
//  FUNCIÓN PRINCIPAL — Enviar un registro a Google Sheets
// ============================================================

async function enviarASheets(datosCaja) {
  // Validar que la URL esté configurada
  if (!SHEETS_CONFIG.url || SHEETS_CONFIG.url === "PEGA_AQUI_TU_URL") {
    console.warn("[Sheets] URL no configurada. Guardando solo localmente.");
    mostrarNotificacion("⚠️ Google Sheets no configurado", "warning");
    return false;
  }

  // Si no hay internet, guardar en cola
  if (!navigator.onLine) {
    SheetsQueue.agregar(datosCaja);
    mostrarNotificacion(`📵 Sin internet — guardado para sincronizar luego (${SheetsQueue.cantidad()} pendientes)`, "warning");
    return false;
  }

  // Intentar enviar
  try {
    const payload = encodeURIComponent(JSON.stringify({
      ...datosCaja,
      _version: SHEETS_CONFIG.version,
      _sistema: SHEETS_CONFIG.nombre,
      _enviado: new Date().toISOString()
    }));
    await fetch(SHEETS_CONFIG.url + '?payload=' + payload, {
      method: "GET",
      mode: "no-cors"
    });

    mostrarNotificacion("✅ Enviado a Google Sheets", "success");
    console.log("[Sheets] Registro enviado correctamente:", datosCaja.id_caja);
    return true;

  } catch (error) {
    // Si falla el envío, guardar en cola
    SheetsQueue.agregar(datosCaja);
    mostrarNotificacion(`⚠️ Error de conexión — guardado para sincronizar luego`, "warning");
    console.error("[Sheets] Error al enviar:", error);
    return false;
  }
}

// ============================================================
//  SINCRONIZACIÓN AUTOMÁTICA
//  Cuando vuelve el internet, envía todo lo que quedó en cola
// ============================================================

async function sincronizarCola() {
  const cola = SheetsQueue.obtener();
  if (cola.length === 0) return;

  console.log(`[Sheets] Sincronizando ${cola.length} registros pendientes...`);
  mostrarNotificacion(`🔄 Sincronizando ${cola.length} registros pendientes...`, "info");

  let enviados = 0;
  let errores = 0;

  for (const item of cola) {
    try {
      const payloadSync = encodeURIComponent(JSON.stringify({
        ...item.datos,
        _version: SHEETS_CONFIG.version,
        _sistema: SHEETS_CONFIG.nombre,
        _enviado: new Date().toISOString(),
        _era_offline: true,
        _timestamp_original: item.timestamp
      }));
      await fetch(SHEETS_CONFIG.url + '?payload=' + payloadSync, {
        method: "GET",
        mode: "no-cors"
      });

      SheetsQueue.eliminar(item.id);
      enviados++;

    } catch (error) {
      errores++;
      console.error(`[Sheets] Error sincronizando registro ${item.id}:`, error);
    }
  }

  if (enviados > 0) {
    mostrarNotificacion(`✅ ${enviados} registros sincronizados con Google Sheets`, "success");
  }
  if (errores > 0) {
    mostrarNotificacion(`⚠️ ${errores} registros no se pudieron sincronizar`, "warning");
  }
}

// Escuchar cuando vuelve el internet
window.addEventListener("online", () => {
  console.log("[Sheets] Conexión restaurada. Iniciando sincronización...");
  setTimeout(sincronizarCola, 2000); // esperar 2 segundos para que la conexión se estabilice
});

// ============================================================
//  NOTIFICACIONES VISUALES
//  Muestra un toast en pantalla con el resultado
// ============================================================

function mostrarNotificacion(mensaje, tipo = "info") {
  // Si ya existe la función en app.js, usar esa
  if (typeof mostrarToast === "function") {
    mostrarToast(mensaje);
    return;
  }

  // Si no, crear un toast propio
  let toast = document.getElementById("sheets-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "sheets-toast";
    toast.style.cssText = `
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      font-family: sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 90%;
      text-align: center;
    `;
    document.body.appendChild(toast);
  }

  const colores = {
    success: { bg: "#1a472a", text: "#ffffff" },
    warning: { bg: "#b45309", text: "#ffffff" },
    error:   { bg: "#991b1b", text: "#ffffff" },
    info:    { bg: "#1e3a5f", text: "#ffffff" }
  };

  const color = colores[tipo] || colores.info;
  toast.style.backgroundColor = color.bg;
  toast.style.color = color.text;
  toast.textContent = mensaje;
  toast.style.opacity = "1";

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = "0";
  }, 3500);
}

// ============================================================
//  VERIFICAR ESTADO AL CARGAR LA PÁGINA
// ============================================================

window.addEventListener("DOMContentLoaded", () => {
  const pendientes = SheetsQueue.cantidad();

  if (pendientes > 0 && navigator.onLine) {
    console.log(`[Sheets] Hay ${pendientes} registros pendientes. Sincronizando...`);
    setTimeout(sincronizarCola, 3000);
  }

  if (pendientes > 0) {
    console.log(`[Sheets] ${pendientes} registros en cola offline.`);
  }
});

// ============================================================
//  EXPORTAR FUNCIONES
//  Úsalas desde app.js así:
//
//  // Al registrar una caja nueva:
//  await enviarASheets(datosCaja);
//
//  // Para sincronizar manualmente:
//  await sincronizarCola();
//
//  // Para ver cuántos registros están pendientes:
//  const pendientes = SheetsQueue.cantidad();
// ============================================================
