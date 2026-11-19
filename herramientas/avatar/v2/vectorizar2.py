"""Vectoriza las capas; ojos y cejas con más detalle de color para conservar el rostro."""
import sys, os, glob, re
import vtracer

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
fino = {"ojoL", "ojoR", "cejaL", "cejaR", "cabeza"}
for png in sorted(glob.glob(os.path.join(src, "*.png"))):
    name = os.path.splitext(os.path.basename(png))[0]
    out = os.path.join(dst, name + ".svg")
    detalle = name in {"ojoL", "ojoR", "cejaL", "cejaR"}
    # quitar ruido JPEG: mediana sobre el color, alfa intacta, y paleta reducida
    from PIL import Image, ImageFilter
    im = Image.open(png).convert("RGBA")
    a = im.getchannel("A")
    rgb = im.convert("RGB").filter(ImageFilter.MedianFilter(3 if detalle else 7))
    if detalle:
        rgb = rgb.quantize(colors=28, method=Image.Quantize.MEDIANCUT).convert("RGB")
    clean = rgb.convert("RGBA"); clean.putalpha(a)
    tmp = os.path.join(dst, "_" + name + ".png"); clean.save(tmp)
    vtracer.convert_image_to_svg_py(
        tmp, out,
        colormode="color", hierarchical="stacked", mode="spline",
        filter_speckle=3 if detalle else 12,
        color_precision=7 if detalle else 6,
        layer_difference=10 if detalle else 26,
        corner_threshold=60, length_threshold=3.5, max_iterations=10,
        splice_threshold=45, path_precision=2,
    )
    os.remove(tmp)
    svg = open(out, encoding="utf-8").read()
    print(name, "paths", len(re.findall(r"<path", svg)), "KB", len(svg) // 1024)
