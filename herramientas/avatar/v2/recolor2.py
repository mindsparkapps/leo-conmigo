"""Aplica la paleta pedida sobre las capas suaves: svg_suave_orig -> svg_suave."""
import re, colorsys, os
SRC, DST = "svg_suave_orig", "svg_suave"
os.makedirs(DST, exist_ok=True)
hx = lambda c: tuple(int(c[i:i + 2], 16) / 255 for i in (0, 2, 4))
tohex = lambda t: "#%02X%02X%02X" % tuple(round(max(0, min(1, v)) * 255) for v in t)
hls = lambda c: colorsys.rgb_to_hls(*hx(c))


def recolor(name, target, sel, f=0.45, fijo=None, especial=None):
    src = open(f"{SRC}/{name}.svg", encoding="utf-8").read()
    cols = set(re.findall(r'fill="#([0-9A-Fa-f]{6})"', src))
    picked = [c for c in cols if sel(*hls(c))]
    th, tl, ts = hls(target[1:])
    ref = max([hls(c)[1] for c in picked] or [1])
    m = {c: tohex(colorsys.hls_to_rgb(th, tl * (f + (1 - f) * hls(c)[1] / ref), ts)) for c in picked}
    m.update(fijo or {})

    def path(k):
        tag = k.group(0)
        if especial:
            r = especial(tag)
            if r:
                return re.sub(r'fill="#[0-9A-Fa-f]{6}"', 'fill="%s"' % r, tag)
        return re.sub(r'fill="#([0-9A-Fa-f]{6})"', lambda q: 'fill="%s"' % m.get(q.group(1), "#" + q.group(1)), tag)
    out = re.sub(r"<path[^>]*>", path, src)
    open(f"{DST}/{name}.svg", "w", encoding="utf-8").write(out)
    print(name, m)


H = lambda h: h * 360
roj = lambda h: H(h) < 20 or H(h) > 300
recolor("peloAtras", "#FF8C00", lambda h, l, s: True)
for e in ("ojoL", "ojoR"):
    recolor(e, "#32CD32", lambda h, l, s: roj(h) and l < 0.75 and s > 0.25, f=0.0)


def banda_cuello(tag):  # la sombra del cuello cayó en el color de la camisa
    ys = [float(v) for v in re.findall(r"[ ,](\d+(?:\.\d+)?)", re.search(r'd="([^"]*)"', tag).group(1))[1::2]]
    tr = re.search(r"translate\(([\d.]+),([\d.]+)\)", tag)
    dy = float(tr.group(2)) if tr else 0
    return "#E8A584" if ys and max(ys) + dy < 545 else None


recolor("cuerpo", "#F08080", lambda h, l, s: roj(h) and s > 0.2 and l < 0.6, especial=banda_cuello)
recolor("cabeza", "#FFDAB9", lambda h, l, s: False, fijo={"B07461": "#FFDAB9", "B37966": "#FFDAB9"})
for n in ("cejaL", "cejaR"):
    open(f"{DST}/{n}.svg", "w", encoding="utf-8").write(open(f"{SRC}/{n}.svg", encoding="utf-8").read())
