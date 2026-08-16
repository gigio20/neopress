# Neopress — operativo

Diario personal diario: recolección RSS + redacción con IA + interfaz web. Este repo es solo lo **operativo** (código + datos). Lo conceptual vive en el vault.

## Documentación conceptual (en /brain)

El "por qué" y el diseño están en `/home/gian/brain/neopress/`:
- `vision.md` — filosofía, principios, estructura del diario.
- `editor.md` — sombrero editor (voz, formato, secciones). El pipeline lo lee de acá.
- `arquitectura.md` — regla de separación conceptual/operativo + pipeline + deudas.
- `_context.md` — estado del proyecto y próximos pasos.
- `fuentes.md` — catálogo de fuentes (sesgo, tipo, estado).

## Estructura

```
pipeline/   collect.py (recolección + extracción) · generate.sh (orquesta) · feeds.json (fuentes)
ui/         index.html · styles.css · app.js (interfaz, vanilla) · icon.svg
diarios/    *.json (crudo) · *.extra.json (texto+imagen) · *.md (diario) · *.briefing.md · *.clima.json
leer-mas-tarde.json   artículos guardados (la UI lo escribe vía API)
manifest.json · sw.js  PWA
```

## Pipeline (cron 9 AM)

`generate.sh` hace, en orden:
1. `python3 collect.py --extraer` → `diarios/<fecha>.json` (resúmenes) + `.extra.json` (texto limpio + imagen de los top 4 por fuente).
2. `curl` a open-meteo → `diarios/<fecha>.clima.json`.
3. run headless de pi (`--provider opencode-go --model kimi-k2.7-code`) con el sombrero `editor.md` → `diarios/<fecha>.md` + `.briefing.md`.

Correr manual: `cd ~/neopress/pipeline && bash generate.sh` (~15 min; el grueso es la extracción + la redacción).

## Serving y API

- pi-web sirve `/neopress/` desde `/home/gian/neopress/` (Patch 11 en `metabot/vps/config/patches/patch-server.cjs`).
- Escritura: `GET/POST /neopress/api/guardados` y `POST /neopress/api/guardados/quitar` (Patch 12) → `leer-mas-tarde.json`.
- Acceso: `https://boty.tail33ba66.ts.net:8192/neopress/` (tailscale).

## Deploy

- Este repo es `git` local en `~/neopress/` (commits manuales).
- Los patches de pi-web viven en el **vault** (`metabot/vps/`). Flujo: editar en vault → push → en VPS `cd ~/brain && git pull && node metabot/vps/config/patches/patch-server.cjs && sudo systemctl restart pi-web`.
- La UI es estática servida por pi-web; los cambios de `ui/` se ven con un recargado (el service worker es network-first).

## Deuda conocida

- `.extra.json` se carga completo (~500KB) — optimizar a carga bajo demanda.
- `app.js` monolítico — umbral de refactor: el chat flotante.
- Patch 11/12 sobre pi-web (monkeypatch).
