"""Vectoriza cada pieza PNG a SVG con trazos bezier (VTracer)."""
import sys, os, glob, re
import vtracer

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for png in sorted(glob.glob(os.path.join(src, "*.png"))):
    name = os.path.splitext(os.path.basename(png))[0]
    out = os.path.join(dst, name + ".svg")
    vtracer.convert_image_to_svg_py(
        png, out,
        colormode="color", hierarchical="stacked", mode="spline",
        filter_speckle=6, color_precision=6, layer_difference=24,
        corner_threshold=60, length_threshold=4.0, max_iterations=10,
        splice_threshold=45, path_precision=2,
    )
    svg = open(out, encoding="utf-8").read()
    print(name, "paths", len(re.findall(r"<path", svg)), "bytes", len(svg))
