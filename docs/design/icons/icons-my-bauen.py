# -*- coding: utf-8 -*-
"""MY im Haus, auf Graphit. Vier Lesarten derselben Idee.
   Weiterhin: 1024x1024, randabfallend, keine Rundung, spaeter ohne Alphakanal."""
import os
S=1024; OUT=os.path.dirname(os.path.abspath(__file__))
GOLD_HOT,GOLD,GOLD_TIEF = "#FBE6A8","#D4A847","#9E7207"
def kopf(): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">'

def graphit(i):
    """Schwarz-grauer Grund: Anthrazit in der Mitte, fast Schwarz am Rand."""
    return f'''
  <defs>
    <radialGradient id="bg{i}" cx="50%" cy="42%" r="80%">
      <stop offset="0%"   stop-color="#2B2B30"/>
      <stop offset="55%"  stop-color="#17171A"/>
      <stop offset="100%" stop-color="#0A0A0C"/>
    </radialGradient>
    <linearGradient id="au{i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#F0CE72"/><stop offset="52%" stop-color="{GOLD}"/>
      <stop offset="100%" stop-color="{GOLD_TIEF}"/>
    </linearGradient>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#bg{i})"/>'''

# ---------------------------------------------------------------
# 9 — LIGATUR: das M ist der Giebel, seine Mitte ist das V des Y,
#     dem nur der Stamm fehlt. Zwei Buchstaben, eine Zeichnung.
# ---------------------------------------------------------------
def e9():
    m = "M232,776 V430 L372,292 L512,430 L652,292 L792,430 V776"
    y = "M512,430 V776"
    return kopf()+graphit(9)+f'''
  <path d="{m}" fill="none" stroke="url(#au9)" stroke-width="92"
        stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"/>
  <path d="{y}" fill="none" stroke="#121214" stroke-width="112" stroke-linecap="butt"/>
  <path d="{y}" fill="none" stroke="{GOLD_HOT}" stroke-width="72" stroke-linecap="butt"/>
  <path d="M232,776 V430 L372,292" fill="none" stroke="#FFFFFF" stroke-opacity="0.13"
        stroke-width="4" transform="translate(0,-42)"/>
</svg>'''

# ---------------------------------------------------------------
# 10 — MY AUSGESPART: massiver Giebel, die Buchstaben als Negativ.
# ---------------------------------------------------------------
def e10():
    # Steileres Dach und hoehere Wand: vorher las sich die Form als Schild
    # mit Deckel, das Haus muss die Buchstaben trag en, nicht umgekehrt.
    haus="M512,150 L842,470 V846 H182 V470 Z"
    return kopf()+graphit(10)+f'''
  <defs>
    <mask id="mk10">
      <rect width="{S}" height="{S}" fill="#000"/>
      <path d="{haus}" fill="#fff"/>
      <text x="512" y="742" font-family="DejaVu Serif, Georgia, serif" font-size="272"
            font-weight="700" text-anchor="middle" fill="#000" letter-spacing="4">MY</text>
    </mask>
  </defs>
  <g mask="url(#mk10)">
    <rect width="{S}" height="{S}" fill="url(#au10)"/>
    <path d="M512,150 L842,470 H182 Z" fill="#FFFFFF" fill-opacity="0.15"/>
  </g>
</svg>'''

# ---------------------------------------------------------------
# 11 — M ALS DACH, Y ALS TUER: das Y traegt das Haus von innen.
# ---------------------------------------------------------------
def e11():
    kontur="M198,802 V446 L355,300 L512,446 L669,300 L826,446 V802 Z"
    ystiel="M512,530 V802"; yarme="M414,446 L512,530 L610,446"
    return kopf()+graphit(11)+f'''
  <path d="{kontur}" fill="#101013" fill-opacity="0.85"/>
  <path d="{kontur}" fill="none" stroke="url(#au11)" stroke-width="34"
        stroke-linejoin="miter" stroke-miterlimit="10"/>
  <path d="{yarme}" fill="none" stroke="{GOLD_HOT}" stroke-width="46"
        stroke-linejoin="miter" stroke-linecap="butt"/>
  <path d="{ystiel}" fill="none" stroke="{GOLD_HOT}" stroke-width="46" stroke-linecap="butt"/>
  <path d="M198,802 H826" stroke="{GOLD_TIEF}" stroke-width="34" stroke-linecap="butt"/>
</svg>'''

# ---------------------------------------------------------------
# 12 — NEON-LIGATUR: dieselbe Ligatur als Leuchtroehre auf Graphit.
# ---------------------------------------------------------------
def e12():
    m="M244,762 V438 L376,306 L512,438 L648,306 L780,438 V762"
    y="M512,438 V762"
    def roehre(d,br,farbe=GOLD,kern=GOLD_HOT,halo=1.0):
        return (f'<path d="{d}" fill="none" stroke="{farbe}" stroke-width="{br*2.4:.0f}" '
                f'stroke-opacity="{0.15*halo:.3f}" stroke-linejoin="round" stroke-linecap="round" filter="url(#gl12)"/>'
                f'<path d="{d}" fill="none" stroke="{farbe}" stroke-width="{br*1.35:.0f}" '
                f'stroke-opacity="{0.5*halo:.3f}" stroke-linejoin="round" stroke-linecap="round"/>'
                f'<path d="{d}" fill="none" stroke="{farbe}" stroke-width="{br}" stroke-linejoin="round" stroke-linecap="round"/>'
                f'<path d="{d}" fill="none" stroke="{kern}" stroke-width="{max(2,br*0.3):.0f}" '
                f'stroke-opacity="0.95" stroke-linejoin="round" stroke-linecap="round"/>')
    raster="".join(f'<path d="M{i},0 V{S}M0,{i} H{S}"/>' for i in range(0,S+1,64))
    return kopf()+graphit(12)+f'''
  <defs>
    <filter id="gl12" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="40" result="w"/>
      <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="m"/>
      <feMerge><feMergeNode in="w"/><feMergeNode in="w"/><feMergeNode in="m"/>
               <feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <g stroke="{GOLD}" stroke-opacity="0.05" stroke-width="1" fill="none">{raster}</g>
  {roehre(m,30)}
  {roehre(y,24,halo=0.85)}
</svg>'''

for n,f in [("09-my-ligatur",e9),("10-my-ausgespart",e10),
            ("11-y-traegt-haus",e11),("12-my-neon-ligatur",e12)]:
    open(os.path.join(OUT,n+".svg"),"w",encoding="utf-8").write(f())
    print("  ",n+".svg")
