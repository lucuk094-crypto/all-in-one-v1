#!/usr/bin/env python3
"""Generate PWA icons: black rounded square + lime down-arrow. Saved in repo so it survives."""
import os
from PIL import Image, ImageDraw

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'public', 'icons')
BG = (10, 10, 10, 255)
LIME = (204, 255, 0, 255)

def make(size):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.18), fill=BG)
    # arrow: shaft + head, centered
    cx = size / 2
    w = size * 0.16          # shaft half-width
    top = size * 0.18
    mid = size * 0.58        # where head starts
    bot = size * 0.80
    hw = size * 0.30         # head half-width
    d.rectangle([cx - w, top, cx + w, mid + 2], fill=LIME)
    d.polygon([(cx - hw, mid), (cx + hw, mid), (cx, bot)], fill=LIME)
    return img

os.makedirs(OUT, exist_ok=True)
for name, px in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    make(px).save(os.path.join(OUT, name))
    print('wrote', name)
