"""Run with Blender -b --factory-startup -P blender/build.py -- [asset] [--preview]."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from characters import atlas, hatchling, patron, quill, shelby
from common import clear, contact_sheet, export_asset, preview
from cosmetics import beanie, beret, cap, egg, gradcap, lantern_hat
from creatures import badger, bookworm, geese, hedgehog, heron, magpie, newt
from fixtures import (archive, board, cabinet, ledger, lost_found, request, sky, slip,
                      sorting_bin, stairs, trapdoor, wing)
from machines import press, scale, spool
from props import book, card, cart, cloud, desk, lamp, library, shelf, sieve, stamp
from stats import bookends, chute, flag, galton, grid, jar, marble, residual

BUILDERS = {
    "shelby": shelby, "quill": quill, "atlas": atlas, "patron": patron,
    "hatchling": hatchling,
    "heron": heron, "badger": badger, "newt": newt, "geese": geese,
    "hedgehog": hedgehog, "bookworm": bookworm, "magpie": magpie,
    "book": book, "cart": cart, "card": card, "shelf": shelf, "desk": desk,
    "lamp": lamp, "sieve": sieve, "stamp": stamp, "library": library, "cloud": cloud,
    "slip": slip, "request": request, "cabinet": cabinet, "ledger": ledger,
    "bin": sorting_bin, "lost_found": lost_found, "board": board,
    "trapdoor": trapdoor, "stairs": stairs, "archive": archive, "wing": wing,
    "sky": sky,
    "scale": scale, "press": press, "spool": spool,
    "jar": jar, "marble": marble, "flag": flag, "bookends": bookends,
    "residual": residual, "grid": grid, "galton": galton, "chute": chute,
    "cap": cap, "beret": beret, "gradcap": gradcap, "lantern_hat": lantern_hat,
    "beanie": beanie, "egg": egg,
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
if ("--preview" in args or "--contact-only" in args) and set(names) == set(BUILDERS):
    contact_sheet(names, angles=("three-quarter",))
