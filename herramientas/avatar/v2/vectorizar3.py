"""Vectorización suave: silueta suavizada (blur+umbral) y colores planos."""
import sys, os, glob, re
from PIL import Image, ImageFilter
import vtracer

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
ncol = {"peloAtras": 5, "cuerpo": 6, "cabeza": 7}
for png in sorted(glob.glob(os.path.join(src, "*.png"))):
    name = os.path.splitext(os.path.basename(png))[0]
    im = Image.open(png).convert("RGBA")
    det = name not in ncol
    a = im.getchannel("A").filter(ImageFilter.GaussianBlur(1.2 if det else 3))
    a = a.point(lambda v: 255 if v >= 128 else 0)
    rgb = im.convert("RGB").filter(ImageFilter.MedianFilter(3 if det else 9))
    if not det:
        rgb = rgb.filter(ImageFilter.GaussianBlur(2))
    rgb = rgb.quantize(colors=28 if det else ncol[name], method=Image.Quantize.MEDIANCUT).convert("RGB")
    if not det:  # fronteras entre colores suaves
        rgb = rgb.filter(ImageFilter.ModeFilter(9))
    c = rgb.convert("RGBA"); c.putalpha(a)
    tmp = os.path.join(dst, "_" + name + ".png"); c.save(tmp)
    out = os.path.join(dst, name + ".svg")
    vtracer.convert_image_to_svg_py(
        tmp, out, colormode="color", hierarchical="stacked", mode="spline",
        filter_speckle=3 if det else 30, color_precision=7 if det else 8,
        layer_difference=10 if det else 6, corner_threshold=60 if det else 120,
        length_threshold=3.5 if det else 8, max_iterations=10,
        splice_threshold=45 if det else 80, path_precision=2)
    os.remove(tmp)
    print(name, len(re.findall("<path", open(out).read())))
