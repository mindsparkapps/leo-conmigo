"""Une todas las capas en un solo SVG con grupos con id y el círculo como máscara."""
import re
capas = [("peloAtras", "svg_suave"), ("cuerpo", "svg_suave"), ("cabeza", "svg_suave"),
         ("narizMejillas", "extras"), ("ojoL", "svg_suave"), ("ojoR", "svg_suave"),
         ("cejaL", "svg_suave"), ("cejaR", "svg_suave"), ("boca", "extras/sonrisa")]
out = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 768 768" width="768" height="768">',
       '<defs><clipPath id="mascara"><circle cx="383" cy="383" r="345"/></clipPath></defs>',
       '<circle id="fondo" cx="383" cy="383" r="345" fill="#48B7CA"/>',
       '<g id="personaje" clip-path="url(#mascara)">']
for nombre, carpeta in capas:
    ruta = f"{carpeta}.svg" if carpeta.endswith("sonrisa") else f"{carpeta}/{nombre}.svg"
    txt = open(ruta, encoding="utf-8").read()
    cuerpo = re.search(r"<svg[^>]*>(.*)</svg>", txt, re.S).group(1)
    out.append(f'<g id="{nombre}">{cuerpo.strip()}</g>')
out.append("</g></svg>")
open("../avatar_capas.svg", "w", encoding="utf-8").write("\n".join(out))
