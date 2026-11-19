"""Compone las piezas en orden y genera una hoja de revisión (composición + cada pieza)."""
import sys, os
from PIL import Image

d, out = sys.argv[1], sys.argv[2]
orden = ["peloAtras", "piernas", "torso", "brazoL", "brazoR", "cabeza", "boca"]
base = Image.new("RGBA", (554, 554), (255, 255, 255, 255))
for n in orden:
    base.alpha_composite(Image.open(os.path.join(d, n + ".png")))
hoja = Image.new("RGBA", (554 + 4 * 200, 554), (230, 230, 240, 255))
hoja.paste(base, (0, 0))
for i, n in enumerate(orden):
    p = Image.open(os.path.join(d, n + ".png")).resize((200, 200))
    t = Image.new("RGBA", (200, 200), (255, 255, 255, 255))
    t.alpha_composite(p)
    hoja.paste(t, (554 + (i % 4) * 200, (i // 4) * 210))
hoja.convert("RGB").save(out)
