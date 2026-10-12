#!/usr/bin/env python3
"""Génère icons/apple-touch-icon.png (180 × 180, opaque, pleine) à partir des formes de icons/apple-touch-icon.svg.

Aucune dépendance : rendu par échantillonnage des formes, PNG écrit avec zlib/struct.
iOS fige l'icône au moment de l'ajout à l'écran d'accueil et remplit en noir les zones transparentes ;
l'image est donc entièrement opaque, sans coins arrondis (iOS applique son propre masque).

Usage : python3 -I tools/make-apple-touch-icon.py icons/apple-touch-icon.png
"""
import math
import struct
import sys
import zlib

SIZE = 180      # pixels de sortie (taille attendue par iOS pour apple-touch-icon)
UNITS = 256.0   # repère du SVG (viewBox 0 0 256 256)
SS = 3          # sur-échantillonnage par axe (anti-crénelage)

BG = (0x1F, 0x4D, 0x3A)     # vert profond
CREAM = (0xF6, 0xF1, 0xE7)  # crème
SAGE = (0x9F, 0xB8, 0xA4)   # sauge
INK = BG


def seg_dist(px, py, ax, ay, bx, by):
    vx, vy = bx - ax, by - ay
    wx, wy = px - ax, py - ay
    l2 = vx * vx + vy * vy
    t = 0.0 if l2 == 0 else max(0.0, min(1.0, (wx * vx + wy * vy) / l2))
    return math.hypot(ax + t * vx - px, ay + t * vy - py)


def bezier(p0, p1, p2, p3, n=40):
    pts = []
    for i in range(n + 1):
        t = i / n
        u = 1 - t
        pts.append((
            u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
            u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
        ))
    return pts


def polyline(pts):
    return [(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]) for i in range(len(pts) - 1)]


# Traits du SVG : largeur 8, extrémités rondes. Fourchette (trois dents) et cuillère (courbe puis manche).
STROKES = [
    (96, 100, 96, 160), (116, 100, 116, 160), (106, 100, 106, 128),
    *polyline(bezier((158, 100), (170, 108), (170, 130), (158, 136))),
    (158, 136, 158, 160),
]
STROKE_R = 4.0
# Boîte englobante des traits, élargie du rayon : évite de tester chaque segment pour chaque échantillon.
BBOX = (96 - STROKE_R, 100 - STROKE_R, 170 + STROKE_R, 160 + STROKE_R)


def sample(x, y):
    d = math.hypot(x - 128, y - 128)
    if d > 76:                      # hors de l'assiette crème
        return BG
    color = SAGE if abs(d - 58) <= 3 else CREAM   # anneau sauge : rayon 58, largeur 6
    if BBOX[0] <= x <= BBOX[2] and BBOX[1] <= y <= BBOX[3]:
        for ax, ay, bx, by in STROKES:
            if seg_dist(x, y, ax, ay, bx, by) <= STROKE_R:
                return INK
    return color


def render():
    scale = UNITS / SIZE
    n = SS * SS
    rows = []
    for j in range(SIZE):
        row = bytearray([0])        # type de filtre PNG : aucun
        for i in range(SIZE):
            r = g = b = 0
            for sj in range(SS):
                for si in range(SS):
                    c = sample((i + (si + 0.5) / SS) * scale, (j + (sj + 0.5) / SS) * scale)
                    r += c[0]
                    g += c[1]
                    b += c[2]
            row += bytes((round(r / n), round(g / n), round(b / n)))
        rows.append(bytes(row))
    return b''.join(rows)


def chunk(tag, data):
    return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)


def png(raw):
    ihdr = struct.pack('>IIBBBBB', SIZE, SIZE, 8, 2, 0, 0, 0)   # 8 bits par canal, RVB, sans alpha
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else 'icons/apple-touch-icon.png'
    with open(out, 'wb') as f:
        f.write(png(render()))
    print(f'{out} : {SIZE} × {SIZE}, RVB opaque')
