"""Arma data/avatar/avatar.svg (capas con id para animar con CSS) y data/avatar/bocas.json (apertura de boca por
fotograma de 1/30 s para cada elogio). Uso: python -I armar_avatar.py <carpeta v2> <proyecto> <ffmpeg>"""
import json, os, re, subprocess, sys, array, math

v2, proyecto, ffmpeg = sys.argv[1:4]
salida = os.path.join(proyecto, "data", "avatar")
os.makedirs(salida, exist_ok=True)


def interior(ruta):
    txt = open(ruta, encoding="utf-8").read()
    return re.search(r"<svg[^>]*>(.*)</svg>", txt, re.S).group(1).strip()


s = lambda n: interior(os.path.join(v2, "svg_suave", n + ".svg"))
x = lambda n: interior(os.path.join(v2, "extras", n + ".svg"))
PIEL = "#FDCBA6"
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768" class="avatar-svg" aria-hidden="true">
<defs>
<clipPath id="av-mascara"><circle cx="383" cy="383" r="345"/></clipPath>
<clipPath id="av-ojoL"><ellipse cx="308" cy="348" rx="40" ry="35"/></clipPath>
<clipPath id="av-ojoR"><ellipse cx="459" cy="348" rx="42" ry="35"/></clipPath>
</defs>
<circle class="av-fondo" cx="383" cy="383" r="345" fill="#48B7CA"/>
<g clip-path="url(#av-mascara)">
<g class="av-cabeza">{s("peloAtras")}</g>
<g class="av-cuerpo">{s("cuerpo")}</g>
<g class="av-cabeza">
{s("cabeza")}
{x("narizMejillas")}
<g class="av-ojo av-ojoL">{s("ojoL")}</g>
<g class="av-ojo av-ojoR">{s("ojoR")}</g>
<g clip-path="url(#av-ojoL)"><ellipse class="av-parpado" cx="308" cy="425" rx="56" ry="30" fill="{PIEL}"/></g>
<g clip-path="url(#av-ojoR)"><ellipse class="av-parpado av-parpadoR" cx="459" cy="425" rx="58" ry="30" fill="{PIEL}"/></g>
<g class="av-ceja">{s("cejaL")}</g>
<g class="av-ceja av-cejaR">{s("cejaR")}</g>
<g class="av-boca">
{x("sonrisa")}
<g class="av-abierta">{x("bocaAbierta")}</g>
</g>
</g>
</g>
</svg>
'''
open(os.path.join(salida, "avatar.svg"), "w", encoding="utf-8").write(svg)

# Apertura de boca: RMS de cada 1/30 s, normalizada y suavizada
bocas = {}
frases = os.path.join(proyecto, "data", "voces", "frases")
for nombre in ("muy-bien", "eso-es", "lo-lograste", "genial", "excelente", "bien-hecho"):
    crudo = subprocess.run([ffmpeg, "-loglevel", "error", "-i", os.path.join(frases, nombre + ".mp3"),
                            "-ac", "1", "-ar", "12000", "-f", "s16le", "-"], capture_output=True, check=True).stdout
    m = array.array("h", crudo)
    paso = 400  # 12000 / 30
    rms = [math.sqrt(sum(v * v for v in m[i:i + paso]) / paso) for i in range(0, len(m), paso)]
    tope = sorted(rms)[int(len(rms) * 0.95)] or 1
    val = [min(1, r / tope) for r in rms]
    val = [round(0 if v < 0.12 else (val[max(0, i - 1)] + 2 * v + val[min(len(val) - 1, i + 1)]) / 4, 2) for i, v in enumerate(val)]
    bocas[nombre] = val
    print(nombre, len(val), "fotogramas")
json.dump(bocas, open(os.path.join(salida, "bocas.json"), "w"), separators=(",", ":"))
print("avatar.svg KB", os.path.getsize(os.path.join(salida, "avatar.svg")) // 1024)
