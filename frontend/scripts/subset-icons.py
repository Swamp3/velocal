#!/usr/bin/env python3
"""
Rebuilds src/assets/fonts/material-symbols-subset.woff2: the Material Symbols
font reduced to the icons the app uses, so the first load stays small.

Run after adding an icon (an icon missing from the subset renders as an empty
box or its name):

    python3 -m venv /tmp/icons && /tmp/icons/bin/pip install fonttools brotli
    /tmp/icons/bin/python scripts/subset-icons.py

Icons are found in templates and components: the text of
`<span class="material-symbols-outlined">name</span>` (also inside `{{ }}`
expressions) and `icon="name"` / `icon: 'name'` values.
"""
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SOURCE_FONT = (
    ROOT
    / 'node_modules/@fontsource-variable/material-symbols-outlined/files'
    / 'material-symbols-outlined-latin-wght-normal.woff2'
)
TARGET = ROOT / 'src/assets/fonts/material-symbols-subset.woff2'

WORD = re.compile(r"[a-z][a-z0-9_]*")
SPAN = re.compile(r'class="[^"]*material-symbols-outlined[^"]*"[^>]*>(.*?)</span', re.S)
ICON_ATTR = re.compile(r"""\bicon\w*\s*[=:]\s*(?:"'?([a-z0-9_]+)'?"|'([a-z0-9_]+)')""")
ICON_FIELD = re.compile(r"""\bicon\w*\s*:\s*'([a-z0-9_]+)'""")


def ligature_names(font: TTFont) -> set[str]:
    cmap = font.getBestCmap()
    rev = {glyph: chr(code) for code, glyph in cmap.items()}
    names: set[str] = set()
    for lookup in font['GSUB'].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            for first, ligs in getattr(sub, 'ligatures', {}).items():
                for lig in ligs:
                    try:
                        names.add(''.join(rev[g] for g in [first, *lig.Component]))
                    except KeyError:
                        pass
    return names


def prune_ligatures(font: TTFont, keep: set[str]) -> None:
    """Drops the ligatures of every icon that is not used, before subsetting."""
    cmap = font.getBestCmap()
    rev = {glyph: chr(code) for code, glyph in cmap.items()}
    for lookup in font['GSUB'].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, 'ExtSubTable', sub)
            ligatures = getattr(sub, 'ligatures', None)
            if not ligatures:
                continue
            for first in list(ligatures):
                kept = []
                for lig in ligatures[first]:
                    try:
                        name = ''.join(rev[g] for g in [first, *lig.Component])
                    except KeyError:
                        continue
                    if name in keep:
                        kept.append(lig)
                if kept:
                    ligatures[first] = kept
                else:
                    del ligatures[first]


def used_icons(known: set[str]) -> set[str]:
    found: set[str] = set()
    # Icons that come from the database (disciplines), not from templates.
    for path in (ROOT.parent / 'backend/src').rglob('*.ts'):
        found.update(
            w for w in re.findall(r"icon: '([a-z0-9_]+)'", path.read_text(encoding='utf-8')) if w in known
        )
    for path in list((ROOT / 'src').rglob('*.html')) + list((ROOT / 'src').rglob('*.ts')):
        text = path.read_text(encoding='utf-8')
        for inner in SPAN.findall(text):
            found.update(w for w in WORD.findall(inner) if w in known)
        for m in ICON_ATTR.finditer(text):
            found.update(g for g in m.groups() if g and g in known)
        found.update(w for w in ICON_FIELD.findall(text) if w in known)
    return found


def main() -> int:
    if not SOURCE_FONT.exists():
        print(f'Missing {SOURCE_FONT}; run pnpm install first', file=sys.stderr)
        return 1
    known = ligature_names(TTFont(SOURCE_FONT))
    icons = used_icons(known)
    print(f'{len(icons)} icons: {" ".join(sorted(icons))}')

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['liga', 'rlig', 'calt']
    options.notdef_outline = True
    options.glyph_names = False
    font = subset.load_font(str(SOURCE_FONT), options)
    prune_ligatures(font, icons)
    subsetter = subset.Subsetter(options)
    # Lowercase letters, digits and the underscore spell the ligatures.
    subsetter.populate(text='abcdefghijklmnopqrstuvwxyz0123456789_ ')
    subsetter.subset(font)
    subset.save_font(font, str(TARGET), options)
    print(f'wrote {TARGET} ({TARGET.stat().st_size} bytes)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
