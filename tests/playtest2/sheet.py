# Contact sheet: python3 tests/playtest2/sheet.py out.png cols scale img1.png img2.png ...
import sys
from PIL import Image, ImageDraw
out, cols, scale = sys.argv[1], int(sys.argv[2]), float(sys.argv[3])
files = sys.argv[4:]
ims = [Image.open(f).convert('RGB') for f in files]
w = int(ims[0].width * scale); h = int(ims[0].height * scale)
rows = (len(ims) + cols - 1) // cols
sheet = Image.new('RGB', (cols * w, rows * (h + 16)), 'black')
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(zip(files, ims)):
    im = im.resize((w, int(im.height * w / im.width)))
    x, y = (i % cols) * w, (i // cols) * (h + 16)
    sheet.paste(im, (x, y + 16))
    d.text((x + 4, y + 2), f.split('/')[-1], fill='yellow')
sheet.save(out)
