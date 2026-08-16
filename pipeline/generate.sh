#!/bin/bash
# Neopress — recolección + clima + redacción (corre en el VPS, cron 9 AM).
set -euo pipefail

NEOPRESS="$HOME/neopress"
PIPELINE="$NEOPRESS/pipeline"
DIARIOS="$NEOPRESS/diarios"
EDITOR="$HOME/brain/neopress/editor.md"
HOY=$(date +%F)
PI="$HOME/.npm-global/bin/pi"

log() { echo "[neopress] $*"; }

cd "$PIPELINE"

log "recolección ($HOY)"
python3 collect.py

log "clima"
curl -s "https://api.open-meteo.com/v1/forecast?latitude=39.47&longitude=-0.38&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&hourly=weather_code,precipitation_probability&timezone=Europe%2FMadrid&forecast_days=1" | python3 -c '
import sys, json
d = json.load(sys.stdin)
out = {
  "temp": round(d["current"]["temperature_2m"]),
  "code": d["current"]["weather_code"],
  "max": round(d["daily"]["temperature_2m_max"][0]),
  "min": round(d["daily"]["temperature_2m_min"][0]),
  "horas": [{"h": h, "code": d["hourly"]["weather_code"][h], "pp": d["hourly"]["precipitation_probability"][h] or 0} for h in (9, 15, 21)]
}
print(json.dumps(out))
' > "$DIARIOS/$HOY.clima.json"

log "redacción"
"$PI" -p "
Sos el editor de Neopress, el diario personal de Gian (anti-FOMO: aislado pero informado).
Tu trabajo: convertir el material crudo del día en el diario.
1. Leé el archivo $EDITOR — es tu sombrero: voz, formato exacto de salida y criterio.
2. Leé el archivo $DIARIOS/${HOY}.json — el material crudo recolectado por collect.py.
3. Escribí dos archivos, siguiendo estrictamente el formato del sombrero:
   - $DIARIOS/${HOY}.md            (el diario, con `titulo:` en el frontmatter: una frase corta y generalista que resuma el día)
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
