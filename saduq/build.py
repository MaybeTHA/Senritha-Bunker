"""Build Saduq into one HTML page: dist/index.html (+ dist/assets/photos).
Usage (from this folder):  python3 build.py      needs Node (npx esbuild)"""
import subprocess, sys, os, shutil, base64
os.chdir(os.path.dirname(os.path.abspath(__file__)))
os.makedirs('dist', exist_ok=True)
r = subprocess.run(['npx', '-y', 'esbuild@0.28.2', 'src/main.js', '--bundle', '--format=esm', '--minify', '--outfile=dist/app.js', '--log-level=warning'])
if r.returncode: sys.exit(1)
b64 = lambda p: 'data:image/png;base64,' + base64.b64encode(open(p, 'rb').read()).decode()
MARK, FAV = b64('assets/brand/saduq-mark.png'), b64('assets/brand/favicon.png')
css = open('src/styles/app.css', encoding='utf8').read() + '\n' + open('src/styles/hub.css', encoding='utf8').read()
js = open('dist/app.js', encoding='utf8').read().replace('</script', '<\\/script').replace('__MARK__', MARK)
os.remove('dist/app.js')
body = open('body.html', encoding='utf8').read().replace('__MARK__', MARK)
fonts = 'https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&family=Noto+Sans+Thai+Looped:wght@400;500;600;700&family=Mali:wght@500;600;700&family=Nunito:wght@900&display=swap'
html = f'''<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Saduq</title>
<meta name="description" content="Saduq ศูนย์รวมบริการสำหรับผู้สูงอายุและครอบครัว">
<meta name="theme-color" content="#FFFFFF">
<meta name="color-scheme" content="light">
<link rel="icon" href="{FAV}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="{fonts}">
<style>
[hidden] {{ display: none !important; }}
{css}
</style>
</head>
<body>
{body}
<script type="module">
{js}
</script>
</body>
</html>
'''
open('dist/index.html', 'w', encoding='utf8').write(html)
shutil.copytree('assets/photos', 'dist/assets/photos', dirs_exist_ok=True)
print('dist/index.html', len(html), 'bytes')
