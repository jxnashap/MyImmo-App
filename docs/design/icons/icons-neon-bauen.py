# -*- coding: utf-8 -*-
"""Vier Neon-Entwuerfe. Dichte entsteht durch programmatisch erzeugte Raster,
   Fenster, Ringe und Gitter — nicht durch von Hand gestreute Deko.
   Technisch weiter streng: 1024x1024, randabfallend, spaeter ohne Alphakanal."""
import os, math, random
S = 1024
OUT = os.path.dirname(os.path.abspath(__file__))
random.seed(7)                     # reproduzierbar

GOLD_HOT, GOLD, GOLD_DEEP = "#FFF0BE", "#F4C64A", "#B8790A"
TEAL, BLAU = "#43E8D8", "#5BA8FF"
NACHT_1, NACHT_2 = "#05060A", "#0E1018"

def leuchtfilter(id_, farbe, weit=42, mittel=15):
    """Neonroehre: weiter Halo, mittlerer Schein, harter Kern."""
    return f'''
    <filter id="f{id_}" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="{weit}" result="w"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="{mittel}" result="m"/>
      <feMerge>
        <feMergeNode in="w"/><feMergeNode in="w"/>
        <feMergeNode in="m"/><feMergeNode in="m"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>'''

def roehre(d, farbe, kern, breite, id_, halo=1.0):
    """Eine Neonroehre in vier Lagen — Halo, Schein, Koerper, heisser Kern."""
    return f'''
  <g>
    <path d="{d}" fill="none" stroke="{farbe}" stroke-width="{breite*2.4:.1f}"
          stroke-opacity="{0.16*halo:.3f}" stroke-linejoin="round" stroke-linecap="round" filter="url(#f{id_})"/>
    <path d="{d}" fill="none" stroke="{farbe}" stroke-width="{breite*1.35:.1f}"
          stroke-opacity="{0.55*halo:.3f}" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="{d}" fill="none" stroke="{farbe}" stroke-width="{breite:.1f}"
          stroke-linejoin="round" stroke-linecap="round"/>
    <path d="{d}" fill="none" stroke="{kern}" stroke-width="{max(2,breite*0.30):.1f}"
          stroke-opacity="0.95" stroke-linejoin="round" stroke-linecap="round"/>
  </g>'''

def nacht(id_):
    return f'''
  <defs>
    <radialGradient id="n{id_}" cx="50%" cy="46%" r="82%">
      <stop offset="0%" stop-color="{NACHT_2}"/><stop offset="100%" stop-color="{NACHT_1}"/>
    </radialGradient>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#n{id_})"/>'''

def kopf(): return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" '
                    f'viewBox="0 0 {S} {S}">')

# =====================================================================
# 5 — NEON-GIEBEL IM RASTER
# =====================================================================
def e5():
    t = 32
    fein = "".join(f'<path d="M{i},0 V{S}M0,{i} H{S}"/>' for i in range(0, S+1, t))
    grob = "".join(f'<path d="M{i},0 V{S}M0,{i} H{S}"/>' for i in range(0, S+1, t*4))
    knoten = "".join(
        f'<circle cx="{x}" cy="{y}" r="2.6"/>'
        for x in range(t*2, S, t*2) for y in range(t*2, S, t*2) if random.random() < 0.17)
    m = ("M232,752 V430 L372,300 L512,430 L652,300 L792,430 V752")
    return kopf() + nacht(5) + f'''
  <defs>{leuchtfilter(5, GOLD, 46, 16)}{leuchtfilter("5t", TEAL, 30, 11)}</defs>
  <g stroke="{GOLD}" stroke-opacity="0.045" stroke-width="1" fill="none">{fein}</g>
  <g stroke="{TEAL}" stroke-opacity="0.075" stroke-width="1.4" fill="none">{grob}</g>
  <g fill="{TEAL}" fill-opacity="0.30">{knoten}</g>
  <g filter="url(#f5t)"><path d="M96,806 H928" stroke="{TEAL}" stroke-width="3"
     stroke-opacity="0.55" fill="none"/></g>
  {roehre(m, GOLD, GOLD_HOT, 30, 5)}
</svg>'''

# =====================================================================
# 6 — DATENSTADT
# =====================================================================
def e6():
    hoehen = [188,124,232,150,96,208,140,176,110]
    basis, links, br, luecke = 812, 92, 78, 18
    haeuser, fenster = [], []
    x = links
    for i,h in enumerate(hoehen):
        if i == 4: x += br + luecke; continue        # Mitte bleibt fuer das Haus frei
        y = basis - h
        haeuser.append(f'<rect x="{x}" y="{y}" width="{br}" height="{h}" rx="3"/>')
        for fy in range(y+16, basis-18, 30):
            for fx in range(x+14, x+br-16, 24):
                if random.random() < 0.62:
                    f = TEAL if random.random() < 0.34 else GOLD
                    o = round(random.uniform(0.30, 0.95), 2)
                    fenster.append(f'<rect x="{fx}" y="{fy}" width="11" height="15" rx="1.5" fill="{f}" fill-opacity="{o}"/>')
        x += br + luecke
    haus = "M512,318 L664,438 V812 H360 V438 Z"
    return kopf() + nacht(6) + f'''
  <defs>{leuchtfilter(6, GOLD, 40, 14)}{leuchtfilter("6t", TEAL, 26, 9)}</defs>
  <g fill="#0A0C12" stroke="{TEAL}" stroke-opacity="0.30" stroke-width="1.6">{"".join(haeuser)}</g>
  <g>{"".join(fenster)}</g>
  <g filter="url(#f6t)"><path d="M40,812 H984" stroke="{TEAL}" stroke-width="3.5" stroke-opacity="0.6"/></g>
  <path d="{haus}" fill="#080A10" fill-opacity="0.92"/>
  {roehre(haus, GOLD, GOLD_HOT, 22, 6)}
  <g filter="url(#f6)">
    <rect x="470" y="640" width="84" height="172" rx="4" fill="{GOLD}" fill-opacity="0.85"/>
  </g>
  <g opacity="0.22">
    <rect x="40" y="816" width="944" height="150" fill="url(#sp6)"/>
  </g>
  <defs><linearGradient id="sp6" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="{TEAL}" stop-opacity="0.35"/>
    <stop offset="100%" stop-color="{TEAL}" stop-opacity="0"/></linearGradient></defs>
</svg>'''

# =====================================================================
# 7 — ISOMETRISCHES DRAHTGITTER
# =====================================================================
def e7():
    hor = 636
    boden = []
    for k in range(-13, 14):
        boden.append(f'<path d="M{512+k*88},{S+40} L{512+k*6},{hor}"/>')
    y = hor + 7; schritt = 6.0
    while y < S + 30:
        boden.append(f'<path d="M0,{y:.1f} H{S}"/>'); schritt *= 1.32; y += schritt
    cx, cy = 512, 470          # cy = Traufe
    w, dy = 196, 104           # halbe Breite, halbe Tiefe
    h, dach = 196, 168         # Wandhoehe, Dachhoehe
    L, B, R, V = (cx-w, cy), (cx, cy-dy), (cx+w, cy), (cx, cy+dy)
    def z(pt): return f"{pt[0]:.0f},{pt[1]:.0f}"
    def tief(pt): return (pt[0], pt[1]+h)
    spitze = (cx, cy-dy-dach)
    # Waende: linke und rechte sichtbare Flaeche
    wand_l = f"M{z(L)} L{z(V)} L{z(tief(V))} L{z(tief(L))} Z"
    wand_r = f"M{z(V)} L{z(R)} L{z(tief(R))} L{z(tief(V))} Z"
    # Dach: zwei sichtbare Flaechen zur Spitze
    dach_l = f"M{z(L)} L{z(B)} L{z(spitze)} Z"
    dach_r = f"M{z(B)} L{z(R)} L{z(spitze)} Z"
    grat   = f"M{z(L)} L{z(spitze)} L{z(R)} M{z(B)} L{z(spitze)}"
    traufe = f"M{z(L)} L{z(V)} L{z(R)}"
    senk   = f"M{z(L)} L{z(tief(L))} M{z(V)} L{z(tief(V))} M{z(R)} L{z(tief(R))}"
    return kopf() + nacht(7) + f'''
  <defs>{leuchtfilter(7, GOLD, 38, 13)}{leuchtfilter("7t", TEAL, 20, 7)}
    <linearGradient id="hz7" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{BLAU}" stop-opacity="0"/>
      <stop offset="100%" stop-color="{BLAU}" stop-opacity="0.22"/></linearGradient>
  </defs>
  <rect x="0" y="{hor-140}" width="{S}" height="140" fill="url(#hz7)"/>
  <g stroke="{TEAL}" stroke-opacity="0.16" stroke-width="1.3" fill="none">{"".join(boden)}</g>
  <g filter="url(#f7t)"><path d="M0,{hor} H{S}" stroke="{TEAL}" stroke-width="2.6" stroke-opacity="0.6"/></g>
  <path d="{dach_l}" fill="{GOLD}" fill-opacity="0.10"/>
  <path d="{dach_r}" fill="{GOLD}" fill-opacity="0.16"/>
  <path d="{wand_l}" fill="#0A0C14" fill-opacity="0.88"/>
  <path d="{wand_r}" fill="#0A0C14" fill-opacity="0.94"/>
  {roehre(senk, GOLD, GOLD_HOT, 9, 7, halo=0.55)}
  {roehre(traufe, GOLD, GOLD_HOT, 11, 7, halo=0.7)}
  {roehre(grat, GOLD, GOLD_HOT, 16, 7)}
</svg>'''

# =====================================================================
# 8 — STRAHLENKRANZ
# =====================================================================
def e8():
    cx, cy = 512, 520
    ringe = "".join(
        f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="none" stroke="{GOLD}" '
        f'stroke-opacity="{max(0.06, 0.46-(r/1250)):.3f}" stroke-width="{1.5 if r%3 else 2.8}"/>'
        for r in range(70, 620, 17))
    strahlen = []
    for i in range(72):
        a = i*(2*math.pi/72); lang = 300 if i % 6 == 0 else (210 if i % 2 == 0 else 150)
        x1,y1 = cx+math.cos(a)*86, cy+math.sin(a)*86
        x2,y2 = cx+math.cos(a)*(86+lang), cy+math.sin(a)*(86+lang)
        o = 0.42 if i % 6 == 0 else 0.18
        strahlen.append(f'<path d="M{x1:.1f},{y1:.1f} L{x2:.1f},{y2:.1f}" stroke-opacity="{o}"/>')
    haus = "M512,246 L800,472 V818 H224 V472 Z"
    schloss = (f'<circle cx="{cx}" cy="{cy+46}" r="52"/>'
               f'<path d="M484,{cy+82} L540,{cy+82} L560,{cy+192} L464,{cy+192} Z"/>')
    return kopf() + nacht(8) + f'''
  <defs>{leuchtfilter(8, GOLD, 44, 15)}{leuchtfilter("8k", GOLD_HOT, 34, 12)}
    <mask id="m8">
      <rect width="{S}" height="{S}" fill="#000"/>
      <path d="{haus}" fill="#fff"/>
      <g fill="#000">{schloss}</g>
    </mask>
  </defs>
  <g>{ringe}</g>
  <g stroke="{GOLD}" stroke-width="2.8" fill="none">{"".join(strahlen)}</g>
  <g mask="url(#m8)">
    <rect width="{S}" height="{S}" fill="#070810"/>
    <rect width="{S}" height="{S}" fill="{GOLD}" fill-opacity="0.05"/>
  </g>
  {roehre(haus, GOLD, GOLD_HOT, 17, 8)}
  <g filter="url(#f8k)" fill="{GOLD_HOT}" fill-opacity="0.92">{schloss}</g>
  <g fill="{GOLD_HOT}">{schloss}</g>
</svg>'''

for name, fn in [("05-neon-raster", e5), ("06-datenstadt", e6),
                 ("07-drahtgitter", e7), ("08-strahlenkranz", e8)]:
    open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8").write(fn())
    print("  ", name + ".svg")
