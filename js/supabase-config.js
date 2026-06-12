// ============================================================
//  FRIGOCARNES — Conexión al Backend seguro (Railway)
//  La app habla con el backend, nunca directo a Supabase
// ============================================================

const BACKEND_URL = "https://frigocarnes-backend-production.up.railway.app";

const SupaDB = {

  // Token JWT del usuario logueado
  getToken() {
    return localStorage.getItem('frigocarnes_jwt') || '';
  },

  saveToken(token) {
    localStorage.setItem('frigocarnes_jwt', token);
  },

  clearToken() {
    localStorage.removeItem('frigocarnes_jwt');
  },

  // Headers con autenticación
  headers() {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer " + this.getToken()
    };
  },

  // ── Auth ────────────────────────────────────────────────
  async login(usuario, pin) {
    try {
      const res = await fetch(BACKEND_URL + "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, pin })
      });
      const data = await res.json();
      if (data.ok && data.token) {
        this.saveToken(data.token);
        return { ok: true, usuario: data.usuario };
      }
      return { ok: false, error: data.error };
    } catch(e) {
      return { ok: false, error: "Sin conexión con el servidor" };
    }
  },

  async logout() {
    this.clearToken();
    return { ok: true };
  },

  // ── Stock ───────────────────────────────────────────────
  async getStock() {
    try {
      const res = await fetch(BACKEND_URL + "/api/stock", {
        headers: this.headers()
      });
      if (res.status === 401) { this.clearToken(); return null; }
      if (!res.ok) throw new Error("Error " + res.status);
      const data = await res.json();
      return data.cajas || [];
    } catch(e) {
      console.warn("[Backend] Error getStock:", e.message);
      return null;
    }
  },

  async addCaja(caja) {
    try {
      const res = await fetch(BACKEND_URL + "/api/stock", {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify(caja)
      });
      return res.ok;
    } catch(e) {
      return false;
    }
  },

  async updateCaja(id, caja) {
    try {
      const res = await fetch(BACKEND_URL + "/api/stock/" + encodeURIComponent(id), {
        method: "PATCH",
        headers: this.headers(),
        body: JSON.stringify(caja)
      });
      return res.ok;
    } catch(e) {
      return false;
    }
  },

  async deleteCaja(id) {
    try {
      const res = await fetch(BACKEND_URL + "/api/stock/" + encodeURIComponent(id), {
        method: "DELETE",
        headers: this.headers()
      });
      return res.ok;
    } catch(e) {
      return false;
    }
  },

  async sincronizarDesdeLocal(stockLocal) {
    try {
      for (const caja of stockLocal) {
        await this.addCaja(caja);
      }
      return true;
    } catch(e) {
      return false;
    }
  },

  async ping() {
    try {
      const res = await fetch(BACKEND_URL);
      return res.ok;
    } catch(e) {
      return false;
    }
  }
};

function mostrarEstadoConexion(online) {
  let indicator = document.getElementById('conexion-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'conexion-indicator';
    indicator.style.cssText = `
      position: fixed; top: 8px; right: 8px; z-index: 9999;
      padding: 3px 10px; border-radius: 20px; font-size: 11px;
      font-weight: 700; transition: all 0.3s ease;
    `;
    document.body.appendChild(indicator);
  }
  if (online) {
    indicator.textContent = '● En línea';
    indicator.style.background = '#d8f3dc';
    indicator.style.color = '#1a3a2a';
  } else {
    indicator.textContent = '● Sin conexión';
    indicator.style.background = '#ffe0e0';
    indicator.style.color = '#7a0a0a';
  }
}
