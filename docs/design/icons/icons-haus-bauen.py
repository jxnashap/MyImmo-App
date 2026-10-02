# -*- coding: utf-8 -*-
"""Das bestehende Logo weitergebaut: gleiche Farben, gleiche Linienfuehrung,
   'Immo' entfaellt, 'My' bleibt — das Haus bekommt Schornstein bzw. Anbau.
   Farben direkt aus public/myimmo_logo_2048.png gemessen."""
import os
S=1024; OUT=os.path.dirname(os.path.abspath(__file__))
GOLD="#E2A94C"; GOLD_L="#F2CB86"; GOLD_D="#A87A2C"
GRUND_1="#26262B"; GRUND_2="#141416"; GRUND_3="#0A0A0B"
SERIF="Liberation Serif, FreeSerif, Times New Roman, serif"

def kopf(): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">'

def basis(i):
    return f'''
  <defs>
    <radialGradient id="bg{i}" cx="46%" cy="36%" r="84%">
      <stop offset="0%" stop-color="{GRUND_1}"/><stop offset="54%" stop-color="{GRUND_2}"/>
      <stop offset="100%" stop-color="{GRUND_3}"/>
    </radialGradient>
    <linearGradient id="au{i}" gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="850" y2="820">
      <stop offset="0%" stop-color="{GOLD_L}"/><stop offset="46%" stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="{GOLD_D}"/>
    </linearGradient>
    <filter id="sch{i}" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#000" flood-opacity="0.55"/>
    </filter>
    <linearGradient id="bo{i}" gradientUnits="userSpaceOnUse" x1="120" y1="0" x2="904" y2="0">
      <stop offset="0%" stop-color="{GOLD}" stop-opacity="0"/>
      <stop offset="22%" stop-color="{GOLD}" stop-opacity="0.85"/>
      <stop offset="78%" stop-color="{GOLD}" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="{GOLD}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#bg{i})"/>'''

def my(x, y, groesse):
    return (f'<text x="{x}" y="{y}" font-family="{SERIF}" font-size="{groesse}" '
            f'text-anchor="middle" fill="url(#auX)">My</text>')

# ---- Bausteine -------------------------------------------------------
def giebel(lx, rx, first_y, traufe_y, sockel_y):
    cx=(lx+rx)/2
    return f"M{lx},{sockel_y} V{traufe_y} L{cx},{first_y} L{rx},{traufe_y} V{sockel_y}"

def schornstein(px, py, qx, qy, x, br, hoehe):
    """Setzt den Schornstein exakt auf die Dachschraege — nicht daneben."""
    t=(x-px)/(qx-px); dach_y=py+t*(qy-py)
    t2=(x+br-px)/(qx-px); dach_y2=py+t2*(qy-py)
    return f"M{x},{dach_y:.1f} V{hoehe} H{x+br} V{dach_y2:.1f}"

# ======================================================================
# 17 — SCHORNSTEIN
# ======================================================================
def e17():
    lx,rx,first,traufe,sockel = 258,766,236,486,806
    sch = schornstein(512,236,766,486, 646, 62, 322)
    return kopf()+basis(17)+f'''
  <defs><linearGradient id="auX" gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="850" y2="820">
    <stop offset="0%" stop-color="{GOLD_L}"/><stop offset="46%" stop-color="{GOLD}"/>
    <stop offset="100%" stop-color="{GOLD_D}"/></linearGradient></defs>
  <g filter="url(#sch17)" fill="none" stroke="url(#au17)" stroke-linejoin="miter"
     stroke-miterlimit="8" stroke-linecap="butt">
    <path d="{sch}" stroke-width="24"/>
    <path d="M150,806 H874" stroke="url(#bo17)" stroke-width="16"/>
    <path d="{giebel(lx,rx,first,traufe,sockel)}" stroke-width="32"/>
  </g>
  <g filter="url(#sch17)">{my(512, 712, 208)}</g>
</svg>'''

# ======================================================================
# 18 — MODERNER ANBAU
# ======================================================================
def e18():
    lx,rx,first,traufe,sockel = 196,650,232,486,806
    ax,arx,adach = 650,832,566
    return kopf()+basis(18)+f'''
  <defs><linearGradient id="auX" gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="850" y2="820">
    <stop offset="0%" stop-color="{GOLD_L}"/><stop offset="46%" stop-color="{GOLD}"/>
    <stop offset="100%" stop-color="{GOLD_D}"/></linearGradient></defs>
  <g filter="url(#sch18)" fill="none" stroke="url(#au18)" stroke-linejoin="miter"
     stroke-miterlimit="8" stroke-linecap="butt">
    <path d="M{ax},{adach} H{arx} V{sockel}" stroke-width="24"/>
    <path d="M{ax+16},{adach+64} H{arx-14}" stroke-width="18" stroke-opacity="0.75"/>
    <path d="M150,806 H874" stroke="url(#bo18)" stroke-width="16"/>
    <path d="{giebel(lx,rx,first,traufe,sockel)}" stroke-width="32"/>
  </g>
  <g filter="url(#sch18)">{my(423, 706, 190)}</g>
</svg>'''

# ======================================================================
# 19 — SCHORNSTEIN UND ANBAU
# ======================================================================
def e19():
    lx,rx,first,traufe,sockel = 180,634,224,478,802
    ax,arx,adach = 634,844,562
    sch = schornstein(407,224,180,478, 246, 56, 306)   # linke Schraege
    return kopf()+basis(19)+f'''
  <defs><linearGradient id="auX" gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="850" y2="820">
    <stop offset="0%" stop-color="{GOLD_L}"/><stop offset="46%" stop-color="{GOLD}"/>
    <stop offset="100%" stop-color="{GOLD_D}"/></linearGradient></defs>
  <g filter="url(#sch19)" fill="none" stroke="url(#au19)" stroke-linejoin="miter"
     stroke-miterlimit="8" stroke-linecap="butt">
    <path d="{sch}" stroke-width="22"/>
    <path d="M{ax},{adach} H{arx} V{sockel}" stroke-width="24"/>
    <path d="M{ax+50},{adach+62} H{arx-38} V{sockel-58} H{ax+50} Z" stroke-width="16" stroke-opacity="0.7"/>
    <path d="M150,802 H874" stroke="url(#bo19)" stroke-width="16"/>
    <path d="{giebel(lx,rx,first,traufe,sockel)}" stroke-width="32"/>
  </g>
  <g filter="url(#sch19)">{my(407, 700, 186)}</g>
</svg>'''

# ======================================================================
# 20 — ANBAU MIT GLASFRONT
# ======================================================================
def e20():
    lx,rx,first,traufe,sockel = 192,646,228,482,804
    ax,arx,adach = 646,838,552
    sch = schornstein(419,228,192,482, 258, 54, 310)
    glas="".join(f'<path d="M{x},{adach+58} V{sockel-34}" stroke-width="14" stroke-opacity="0.7"/>'
                 for x in (698,748,798))
    return kopf()+basis(20)+f'''
  <defs><linearGradient id="auX" gradientUnits="userSpaceOnUse" x1="180" y1="200" x2="850" y2="820">
    <stop offset="0%" stop-color="{GOLD_L}"/><stop offset="46%" stop-color="{GOLD}"/>
    <stop offset="100%" stop-color="{GOLD_D}"/></linearGradient></defs>
  <g filter="url(#sch20)" fill="none" stroke="url(#au20)" stroke-linejoin="miter"
     stroke-miterlimit="8" stroke-linecap="butt">
    <path d="{sch}" stroke-width="22"/>
    <path d="M{ax},{adach} H{arx} V{sockel}" stroke-width="24"/>
    {glas}
    <path d="M{ax+18},{adach+58} H{arx-16}" stroke-width="16" stroke-opacity="0.7"/>
    <path d="M150,804 H874" stroke="url(#bo20)" stroke-width="16"/>
    <path d="{giebel(lx,rx,first,traufe,sockel)}" stroke-width="32"/>
  </g>
  <g filter="url(#sch20)">{my(419, 702, 188)}</g>
</svg>'''

for n,f in [("17-schornstein",e17),("18-anbau",e18),
            ("19-schornstein-anbau",e19),("20-anbau-glasfront",e20)]:
    open(os.path.join(OUT,n+".svg"),"w",encoding="utf-8").write(f())
    print("  ",n+".svg")
