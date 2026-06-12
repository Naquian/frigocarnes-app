/* =============================================
   FRIGOCARNES — Generador de código de barras
   Code128B puro en Canvas, sin dependencias
   ============================================= */

const Barcode = (() => {

  // Patrones Code128B
  const PATTERNS = [
    '11011001100','11001101100','11001100110','10010011000','10010001100',
    '10001001100','10011001000','10011000100','10001100100','11001001000',
    '11001000100','11000100100','10110011100','10011011100','10011001110',
    '10111001100','10011101100','10011100110','11001110010','11001011100',
    '11001001110','11011100100','11001110100','11101101110','11101001100',
    '11100101100','11100100110','11101100100','11100110100','11100110010',
    '11011011000','11011000110','11000110110','10100011000','10001011000',
    '10001000110','10110001000','10001101000','10001100010','11010001000',
    '11000101000','11000100010','10110111000','10110001110','10001101110',
    '10111011000','10111000110','10001110110','11101110110','11010001110',
    '11000101110','11011101000','11011100010','11011101110','11101011000',
    '11101000110','11100010110','11101101000','11101100010','11100011010',
    '11101111010','11001000010','11110001010','10100110000','10100001100',
    '10010110000','10010000110','10000101100','10000100110','10110010000',
    '10110000100','10011010000','10011000010','10000110100','10000110010',
    '11000010010','11001010000','11110111010','11000010100','10001111010',
    '10100111100','10010111100','10010011110','10111100100','10011110100',
    '10011110010','11110100100','11110010100','11110010010','11011011110',
    '11011110110','11110110110','10101111000','10100011110','10001011110',
    '10111101000','10111100010','11110101000','11110100010','10111011110',
    '10111101110','11101011110','11110101110','11010000100','11010010000',
    '11010011100','11000111010'
  ];

  // Valor Code128B para cada caracter
  function charVal(c) {
    const code = c.charCodeAt(0);
    if (code >= 32 && code <= 126) return code - 32;
    return 0;
  }

  // Encodificar texto en Code128B
  function encode(text) {
    let bits = '';
    let checksum = 104; // START B

    // START B
    bits += '11010010000';

    for (let i = 0; i < text.length; i++) {
      const val = charVal(text[i]);
      checksum += (i + 1) * val;
      bits += PATTERNS[val];
    }

    // Checksum
    bits += PATTERNS[checksum % 103];

    // STOP
    bits += '1100011101011';

    return bits;
  }

  // Dibujar en canvas
  function draw(canvasEl, text, opts) {
    opts = opts || {};
    const barW    = opts.width      || 2;
    const barH    = opts.height     || 60;
    const margin  = opts.margin     !== undefined ? opts.margin : 8;
    const color   = opts.lineColor  || '#1a3a2a';
    const bg      = opts.background || '#ffffff';
    const showTxt = opts.displayValue !== false;
    const fontSize = opts.fontSize  || 12;

    const bits = encode(text);
    const totalW = bits.length * barW + margin * 2;
    const totalH = barH + margin * 2 + (showTxt ? fontSize + 6 : 0);

    canvasEl.width  = totalW;
    canvasEl.height = totalH;
    canvasEl.style.maxWidth = '100%';

    const ctx = canvasEl.getContext('2d');

    // Fondo
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, totalW, totalH);

    // Barras
    ctx.fillStyle = color;
    for (let i = 0; i < bits.length; i++) {
      if (bits[i] === '1') {
        ctx.fillRect(margin + i * barW, margin, barW, barH);
      }
    }

    // Texto
    if (showTxt) {
      ctx.fillStyle = color;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.fillText(text, totalW / 2, barH + margin + fontSize + 2);
    }
  }

  // API pública
  return {
    draw,
    // Helper: dibuja en un elemento por ID
    render(id, text, opts) {
      const el = document.getElementById(id);
      if (!el) { console.warn('[Barcode] Elemento no encontrado:', id); return; }
      if (el.tagName !== 'CANVAS') {
        const canvas = document.createElement('canvas');
        canvas.id = id + '-canvas';
        el.parentNode.insertBefore(canvas, el);
        el.style.display = 'none';
        draw(canvas, text, opts);
      } else {
        draw(el, text, opts);
      }
    }
  };
})();
