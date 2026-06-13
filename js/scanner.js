// ============================================================
//  FRIGOCARNES — Escáner IA (local, sin backend)
//  Usa la cámara del dispositivo directamente
// ============================================================

const Scanner = (() => {
  let stream = null;
  let videoEl = null;
  let canvasEl = null;

  function init(videoId, canvasId) {
    videoEl  = document.getElementById(videoId);
    canvasEl = document.getElementById(canvasId);
  }

  async function iniciar() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      if (videoEl) {
        videoEl.srcObject = stream;
        await videoEl.play();
      }
      return true;
    } catch(e) {
      console.warn('[Scanner] No se pudo acceder a cámara:', e.message);
      return false;
    }
  }

  function detener() {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  function capturar() {
    if (!videoEl || !canvasEl) return null;
    canvasEl.width  = videoEl.videoWidth  || 640;
    canvasEl.height = videoEl.videoHeight || 480;
    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0);
    return canvasEl.toDataURL('image/jpeg', 0.85);
  }

  function activo() {
    return stream && stream.active;
  }

  return { init, iniciar, detener, capturar, activo };
})();
