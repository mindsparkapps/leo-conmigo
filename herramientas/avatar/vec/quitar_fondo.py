"""Quita el fondo morado, los adornos y el globo: deja solo el personaje."""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src, out = sys.argv[1], sys.argv[2]
img = np.asarray(Image.open(src).convert("RGB")).astype(int)
r, g, b = img[..., 0], img[..., 1], img[..., 2]

# Morados y lilas del fondo: azul alto, rojo medio, verde por debajo de ambos
purple = (b > 170) & (b - g > 35) & (r - g > 10)
# Blancos/lilas muy claros de los adornos (se filtran luego por conexión)
not_bg = ~purple
lab, n = ndimage.label(not_bg)
sizes = ndimage.sum(not_bg, lab, range(1, n + 1))
keep = np.argmax(sizes) + 1           # el personaje es la mancha más grande
mask = lab == keep
mask = ndimage.binary_fill_holes(mask)
# Borde suave: un píxel de anti-alias
alpha = ndimage.binary_erosion(mask, iterations=1).astype(np.uint8) * 255
rgba = np.dstack([img.astype(np.uint8), alpha])
Image.fromarray(rgba, "RGBA").save(out)
ys, xs = np.nonzero(mask)
print("bbox", xs.min(), ys.min(), xs.max(), ys.max(), "componentes", n)
