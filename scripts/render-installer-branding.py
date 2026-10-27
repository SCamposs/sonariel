"""Render committed NSIS artwork; development-only Pillow, no runtime dependency.

Run after npm ci with a Python that has Pillow installed. Uses the same OFL
font files as the desktop, without installing fonts on the user's computer.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src-tauri" / "installer"
SCALE = 4
INK, PAPER, AMBER, MINT, RULE = "#130f18", "#ede7d9", "#f4ae38", "#76d8bb", "#3e3745"


def font(family, weight, size):
    path = ROOT / "node_modules" / "@fontsource" / family / "files" / f"{family}-latin-{weight}-normal.woff"
    return ImageFont.truetype(str(path), round(size * SCALE))


def canvas(width, height, color):
    image = Image.new("RGB", (width * SCALE, height * SCALE), color)
    return image, ImageDraw.Draw(image)


def rect(draw, box, color):
    draw.rectangle(tuple(round(value * SCALE) for value in box), fill=color)


def text(draw, xy, value, family, weight, size, color):
    draw.text(tuple(round(value * SCALE) for value in xy), value, font=font(family, weight, size), fill=color)


def mark(draw, x, y, size):
    # Original Sonariel audio mark from assets/icon.svg, same geometry/palette.
    for box, color in [((120, 210, 156, 302), AMBER), ((188, 136, 224, 376), AMBER),
                       ((256, 168, 292, 344), AMBER), ((324, 232, 360, 280), AMBER),
                       ((188, 136, 224, 190), MINT), ((120, 210, 156, 248), PAPER)]:
        rect(draw, (x + box[0] / 512 * size, y + box[1] / 512 * size,
                    x + box[2] / 512 * size, y + box[3] / 512 * size), color)


def save(image, name, size):
    image.resize(size, Image.Resampling.LANCZOS).save(OUT / name, format="BMP")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    image, draw = canvas(164, 314, INK)
    rect(draw, (0, 0, 163, 2), AMBER)
    rect(draw, (163, 3, 163, 313), RULE)
    mark(draw, -4, 11, 98)
    text(draw, (17, 94), "Sonariel", "urbanist", 700, 25, PAPER)
    text(draw, (18, 129), "LOCAL AUDIO", "barlow", 500, 10, PAPER)
    text(draw, (18, 142), "WORKSPACE", "barlow", 500, 10, PAPER)
    rect(draw, (18, 172, 145, 172), RULE)
    # A static audio mark, not a simulated progress indicator or telemetry.
    heights = [6, 12, 22, 35, 48, 29, 16, 9, 18, 31, 21, 12, 6]
    for index, height in enumerate(heights):
        x = 20 + index * 9
        rect(draw, (x, 218 - height / 2, x + 2, 218 + height / 2), AMBER if index < 5 else RULE)
    rect(draw, (18, 264, 145, 264), RULE)
    text(draw, (18, 280), "MUSIC / VOICE / FX", "jetbrains-mono", 400, 8, PAPER)
    save(image, "sidebar.bmp", (164, 314))

    image, draw = canvas(150, 57, PAPER)
    rect(draw, (0, 0, 149, 56), INK)
    rect(draw, (0, 54, 149, 56), AMBER)
    mark(draw, -5, 0, 57)
    text(draw, (44, 17), "Sonariel", "urbanist", 700, 21, PAPER)
    save(image, "header.bmp", (150, 57))


if __name__ == "__main__":
    main()
