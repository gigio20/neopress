// Neopress — vista del diario (corte 1).
// Lee el markdown del día (../diarios/<fecha>.md) y lo renderiza: header, panorama,
// secciones con citas y carrusel de titulares.
(() => {
  const params = new URLSearchParams(location.search);
  const FECHA_INICIAL = params.get('fecha') || hoyISO();
  const contenedor = document.getElementById('diario');

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function fechaLarga(iso) {
    const d = new Date(iso + 'T12:00:00');
    if (isNaN(d)) return iso;
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return dias[d.getDay()] + ' ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function esc(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  }

  // Cada item del carrusel: "[Titular] — [Medio](link)" o "[Titular](link)".
  function parseTarjeta(s) {
    const full = s.match(/^(.*?)\s*—\s*\[([^\]]+)\]\(([^)]+)\)$/);
    if (full) {
      const titulo = full[1].trim().replace(/^\[|\]$/g, '');
      return { titulo, medio: full[2], url: full[3] };
    }
    const single = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (single) return { titulo: single[1], medio: '', url: single[2] };
    return { titulo: s.replace(/^\[|\]$/g, ''), medio: '', url: '' };
  }

  function render(md) {
    let fecha = FECHA_INICIAL;
    const fm = md.match(/^---\s*\nfecha:\s*([\d-]+)/);
    if (fm) fecha = fm[1];
    md = md.replace(/^---[\s\S]*?---\s*/, '');

    const html = [];
    let carruselOpen = false;
    let enPanorama = false;
    const cerrar = () => { if (carruselOpen) { html.push('</div>'); carruselOpen = false; } };

    html.push('<header class="header"><div class="marca">Neopress</div><div class="fecha">' + fechaLarga(fecha) + '</div></header>');

    for (const raw of md.split('\n')) {
      const line = raw.trim();
      if (!line) { cerrar(); continue; }

      if (line.startsWith('# ')) {
        cerrar();
      } else if (line.startsWith('## ')) {
        cerrar();
        const t = line.slice(3).trim();
        if (t.toLowerCase() === 'panorama') { enPanorama = true; }
        else { enPanorama = false; html.push('<h2 class="seccion">' + inline(t) + '</h2>'); }
      } else if (line.startsWith('### ')) {
        cerrar(); html.push('<h3>' + inline(line.slice(4)) + '</h3>');
      } else if (line.startsWith('> ')) {
        cerrar(); html.push('<blockquote class="cita">' + inline(line.slice(2)) + '</blockquote>');
      } else if (line.startsWith('- ')) {
        if (!carruselOpen) { html.push('<div class="carrusel">'); carruselOpen = true; }
        const t = parseTarjeta(line.slice(2));
        if (t.url) {
          html.push('<a class="tarjeta" href="' + esc(t.url) + '" target="_blank" rel="noopener"><span class="tarjeta-titulo">' + esc(t.titulo) + '</span>' + (t.medio ? '<span class="tarjeta-medio">' + esc(t.medio) + '</span>' : '') + '</a>');
        } else {
          html.push('<div class="tarjeta"><span class="tarjeta-titulo">' + esc(t.titulo) + '</span></div>');
        }
      } else {
        cerrar();
        html.push('<p class="' + (enPanorama ? 'panorama' : 'parrafo') + '">' + inline(line) + '</p>');
      }
    }
    cerrar();
    return html.join('\n');
  }

  async function cargar() {
    try {
      const resp = await fetch('../diarios/' + FECHA_INICIAL + '.md');
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      contenedor.innerHTML = render(await resp.text());
    } catch (e) {
      contenedor.innerHTML =
        '<div class="error"><p>No se pudo cargar el diario del ' + fechaLarga(FECHA_INICIAL) + '.</p>' +
        '<p class="detalle">' + esc(String(e.message)) + '</p></div>';
    }
  }

  cargar();
})();
