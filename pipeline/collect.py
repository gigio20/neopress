#!/usr/bin/env python3
"""Neopress — recolección diaria.

Fetch de feeds RSS/Atom → parseo → dedupe por título → guarda el material del día.
Con --extraer: además genera diarios/<fecha>.extra.json con texto limpio + imagen
de los artículos top (para la lectura limpia de la UI).
"""
import json
import re
import sys
import time
import datetime
import urllib.request
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

import feedparser
import trafilatura

BASE = Path(__file__).resolve().parent
NEOPRESS = BASE.parent
DIARIOS = NEOPRESS / "diarios"
FEED_PATH = NEOPRESS / "feed.json"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36")

EXTRACCION_SKIP = {"reddit"}
TOP_EXTRACCION = 4


def load_feeds():
    data = json.loads((BASE / "feeds.json").read_text(encoding="utf-8"))
    return data["fuentes"]


def load_config():
    try:
        return json.loads(FEED_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def resolver_fuentes(catalogo, cfg):
    """La config del Feed lista nombres del catálogo y/o URLs crudas.
    Vacío (o sin nada resoluble) = todas las del catálogo."""
    seleccion = cfg.get("fuentes") or []
    if not seleccion:
        return catalogo
    por_nombre = {f["nombre"]: f for f in catalogo}
    out, urls = [], set()
    for item in seleccion:
        if not isinstance(item, str):
            continue
        item = item.strip()
        if item in por_nombre:
            f = por_nombre[item]
        elif item.startswith(("http://", "https://")):
            f = {"nombre": urlparse(item).netloc or item, "categoria": "custom", "url": item}
        else:
            print(f"  [warn] fuente no reconocida (ni del catálogo ni URL): {item}")
            continue
        if f["url"] in urls:
            continue
        urls.add(f["url"])
        out.append(f)
    return out or catalogo


def fetch(url, timeout=15):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def norm(s):
    return "".join(c.lower() for c in s if c.isalnum())


def imagen_de(it, summary_html=""):
    mc = it.get("media_content") or it.get("media_thumbnail")
    if mc:
        for m in mc:
            url = m.get("url")
            if url:
                return url
    if summary_html:
        m = re.search(r"<img[^>]+src=[\"\x27]([^\"\x27]+)[\"\x27]", summary_html, re.I)
        if m:
            return m[1]
    return ""


def extraer_articulo(link):
    try:
        return (trafilatura.extract(fetch(link)) or "").strip()
    except Exception:
        return ""


def main():
    extraer = "--extraer" in sys.argv
    dias = 8
    if "--dias" in sys.argv:
        dias = int(sys.argv[sys.argv.index("--dias") + 1])

    catalogo = load_feeds()
    fuentes = resolver_fuentes(catalogo, load_config())
    hoy = datetime.date.today().isoformat()
    salida = {"fecha": hoy, "fuentes": []}
    extra_salida = {}
    vistos = set()
    tags_contador = Counter()

    DIARIOS.mkdir(exist_ok=True)

    for f in fuentes:
        nombre, cat, url = f["nombre"], f["categoria"], f["url"]
        entry = {"nombre": nombre, "categoria": cat, "items": []}
        try:
            print(f"  fetch {nombre}...", flush=True)
            parsed = feedparser.parse(fetch(url))
            entries = parsed.entries[:dias]
        except Exception as e:
            print(f"  [ERR] {nombre}: {e}")
            salida["fuentes"].append(entry)
            continue

        extraidas = 0
        for it in entries:
            titulo = (it.get("title") or "").strip()
            link = it.get("link", "")
            clave = norm(titulo)
            if clave and clave in vistos:
                continue
            if clave:
                vistos.add(clave)

            summary_html = (it.get("summary") or it.get("description") or "")
            resumen = re.sub(r"<[^>]+>", " ", summary_html)
            resumen = re.sub(r"\s+", " ", resumen).strip()[:400]

            tags_item = []
            for t in (it.get("tags") or []):
                term = (t.get("term") or "").strip()
                if term and term not in tags_item:
                    tags_item.append(term)
            for t in tags_item:
                tags_contador[t] += 1

            entry["items"].append({
                "titulo": titulo,
                "link": link,
                "fecha": it.get("published") or it.get("updated") or "",
                "resumen": resumen,
                "tags": tags_item,
            })

            if extraer:
                img = imagen_de(it, summary_html)
                if img:
                    extra_salida.setdefault(link, {"titulo": titulo, "medio": nombre, "imagen": img, "texto": ""})
                if link and cat not in EXTRACCION_SKIP and extraidas < TOP_EXTRACCION:
                    texto = extraer_articulo(link)
                    if texto:
                        extra_salida.setdefault(link, {"titulo": titulo, "medio": nombre, "imagen": img, "texto": ""})
                        extra_salida[link]["texto"] = texto[:15000]
                        extraidas += 1

        n = len(entry["items"])
        print(f"  [ok] {nombre} ({cat}): {n} items")
        salida["fuentes"].append(entry)
        time.sleep(0.2)

    out = DIARIOS / f"{hoy}.json"
    out.write_text(json.dumps(salida, ensure_ascii=False, indent=2), encoding="utf-8")
    total = sum(len(x["items"]) for x in salida["fuentes"])

    tags_out = [t for t, _ in tags_contador.most_common(200)]
    (NEOPRESS / "tags-disponibles.json").write_text(
        json.dumps(tags_out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"  tags disponibles: {len(tags_out)}")

    if extraer:
        extra_out = DIARIOS / f"{hoy}.extra.json"
        extra_out.write_text(json.dumps(extra_salida, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n-> {out}  |  {total} items · {len(extra_salida)} extraídos -> {extra_out}")
    else:
        print(f"\n-> {out}  |  {total} items de {len(fuentes)} fuentes")


if __name__ == "__main__":
    main()
