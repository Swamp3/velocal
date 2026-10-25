#!/usr/bin/env python3
"""
Adds series (cup runs, league matchdays) and age classes to an event import file, derived from
event names and ids. Writes a new file and never changes the input. Review the result in
Admin → Imports → Import file before importing.

Usage: python3 scripts/enrich-import.py events.json events-enriched.json

Only clear patterns are used. Events that already have "series" or "classes" are left as they are.
Extend CUP_RULES for new series; see docs/IMPORT-FILE-FORMAT.md for the fields.
"""
import json
import re
import sys
import unicodedata

SEASON = "2026/27"

# (pattern on name or externalId, key, series name, kind, season, round pattern)
CUP_RULES = [
    (r"stevens", "stevens-cyclocross-cup-2026-27", "STEVENS CycloCross-Cup", "cup", SEASON, None),
    (r"gunsha", "gunsha-cross-challenge-2026-27", "GUNSHA Cross Challenge", "cup", SEASON, r"(\d+)\.\s*Lauf"),
    (r"weser-ems", "weser-ems-cup-2026-27", "Weser-Ems Cup", "cup", SEASON, None),
    (r"crossmania", "crossmania-2026-27", "crossmania", "cup", SEASON, r"#(\d+)"),
    (r"cyclo-cross bundesliga|cyclocross-bundesliga", "cyclo-cross-bundesliga-2026-27", "Cyclo-Cross Bundesliga", "cup", SEASON, None),
    (r"cx-cup n(ds|iedersachsen)|cx-cup-niedersachsen", "cx-cup-niedersachsen-2026-27", "CX-Cup Niedersachsen", "cup", SEASON, r"(\d+)\.\s*Lauf"),
    (r"elektroland24", "elektroland24-cyclocross-cup-2026-27", "Elektroland24.de Cyclocross Cup", "cup", SEASON, r"(\d+)\.\s*Lauf"),
    (r"^nrw-cross-cup", "nrw-cross-cup-2026-27", "NRW Cross-Cup", "cup", SEASON, None),
    (r"bmx freestyle nachwuchsserie", "bmx-freestyle-nachwuchsserie-2026", "BMX Freestyle Nachwuchsserie", "series", "2026", r"(\d+)\.\s*Stopp"),
]

# Radball/Radpolo age groups: U13 = 11 and 12 years in the season's year, and so on.
AGE_GROUP = re.compile(r"\bU\s?(11|13|15|17|19)\b")
LEAGUE = re.compile(r"^Radball\s+—\s+(.+?)\s+—\s+(.+)$")
ROUND = re.compile(r"(\d+)\s*\.\s*Spieltag", re.I)


def slug(text):
    text = text.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:150]


def league_season(text):
    if "2026/2027" in text or "2026/27" in text:
        return SEASON
    m = re.search(r"\b(20\d\d)\b", text)
    return m.group(1) if m else None


def classes_from(name):
    found = []
    for m in AGE_GROUP.finditer(name):
        limit = int(m.group(1))
        found.append({"name": f"U{limit}", "category": f"u{limit}", "ageMin": limit - 2, "ageMax": limit - 1})
    if re.search(r"\bFrauen\b", name):
        if found:
            for c in found:
                c["gender"] = "female"
                c["name"] += " weiblich"
        else:
            found.append({"name": "Frauen", "gender": "female"})
    # One class per age group, even if the name repeats it.
    unique = {c["name"]: c for c in found}
    return list(unique.values())


def enrich(event):
    added = []
    name = event["name"]
    ident = event.get("externalId", "")
    if "series" not in event:
        league = LEAGUE.match(name)
        if league:
            title, rest = league.group(1), league.group(2)
            series = {"key": "radball-" + slug(title), "name": "Radball " + title, "kind": "league"}
            season = league_season(title)
            if season:
                series["season"] = season
            r = ROUND.search(rest)
            if r:
                series["round"] = int(r.group(1))
            series["roundLabel"] = rest.strip()[:100]
            event["series"] = series
            added.append("league")
        else:
            for pattern, key, title, kind, season, round_pattern in CUP_RULES:
                if re.search(pattern, name, re.I) or re.search(pattern, ident, re.I):
                    series = {"key": key, "name": title, "kind": kind, "season": season}
                    if round_pattern:
                        r = re.search(round_pattern, name, re.I)
                        if r:
                            series["round"] = int(r.group(1))
                    event["series"] = series
                    added.append("cup" if kind == "cup" else "series")
                    break
    if "classes" not in event and name.startswith("Radball"):
        classes = classes_from(name)
        if classes:
            event["classes"] = classes
            added.append("classes")
    return added


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    with open(sys.argv[1], encoding="utf-8") as f:
        data = json.load(f)
    counts = {}
    for event in data.get("events", []):
        for kind in enrich(event):
            counts[kind] = counts.get(kind, 0) + 1
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    series = {e["series"]["key"] for e in data["events"] if "series" in e}
    print(f"events: {len(data['events'])}")
    print(f"series links: league {counts.get('league', 0)}, cup {counts.get('cup', 0)}, other {counts.get('series', 0)}")
    print(f"distinct series: {len(series)}")
    print(f"events with classes: {counts.get('classes', 0)}")


if __name__ == "__main__":
    main()
