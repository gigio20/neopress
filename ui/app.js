// Neopress — vista del diario. Lectura limpia vía .extra.json.
(() => {
  const params = new URLSearchParams(location.search);
  const FECHA = params.get("fecha") || hoyISO();
  const contenedor = document.getElementById("diario");
  let EXTRA = {}; // link -> {titulo, medio, imagen, texto}

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
  function esc(s) { return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
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

  function tarjetaHTML(t) {
    const datos = EXTRA[t.url] || {};
    const img = datos.imagen ? "<img class=\"tarjeta-img\" src=\"" + esc(datos.imagen) + "\" alt=\"\" loading=\"lazy\">" : "";
    const leible = datos.texto ? " tarjeta--leible" : "";
    const ext = datos.texto ? "" : " target=\"_blank\" rel=\"noopener\"";
    return "<a class=\"tarjeta" + leible + "\" href=\"" + esc(t.url) + "\" data-link=\"" + esc(t.url) + "\"" + ext + ">" +
      img +
      "<span class=\"tarjeta-titulo\">" + esc(t.titulo) + "</span>" +
      (t.medio ? "<span class=\"tarjeta-medio\">" + esc(t.medio) + "</span>" : "") +
      "</a>";
  }

  function render(md) {
    let fecha = FECHA;
    const fm = md.match(/^---\s*\nfecha:\s*([\d-]+)/);
    if (fm) fecha = fm[1];
    md = md.replace(/^---[\s\S]*?---\s*/, "");

    const html = [];
    let carruselOpen = false, enPanorama = false;
    const cerrar = () => { if (carruselOpen) { html.push("</div>"); carruselOpen = false; } };

    html.push("<header class=\"header\"><div class=\"marca\">Neopress</div><div class=\"fecha\">" + fechaLarga(fecha) + "</div></header>");

    for (const raw of md.split("\n")) {
      const line = raw.trim();
      if (!line) { cerrar(); continue; }
      if (line.startsWith("# ")) { cerrar(); }
      else if (line.startsWith("## ")) {
        cerrar();
        const t = line.slice(3).trim();
        if (t.toLowerCase() === "panorama") enPanorama = true;
        else { enPanorama = false; html.push("<h2 class=\"seccion\">" + inline(t) + "</h2>"); }
      } else if (line.startsWith("### ")) { cerrar(); html.push("<h3>" + inline(line.slice(4)) + "</h3>"); }
      else if (line.startsWith("> ")) { cerrar(); html.push("<blockquote class=\"cita\">" + inline(line.slice(2)) + "</blockquote>"); }
      else if (line.startsWith("- ")) {
        if (!carruselOpen) { html.push("<div class=\"carrusel\">"); carruselOpen = true; }
        html.push(tarjetaHTML(parseTarjeta(line.slice(2))));
      } else { cerrar(); html.push("<p class=\"" + (enPanorama ? "panorama" : "parrafo") + "\">" + inline(line) + "</p>"); }
    }
    cerrar();
    return html.join("\n");
  }

  function abrirLectura(link) {
    const datos = EXTRA[link];
    if (!datos || !datos.texto) { window.open(link, "_blank"); return; }
    const overlay = document.createElement("div");
    overlay.className = "lectura-overlay";
    overlay.innerHTML =
      "<article class=\"lectura\">" +
        "<button class=\"lectura-cerrar\" aria-label=\"Cerrar\">✕</button>" +
        (datos.imagen ? "<img class=\"lectura-img\" src=\"" + esc(datos.imagen) + "\" alt=\"\">" : "") +
        "<h1 class=\"lectura-titulo\">" + esc(datos.titulo) + "</h1>" +
        "<div class=\"lectura-medio\">" + esc(datos.medio) + " · <a href=\"" + esc(link) + "\" target=\"_blank\" rel=\"noopener\">ver original</a></div>" +
        "<div class=\"lectura-texto\">" + datos.texto.split("\n").filter(p => p.trim()).map(p => "<p>" + esc(p) + "</p>").join("") + "</div>" +
      "</article>";
    const cerrarLectura = () => overlay.remove();
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrarLectura(); });
    overlay.querySelector(".lectura-cerrar").addEventListener("click", cerrarLectura);
    document.body.appendChild(overlay);
  }

  contenedor.addEventListener("click", (e) => {
    const tarjeta = e.target.closest(".tarjeta[data-link]");
    if (!tarjeta) return;
    const link = tarjeta.getAttribute("data-link");
    if (EXTRA[link] && EXTRA[link].texto) { e.preventDefault(); abrirLectura(link); }
  });

  async function cargar() {
    try {
      const [rMd, rExtra] = await Promise.all([
        fetch("../diarios/" + FECHA + ".md"),
        fetch("../diarios/" + FECHA + ".extra.json"),
      ]);
      if (!rMd.ok) throw new Error("HTTP " + rMd.status);
      if (rExtra.ok) { try { EXTRA = await rExtra.json(); } catch (e) {} }
      contenedor.innerHTML = render(await rMd.text());
    } catch (e) {
      contenedor.innerHTML = "<div class=\"error\"><p>No se pudo cargar el diario del " + fechaLarga(FECHA) + ".</p><p class=\"detalle\">" + esc(String(e.message)) + "</p></div>";
    }
  }

  cargar();
})();
