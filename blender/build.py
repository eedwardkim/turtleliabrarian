"""Run with Blender -b --factory-startup -P blender/build.py -- [asset] [--preview]."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from characters import atlas, patron, quill, shelby
from common import clear, contact_sheet, export_asset, preview
from props import book, card, cart, cloud, desk, lamp, library, shelf, sieve, stamp

BUILDERS = {
    "shelby": shelby, "quill": quill, "atlas": atlas, "patron": patron,
    "book": book, "cart": cart, "card": card, "shelf": shelf, "desk": desk,
    "lamp": lamp, "sieve": sieve, "stamp": stamp, "library": library, "cloud": cloud,
}

args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
names = [arg for arg in args if not arg.startswith("--")] or list(BUILDERS)
for name in names:
    if "--contact-only" in args:
        contact_sheet([name])
        continue
    clear()
    root = BUILDERS[name]()
    export_asset(name, root)
    if "--preview" in args:
        preview(name)
        contact_sheet([name])
if ("--preview" in args or "--contact-only" in args) and len(names) > 1:
    contact_sheet(names, angles=("three-quarter",))
