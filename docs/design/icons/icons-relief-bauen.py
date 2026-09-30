# -*- coding: utf-8 -*-
"""Monochrom in Goldwerten auf Graphit. Tiefe entsteht ausschliesslich durch
   Licht: Fase, Schlagschatten INNERHALB der Flaeche, Prägung.
   Kein zweiter Farbton. Kein Leuchten."""
import os
S=1024; OUT=os.path.dirname(os.path.abspath(__file__))

# EINE Farbe, fuenf Werte. Mehr braucht Relief nicht.
LICHT, HELL, BASIS, TIEF, KANTE = "#F8E9BC","#E2C170","#D4A847","#A87C1D","#6B4E10"
GRAPHIT_1, GRAPHIT_2, GRAPHIT_3 = "#26252A","#141317","#08080A"

def kopf(): return f'<svg xmlns="http://www.w3.org/2000/svg" width="{S}" height="{S}" viewBox="0 0 {S} {S}">'

def grund(i, hell=False):
    return f'''
  <defs>
    <radialGradient id="bg{i}" cx="42%" cy="34%" r="86%">
      <stop offset="0%" stop-color="{GRAPHIT_1}"/>
      <stop offset="52%" stop-color="{GRAPHIT_2}"/>
      <stop offset="100%" stop-color="{GRAPHIT_3}"/>
    </radialGradient>
    <linearGradient id="mt{i}" x1="0.15" y1="0" x2="0.85" y2="1">
      <stop offset="0%" stop-color="{LICHT}"/><stop offset="26%" stop-color="{HELL}"/>
      <stop offset="58%" stop-color="{BASIS}"/><stop offset="100%" stop-color="{TIEF}"/>
    </linearGradient>
  </defs>
  <rect width="{S}" height="{S}" fill="url(#bg{i})"/>'''

def fase(i, weich=9, hoehe=7, az=228):
    """Echte Fase: Glanzlicht aus der Alphakante, Licht von links oben."""
    return f'''
    <filter id="fs{i}" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="{weich}" result="b"/>
      <feSpecularLighting in="b" surfaceScale="{hoehe}" specularConstant="0.95"
          specularExponent="21" lighting-color="#FFF7E2" result="sp">
        <feDistantLight azimuth="{az}" elevation="56"/>
      </feSpecularLighting>
      <feComposite in="sp" in2="SourceAlpha" operator="in" result="spk"/>
      <feComposite in="SourceGraphic" in2="spk" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
    </filter>'''

def innenschatten(i, dx=0, dy=14, weich=13, deck=0.85):
    """Schatten INNERHALB der Form — das Mittel fuer Praegung."""
    return f'''
    <filter id="is{i}" x="-30%" y="-30%" width="160%" height="160%">
      <feOffset dx="{dx}" dy="{dy}" in="SourceAlpha" result="o"/>
      <feGaussianBlur in="o" stdDeviation="{weich}" result="ob"/>
      <feComposite operator="out" in="SourceAlpha" in2="ob" result="inv"/>
      <feFlood flood-color="#000000" flood-opacity="{deck}" result="c"/>
      <feComposite operator="in" in="c" in2="inv" result="sch"/>
      <feComposite operator="over" in="sch" in2="SourceGraphic"/>
    </filter>'''

def wurf(i, dy=26, weich=22, deck=0.62):
    return f'''
    <filter id="wf{i}" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="{dy}" stdDeviation="{weich}" flood-color="#000000" flood-opacity="{deck}"/>
    </filter>'''

# Die Ligatur: M ist der Giebel, der Stamm macht daraus das Y.
M_PFAD = "M244,764 V444 L378,306 L512,444 L646,306 L780,444 V764"
Y_STAMM = "M512,444 V764"
HAUS = "M512,196 L828,452 V830 H196 V452 Z"

def relief(i, tiefe=16, weich=12, dunkel=0.88, licht=0.5):
    """Praegung: dunkler Innenschatten von oben, helle Innenkante von unten.
       Das ist der ganze Trick — Tiefe entsteht aus zwei Kanten, nicht aus Farbe."""
    return f'''
    <filter id="rf{i}" x="-30%" y="-30%" width="160%" height="160%">
      <feOffset in="SourceAlpha" dx="0" dy="{tiefe}" result="o1"/>
      <feGaussianBlur in="o1" stdDeviation="{weich}" result="b1"/>
      <feComposite operator="out" in="SourceAlpha" in2="b1" result="i1"/>
      <feFlood flood-color="#000000" flood-opacity="{dunkel}"/>
      <feComposite operator="in" in2="i1" result="dunkel"/>
      <feOffset in="SourceAlpha" dx="0" dy="-{max(4,tiefe-4)}" result="o2"/>
      <feGaussianBlur in="o2" stdDeviation="{max(4,weich-3)}" result="b2"/>
      <feComposite operator="out" in="SourceAlpha" in2="b2" result="i2"/>
      <feFlood flood-color="#FFF4D6" flood-opacity="{licht}"/>
      <feComposite operator="in" in2="i2" result="hell"/>
      <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="dunkel"/>
               <feMergeNode in="hell"/></feMerge>
    </filter>'''

# ==================================================================
# 13 — ERHABEN: das Monogramm steht auf der Flaeche und wirft Schatten
# ==================================================================
def e13():
    voll = M_PFAD + " " + Y_STAMM
    return kopf()+grund(13)+f'''
  <defs>{fase(13, 8, 8)}{wurf(13, 32, 28, 0.72)}</defs>
  <g filter="url(#wf13)">
    <g filter="url(#fs13)">
      <path d="{voll}" fill="none" stroke="url(#mt13)" stroke-width="94"
            stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"/>
    </g>
  </g>
</svg>'''

# ==================================================================
# 14 — EINGEPRAEGT: der Giebel ist in die Graphitflaeche gedrueckt
# ==================================================================
def e14():
    voll = M_PFAD + " " + Y_STAMM
    return kopf()+grund(14)+f'''
  <defs>{relief(14, 20, 14, 0.92, 0.55)}
    <mask id="mk14">
      <rect width="{S}" height="{S}" fill="#000"/>
      <path d="{voll}" fill="none" stroke="#fff" stroke-width="98"
            stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"/>
    </mask>
    <linearGradient id="tief14" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="{TIEF}"/><stop offset="46%" stop-color="{BASIS}"/>
      <stop offset="100%" stop-color="{HELL}"/>
    </linearGradient>
  </defs>
  <g mask="url(#mk14)" filter="url(#rf14)">
    <rect width="{S}" height="{S}" fill="url(#tief14)"/>
  </g>
</svg>'''

# ==================================================================
# 15 — DOPPELRELIEF: der Giebel steht erhaben, das MY liegt darin vertieft
# ==================================================================
def e15():
    voll = M_PFAD + " " + Y_STAMM
    return kopf()+grund(15)+f'''
  <defs>{fase(15, 9, 7)}{wurf(15, 30, 26, 0.70)}{relief("15p", 15, 11, 0.62, 0.42)}
    <clipPath id="cp15"><path d="{HAUS}"/></clipPath>
    <linearGradient id="pl15" x1="0.12" y1="0" x2="0.88" y2="1">
      <stop offset="0%" stop-color="{LICHT}"/><stop offset="32%" stop-color="{HELL}"/>
      <stop offset="68%" stop-color="{BASIS}"/><stop offset="100%" stop-color="{TIEF}"/>
    </linearGradient>
    <mask id="mk15">
      <rect width="{S}" height="{S}" fill="#000"/>
      <path d="{voll}" fill="none" stroke="#fff" stroke-width="70"
            stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"
            transform="translate(512,540) scale(0.60) translate(-512,-540)"/>
    </mask>
  </defs>
  <g filter="url(#wf15)"><g filter="url(#fs15)">
    <path d="{HAUS}" fill="url(#pl15)"/>
  </g></g>
  <g clip-path="url(#cp15)">
    <g mask="url(#mk15)" filter="url(#rf15p)">
      <rect width="{S}" height="{S}" fill="{TIEF}"/>
    </g>
  </g>
</svg>'''

# ==================================================================
# 16 — GOLDPLATTE MIT PRAEGUNG: die ganze Kachel ist Metall
# ==================================================================
def e16():
    voll = M_PFAD + " " + Y_STAMM
    return kopf()+f'''
  <defs>
    <linearGradient id="pl16" x1="0.08" y1="0" x2="0.92" y2="1">
      <stop offset="0%" stop-color="{LICHT}"/><stop offset="28%" stop-color="{HELL}"/>
      <stop offset="64%" stop-color="{BASIS}"/><stop offset="100%" stop-color="{TIEF}"/>
    </linearGradient>
    {relief(16, 18, 13, 0.70, 0.60)}
    <mask id="mk16">
      <rect width="{S}" height="{S}" fill="#fff"/>
      <path d="{voll}" fill="none" stroke="#000" stroke-width="96"
            stroke-linejoin="miter" stroke-miterlimit="10" stroke-linecap="butt"/>
    </mask>
  </defs>
  <rect width="{S}" height="{S}" fill="{KANTE}"/>
  <g filter="url(#rf16)" mask="url(#mk16)">
    <rect width="{S}" height="{S}" fill="url(#pl16)"/>
  </g>
</svg>'''

for n,f in [("13-erhaben",e13),("14-eingepraegt",e14),
            ("15-geschichtet",e15),("16-goldplatte",e16)]:
    open(os.path.join(OUT,n+".svg"),"w",encoding="utf-8").write(f())
    print("  ",n+".svg")
