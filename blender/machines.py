"""Workroom machines: the scale, the copying press and the gold thread spool."""

import math

from common import box, clips, cylinder, ellipsoid, empty, merge_children, wave


def scale():
    """A balance scale; group sums tip the pans."""
    root = empty("Scale")
    body = empty("Body", parent=root)
    cylinder("base", (0, 0, 0.05), 0.24, 0.1, "leather", body)
    cylinder("column", (0, 0, 0.42), 0.035, 0.66, "brass", body, vertices=8)
    beam = empty("Beam", (0, 0, 0.78), root)
    box("beam", (0, 0, 0), (0.86, 0.05, 0.045), "brass", beam)
    ellipsoid("pivot", (0, 0, 0.035), (0.055, 0.055, 0.045), "brass", beam,
              segments=8, rings=4)
    pans = []
    for side, label in ((-1, "Pan_L"), (1, "Pan_R")):
        pan = empty(label, (side * 0.4, 0, -0.26), beam)
        cylinder("pan", (0, 0, 0), 0.17, 0.02, "shell_top", pan)
        cylinder("lip", (0, 0, 0.035), 0.17, 0.05, "rim", pan)
        for x, y in ((-0.12, 0), (0.12, 0), (0, 0.12)):
            cylinder("wire", (x, y, 0.14), 0.006, 0.26, "brass", pan, vertices=6)
        pans.append(pan)
    merge_children(root)
    clips(root, {"weigh": [(beam, "rotation_euler", wave(0.16, 1)),
                           (pans[0], "location", wave(-0.06, 2)),
                           (pans[1], "location", wave(0.06, 2))]})
    return root


def press():
    """The copying press duplicates a key with k matches."""
    root = empty("Press")
    body = empty("Body", parent=root)
    box("bed", (0, 0, 0.09), (0.86, 0.6, 0.18), "leather", body, 0.025)
    box("tray", (0, -0.03, 0.2), (0.6, 0.42, 0.05), "shell_top", body, 0.012)
    for x in (-0.36, 0.36):
        box("frame", (x, 0.16, 0.6), (0.09, 0.14, 0.84), "leather_dark", body, 0.018)
    box("crown", (0, 0.16, 1.02), (0.83, 0.16, 0.1), "brass", body, 0.02)
    cylinder("screw", (0, 0.16, 0.88), 0.045, 0.34, "brass", body, vertices=10)
    plate = empty("Platen", (0, 0.02, 0.44), root)
    box("platen", (0, 0, 0), (0.58, 0.4, 0.09), "brass", plate, 0.02)
    cylinder("post", (0, 0.14, 0.16), 0.03, 0.24, "brass", plate, vertices=8)
    wheel = empty("Wheel", (0, 0.16, 1.02), root)
    cylinder("hub", (0, 0, 0), 0.06, 0.08, "brass", wheel, vertices=8,
             rotation=(math.pi / 2, 0, 0))
    for index in range(4):
        angle = math.tau * index / 4
        spoke = box("spoke", (math.cos(angle) * 0.17, 0, math.sin(angle) * 0.17),
                    (0.05, 0.05, 0.3), "brass", wheel)
        spoke.rotation_euler = (0, angle + math.pi / 2, 0)
    merge_children(root)
    clips(root, {"press": [(plate, "location", [(1, (0, 0, 0)), (20, (0, 0, -0.2)),
                                                (32, (0, 0, -0.2)), (49, (0, 0, 0))]),
                           (wheel, "rotation_euler", [(1, (0, 0, 0)), (20, (0, 1.6, 0)),
                                                      (49, (0, 1.6, 0))])]})
    return root


def spool():
    """Gold thread pays out between matching join keys."""
    root = empty("Spool")
    body = empty("Body", parent=root)
    box("stand", (0, 0, 0.05), (0.34, 0.26, 0.1), "leather", body, 0.015)
    for x in (-0.14, 0.14):
        box("arm", (x, 0, 0.21), (0.045, 0.05, 0.28), "brass", body, 0.008)
    reel = empty("Reel", (0, 0, 0.3), root)
    cylinder("thread", (0, 0, 0), 0.105, 0.17, "gold", reel, vertices=12,
             rotation=(0, math.pi / 2, 0))
    for x in (-0.095, 0.095):
        cylinder("flange", (x, 0, 0), 0.13, 0.02, "brass", reel, vertices=12,
                 rotation=(0, math.pi / 2, 0))
    merge_children(root)
    clips(root, {"spin": [(reel, "rotation_euler", [(1, (0, 0, 0)),
                                                    (49, (math.tau, 0, 0))])]})
    return root
