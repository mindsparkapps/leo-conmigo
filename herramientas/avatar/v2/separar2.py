"""Separa el avatar (768x768) en capas para el rig. Uso: python -I separar2.py ref768.png salida"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

src, outdir = sys.argv[1], sys.argv[2]
os.makedirs(outdir, exist_ok=True)
rgb = np.asarray(Image.open(src).convert("RGB")).astype(int)
H, W = rgb.shape[:2]
r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
Y, X = np.mgrid[0:H, 0:W]
lum = 0.299 * r + 0.587 * g + 0.114 * b


def ell(cx, cy, rx, ry):
    return ((X - cx) / rx) ** 2 + ((Y - cy) / ry) ** 2 <= 1


def biggest(m):
    lab, n = ndimage.label(m)
    if n == 0:
        return m
    return lab == (np.argmax(ndimage.sum(m, lab, range(1, n + 1))) + 1)


def save(name, m, px=None, borde=0):
    """Guarda la capa. Los píxeles transparentes toman el color vecino (no contaminan
    la vectorización); con borde>0 el contorno mezclado con el fondo también."""
    px = (rgb if px is None else px).copy()
    inner = ndimage.binary_erosion(m, iterations=borde) if borde else m
    if borde and inner.any():                    # ojos y cejas se guardan tal cual
        _, (iy, ix) = ndimage.distance_transform_edt(~inner, return_indices=True)
        fuera = ~inner
        px[fuera] = px[iy[fuera], ix[fuera]]
    px = px.astype(np.uint8)
    Image.fromarray(np.dstack([px, (m * 255).astype(np.uint8)]), "RGBA").save(os.path.join(outdir, name + ".png"))


# círculo de fondo
teal = (b > 150) & (g > 120) & (r < 120) & (b - r > 60)
ys, xs = np.nonzero(teal)
cx = (xs.min() + xs.max()) / 2                  # la camiseta tapa el borde inferior:
rad = (xs.max() - xs.min()) / 2                 # se mide con el ancho y el borde superior
cy = ys.min() + rad
circle = ell(cx, cy, rad, rad)
teal_col = np.median(rgb[teal], axis=0).astype(int)
print("circulo", round(cx, 1), round(cy, 1), round(rad, 1), "teal #%02X%02X%02X" % tuple(teal_col))

char = circle & ~teal
char = ndimage.binary_opening(char, iterations=1)
char = biggest(char)
char = ndimage.binary_fill_holes(char) & circle & ~teal

skin_ref = np.median(rgb[ell(382, 380, 18, 10)], axis=0).astype(int)
print("piel #%02X%02X%02X" % tuple(skin_ref))

hair = char & (lum < 110) & (r >= g) & (r - b < 70)
eyeL, eyeR = ell(308, 348, 40, 37), ell(459, 348, 42, 37)
browL = (X >= 260) & (X <= 352) & (Y >= 274) & (Y <= 302)
browR = (X >= 418) & (X <= 474) & (Y >= 283) & (Y <= 302)   # el final se funde con el flequillo
mouth = ell(382, 445, 36, 12)
features = eyeL | eyeR | browL | browR
hair &= ~features

# rasgos: lo que no es piel dentro de cada zona
is_skin = (r > 200) & (r - b > 35) & (g > 150)
def feat(zone):
    m = char & zone & ~is_skin
    return ndimage.binary_dilation(m, iterations=2) & zone & char

oL, oR = feat(eyeL), feat(eyeR)
cL, cR = feat(browL) & (lum < 150), feat(browR) & (lum < 150)
cL, cR = biggest(ndimage.binary_dilation(cL, iterations=1)), biggest(ndimage.binary_dilation(cR, iterations=1))

# cabeza: todo por encima de la barbilla salvo la melena lateral
side = ((X < 262) | (X > 512)) & (Y > 300)
head = char & (Y < 503) & ~hair          # el pelo entero (flequillo incluido) va en peloAtras
ear = (r > 150) & (r - g > 50)
head &= ~(side & (Y >= 312) & ~is_skin & ~ear)   # sin restos del borde del pelo en los lados
head_px = rgb.copy()
for m in (oL, oR, cL, cR, mouth & head):
    grown = ndimage.binary_dilation(m, iterations=2) & head & ~(hair & ~m)
    head_px[grown] = skin_ref
head = biggest(head)

# pelo de atrás: toda la melena
hair_back = biggest(ndimage.binary_dilation(hair, iterations=1) & char)

# cuerpo: cuello y camiseta (con cuello extendido bajo la barbilla)
body = char & (Y >= 503) & ~hair_back      # la barbilla queda en la cabeza
neck_ext = ell(384, 490, 30, 28)
body_px = rgb.copy()
neck_col = np.median(rgb[char & (Y > 545) & (Y < 565) & (abs(X - 384) < 15)], axis=0).astype(int)
body_px[neck_ext & ~body] = neck_col
body = biggest(body | neck_ext)

save("peloAtras", hair_back, borde=3)
save("cuerpo", body, body_px, borde=3)
save("cabeza", head, head_px, borde=1)
save("ojoL", oL); save("ojoR", oR)
save("cejaL", cL); save("cejaR", cR)
for n, m in (("peloAtras", hair_back), ("cuerpo", body), ("cabeza", head), ("ojoL", oL), ("ojoR", oR), ("cejaL", cL), ("cejaR", cR)):
    ys, xs = np.nonzero(m)
    print(n, xs.min(), ys.min(), xs.max(), ys.max())
