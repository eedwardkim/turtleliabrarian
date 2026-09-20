"""Storage, desk paperwork and archive fixtures for the later wings."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, wave


def slip():
    """A loan slip: one row of the loans table, in paper form."""
    root = empty("Slip")
    body = empty("Paper", parent=root)
    box("slip", (0, 0, 0.004), (0.2, 0.3, 0.006), "paper_light", body, 0.004)
    for index in range(4):
        box("ruling", (-0.01, 0.1 - index * 0.055, 0.008),
            (0.14 - index * 0.01, 0.004, 0.002), "belly_seam", body)
    box("header", (0, 0.13, 0.008), (0.16, 0.012, 0.002), "ink", body)
    cylinder("seal", (0.06, -0.1, 0.008), 0.018, 0.003, "red", body, vertices=8)
    merge_children(root)
    return root


def request():
    """A patron request slip; the table row a puzzle must satisfy."""
    root = empty("Request")
    body = empty("Paper", parent=root)
    box("slip", (0, 0, 0.004), (0.22, 0.16, 0.006), "paper", body, 0.004)
    for index in range(3):
        box("ruling", (-0.015, 0.045 - index * 0.04, 0.008),
            (0.15, 0.004, 0.002), "belly_seam", body)
    box("tab", (0, 0.095, 0.006), (0.09, 0.03, 0.005), "ochre", body, 0.004)
    merge_children(root)
    return root


def cabinet():
    """Card catalog: five labelled drawers that slide for lookups."""
    root = empty("Cabinet")
    body = empty("Body", parent=root)
    box("case", (0, 0.03, 0.56), (0.74, 0.56, 1.12), "leather", body, 0.025)
    box("top", (0, 0.03, 1.15), (0.82, 0.62, 0.07), "shell_top", body, 0.02)
    box("plinth", (0, 0.03, 0.035), (0.8, 0.6, 0.07), "leather_dark", body, 0.015)
    drawers = []
    for index in range(5):
        drawer = empty(f"Drawer_{index}", (0, -0.25, 0.18 + index * 0.2), root)
        box("front", (0, 0, 0), (0.66, 0.035, 0.17), "shell", drawer, 0.012)
        box("label", (0, -0.022, 0.03), (0.2, 0.006, 0.055), "paper_light", drawer)
        cylinder("pull", (0, -0.035, -0.035), 0.022, 0.02, "brass", drawer,
                 vertices=8, rotation=(math.pi / 2, 0, 0))
        drawers.append(drawer)
    merge_children(root)
    clips(root, {
        "open_drawer": [(drawers[2], "location",
                         [(1, (0, 0, 0)), (20, (0, -0.32, 0)),
                          (32, (0, -0.32, 0)), (49, (0, 0, 0))])],
        "rummage": [(drawers[index], "location", wave(-0.1 - index * 0.02, 1))
                    for index in range(5)],
    })
    return root


def ledger():
    """The giant loans ledger: the table itself, kept open on a lectern."""
    root = empty("Ledger")
    body = empty("Body", parent=root)
    for x in (-0.3, 0.3):
        box("leg", (x, 0, 0.35), (0.09, 0.42, 0.7), "leather_dark", body, 0.015)
    box("stretcher", (0, 0, 0.18), (0.62, 0.07, 0.06), "leather_dark", body)
    lectern = empty("Lectern", (0, 0, 0.74), root)
    slope = box("slope", (0, 0, 0), (0.86, 0.6, 0.06), "leather", lectern, 0.015)
    slope.rotation_euler = (-0.28, 0, 0)
    pages_group = empty("Pages", (0, 0.02, 0.83), root)
    leaf = box("pages", (0, 0, 0), (0.78, 0.54, 0.06), "pages", pages_group, 0.008)
    leaf.rotation_euler = (-0.28, 0, 0)
    for index in range(5):
        rule = box("ruling", (0, 0.16 - index * 0.09, 0.04),
                   (0.66, 0.006, 0.004), "belly_seam", pages_group)
        rule.rotation_euler = (-0.28, 0, 0)
    turner = empty("Leaf", (-0.38, 0.02, 0.86), root)
    flap = box("leaf", (0.38, 0, 0), (0.76, 0.52, 0.01), "paper_light", turner)
    flap.rotation_euler = (-0.28, 0, 0)
    merge_children(root)
    clips(root, {"turn_page": [(turner, "rotation_euler",
                                [(1, (0, 0, 0)), (49, (0, -2.6, 0))])]})
    return root


def sorting_bin():
    """A sorting bin with a brass count tag; one per group."""
    root = empty("Bin")
    body = empty("Body", parent=root)
    for y in (-0.24, 0.24):
        box("wall", (0, y, 0.19), (0.52, 0.03, 0.38), "leather", body, 0.01)
    for x in (-0.245, 0.245):
        box("wall", (x, 0, 0.19), (0.03, 0.51, 0.38), "leather", body, 0.01)
    box("floor", (0, 0, 0.025), (0.52, 0.51, 0.05), "leather_dark", body, 0.01)
    tag = empty("CountTag", (0, -0.27, 0.3), root)
    box("tag", (0, 0, 0), (0.22, 0.012, 0.11), "brass", tag, 0.01)
    box("rivet", (0, -0.01, 0.05), (0.02, 0.008, 0.02), "shell_top", tag)
    merge_children(root)
    clips(root, {"fill": [(body, "location", wave(0.03, 2))]})
    return root


def lost_found():
    """Lost & Found: where rows with missing values end up."""
    root = empty("LostFound")
    body = empty("Body", parent=root)
    for y in (-0.3, 0.3):
        box("wall", (0, y, 0.24), (0.66, 0.035, 0.48), "plum", body, 0.012)
    for x in (-0.31, 0.31):
        box("wall", (x, 0, 0.24), (0.035, 0.64, 0.48), "plum", body, 0.012)
    box("floor", (0, 0, 0.03), (0.66, 0.64, 0.06), "leather_dark", body, 0.012)
    box("sign", (0, -0.32, 0.42), (0.38, 0.014, 0.14), "paper_light", body, 0.01)
    for index in range(3):
        box("question", (-0.1 + index * 0.1, -0.33, 0.42), (0.03, 0.006, 0.07),
            "ink", body)
    lid = empty("Lid", (0, 0.3, 0.49), root)
    box("lid", (0, -0.3, 0), (0.68, 0.66, 0.04), "plum", lid, 0.012)
    merge_children(root)
    clips(root, {"toss_in": [(lid, "rotation_euler",
                              [(1, (0, 0, 0)), (16, (-1.1, 0, 0)),
                               (33, (-1.1, 0, 0)), (49, (0, 0, 0))])]})
    return root


def board():
    """Standing Orders board: the saved query list pinned above the desk."""
    root = empty("Board")
    body = empty("Body", parent=root)
    box("frame", (0, 0.03, 0.62), (1.1, 0.06, 0.78), "leather", body, 0.02)
    box("cork", (0, -0.005, 0.62), (1.0, 0.02, 0.68), "rim", body, 0.01)
    for x in (-0.45, 0.45):
        box("leg", (x, 0.03, 0.12), (0.08, 0.06, 0.24), "leather_dark", body, 0.012)
    cards = empty("Orders", parent=root)
    for index in range(4):
        x = -0.33 + (index % 2) * 0.33
        z = 0.78 - (index // 2) * 0.28
        box("order", (x, -0.02, z), (0.28, 0.008, 0.2), "paper_light", cards, 0.006)
        box("line", (x, -0.027, z + 0.05), (0.18, 0.004, 0.008), "ink", cards)
        cylinder("pin", (x, -0.035, z + 0.085), 0.012, 0.012, "red", cards,
                 vertices=6, rotation=(math.pi / 2, 0, 0))
    merge_children(root)
    return root


def trapdoor():
    """The archive trapdoor; it opens on the dark-archive chapters."""
    root = empty("Trapdoor")
    frame = empty("Frame", parent=root)
    for y in (-0.55, 0.55):
        box("frame", (0, y, 0.02), (1.14, 0.06, 0.04), "brass", frame)
    for x in (-0.55, 0.55):
        box("frame", (x, 0, 0.02), (0.06, 1.04, 0.04), "brass", frame)
    box("shaft", (0, 0, -0.3), (1.0, 1.0, 0.6), "ink", frame)
    door = empty("Door", (-0.52, 0, 0.045), root)
    box("door", (0.52, 0, 0), (1.0, 1.0, 0.05), "leather", door, 0.015)
    ring_pull = cylinder("pull", (0.82, 0, 0.035), 0.05, 0.012, "brass", door,
                         vertices=10)
    ring_pull.name = "pull"
    merge_children(root)
    clips(root, {"open": [(door, "rotation_euler",
                           [(1, (0, 0, 0)), (49, (0, -2.0, 0))])]})
    return root


def stairs():
    """A short flight down to the archive."""
    root = empty("Stairs")
    body = empty("Body", parent=root)
    for index in range(6):
        box("step", (0, index * 0.28, -index * 0.18 - 0.09),
            (1.0, 0.28, 0.18), "leather", body, 0.012)
        box("tread", (0, index * 0.28, -index * 0.18 - 0.005),
            (0.98, 0.26, 0.02), "shell", body, 0.008)
    merge_children(root)
    return root


def archive():
    """Dark archive shelving: shuttered, lantern-lit, mostly empty."""
    root = empty("Archive")
    body = empty("Body", parent=root)
    for x in (-0.62, 0.62):
        box("side", (x, 0, 0.9), (0.1, 0.44, 1.8), "leather_dark", body, 0.02)
    box("back", (0, 0.18, 0.9), (1.2, 0.07, 1.78), "ink", body)
    for z in (0.2, 0.75, 1.3):
        box("shelf", (0, -0.02, z), (1.3, 0.5, 0.07), "leather_dark", body, 0.015)
    box("cornice", (0, 0, 1.85), (1.38, 0.5, 0.12), "ink", body, 0.03)
    shutter = empty("Shutter", (0, -0.24, 1.0), root)
    box("shutter", (0, 0, 0), (1.18, 0.04, 1.6), "leather", shutter, 0.012)
    for index in range(5):
        box("slat", (0, -0.026, -0.6 + index * 0.3), (1.1, 0.012, 0.06), "rim",
            shutter)
    ellipsoid("lantern", (0.46, -0.16, 1.62), (0.07, 0.07, 0.09), "band", body,
              segments=8, rings=4)
    cone("hood", (0.46, -0.16, 1.73), 0.08, 0.02, 0.07, "brass", body, vertices=8)
    merge_children(root)
    clips(root, {"open_shutter": [(shutter, "location",
                                   [(1, (0, 0, 0)), (49, (0, 0, 1.55))])]})
    return root


def wing():
    """A wing marker: the plinth and index plate that grows in when a wing opens."""
    root = empty("Wing")
    base = empty("Base", parent=root)
    box("plinth", (0, 0, 0.09), (0.78, 0.78, 0.18), "shell_top", base, 0.02)
    box("step", (0, 0, 0.21), (0.6, 0.6, 0.08), "shell", base, 0.015)
    post = empty("Post", (0, 0, 0.25), root)
    cylinder("post", (0, 0, 0.3), 0.045, 0.6, "leather", post, vertices=8)
    box("plate", (0, -0.03, 0.62), (0.42, 0.03, 0.2), "brass", post, 0.012)
    for index in range(3):
        box("line", (0, -0.05, 0.66 - index * 0.05), (0.26, 0.006, 0.012),
            "leather_dark", post)
    merge_children(root)
    clips(root, {"grow": [(post, "location", [(1, (0, 0, -0.85)), (37, (0, 0, 0.04)),
                                              (49, (0, 0, 0))])]})
    return root


def sky():
    """A soft inverted dome; the only backdrop the scene needs."""
    root = empty("Sky")
    body = empty("Body", parent=root)
    dome = ellipsoid("dome", (0, 0, 0), (40, 40, 26), "ghost_light", body,
                     segments=16, rings=8)
    dome.name = "dome"
    merge_children(root)
    return root
