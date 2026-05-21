"""
Read bff-ssbd-database-omezarr04.csv, fetch zarr metadata for each File Path,
extract X/Y/Z/C/T dimensions, and write a new CSV with a Dimensions column.
"""
import csv
import json
import sys
import urllib.request
import urllib.error
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

INPUT   = Path(__file__).parent / '../data/bff-ssbd-database-omezarr04.csv'
OUTPUT  = Path(__file__).parent / '../data/bff-ssbd-database-omezarr04-dims.csv'
WORKERS = 30

def fetch_json(url: str):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'python'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.loads(r.read())
    except Exception:
        return None

def get_dims(file_path: str) -> str:
    """Return 'X x Y x Z x C x T' for the given zarr group URL."""
    base = file_path.rstrip('/')

    zattrs = fetch_json(f'{base}/.zattrs')
    if not zattrs:
        return ''

    multiscale = zattrs.get('multiscales', [{}])[0]
    axes = [ax['name'] for ax in multiscale.get('axes', [])]
    first_ds_path = (multiscale.get('datasets') or [{}])[0].get('path', '0')

    zarray = fetch_json(f'{base}/{first_ds_path}/.zarray')
    if not zarray:
        return ''

    shape: list = zarray.get('shape', [])
    if len(shape) != len(axes):
        return ''

    dim = {ax: sz for ax, sz in zip(axes, shape)}
    x = dim.get('x', 1)
    y = dim.get('y', 1)
    z = dim.get('z', 1)
    c = dim.get('c', 1)
    t = dim.get('t', 1)
    return f'{x} x {y} x {z} x {c} x {t}'

# ── Main ──────────────────────────────────────────────────────────────────────
with open(INPUT, newline='', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    fieldnames = list(reader.fieldnames or [])
    rows = list(reader)

if 'Dimensions' not in fieldnames:
    fieldnames = fieldnames + ['Dimensions']

unique_paths = [r['File Path'].strip() for r in rows if r.get('File Path', '').strip()]
unique_paths = list(dict.fromkeys(unique_paths))  # deduplicate while preserving order
total = len(unique_paths)
print(f'Fetching dimensions for {total} unique paths with {WORKERS} workers…', flush=True)

cache: dict[str, str] = {}
done = 0

with ThreadPoolExecutor(max_workers=WORKERS) as exe:
    future_to_path = {exe.submit(get_dims, p): p for p in unique_paths}
    for future in as_completed(future_to_path):
        path = future_to_path[future]
        dims = future.result()
        cache[path] = dims
        done += 1
        if done % 100 == 0 or done == total:
            print(f'  {done}/{total}  last: {path.split("/")[-1]}  → {dims or "(failed)"}',
                  flush=True)

failed = sum(1 for v in cache.values() if not v)
print(f'\nFetch complete. Failed: {failed}/{total}', flush=True)

for row in rows:
    fp = row.get('File Path', '').strip()
    row['Dimensions'] = cache.get(fp, '')

with open(OUTPUT, 'w', newline='', encoding='utf-8') as f:
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(rows)

print(f'Written → {OUTPUT}')
