"""Inline Saduq logo and photos into promo.src.html → index.html (one self-contained file)."""
import base64, pathlib, re

HERE = pathlib.Path(__file__).parent
ASSETS = HERE.parent / 'assets'

def data_uri(path):
    mime = 'image/png' if path.suffix == '.png' else 'image/jpeg'
    return f'data:{mime};base64,' + base64.b64encode(path.read_bytes()).decode()

def asset(name):
    if name == 'mark':
        return ASSETS / 'brand' / 'saduq-mark.png'
    return ASSETS / 'photos' / f'{name}.jpg'

src = (HERE / 'promo.src.html').read_text(encoding='utf-8')
cache = {}
out = re.sub(r'\{\{([\w-]+)\}\}', lambda m: cache.setdefault(m[1], data_uri(asset(m[1]))), src)
(HERE / 'index.html').write_text(out, encoding='utf-8')
print('wrote', HERE / 'index.html', f'{len(out) / 1024:.0f} KB')
