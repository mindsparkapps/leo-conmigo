"""Separa personaje.png en piezas alineadas (mismo lienzo 554x554) para el rig.

Uso: python -I separar.py personaje.png carpeta_salida
"""
import sys, os
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
im = np.asarray(Image.open(src).convert("RGBA")).astype(int)
H, W = im.shape[:2]
rgb, a = im[..., :3], im[..., 3] > 0
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
Y, X = np.mgrid[0:H, 0:W]
lum = 0.299 * r + 0.587 * g + 0.114 * b


def poly(points):
    m = Image.new("L", (W, H), 0)
    ImageDraw.Draw(m).polygon(points, fill=1)
    return np.asarray(m).astype(bool)


def ellipse(cx, cy, rx, ry):
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def save(name, mask, pixels=None):
    px = (rgb if pixels is None else pixels).astype(np.uint8)
    out = np.dstack([px, (mask * 255).astype(np.uint8)])
    Image.fromarray(out, "RGBA").save(os.path.join(outdir, name + ".png"))


hair = a & (lum < 85) & (b - r < 30) & (Y < 400)
yellow = a & (r > 190) & (g > 120) & (b < 110)
skin_px = rgb[(Y > 240) & (Y < 250) & (abs(X - 282) < 30) & a & ~yellow & ~hair]
skin = np.median(skin_px, axis=0).astype(int)
hair_col = np.median(rgb[hair & (Y < 120)], axis=0).astype(int)
print("piel", "#%02X%02X%02X" % tuple(skin), "pelo", "#%02X%02X%02X" % tuple(hair_col))

# --- brazos (manga + mano) ---
armL = a & poly([(240, 278), (232, 302), (222, 340), (214, 380), (206, 394), (186, 406),
                 (150, 410), (146, 392), (158, 368), (168, 334), (192, 300), (220, 280)])
armR = a & poly([(316, 284), (346, 294), (376, 324), (394, 352), (412, 368), (414, 392),
                 (392, 396), (364, 390), (344, 384), (330, 350), (316, 314)])
armL &= ~hair
armR &= ~hair

# --- cabeza: todo lo que hay por encima del cuello, salvo el pelo largo de los lados ---
cut = 258 - 46 * ((X - 282) / 150.0) ** 2      # borde inferior redondeado del pelo
head = a & (Y <= 262) & ~yellow & ~(hair & ((X < 172) | (X > 392))) & ~(hair & (Y >= cut))
head &= ~armL & ~armR

# ojos y boca: huecos rellenos de piel (los ojos se dibujan aparte, más pequeños)
eyeL, eyeR = ellipse(229, 191, 33, 35), ellipse(333, 186, 33, 36)
eyeL &= ~(hair & (Y < 153))
eyeR &= ~(hair & (Y < 147))
blush = (r > 235) & (g < 185) & (b < 185) & (Y > 200)   # conservar el rubor
eyeL &= ~blush
eyeR &= ~blush
mouth = ellipse(282, 227, 20, 13) & head & (lum < 200) | (ellipse(282, 227, 20, 13) & head & (r > 200) & (g < 150))
mouth = ndimage.binary_closing(mouth, iterations=2) & head
head_px = rgb.copy()
for m in (eyeL & head, eyeR & head, mouth):
    head_px[m] = skin

# --- pelo de atrás: solo la parte de la cabeza (lo largo se sustituye por trenzas) ---
cut = 258 - 46 * ((X - 282) / 150.0) ** 2      # borde inferior redondeado
hair_back = hair & (Y < cut)
hair_back = ndimage.binary_dilation(hair_back, iterations=1) & a & (Y < cut + 1)
lab, n = ndimage.label(hair_back)                 # solo la melena, sin pestañas ni boca
hair_back = lab == (np.argmax(ndimage.sum(hair_back, lab, range(1, n + 1))) + 1)

# --- piernas: pantalón azul, zapatos oscuros ---
legs = a & (Y >= 426) & (X > 185) & (X < 350)
shoe = legs & (lum < 80)
legs_px = rgb.copy()
cloth = legs & ~shoe
t = np.clip((lum - 120) / 135, 0, 1)[..., None]
dark, light = np.array([0x24, 0x47, 0x9A]), np.array([0x3D, 0x74, 0xD6])
legs_px[cloth] = (dark + (light - dark) * t)[cloth].astype(int)
# cadera del pantalón bajo la falda, para que no quede hueco si el torso respira
hip = poly([(228, 396), (336, 396), (334, 422), (230, 422)])
legs_px[hip & ~legs] = dark + (light - dark) * 0.75
legs = legs | hip

# --- torso: suéter y falda ---
torso = a & ~head & ~hair & ~armL & ~armR & (Y < 434) & ~(legs & ~hip & (Y >= 426) & ~(b > r + 30))
torso &= ~(hair)
torso &= ~((Y > 405) & (r > 220) & (g > 150) & (b > 120))   # sin piel de rodillas
lab, n = ndimage.label(torso)
torso = lab == (np.argmax(ndimage.sum(torso, lab, range(1, n + 1))) + 1)

# --- borde de los brazos ---
border = (176, 112, 10)
arms_px = rgb.copy()
for name, m in (("brazoL", armL), ("brazoR", armR)):
    m = ndimage.binary_closing(m, iterations=2)
    ring = ndimage.binary_dilation(m, iterations=2) & ~m
    px = arms_px.copy()
    px[ring] = border
    save(name, m | ring, px)

save("cabeza", head, head_px)
save("boca", mouth)
save("peloAtras", hair_back)
save("torso", torso)
save("piernas", legs, legs_px)
for n, m in (("cabeza", head), ("boca", mouth), ("torso", torso), ("piernas", legs), ("peloAtras", hair_back)):
    ys, xs = np.nonzero(m)
    print(n, "bbox", xs.min(), ys.min(), xs.max(), ys.max(), "px", int(m.sum()))
