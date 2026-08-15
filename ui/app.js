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
    const full = s.match(/^(.*?)\s*—\s*\[([^\]]+)\]\(([^)]+)\)$/);
    if (full) return { titulo: full[1].trim().replace(/^\[|\]$/g,""), medio: full[2], url: full[3] };
    const single = s.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (single) return { titulo: single[1], medio: "", url: single[2] };
    return { titulo: s.replace(/^\[|\]$/g,""), medio: "", url: "" };
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
  function climaHTML() {
    if (!CLIMA) return "";
    return "<div class=\"clima\"><span class=\"clima-temp\">" + CLIMA.temp + "°</span>" +
      "<span class=\"clima-desc\">" + climaDesc(CLIMA.code) + "</span>" +
      "<span class=\"clima-minmax\">" + CLIMA.min + "° / " + CLIMA.max + "°</span></div>";
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
    let carruselOpen = false, enPanorama = false, heroAbierto = true;
    const cerrar = () => { if (carruselOpen) { html.push("</div>"); carruselOpen = false; } };
    const cerrarHero = () => { if (heroAbierto) { html.push("</header>"); html.push("<div class=\"contenido\">"); heroAbierto = false; } };

    html.push("<div class=\"hero-top\"><div class=\"marca\">Neopress</div>" + climaHTML() + "<a class=\"link-guardados\" href=\"/neopress/?vista=guardados\">Leer más tarde" + (GUARDADOS.length ? " (" + GUARDADOS.length + ")" : "") + "</a></div>");
    html.push("<header class=\"hero\">");
    html.push("<h1 class=\"hero-fecha\">" + fechaLarga(fecha) + "</h1>");
    if (titulo) html.push("<h2 class=\"hero-titulo\">" + esc(titulo) + "</h2>");

    for (const raw of md.split("\n")) {
      const line = raw.trim();
      if (!line) { cerrar(); continue; }
      if (line.startsWith("# ")) { cerrar(); }
      else if (line.startsWith("## ")) {
        cerrar();
        const t = line.slice(3).trim();
        if (t.toLowerCase() === "panorama") enPanorama = true;
        else { cerrarHero(); enPanorama = false; html.push("<h2 class=\"seccion\">" + inline(t) + "</h2>"); }
      } else if (line.startsWith("### ")) { cerrar(); html.push("<h3>" + inline(line.slice(4)) + "</h3>"); }
      else if (line.startsWith("> ")) { cerrar(); html.push("<blockquote class=\"cita\">" + inline(line.slice(2)) + "</blockquote>"); }
      else if (line.startsWith("- ")) {
        if (!carruselOpen) { html.push("<div class=\"carrusel\">"); carruselOpen = true; }
        html.push(tarjetaHTML(parseTarjeta(line.slice(2))));
      } else { cerrar(); html.push("<p class=\"" + (enPanorama ? "panorama" : "parrafo") + "\">" + inline(line) + "</p>"); }
    }
    cerrar(); cerrarHero();
    return html.join("\n");
  }

  function renderGuardados() {
    const html = [];
    html.push("<div class=\"hero-top\"><div class=\"marca\">Neopress</div><a class=\"link-guardados\" href=\"/neopress/\">← diario de hoy</a></div>");
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
      "<article class=\"lectura\">" +
        "<button class=\"lectura-cerrar\" aria-label=\"Cerrar\">✕</button>" +
        (datos.imagen ? "<img class=\"lectura-img\" src=\"" + esc(datos.imagen) + "\" alt=\"\">" : "") +
        "<h1 class=\"lectura-titulo\">" + esc(datos.titulo) + "</h1>" +
        "<div class=\"lectura-medio\">" + esc(datos.medio || "") + " · <a href=\"" + esc(datos.url) + "\" target=\"_blank\" rel=\"noopener\">ver original</a></div>" +
        "<button class=\"lectura-guardar\">" + (guardado ? "✓ Guardado — tocar para quitar" : "Guardar para más tarde") + "</button>" +
        "<div class=\"lectura-texto\">" + datos.texto.split("\n").filter(p => p.trim()).map(p => "<p>" + esc(p) + "</p>").join("") + "</div>" +
      "</article>";
    const cerrarLectura = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarLectura(); });
    overlay.querySelector(".lectura-cerrar").addEventListener("click", cerrarLectura);
    const btnGuardar = overlay.querySelector(".lectura-guardar");
    btnGuardar.addEventListener("click", () => {
      if (GUARDADOS.some(a => a.url === datos.url)) {
        quitarArticulo(datos.url).then(() => { recargarGuardados(); btnGuardar.textContent = "Guardar para más tarde"; });
      } else {
        guardarArticulo(datos).then(() => { recargarGuardados(); btnGuardar.textContent = "✓ Guardado — tocar para quitar"; });
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
    try {
      const [rMd, rExtra, rClima] = await Promise.all([
        fetch("/neopress/diarios/" + FECHA + ".md"),
        fetch("/neopress/diarios/" + FECHA + ".extra.json"),
        fetch("/neopress/diarios/" + FECHA + ".clima.json"),
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
