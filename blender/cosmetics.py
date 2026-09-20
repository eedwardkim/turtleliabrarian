"""Wearable hats and the hatchling egg; all sit on Shelby's head socket."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, wave

# Hats are modelled around the origin so the scene can parent them straight to
# Shelby's Head node without a per-hat offset.


def _hat(name):
    root = empty(name)
    return root, empty("Crown", parent=root)


def cap():
    """Reading cap: the first cosmetic, earned in the prologue."""
    root, crown = _hat("Cap")
    ellipsoid("crown", (0, 0, 0.03), (0.1, 0.105, 0.055), "green", crown,
              segments=10, rings=5)
    box("brim", (0, -0.1, 0.012), (0.15, 0.12, 0.016), "green", crown, 0.008)
    cylinder("button", (0, 0, 0.082), 0.017, 0.012, "brass", crown, vertices=8)
    merge_children(root)
    return root


def beret():
    """A soft beret for the sorting wing."""
    root, crown = _hat("Beret")
    ellipsoid("crown", (0, 0.01, 0.028), (0.115, 0.115, 0.04), "plum", crown,
              segments=12, rings=5)
    cylinder("band", (0, 0, 0.008), 0.095, 0.02, "leather_dark", crown, vertices=12)
    cylinder("stalk", (0, 0.01, 0.06), 0.008, 0.03, "plum", crown, vertices=6)
    merge_children(root)
    return root


def gradcap():
    """Graduation cap: the capstone reward."""
    root, crown = _hat("Gradcap")
    cylinder("cap", (0, 0, 0.03), 0.085, 0.06, "ink", crown, vertices=12)
    box("board", (0, 0, 0.068), (0.28, 0.28, 0.014), "ink", crown, 0.006)
    cylinder("button", (0, 0, 0.082), 0.016, 0.014, "gold", crown, vertices=8)
    tassel = empty("Tassel", (0, 0, 0.08), root)
    cylinder("cord", (0.06, 0, 0), 0.006, 0.12, "gold", tassel, vertices=6,
             rotation=(0, math.pi / 2, 0))
    cone("fringe", (0.12, 0, -0.04), 0.022, 0.008, 0.08, "gold", tassel, vertices=6)
    merge_children(root)
    clips(root, {"swing": [(tassel, "rotation_euler", wave(0.35, 1))]})
    return root


def lantern_hat():
    """Lantern hat: worn in the dark archive, it reads as a light source."""
    root, crown = _hat("LanternHat")
    ellipsoid("crown", (0, 0, 0.035), (0.1, 0.1, 0.055), "leather", crown,
              segments=10, rings=5)
    cylinder("band", (0, 0, 0.012), 0.104, 0.024, "leather_dark", crown, vertices=12)
    lamp = empty("Lantern", (0, -0.09, 0.05), root)
    cylinder("housing", (0, 0, 0), 0.032, 0.05, "brass", lamp, vertices=8,
             rotation=(math.pi / 2, 0, 0))
    ellipsoid("glow", (0, -0.026, 0), (0.026, 0.012, 0.026), "band", lamp,
              segments=8, rings=4)
    merge_children(root)
    clips(root, {"flicker": [(lamp, "location", wave(0.006, 2))]})
    return root


def beanie():
    """Knit beanie, for the long winter of joins."""
    root, crown = _hat("Beanie")
    ellipsoid("crown", (0, 0, 0.04), (0.102, 0.102, 0.07), "rose", crown,
              segments=10, rings=5)
    cylinder("cuff", (0, 0, 0.014), 0.107, 0.034, "red", crown, vertices=12)
    ellipsoid("pom", (0, 0, 0.115), (0.032, 0.032, 0.032), "paper_light", crown,
              segments=8, rings=4)
    merge_children(root)
    return root


def egg():
    """A hatchling egg; it rocks, then cracks open in the epilogue wing."""
    root = empty("Egg")
    body = empty("Body", parent=root)
    ellipsoid("egg", (0, 0, 0.09), (0.07, 0.07, 0.09), "belly", body,
              segments=10, rings=6)
    cylinder("nest", (0, 0, 0.022), 0.11, 0.045, "rim", body, vertices=12)
    shell = empty("Shell", (0, 0, 0.14), root)
    cone("cap", (0, 0, 0), 0.055, 0.02, 0.05, "belly", shell, vertices=8)
    merge_children(root)
    clips(root, {
        "rock": [(body, "rotation_euler", wave(0.18, 1))],
        "hatch": [(shell, "location", [(1, (0, 0, 0)), (25, (0, 0, 0.16)),
                                       (49, (0.16, 0.1, -0.13))]),
                  (body, "rotation_euler", wave(0.25, 1))],
    })
    return root
