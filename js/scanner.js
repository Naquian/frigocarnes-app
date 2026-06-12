// ============================================================
//  FRIGOCARNES — Escáner Remoto
//  Canal único compartido — sin problemas de usuario
// ============================================================

const express = require('express');
const router  = express.Router();

// Una sola foto pendiente para toda la empresa
let fotoPendiente = null;

// POST /api/scanner/foto — celular sube foto
router.post('/foto', (req, res) => {
  try {
    const { imagenBase64, mediaType, usuario } = req.body;
    if (!imagenBase64) return res.status(400).json({ error: 'Imagen requerida' });

    fotoPendiente = {
      imagenBase64,
      mediaType: mediaType || 'image/jpeg',
      usuario:   usuario || 'desconocido',
      timestamp: Date.now(),
      procesada: false
    };

    console.log(`[Scanner] Foto recibida de: ${usuario}`);
    res.json({ ok: true, timestamp: fotoPendiente.timestamp });

  } catch(err) {
    console.error('[Scanner] Error:', err.message);
    res.status(500).json({ error: 'Error guardando foto' });
  }
});

// GET /api/scanner/pendiente/:usuario — notebook consulta (usuario ignorado)
router.get('/pendiente/:usuario', (req, res) => {
  if (!fotoPendiente || fotoPendiente.procesada) {
    return res.json({ ok: true, hay_foto: false });
  }

  res.json({
    ok:            true,
    hay_foto:      true,
    imagenBase64:  fotoPendiente.imagenBase64,
    mediaType:     fotoPendiente.mediaType,
    usuario:       fotoPendiente.usuario,
    timestamp:     fotoPendiente.timestamp
  });
});

// DELETE /api/scanner/pendiente/:usuario — marcar como procesada
router.delete('/pendiente/:usuario', (req, res) => {
  if (fotoPendiente) fotoPendiente.procesada = true;
  res.json({ ok: true });
});

// GET /api/scanner/estado
router.get('/estado', (req, res) => {
  res.json({ ok: true, activo: true, hay_foto: fotoPendiente && !fotoPendiente.procesada });
});

module.exports = router;
