// Neopress — vista del diario + leer más tarde.
(() => {
  const params = new URLSearchParams(location.search);
  const FECHA = params.get("fecha") || hoyISO();
  const VISTA = params.get("vista") || "diario";
  const contenedor = document.getElementById("diario");
  let EXTRA = {};
  let CLIMA = null;
  let GUARDADOS = [];
  const SVG_VACIO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';
  const SVG_LLENO = '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z"/></svg>';

  function hoyISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
  }
  function fechaLarga(iso) {
    const d = new Date(iso + "T12:00:00");
    if (isNaN(d)) return iso;
    const dias = ["domingo","lunes","martes","miércoles","jueves","viernes","sábado"];
    const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
    return dias[d.getDay()] + " " + d.getDate() + " de " + meses[d.getMonth()] + " de " + d.getFullYear();
  }
  function fechaCorta(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.getDate() + "/" + (d.getMonth()+1);
  }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
  function inline(s) {
    return esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener\">$1</a>");
  }
  function parseTarjeta(s) {
    const um = s.match(/\((https?:\/\/[^)]+)\)/);
    const url = um ? um[1] : "";
    let texto = s;
    if (um) texto = (s.slice(0, um.index) + " " + s.slice(um.index + um[0].length)).trim();
    let titulo = texto, medio = "";
    const sep = texto.indexOf("—");
    if (sep >= 0) { titulo = texto.slice(0, sep).trim(); medio = texto.slice(sep + 1).trim(); }
    titulo = titulo.replace(/^\[|\]$/g, "").trim();
    medio = medio.replace(/^\[|\]$/g, "").trim();
    return { titulo, medio, url };
  }

  function climaDesc(code) {
    if (code === 0) return "Despejado";
    if (code <= 3) return "Parcialmente nublado";
    if (code === 45 || code === 48) return "Niebla";
    if (code >= 51 && code <= 67) return "Lluvia";
    if (code >= 71 && code <= 77) return "Nieve";
    if (code >= 80 && code <= 82) return "Chubascos";
    if (code >= 95) return "Tormenta";
    return "—";
  }
  function climaIcono(code) {
    const s = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
    const sol = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
    const solNube = '<circle cx="8" cy="8" r="2.5"/><path d="M8 2.5v1M2.5 8h1M4 4l.8.8"/><path d="M10 19h8a3.5 3.5 0 0 0 .5-6.97A5 5 0 0 0 9 10.5 3.8 3.8 0 0 0 10 19z"/>';
    const nube = '<path d="M6 18.5h11a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.8 9.1 4.3 4.3 0 0 0 6 18.5z"/>';
    const niebla = '<path d="M4 10h16M6 14h12M8 18h8"/>';
    const lluvia = '<path d="M6 14h11a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.8 4.6 4.3 4.3 0 0 0 6 14z"/><path d="M8 17.5v2M12 18v2.5M16 17.5v2"/>';
    const nieve = '<path d="M6 14h11a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.8 4.6 4.3 4.3 0 0 0 6 14z"/><path d="M8 18h.01M12 19h.01M16 18h.01"/>';
    const tormenta = '<path d="M6 13h11a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 6.8 3.6 4.3 4.3 0 0 0 6 13z"/><path d="M12.5 13l-2.5 4h3l-2 4"/>';
    let g = nube;
    if (code === 0 || code === 1) g = sol;
    else if (code === 2) g = solNube;
    else if (code === 45 || code === 48) g = niebla;
    else if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) g = lluvia;
    else if ((code >= 71 && code <= 77) || code === 85 || code === 86) g = nieve;
    else if (code >= 95) g = tormenta;
    return s + g + "</svg>";
  }
  function climaHTML() {
    if (!CLIMA) return "";
    let h = "<div class=\"clima\"><span class=\"clima-temp\">" + CLIMA.temp + "°</span>" +
      "<span class=\"clima-desc\">" + climaDesc(CLIMA.code) + "</span>" +
      "<span class=\"clima-minmax\">" + CLIMA.min + "° / " + CLIMA.max + "°</span>";
    if (CLIMA.horas && CLIMA.horas.length) {
      h += "<span class=\"clima-sep\"></span>";
      for (const s of CLIMA.horas) {
        h += "<span class=\"clima-h\">" + s.h + "h" + climaIcono(s.code) + (s.pp >= 30 ? " " + s.pp + "%" : "") + "</span>";
      }
    }
    return h + "</div>";
  }

  function bookmarkHTML(t) {
    const g = GUARDADOS.some(a => a.url === t.url);
    return '<span class="tarjeta-bookmark' + (g ? " tarjeta-bookmark--on" : "") + '" data-url="' + esc(t.url) + '" data-titulo="' + esc(t.titulo) + '" data-medio="' + esc(t.medio) + '" role="button" aria-label="Guardar">' + (g ? SVG_LLENO : SVG_VACIO) + '</span>';
  }

  function tarjetaHTML(t) {
    const datos = EXTRA[t.url] || {};
    const img = datos.imagen ? "<img class=\"tarjeta-img\" src=\"" + esc(datos.imagen) + "\" alt=\"\" loading=\"lazy\">" : "";
    const leible = datos.texto ? " tarjeta--leible" : "";
    const sinFoto = datos.imagen ? "" : " tarjeta--sin-foto";
    const ext = datos.texto ? "" : " target=\"_blank\" rel=\"noopener\"";
    return "<a class=\"tarjeta" + leible + sinFoto + "\" href=\"" + esc(t.url) + "\" data-link=\"" + esc(t.url) + "\"" + ext + ">" +
      img +
      bookmarkHTML(t) +
      "<span class=\"tarjeta-titulo\">" + esc(t.titulo) + "</span>" +
      (t.medio ? "<span class=\"tarjeta-medio\">" + esc(t.medio) + "</span>" : "") +
      "</a>";
  }

  function renderDiario(md) {
    let fecha = FECHA, titulo = "";
    const fm = md.match(/^---\s*([\s\S]*?)\s*---/);
    if (fm) {
      const f = fm[1].match(/fecha:\s*([\d-]+)/); if (f) fecha = f[1];
      const t = fm[1].match(/titulo:\s*(.+)/); if (t) titulo = t[1].trim().replace(/^["']|["']$/g, "");
    }
    md = md.replace(/^---[\s\S]*?---\s*/, "");

    const html = [];
    let carruselOpen = false, enPanorama = false, enCierre = false, heroAbierto = true;
    const cerrar = () => { if (carruselOpen) { html.push("</div>"); carruselOpen = false; } };
    const cerrarHero = () => { if (heroAbierto) { html.push("</header>"); html.push("<div class=\"contenido\">"); heroAbierto = false; } };

    html.push("<header class=\"masthead\">" +
      "<div class=\"masthead-linea\"><span class=\"masthead-tag\">Diario personal</span><a class=\"link-guardados\" href=\"/neopress/?vista=guardados\">Leer más tarde" + (GUARDADOS.length ? " (" + GUARDADOS.length + ")" : "") + "</a></div>" +
      "<div class=\"marca\">Neopress</div>" +
      "<div class=\"masthead-meta\"><span>Edición diaria</span><span>·</span><span>Valencia</span>" + climaHTML() + "</div>" +
      "</header>");
    html.push("<header class=\"hero\">");
    const partesFecha = fechaLarga(fecha).split(" ");
    const diaSemana = partesFecha.shift();
    html.push("<p class=\"hero-dia\">" + esc(diaSemana) + "</p>");
    html.push("<h1 class=\"hero-fecha\">" + esc(partesFecha.join(" ")) + "</h1>");
    if (titulo) html.push("<h2 class=\"hero-titulo\">" + esc(titulo) + "</h2>");

    for (const raw of md.split("\n")) {
      const line = raw.trim();
      if (!line) { cerrar(); continue; }
      if (line.startsWith("# ")) { cerrar(); }
      else if (line.startsWith("## ")) {
        cerrar();
        const t = line.slice(3).trim();
        if (t.toLowerCase() === "panorama") { enPanorama = true; enCierre = false; }
        else if (t.toLowerCase() === "cierre") { cerrarHero(); enPanorama = false; enCierre = true; html.push("<div class=\"cierre-sep\" aria-hidden=\"true\">■ ■ ■</div>"); }
        else {
          cerrarHero(); enPanorama = false; enCierre = false;
          const num = t.match(/^(\d+)\.\s*(.+)$/);
          if (num) html.push("<h2 class=\"seccion\"><span class=\"seccion-num\">" + num[1].padStart(2, "0") + "</span><span class=\"seccion-nombre\">" + inline(num[2]) + "</span></h2>");
          else html.push("<h2 class=\"seccion\"><span class=\"seccion-nombre\">" + inline(t) + "</span></h2>");
        }
      } else if (line.startsWith("### ")) { cerrar(); html.push("<h3>" + inline(line.slice(4)) + "</h3>"); }
      else if (/^\*\*(.+?)\*\*$/.test(line)) { cerrar(); html.push("<h3 class=\"label\">" + inline(line.replace(/^\*\*|\*\*$/g, "")) + "</h3>"); }
      else if (line.startsWith("> ")) { cerrar(); html.push("<blockquote class=\"cita\">" + inline(line.slice(2)) + "</blockquote>"); }
      else if (line.startsWith("- ")) {
        if (!carruselOpen) { html.push("<div class=\"carrusel\">"); carruselOpen = true; }
        html.push(tarjetaHTML(parseTarjeta(line.slice(2))));
      } else { cerrar(); const clase = enPanorama ? "panorama" : (enCierre ? "cierre" : "parrafo"); html.push("<p class=\"" + clase + "\">" + inline(line) + "</p>"); }
    }
    cerrar(); cerrarHero();
    html.push("</div>");
    html.push("<footer class=\"colofon\">Neopress · Edición del " + fechaCorta(fecha) + " · Escrito por Boty Editor</footer>");
    return html.join("\n");
  }

  function renderGuardados() {
    const html = [];
    html.push("<header class=\"masthead\"><div class=\"masthead-linea\"><span class=\"masthead-tag\">Diario personal</span><a class=\"link-guardados\" href=\"/neopress/\">← diario de hoy</a></div><div class=\"marca\">Neopress</div><div class=\"masthead-meta\"><span>Edición diaria</span><span>·</span><span>Valencia</span></div></header>");
    html.push("<header class=\"guardados-head\"><h1 class=\"guardados-titulo\">Leer más tarde</h1><p class=\"guardados-sub\">Lo que guardás acá no se borra con el diario del día.</p></header>");
    if (!GUARDADOS.length) {
      html.push("<p class=\"guardados-vacio\">Nada guardado todavía.</p>");
    } else {
      html.push("<div class=\"guardados-lista\">");
      for (const a of GUARDADOS) {
        html.push("<div class=\"guardado\" data-url=\"" + esc(a.url) + "\">" +
          (a.imagen ? "<img class=\"guardado-img\" src=\"" + esc(a.imagen) + "\" alt=\"\" loading=\"lazy\">" : "") +
          "<div class=\"guardado-cuerpo\">" +
            "<div class=\"guardado-titulo\">" + esc(a.titulo) + "</div>" +
            "<div class=\"guardado-medio\">" + esc(a.medio || "") + (a.guardado ? " · guardado el " + fechaCorta(a.guardado) : "") + "</div>" +
          "</div>" +
          "<button class=\"guardado-quitar\" data-url=\"" + esc(a.url) + "\" aria-label=\"Quitar\">✕</button>" +
        "</div>");
      }
      html.push("</div>");
    }
    return html.join("\n");
  }

  function abrirLectura(datos) {
    if (!datos || !datos.texto) { if (datos && datos.url) window.open(datos.url, "_blank"); return; }
    const guardado = GUARDADOS.some(a => a.url === datos.url);
    const overlay = document.createElement("div");
    overlay.className = "lectura-overlay";
    overlay.innerHTML =
      "<div class=\"lectura-topbar\"><span>Neopress — Lectura</span><button class=\"lectura-cerrar\" aria-label=\"Cerrar\">✕</button></div>" +
      "<article class=\"lectura\">" +
        (datos.imagen ? "<img class=\"lectura-img\" src=\"" + esc(datos.imagen) + "\" alt=\"\">" : "") +
        "<h1 class=\"lectura-titulo\">" + esc(datos.titulo) + "</h1>" +
        "<div class=\"lectura-medio\">" + esc(datos.medio || "") + " · <a href=\"" + esc(datos.url) + "\" target=\"_blank\" rel=\"noopener\">ver original</a></div>" +
        "<button class=\"lectura-guardar" + (guardado ? " is-on" : "") + "\">" + (guardado ? "✓ Guardado — tocar para quitar" : "Guardar para más tarde") + "</button>" +
        "<div class=\"lectura-texto\">" + datos.texto.split("\n").filter(p => p.trim()).map(p => "<p>" + esc(p) + "</p>").join("") + "</div>" +
      "</article>";
    const cerrarLectura = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarLectura(); });
    overlay.querySelector(".lectura-cerrar").addEventListener("click", cerrarLectura);
    const btnGuardar = overlay.querySelector(".lectura-guardar");
    btnGuardar.addEventListener("click", () => {
      if (GUARDADOS.some(a => a.url === datos.url)) {
        quitarArticulo(datos.url).then(() => { recargarGuardados(); btnGuardar.textContent = "Guardar para más tarde"; btnGuardar.classList.remove("is-on"); });
      } else {
        guardarArticulo(datos).then(() => { recargarGuardados(); btnGuardar.textContent = "✓ Guardado — tocar para quitar"; btnGuardar.classList.add("is-on"); });
      }
    });
    document.body.appendChild(overlay);
  }

  function guardarArticulo(datos) {
    return fetch("/neopress/api/guardados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ articulo: datos })
    }).then(r => r.json());
  }
  function quitarArticulo(url) {
    return fetch("/neopress/api/guardados/quitar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    }).then(r => r.json());
  }
  async function recargarGuardados() {
    try {
      const r = await fetch("/neopress/api/guardados");
      if (r.ok) GUARDADOS = await r.json();
    } catch (e) {}
  }

  contenedor.addEventListener("click", (e) => {
    const bookmark = e.target.closest(".tarjeta-bookmark");
    if (bookmark) {
      e.preventDefault(); e.stopPropagation();
      const url = bookmark.getAttribute("data-url");
      const yaGuardado = GUARDADOS.some(a => a.url === url);
      const pintar = (on) => { bookmark.innerHTML = on ? SVG_LLENO : SVG_VACIO; bookmark.classList.toggle("tarjeta-bookmark--on", on); };
      if (yaGuardado) {
        quitarArticulo(url).then(() => recargarGuardados().then(() => pintar(false)));
      } else {
        const titulo = bookmark.getAttribute("data-titulo");
        const medio = bookmark.getAttribute("data-medio");
        const datos = (EXTRA[url] && EXTRA[url].texto) ? EXTRA[url] : { url: url, titulo: titulo, medio: medio, imagen: (EXTRA[url] ? EXTRA[url].imagen : ""), texto: (EXTRA[url] ? EXTRA[url].texto : "") };
        guardarArticulo(datos).then(() => recargarGuardados().then(() => pintar(true)));
      }
      return;
    }
    const quitar = e.target.closest(".guardado-quitar");
    if (quitar) {
      const url = quitar.getAttribute("data-url");
      quitarArticulo(url).then(() => recargarGuardados().then(() => { contenedor.innerHTML = renderGuardados(); }));
      return;
    }
    const guardado = e.target.closest(".guardado[data-url]");
    if (guardado) {
      const url = guardado.getAttribute("data-url");
      const a = GUARDADOS.find(x => x.url === url);
      if (a) abrirLectura(a);
      return;
    }
    const tarjeta = e.target.closest(".tarjeta[data-link]");
    if (tarjeta) {
      const link = tarjeta.getAttribute("data-link");
      if (EXTRA[link] && EXTRA[link].texto) { e.preventDefault(); abrirLectura(EXTRA[link]); }
    }
  });

  async function cargar() {
    await recargarGuardados();
    if (VISTA === "guardados") {
      contenedor.innerHTML = renderGuardados();
      return;
    }
    // encontrar el diario más reciente disponible (hoy o días atrás)
    let fechaEf = null;
    const dd = new Date(FECHA + "T12:00:00");
    for (let i = 0; i < 8; i++) {
      const iso = dd.getFullYear() + "-" + String(dd.getMonth()+1).padStart(2,"0") + "-" + String(dd.getDate()).padStart(2,"0");
      const pr = await fetch("/neopress/diarios/" + iso + ".md");
      if (pr.ok) { fechaEf = iso; break; }
      dd.setDate(dd.getDate() - 1);
    }
    if (!fechaEf) {
      contenedor.innerHTML = "<div class=\"error\"><h2 class=\"error-fecha\">" + fechaLarga(FECHA) + "</h2><p>No hay diario disponible todavía.</p></div>";
      return;
    }
    try {
      const [rMd, rExtra, rClima] = await Promise.all([
        fetch("/neopress/diarios/" + fechaEf + ".md"),
        fetch("/neopress/diarios/" + fechaEf + ".extra.json"),
        fetch("/neopress/diarios/" + fechaEf + ".clima.json"),
      ]);
      if (!rMd.ok) throw new Error("HTTP " + rMd.status);
      if (rExtra.ok) { try { const raw = await rExtra.json(); EXTRA = {}; for (const u in raw) { EXTRA[u] = Object.assign({}, raw[u], { url: u }); } } catch (e) {} }
      if (rClima.ok) { try { CLIMA = await rClima.json(); } catch (e) {} }
      contenedor.innerHTML = renderDiario(await rMd.text());
    } catch (e) {
      contenedor.innerHTML = "<div class=\"error\"><p>No se pudo cargar el diario del " + fechaLarga(FECHA) + ".</p><p class=\"detalle\">" + esc(String(e.message)) + "</p></div>";
    }
  }

  cargar();
})();
