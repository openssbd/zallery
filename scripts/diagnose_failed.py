"""Diagnose why each failed entry could not have its dimensions extracted."""
import csv
import json
import urllib.request
import urllib.error
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

INPUT = str(Path(__file__).parent / '../data/bff-ssbd-database-omezarr04-dims.csv')

def fetch_raw(url: str):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'python'})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, r.read().decode('utf-8', errors='replace')
    except urllib.error.HTTPError as e:
        return e.code, str(e)
    except urllib.error.URLError as e:
        return None, str(e)
    except Exception as e:
        return None, str(e)

def diagnose(file_path: str) -> str:
    base = file_path.rstrip('/')

    # 1. Check .zattrs
    status, body = fetch_raw(f'{base}/.zattrs')
    if status is None:
        return f'Network error on .zattrs: {body}'
    if status != 200:
        return f'.zattrs HTTP {status}'
    try:
        zattrs = json.loads(body)
    except Exception:
        return f'.zattrs not valid JSON'

    multiscale = zattrs.get('multiscales', [{}])[0] if zattrs.get('multiscales') else None
    if not multiscale:
        return f'.zattrs has no multiscales key (keys: {list(zattrs.keys())})'

    axes = [ax['name'] for ax in multiscale.get('axes', [])]
    if not axes:
        return f'multiscales[0].axes is empty or missing'

    datasets = multiscale.get('datasets')
    if not datasets:
        return f'multiscales[0].datasets is empty or missing'

    first_ds_path = datasets[0].get('path', '0')

    # 2. Check .zarray
    status2, body2 = fetch_raw(f'{base}/{first_ds_path}/.zarray')
    if status2 is None:
        return f'Network error on .zarray: {body2}'
    if status2 != 200:
        return f'.zarray HTTP {status2} (path: {first_ds_path})'
    try:
        zarray = json.loads(body2)
    except Exception:
        return f'.zarray not valid JSON'

    shape = zarray.get('shape', [])
    if not shape:
        return f'.zarray has no shape'

    if len(shape) != len(axes):
        return f'shape length {len(shape)} != axes length {len(axes)} (axes={axes}, shape={shape})'

    return 'OK (should not appear here)'

with open(INPUT) as f:
    rows = list(csv.DictReader(f))

failed = [(r['SSBD:database ID'], r['Dataset'], r['File Path'])
          for r in rows if not r.get('Dimensions', '').strip()]

print(f'Diagnosing {len(failed)} failed entries...\n')

results = {}
with ThreadPoolExecutor(max_workers=20) as exe:
    future_map = {exe.submit(diagnose, fp): (db_id, ds, fp) for db_id, ds, fp in failed}
    for future in future_map:
        db_id, ds, fp = future_map[future]
        reason = future.result()
        results[(db_id, ds, fp)] = reason

# Group by reason
from collections import Counter
reason_counter = Counter(results.values())
print('=== Summary by cause ===')
for reason, count in reason_counter.most_common():
    print(f'  {count:3d}  {reason}')

print('\n=== Full list ===')
for (db_id, ds, fp), reason in sorted(results.items()):
    print(f'{db_id} | {ds} | {reason}')
    print(f'  {fp}')
