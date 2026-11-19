"""Hoja de revisión: composición de capas + cada capa en miniatura."""
import sys, os
from PIL import Image

d, out = sys.argv[1], sys.argv[2]
orden = ["peloAtras", "cuerpo", "cabeza", "ojoL", "ojoR", "cejaL", "cejaR"]
comp = Image.new("RGBA", (768, 768), (72, 183, 202, 255))
for n in orden:
    comp.alpha_composite(Image.open(os.path.join(d, n + ".png")))
hoja = Image.new("RGBA", (768 + 2 * 256, 768), (235, 235, 240, 255))
hoja.paste(comp, (0, 0))
for i, n in enumerate(orden[:3] + ["ojoL"]):
    t = Image.new("RGBA", (768, 768), (255, 255, 255, 255))
    t.alpha_composite(Image.open(os.path.join(d, n + ".png")))
    hoja.paste(t.resize((256, 256)), (768 + (i % 2) * 256, (i // 2) * 256))
hoja.convert("RGB").save(out)
