# FrigoCarnes WMS — Guía completa de instalación y puesta en marcha

---

## ¿Qué hay en este sistema?

| Archivo | Descripción |
|---|---|
| `index.html` | App principal (todo el HTML) |
| `css/main.css` | Estilos visuales |
| `js/db.js` | Base de datos local (localStorage) |
| `js/scanner.js` | Cámara + lector IA de etiquetas |
| `js/app.js` | Lógica principal del sistema |
| `js/export.js` | Exportación Excel / CSV / PDF / JSON |
| `manifest.json` | Configuración para instalar como app |
| `icon-192.svg` | Ícono de la app |

---

## OPCIÓN A — Subir a Netlify (recomendado, gratis)

**Tiempo estimado: 5 minutos**

### Paso 1 — Crear cuenta en Netlify
1. Ve a [https://netlify.com](https://netlify.com)
2. Haz clic en **"Sign up"**
3. Regístrate con tu correo Gmail (o cualquier correo)
4. Confirma tu correo cuando llegue el email

### Paso 2 — Preparar la carpeta
Asegúrate que la carpeta `frigocarnes` tenga esta estructura exacta:
```
frigocarnes/
├── index.html
├── manifest.json
├── icon-192.svg
├── icon-512.svg
├── css/
│   └── main.css
└── js/
    ├── db.js
    ├── scanner.js
    ├── app.js
    └── export.js
```

### Paso 3 — Subir a Netlify
1. En Netlify, haz clic en **"Add new site"** → **"Deploy manually"**
2. Arrastra toda la carpeta `frigocarnes` al recuadro que dice **"Drag and drop"**
3. Espera 10-20 segundos
4. Netlify te da una URL tipo: `https://amazing-name-123.netlify.app`

### Paso 4 — Personalizar la URL (opcional pero recomendado)
1. En Netlify, ve a **Site configuration** → **Site details**
2. Haz clic en **"Change site name"**
3. Escribe algo como `frigocarnes-wms`
4. Tu URL queda: `https://frigocarnes-wms.netlify.app`

### Paso 5 — Compartir con tu equipo
1. Copia la URL que Netlify te dio
2. Mándala por WhatsApp a los operarios
3. Listo — cualquiera que la abra desde su celular tiene acceso al sistema

### Actualizar el sistema en el futuro
Cuando hagas cambios en los archivos:
1. Ve a Netlify → tu sitio → **Deploys**
2. Arrastra la carpeta actualizada al recuadro
3. El sistema se actualiza en segundos para todos

---

## OPCIÓN B — Subir a GitHub Pages (también gratis)

**Tiempo estimado: 10 minutos**

### Paso 1 — Crear cuenta en GitHub
1. Ve a [https://github.com](https://github.com)
2. Haz clic en **"Sign up"**
3. Crea tu cuenta con correo y contraseña

### Paso 2 — Crear repositorio
1. Haz clic en el botón **"+"** (arriba a la derecha) → **"New repository"**
2. Nombre del repositorio: `frigocarnes-wms`
3. Marca la opción **"Public"**
4. Haz clic en **"Create repository"**

### Paso 3 — Subir los archivos
1. En la página del repositorio, haz clic en **"uploading an existing file"**
2. Arrastra todos los archivos de la carpeta `frigocarnes` (incluyendo subcarpetas)
3. Al final escribe en el campo de commit: `Primer deploy FrigoCarnes WMS`
4. Haz clic en **"Commit changes"**

### Paso 4 — Activar GitHub Pages
1. Ve a **Settings** (pestaña del repositorio)
2. En el menú izquierdo, haz clic en **"Pages"**
3. En **"Source"**, selecciona **"Deploy from a branch"**
4. En **"Branch"**, selecciona **"main"** y **"/ (root)"**
5. Haz clic en **"Save"**
6. Espera 2-3 minutos

### Paso 5 — Obtener tu URL
- Tu URL quedará así: `https://TU_USUARIO.github.io/frigocarnes-wms/`
- Reemplaza `TU_USUARIO` por tu nombre de usuario de GitHub

---

## OPCIÓN C — Usar en PC sin internet (archivo local)

**Para usar en una PC de escritorio en la bodega, sin necesidad de subir a internet.**

### Paso 1 — Descargar los archivos
- Descarga la carpeta `frigocarnes` completa en tu PC
- Puedes guardarla en el escritorio o en Documentos

### Paso 2 — Abrir el sistema
1. Abre la carpeta `frigocarnes`
2. Haz doble clic en `index.html`
3. Se abre en tu navegador (Chrome o Edge recomendado)

### Paso 3 — Crear acceso directo (opcional)
1. Haz clic derecho en `index.html`
2. Selecciona **"Crear acceso directo"**
3. Mueve el acceso directo al escritorio
4. Cámbiale el nombre a "FrigoCarnes WMS"

### Limitación importante en PC local
- Los datos se guardan en el navegador de ESA PC
- Si abres en otro PC, los datos son distintos
- Para compartir datos entre PCs, usa la función **"Exportar backup JSON"** y **"Importar backup JSON"**

---

## Instalar como app en el celular (PWA)

**Convierte el sistema en una app con ícono en la pantalla de inicio.**

### En Android (Chrome)
1. Abre la URL del sistema en Chrome
2. Toca el menú (3 puntos arriba a la derecha)
3. Toca **"Agregar a pantalla de inicio"**
4. Confirma con **"Agregar"**
5. El ícono de FrigoCarnes aparece en tu pantalla

### En iPhone (Safari)
1. Abre la URL en Safari (importante: debe ser Safari, no Chrome)
2. Toca el botón de compartir (cuadrado con flecha)
3. Baja y toca **"Agregar a pantalla de inicio"**
4. Toca **"Agregar"**
5. El ícono aparece en tu pantalla de inicio

---

## Primeros pasos en el sistema

### 1. Iniciar sesión
- Usuario: cualquiera del listado
- PIN: **1234** (PIN de demo para todos)
- Para cambiar el PIN, edita el archivo `js/db.js` línea donde dice `'1234'`

### 2. El sistema carga con 5 cajas de ejemplo
- Puedes borrarlas o usarlas para practicar
- Ve a Stock → toca una caja → toca el ícono 🗑 para eliminar

### 3. Ingresar tu primera caja real
1. Toca **"Ingresar"** en el menú
2. Toca **"Probar con etiqueta de ejemplo"** para ver cómo funciona el escáner IA
3. O toca **"Abrir cámara"** para fotografiar una etiqueta real
4. Revisa los campos, completa los que falten
5. Toca **"Registrar caja en stock"**

### 4. Ver el stock
- Ve a **Stock** para ver todas las cajas
- Usa la barra de búsqueda para encontrar por ID, SKU, lote, proveedor
- Toca cualquier caja para ver todos sus detalles y trazabilidad

### 5. Hacer una exportación de respaldo (¡hazlo regularmente!)
- Ve a **Reportes**
- Toca **"Backup JSON"** — guarda una copia de todos tus datos
- **MUY IMPORTANTE:** en PC local, si borras el historial del navegador, pierdes los datos. Haz backup frecuente.

---

## Cómo funciona el escáner con IA

El sistema usa **Claude Vision** (IA de Anthropic) para leer etiquetas automáticamente.

### Requisito
Necesita conexión a internet para enviar la foto a la IA y recibir los datos.

### Cómo usarlo
1. Ve a **Ingresar**
2. Toca **"Abrir cámara"**
3. Enfoca la etiqueta de la caja — mantén el celular firme a unos 20-30cm
4. Toca **"Capturar etiqueta"**
5. La IA lee el texto y rellena los campos en 2-3 segundos
6. Revisa los datos y corrige si es necesario
7. Toca **"Registrar caja en stock"**

### Consejos para mejores resultados
- Asegúrate de que la etiqueta esté bien iluminada
- Evita reflejos o sombras sobre la etiqueta
- La etiqueta debe estar completamente dentro del encuadre
- Si la foto sale borrosa, usa **"Subir foto"** para cargar una imagen de la galería

---

## Exportar datos a Excel

1. Ve a **Reportes**
2. Toca **"Exportar a Excel"**
3. Se descarga automáticamente un archivo `.xlsx`
4. Ábrelo en Excel, Google Sheets o LibreOffice Calc
5. El archivo tiene dos hojas: **Stock completo** y **Resumen**

---

## Preguntas frecuentes

**¿Los datos se pierden si cierro el navegador?**
No. Los datos se guardan automáticamente en el navegador con localStorage. Permanecen aunque cierres la ventana o apagues el PC.

**¿Se pierden si borro el historial del navegador?**
Sí. Por eso es importante hacer backup JSON regularmente desde Reportes.

**¿Pueden usar el sistema varios celulares al mismo tiempo?**
Si usas Netlify o GitHub Pages, cada celular tiene sus propios datos locales. Para compartir datos en tiempo real entre dispositivos, se necesita conectar Google Sheets (próxima versión).

**¿Funciona sin internet?**
El sistema funciona sin internet excepto por el escáner con IA. La función "Subir foto" + IA requiere conexión.

**¿Cómo cambio los operarios disponibles?**
Edita `js/db.js` en la sección `USERS` y agrega o quita nombres.

**¿Cómo agrego más cámaras de frío?**
En `index.html`, busca los `<select id="f-camara">` y agrega las opciones que necesites.

---

## Soporte técnico

Si algo no funciona, verifica:
1. Estás usando Chrome, Edge o Safari (no Internet Explorer)
2. La carpeta tiene todos los archivos (index.html, css/, js/)
3. Para el escáner IA, tienes conexión a internet

---

*FrigoCarnes WMS v1.0 — Sistema de gestión de stock frigorífico*
