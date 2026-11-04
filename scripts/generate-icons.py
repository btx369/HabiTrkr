"""
Generates every app icon (web favicons, PWA, Android launcher + splash) from the
HabiTrkr logo, drawn as vector geometry (ring + disc + check) so every size is crisp.

    python3 scripts/generate-icons.py        # needs Pillow

Geometry is measured from resources/icon-source.jpg (circle with a check mark).
"""
import os, struct
from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SS = 4  # supersampling factor
BLACK, WHITE = (0, 0, 0, 255), (255, 255, 255, 255)
SPLASH_BG = (237, 234, 230, 255)

def logo(px, bg=None, scale=1.0, rounded=False):
    """Render the logo on a px*px canvas. `scale` is the ring diameter / canvas."""
    n = px * SS
    im = Image.new('RGBA', (n, n), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    if bg is not None:
        if rounded:
            d.rounded_rectangle([0, 0, n - 1, n - 1], radius=n * 0.224, fill=bg)
        else:
            d.rectangle([0, 0, n, n], fill=bg)
    c, R = n / 2, n * scale / 2
    ring_w = R * 0.03
    d.ellipse([c - R, c - R, c + R, c + R], fill=BLACK)
    r2 = R - ring_w
    d.ellipse([c - r2, c - r2, c + r2, c + r2], fill=WHITE)
    r3 = R * 0.84
    d.ellipse([c - r3, c - r3, c + r3, c + r3], fill=BLACK)
    # check mark, coordinates relative to the ring centre in units of R
    u = R / 197.0
    pts = [(-96, 2), (-31, 75), (98, -65)]
    pts = [(c + x * u, c + y * u) for x, y in pts]
    w = 34 * u
    # stroke with round caps/joins: stamp discs densely along the path
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        steps = max(2, int(((x1 - x0) ** 2 + (y1 - y0) ** 2) ** 0.5))
        for i in range(steps + 1):
            x, y = x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps
            d.ellipse([x - w / 2, y - w / 2, x + w / 2, y + w / 2], fill=WHITE)
    return im.resize((px, px), Image.LANCZOS)

def save(rel, im):
    p = os.path.join(ROOT, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    im.save(p)
    print('ok', rel, im.size)

art = lambda s: logo(s, WHITE, 0.84, rounded=True)           # favicons / PWA "any"
for s, name in [(16, 'favicon-16x16'), (32, 'favicon-32x32'), (48, 'favicon-48x48'),
                (180, 'apple-touch-icon'), (192, 'icon-192'), (512, 'icon-512')]:
    save(f'public/{name}.png', art(s))
save('public/icon-maskable-512.png', logo(512, WHITE, 0.62))   # inside the 80% safe zone
save('resources/icon.png', art(1024))

DENS = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
LAUNCH = dict(zip(DENS, [48, 72, 96, 144, 192]))
FORE = dict(zip(DENS, [108, 162, 216, 324, 432]))
SPLASH = dict(zip(DENS, [480, 720, 960, 1440, 1920]))
res = 'android/app/src/main/res'
for dn in DENS:
    save(f'{res}/mipmap-{dn}/ic_launcher.png', logo(LAUNCH[dn], WHITE, 0.84, rounded=True))
    rnd = logo(LAUNCH[dn], WHITE, 0.84)
    m = Image.new('L', rnd.size, 0)
    ImageDraw.Draw(m).ellipse([0, 0, rnd.size[0] - 1, rnd.size[1] - 1], fill=255)
    rnd.putalpha(m)
    save(f'{res}/mipmap-{dn}/ic_launcher_round.png', rnd)
    fg = logo(FORE[dn], None, 0.60)  # transparent; ring inside adaptive safe zone
    save(f'{res}/mipmap-{dn}/ic_launcher_foreground.png', fg)
    save(f'{res}/mipmap-{dn}/ic_launcher_foreground_adaptive.png', fg)
    s = SPLASH[dn]
    sp = Image.new('RGBA', (s, s), SPLASH_BG)
    sp.alpha_composite(logo(round(s * 0.30), None, 1.0), (round(s * 0.35), round(s * 0.35)))
    save(f'{res}/drawable-{dn}/splash.png', sp)
    for orient, (w, h) in {'port': (s * 2 // 3, s), 'land': (s, s * 2 // 3)}.items():
        pic = Image.new('RGBA', (w, h), SPLASH_BG)
        k = round(min(w, h) * 0.30)
        pic.alpha_composite(logo(k, None, 1.0), ((w - k) // 2, (h - k) // 2))
        save(f'{res}/drawable-{orient}-{dn}/splash.png', pic)

# favicon.ico (PNG-in-ICO)
pngs = []
for s in (16, 32, 48):
    with open(os.path.join(ROOT, f'public/favicon-{s}x{s}.png'), 'rb') as f:
        pngs.append((s, f.read()))
out = struct.pack('<HHH', 0, 1, len(pngs)); off = 6 + 16 * len(pngs); body = b''
for s, b in pngs:
    out += struct.pack('<BBBBHHII', s, s, 0, 0, 1, 32, len(b), off); off += len(b); body += b
open(os.path.join(ROOT, 'public/favicon.ico'), 'wb').write(out + body)
print('ok public/favicon.ico')
