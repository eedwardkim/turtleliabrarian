"""Original modular furniture; each family is exportable without the scene."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, wave


def book():
    root = empty("Book")
    cover = empty("Cover", parent=root)
    pages = empty("Pages", parent=root)
    band = empty("Band", parent=root)
    for x in (-0.034, 0.034):
        box("cover", (x, 0, 0.125), (0.007, 0.16, 0.25), "blue", cover)
    box("spine", (0, -0.077, 0.125), (0.065, 0.006, 0.25), "blue", cover)
    box("pages", (0, 0.004, 0.125), (0.06, 0.143, 0.235), "pages", pages)
    box("plate", (0, -0.082, 0.155), (0.048, 0.003, 0.045), "band", band)
    merge_children(root)
    return root


def cart():
    root = empty("Cart")
    body = empty("Body", parent=root)
    for z in (0.14, 0.52):
        box("shelf", (0, 0, z), (1.04, 0.54, 0.055), "leather", body, 0.015)
    for x in (-0.49, 0.49):
        for y in (-0.23, 0.23):
            cylinder("upright", (x, y, 0.4), 0.019, 0.55, "brass", body, vertices=8)
            cylinder("wheel", (x, y, 0.072), 0.068, 0.042, "ink", body,
                     vertices=10, rotation=(0, math.pi / 2, 0))
    for x in (-0.49, 0.49):
        box("handle", (x, 0, 0.68), (0.027, 0.49, 0.03), "brass", body)
    plate = empty("NamePlate", parent=root)
    box("plate", (0, -0.278, 0.46), (0.37, 0.02, 0.12), "brass", plate, 0.008)
    merge_children(root)
    return root


def card():
    root = empty("Card")
    body = empty("Paper", parent=root)
    box("card", (0, 0, 0.085), (0.26, 0.009, 0.17), "paper", body, 0.006)
    for z, width in [(0.125, 0.18), (0.087, 0.17), (0.054, 0.12)]:
        box("ruling", (-0.02, -0.005, z), (width, 0.002, 0.004), "belly_seam", body)
    cylinder("seal", (0.09, -0.007, 0.035), 0.017, 0.002, "brass", body,
             vertices=8, rotation=(math.pi / 2, 0, 0))
    merge_children(root)
    return root


def shelf():
    root = empty("Shelf")
    body = empty("Body", parent=root)
    for x in (-0.58, 0.58):
        box("side", (x, 0, 0.84), (0.10, 0.46, 1.68), "leather", body, 0.02)
    box("back", (0, 0.19, 0.84), (1.1, 0.08, 1.64), "leather_dark", body)
    for z in (0.13, 0.63, 1.13, 1.63):
        box("shelf", (0, -0.025, z), (1.23, 0.52, 0.07), "shell", body, 0.018)
    box("cornice", (0, 0, 1.73), (1.32, 0.52, 0.14), "rim", body, 0.035)
    box("index", (0, -0.278, 1.71), (0.27, 0.013, 0.07), "brass", body)
    merge_children(root)
    return root


def desk():
    root = empty("Desk")
    body = empty("Body", parent=root)
    box("front", (0, 0.035, 0.36), (1.45, 0.65, 0.66), "leather", body, 0.045)
    box("inlay", (0, -0.31, 0.38), (1.2, 0.025, 0.39), "rim", body, 0.03)
    box("brass_inset", (0, -0.331, 0.39), (0.2, 0.012, 0.13), "brass", body, 0.014)
    box("desktop", (0, 0, 0.75), (1.64, 0.86, 0.13), "shell_top", body, 0.05)
    box("desk_mat", (0.11, -0.03, 0.821), (0.64, 0.45, 0.013), "green", body, 0.015)
    for x in (-0.62, 0.62):
        box("foot", (x, 0, 0.046), (0.2, 0.65, 0.09), "leather_dark", body)
    merge_children(root)
    return root


def lamp():
    root = empty("Lamp")
    body = empty("Body", parent=root)
    cylinder("base", (0, 0, 0.025), 0.105, 0.05, "brass", body)
    cylinder("stem", (0, 0, 0.225), 0.015, 0.4, "brass", body, vertices=8)
    cone("shade", (0, 0, 0.43), 0.17, 0.06, 0.16, "green", body, vertices=12)
    cylinder("rim", (0, 0, 0.35), 0.175, 0.014, "brass", body)
    ellipsoid("bulb", (0, 0, 0.358), (0.055, 0.055, 0.045), "band", body)
    merge_children(root)
    return root


def sieve():
    root = empty("Sieve")
    body = empty("Body", parent=root)
    for x in (-0.4, 0.4):
        box("leg", (x, 0, 0.35), (0.08, 0.48, 0.7), "leather", body, 0.012)
    box("base", (0, 0, 0.09), (0.95, 0.65, 0.16), "rim", body, 0.028)
    tray = empty("Screen", (0, 0, 0.69), root)
    for x in (-0.38, 0.38):
        box("side", (x, 0, 0), (0.05, 0.65, 0.08), "brass", tray)
    for y in (-0.3, 0.3):
        box("side", (0, y, 0), (0.75, 0.05, 0.08), "brass", tray)
    for i in range(7):
        box("wire", (-0.3 + i * 0.1, 0, -0.013), (0.012, 0.6, 0.012), "brass", tray)
        box("wire", (0, -0.25 + i * 0.083, -0.007), (0.75, 0.012, 0.012), "brass", tray)
    merge_children(root)
    clips(root, {"sift": [(tray, "location", wave(0.045))]})
    return root


def stamp():
    root = empty("Stamp")
    body = empty("Body", parent=root)
    box("base", (0, 0, 0.06), (0.5, 0.48, 0.12), "leather", body, 0.025)
    for x in (-0.2, 0.2):
        cylinder("pillar", (x, 0.12, 0.38), 0.025, 0.63, "brass", body, vertices=8)
    box("arch", (0, 0.12, 0.7), (0.48, 0.13, 0.07), "brass", body, 0.012)
    head = empty("Press", (0, 0, 0.43), root)
    cylinder("handle", (0, 0, 0.2), 0.03, 0.3, "brass", head, vertices=8)
    ellipsoid("grip", (0, 0, 0.33), (0.085, 0.075, 0.045), "green", head)
    box("platen", (0, 0, 0), (0.27, 0.25, 0.07), "brass", head, 0.02)
    merge_children(root)
    clips(root, {"stamp": [(head, "location", [(1, (0, 0, 0)), (20, (0, 0, -0.23)),
                                             (30, (0, 0, -0.23)), (49, (0, 0, 0))])]})
    return root


def library():
    root = empty("Library")
    returns = empty("Returns", parent=root)
    stacks = empty("Stacks", parent=root)
    for x in range(-3, 3):
        for y in range(-2, 3):
            if abs(x + 0.5) == 2.5 and abs(y) == 2:
                continue
            parent = returns if y <= 0 else stacks
            color = "shell_top" if (x + y) % 3 else "shell_light"
            box("tile", (x + 0.5, y, 0.09), (0.975, 0.975, 0.18), color, parent, 0.015)
    # A low balustrade frames the rear; the front stays open to the camera.
    for x in (-2.6, -1.3, 0, 1.3, 2.6):
        cylinder("post", (x, 2.34, 0.49), 0.045, 0.68, "leather", stacks, vertices=8)
        ellipsoid("finial", (x, 2.34, 0.85), (0.08, 0.08, 0.08), "brass", stacks,
                  segments=8, rings=4)
    box("rail", (0, 2.34, 0.72), (5.25, 0.065, 0.065), "leather", stacks)
    for x in (-2.7, 2.7):
        cone("pot", (x, 0.6, 0.29), 0.18, 0.24, 0.26, "rim", stacks)
        for dx, dy, z in [(-0.08, 0, 0.68), (0.08, 0.06, 0.59), (0, -0.05, 0.84)]:
            cylinder("stem", (x + dx, 0.6 + dy, z - 0.14), 0.012, 0.4, "skin_shadow", stacks,
                     vertices=6)
            ellipsoid("leaf", (x + dx, 0.6 + dy, z), (0.14, 0.085, 0.18), "skin", stacks,
                      segments=6, rings=4)
    merge_children(root)
    return root


def cloud():
    root = empty("Cloud")
    body = empty("Body", parent=root)
    for x, y, z, size in [(-0.7, 0, 0.22, 0.6), (0, 0, 0.3, 0.85),
                           (0.7, 0, 0.2, 0.55), (0.2, 0.35, 0.17, 0.5)]:
        ellipsoid("cloud", (x, y, z), (size, size * 0.65, size * 0.53),
                  "paper_light", body, segments=10, rings=5)
    merge_children(root)
    return root
