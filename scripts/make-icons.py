"""Draws the toolbar/store icons: a teal target on a dark rounded square."""
import sys
from pathlib import Path
from PIL import Image, ImageDraw

out = Path(sys.argv[1] if len(sys.argv) > 1 else "extension/icons")
S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=(23, 25, 26, 255))
c = S // 2
teal = (124, 196, 189, 255)
d.ellipse([c - 330, c - 330, c + 330, c + 330], outline=teal, width=96)
d.ellipse([c - 120, c - 120, c + 120, c + 120], fill=teal)
for size in (16, 32, 48, 128):
    img.resize((size, size), Image.LANCZOS).save(out / f"icon{size}.png")
print("wrote", sorted(p.name for p in out.glob("icon*.png")))
