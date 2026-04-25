"""Apply a dict of translations to a Russian gamedata JSON file.

Default target is variantrule.json (left for backwards compat with old
batch scripts). New batches should pass `path=` explicitly, e.g.:

    apply(TRANSLATIONS, path=r'.../ru/optionalfeatures.json')
"""
import json, sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

TRANSLATIONS = {}  # Will be populated by batch scripts

DEFAULT_PATH = r'C:\Projects\dnd-character-manager\src\i18n\gamedata\ru\variantrule.json'

def apply(translations, path=DEFAULT_PATH):
    with open(path, encoding='utf-8') as f:
        data = json.load(f)
    applied, missing = 0, []
    for k, v in translations.items():
        if k in data:
            data[k] = v
            applied += 1
        else:
            missing.append(k)
    # Write with 2-space indent, no trailing whitespace
    # Preserve key order: Python dict preserves insertion, and json.load preserves order too
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write('\n')
    print(f"Applied {applied}; missing {len(missing)}: {missing[:5]}")
