from pathlib import Path
import re
import urllib.request

root = Path(__file__).resolve().parent.parent
target = root / 'assets' / 'fonts'
target.mkdir(exist_ok=True)
url = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400..800&display=optional'
request = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'})
css = urllib.request.urlopen(request).read().decode()
parts = []
for subset, block in re.findall(r'/\* (.*?) \*/\s*(@font-face\s*\{.*?\})', css, re.S):
    if subset not in ['cyrillic', 'cyrillic-ext', 'latin', 'latin-ext']:
        continue
    remote = re.search(r'url\((.*?)\)', block).group(1)
    extension = remote.rsplit('.', 1)[-1]
    name = f'montserrat-{subset}.{extension}'
    (target / name).write_bytes(urllib.request.urlopen(remote).read())
    parts.append(block.replace(remote, f'./fonts/{name}'))
if not parts:
    raise RuntimeError('No expected font subsets; inspect provider response')
(root / 'assets' / 'fonts.css').write_text('\n'.join(parts), encoding='utf-8')
license_url = 'https://raw.githubusercontent.com/google/fonts/main/ofl/montserrat/OFL.txt'
(target / 'OFL.txt').write_bytes(urllib.request.urlopen(license_url).read())
print('Self-hosted Montserrat subsets:', len(parts))
