# -*- coding: utf-8 -*-
"""Erzeugt vier App-Icon-Entwuerfe als SVG, streng nach Apples Vorgaben:
   1024x1024, randabfallend, KEINE vorgerundeten Ecken, KEIN Alphakanal,
   keine Schrift, keine Schlagschatten ausserhalb der Form."""
import os
S = 1024
OUT = os.path.dirname(os.path.abspath(__file__))

# --- Markenpalette -------------------------------------------------------
DUNKEL_1, DUNKEL_2 = "#0B0B0A", "#191712"      # Grund, warm abgetoent
GOLD_HELL, GOLD, GOLD_TIEF = "#F2D583", "#D4A847", "#A97A11"
CREME = "#F5F2EA"

def kopf(extra=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" '
            f'viewBox="0 0 {S} {S}" shape-rendering="geometricPrecision">{extra}')

def grund_dunkel(id_):
    """Beinahe schwarzer Grund mit warmem Lichtanstieg — nie reines Schwarz."""
    return f'''
  <defs>
    <radialGradient id="g{id_}" cx="50%" cy="38%" r="78%">
      <stop offset="0%"  stop-color="{DUNKEL_2}"/>
      <stop offset="62%" stop-color="#101010"/>
      <stop offset="100%" stop-color="{DUNKEL_1}"/>
    </radialGradient>
    <linearGradient id="au{id_}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="{GOLD_HELL}"/>
      <stop offset="52%"  stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="{GOLD_TIEF}"/>
    </linearGradient>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#g{id_})"/>'''

# ======================================================================
# 1 — GIEBEL-MONOGRAMM
#     Zwei Dachfirste bilden ein M. Haus und Initiale sind dieselbe Linie.
# ======================================================================
def entwurf_1():
    b = 96                       # Wandstaerke
    ax, ex = 208, 816            # aeussere Stege
    y_o, y_t, y_u = 300, 432, 760   # Firsthoehe, Traufe, Sockel
    p1x, p2x, tal = 360, 664, 512
    pfad = (f"M{ax},{y_u} V{y_t} L{p1x},{y_o} L{tal},{y_t} "
            f"L{p2x},{y_o} L{ex},{y_t} V{y_u}")
    return kopf() + grund_dunkel(1) + f'''
  <path d="{pfad}" fill="none" stroke="url(#au1)" stroke-width="{b}"
        stroke-linejoin="miter" stroke-linecap="butt" stroke-miterlimit="12"/>
  <path d="M{ax},{y_u} V{y_t} L{p1x},{y_o}" fill="none" stroke="#FFFFFF"
        stroke-opacity="0.10" stroke-width="3" transform="translate(0,-46)"/>
</svg>'''

# ======================================================================
# 2 — GIEBEL MIT SCHLUESSELLOCH
#     Massives Gold, das Schloss als Aussparung. Eigentum heisst: der Schluessel.
# ======================================================================
def entwurf_2():
    haus = "M512,214 L818,462 V806 H206 V462 Z"
    return kopf() + grund_dunkel(2) + f'''
  <defs>
    <mask id="m2">
      <rect width="{S}" height="{S}" fill="#000"/>
      <path d="{haus}" fill="#fff"/>
      <circle cx="512" cy="588" r="66" fill="#000"/>
      <path d="M478,624 L546,624 L566,752 L458,752 Z" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#m2)">
    <rect width="{S}" height="{S}" fill="url(#au2)"/>
    <path d="M512,214 L818,462 H206 Z" fill="#FFFFFF" fill-opacity="0.13"/>
  </g>
  <path d="{haus}" fill="none" stroke="{DUNKEL_1}" stroke-opacity="0.35" stroke-width="2"/>
</svg>'''

# ======================================================================
# 3 — DREI HAEUSER
#     Die App verwaltet ein Portfolio, kein einzelnes Objekt.
# ======================================================================
def entwurf_3():
    def haus(cx, first, eave, basis, halb):
        # Wand MUSS hoeher wirken als das Dach, sonst liest sich die Form
        # bei 40 px als Berg und nicht als Haus.
        return (f"M{cx},{first} L{cx+halb},{eave} V{basis} H{cx-halb} V{eave} Z")
    gap = 18   # dunkle Fuge, damit die Formen bei 29 px nicht verschmelzen
    l = haus(258, 512, 610, 800, 132)
    m = haus(512, 404, 546, 812, 158)
    r = haus(766, 512, 610, 800, 132)
    def fuge(d): return f'<path d="{d}" fill="none" stroke="{DUNKEL_1}" stroke-width="{gap}"/>'
    return kopf() + grund_dunkel(3) + f'''
  <defs>
    <linearGradient id="s3" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#8A6410"/><stop offset="100%" stop-color="#6B4C0B"/>
    </linearGradient>
  </defs>
  <path d="{l}" fill="url(#s3)"/>
  <path d="{r}" fill="url(#s3)"/>
  {fuge(l)}{fuge(r)}
  <path d="{m}" fill="url(#au3)"/>
  <path d="M512,404 L670,546 H354 Z" fill="#FFFFFF" fill-opacity="0.12"/>
  <rect x="478" y="700" width="68" height="112" fill="{DUNKEL_1}" fill-opacity="0.55"/>
</svg>'''

# ======================================================================
# 4 — INVERS: GOLDFELD, AUSGESPARTER GIEBEL
#     Figur und Grund tauschen. Hell auf dem Homescreen, maximal ablesbar.
# ======================================================================
def entwurf_4():
    haus = "M512,232 L806,470 V802 H218 V470 Z"
    return kopf() + f'''
  <defs>
    <linearGradient id="g4" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0%"   stop-color="#F2D583"/>
      <stop offset="46%"  stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="#B98A18"/>
    </linearGradient>
    <mask id="m4">
      <rect width="{S}" height="{S}" fill="#fff"/>
      <path d="{haus}" fill="#000"/>
    </mask>
  </defs>
  <rect width="{S}" height="{S}" fill="{DUNKEL_1}"/>
  <g mask="url(#m4)">
    <rect width="{S}" height="{S}" fill="url(#g4)"/>
  </g>
  <path d="M512,232 L806,470 H218 Z" fill="{DUNKEL_2}" fill-opacity="0.55"/>
  <rect x="466" y="640" width="92" height="162" fill="url(#g4)" fill-opacity="0.92"/>
</svg>'''

namen = [("01-giebel-monogramm", entwurf_1), ("02-schluessel-giebel", entwurf_2),
         ("03-drei-haeuser", entwurf_3), ("04-invers-goldfeld", entwurf_4)]
for name, fn in namen:
    open(os.path.join(OUT, name + ".svg"), "w", encoding="utf-8").write(fn())
    print("  ", name + ".svg")
