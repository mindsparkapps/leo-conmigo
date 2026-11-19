import re, colorsys, sys
def hx(c): return tuple(int(c[i:i+2],16)/255 for i in (0,2,4))
def tohex(t): return "#%02X%02X%02X"%tuple(round(max(0,min(1,v))*255) for v in t)
def recolor(name, target, sel, f=0.45):
    src=open(f"svg_orig/{name}.svg",encoding="utf-8").read()
    cols=set(re.findall(r'fill="#([0-9A-Fa-f]{6})"',src))
    picked=[c for c in cols if sel(*colorsys.rgb_to_hls(*hx(c)))]
    th,tl,ts=colorsys.rgb_to_hls(*hx(target[1:]))
    ref=max(colorsys.rgb_to_hls(*hx(c))[1] for c in picked)
    m={}
    for c in picked:
        l=colorsys.rgb_to_hls(*hx(c))[1]
        m[c]=tohex(colorsys.hls_to_rgb(th, tl*(f+(1-f)*l/ref), ts))
    out=re.sub(r'fill="#([0-9A-Fa-f]{6})"',lambda k:'fill="%s"'%m.get(k.group(1),'#'+k.group(1)),src)
    open(f"svg/{name}.svg","w",encoding="utf-8").write(out)
    print(name,{k:v for k,v in sorted(m.items())})
hue=lambda h:h*360
recolor("peloAtras","#FF8C00",lambda h,l,s:True)
for e in ("ojoL","ojoR"):
    recolor(e,"#32CD32",lambda h,l,s:(hue(h)<20 or hue(h)>330) and l<0.75 and s>0.25, f=0.0)
recolor("cuerpo","#F08080",lambda h,l,s:hue(h)>300 or hue(h)<12)
