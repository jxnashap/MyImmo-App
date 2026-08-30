# -*- coding: utf-8 -*-
"""Verlaessliche Render-Kette fuer die Icons.

   Chrome liefert bei --window-size=1024,1024 nur ~937 px Viewporthoehe; die
   Icons bekamen dadurch einen schwarzen Streifen am unteren Rand. Loesung:
   mit Reserve rendern und exakt auf 1024x1024 beschneiden — und das Ergebnis
   danach MESSEN, nicht annehmen."""
import subprocess, sys, os
from PIL import Image

CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
KANTE  = 1024
RESERVE = 260          # Puffer gegen die verkuerzte Viewporthoehe

def rendere(svg_pfad, ziel_png):
    ordner = os.path.dirname(os.path.abspath(svg_pfad))
    basis  = os.path.splitext(os.path.basename(svg_pfad))[0]
    html   = os.path.join(ordner, basis + ".__render.html")
    with open(svg_pfad, encoding="utf-8") as f: svg = f.read()
    with open(html, "w", encoding="utf-8") as f:
        f.write("<style>html,body{margin:0;padding:0;background:#FF00FF}"
                f"svg{{display:block;width:{KANTE}px;height:{KANTE}px}}</style>\n" + svg)
    roh = os.path.join(ordner, basis + ".__roh.png")
    subprocess.run([CHROME,"--headless","--no-sandbox","--disable-gpu","--hide-scrollbars",
                    "--force-device-scale-factor=1", f"--window-size={KANTE},{KANTE+RESERVE}",
                    "--virtual-time-budget=3000", f"--screenshot={roh}", "file://"+html],
                   check=True, capture_output=True)
    im = Image.open(roh).crop((0,0,KANTE,KANTE))
    flach = Image.new("RGB",(KANTE,KANTE),(0,0,0))
    flach.paste(im, mask=im.split()[-1] if im.mode=="RGBA" else None)
    flach.save(ziel_png,"PNG",optimize=True)
    os.remove(roh); os.remove(html)
    return pruefe(ziel_png)

def pruefe(png):
    """Magenta = die Seite hat durchgeschienen. Schwarzer Rand = beschnitten."""
    im = Image.open(png)
    fehler = []
    if im.size != (KANTE,KANTE): fehler.append(f"Größe {im.size}")
    if im.mode != "RGB":         fehler.append(f"Modus {im.mode}")
    px = im.load()
    for xy in [(2,2),(KANTE-3,2),(2,KANTE-3),(KANTE-3,KANTE-3),(KANTE//2,KANTE-3)]:
        r,g,b = px[xy]
        if r>200 and b>200 and g<80: fehler.append(f"Seitenhintergrund sichtbar bei {xy}")
    g = im.convert("L"); gp = g.load()
    letzte = 0
    for y in range(KANTE-1,-1,-1):
        if max(gp[x,y] for x in range(0,KANTE,8))>12: letzte=y; break
    if KANTE-1-letzte > 1: fehler.append(f"schwarzer Streifen unten: {KANTE-1-letzte} px")
    return fehler

if __name__ == "__main__":
    alle_ok = True
    for svg in sys.argv[1:]:
        ziel = svg.replace(".svg","-1024.png")
        f = rendere(svg, ziel)
        alle_ok &= not f
        print(("  OK     " if not f else "  FEHLER ") + os.path.basename(ziel) +
              ("" if not f else "  -> " + "; ".join(f)))
    sys.exit(0 if alle_ok else 1)
