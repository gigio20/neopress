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
from pathlib import Path

import feedparser
import trafilatura

BASE = Path(__file__).resolve().parent
DIARIOS = BASE.parent / "diarios"
UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
      "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36")

EXTRACCION_SKIP = {"reddit"}
TOP_EXTRACCION = 4


def load_feeds():
    data = json.loads((BASE / "feeds.json").read_text(encoding="utf-8"))
    return data["fuentes"]


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

    fuentes = load_feeds()
    hoy = datetime.date.today().isoformat()
    salida = {"fecha": hoy, "fuentes": []}
    extra_salida = {}
    vistos = set()

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

            entry["items"].append({
                "titulo": titulo,
                "link": link,
                "fecha": it.get("published") or it.get("updated") or "",
                "resumen": resumen,
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

    if extraer:
        extra_out = DIARIOS / f"{hoy}.extra.json"
        extra_out.write_text(json.dumps(extra_salida, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"\n-> {out}  |  {total} items · {len(extra_salida)} extraídos -> {extra_out}")
    else:
        print(f"\n-> {out}  |  {total} items de {len(fuentes)} fuentes")


if __name__ == "__main__":
    main()
