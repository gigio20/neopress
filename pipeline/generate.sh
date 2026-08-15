#!/bin/bash
# Neopress — recolección + redacción (corre en el VPS, cron 9 AM).
set -euo pipefail

NEOPRESS="$HOME/neopress"
PIPELINE="$NEOPRESS/pipeline"
DIARIOS="$NEOPRESS/diarios"
EDITOR="$HOME/brain/neopress/editor.md"   # sombrero: vive en el vault (conceptual)
HOY=$(date +%F)
PI="$HOME/.npm-global/bin/pi"

log() { echo "[neopress] $*"; }

cd "$PIPELINE"

log "recolección ($HOY)"
python3 collect.py --extraer

log "redacción"
"$PI" -p "
Sos el editor de Neopress, el diario personal de Gian (anti-FOMO: aislado pero informado).
Tu trabajo: convertir el material crudo del día en el diario.
1. Leé el archivo $EDITOR — es tu sombrero: voz, formato exacto de salida y criterio.
2. Leé el archivo $DIARIOS/${HOY}.json — el material crudo recolectado por collect.py.
3. Escribí dos archivos, siguiendo estrictamente el formato del sombrero:
   - $DIARIOS/${HOY}.md            (el diario)
   - $DIARIOS/${HOY}.briefing.md   (el briefing)
Reglas duras:
- Solo material que esté en el JSON. No inventes noticias, datos ni links.
- 3 a 5 titulares por sección, nunca más.
- Filtrá ruido: horóscopos, relleno, deportes irrelevantes, notas repetidas.
- Objetividad activa: en temas polémicos mostrá las dos (o tres) caras reales.
- Voz: español rioplatense, directo, sin clickbait.
" \
  --provider opencode-go \
  --model kimi-k2.7-code \
  --thinking high \
  --no-context-files

log "listo: $DIARIOS/${HOY}.md + .briefing.md"
