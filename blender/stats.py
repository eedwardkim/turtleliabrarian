"""Chart, sampling and inference props for the statistics wings."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, wave


def jar():
    """The marble jar: a population to sample from."""
    root = empty("Jar")
    body = empty("Body", parent=root)
    cylinder("wall", (0, 0, 0.3), 0.26, 0.6, "glass", body, vertices=16)
    cylinder("base", (0, 0, 0.025), 0.28, 0.05, "brass", body, vertices=16)
    cylinder("rim", (0, 0, 0.61), 0.28, 0.04, "brass", body, vertices=16)
    marbles = empty("Marbles", parent=root)
    for index in range(9):
        angle = math.tau * index / 9
        radius = 0.06 + (index % 3) * 0.055
        ellipsoid("marble", (math.cos(angle) * radius, math.sin(angle) * radius,
                             0.06 + (index % 4) * 0.05), (0.038, 0.038, 0.038),
                  ("blue", "rose", "green")[index % 3], marbles, segments=8, rings=4)
    merge_children(root)
    clips(root, {"shake": [(body, "rotation_euler", wave(0.12, 1)),
                           (marbles, "location", wave(0.03, 2))]})
    return root


def marble():
    """One drawn marble; instanced heavily, so it stays tiny."""
    root = empty("Marble")
    body = empty("Body", parent=root)
    ellipsoid("marble", (0, 0, 0.035), (0.035, 0.035, 0.035), "blue", body,
              segments=8, rings=4)
    merge_children(root)
    return root


def flag():
    """The observed-statistic flag planted on the null distribution."""
    root = empty("Flag")
    body = empty("Body", parent=root)
    cylinder("pole", (0, 0, 0.3), 0.012, 0.6, "brass", body, vertices=6)
    cone("spike", (0, 0, 0.63), 0.02, 0, 0.07, "brass", body, vertices=6)
    cloth = empty("Cloth", (0.0, 0, 0.5), root)
    box("cloth", (0.11, 0, 0), (0.22, 0.006, 0.14), "red", cloth, 0.006)
    merge_children(root)
    clips(root, {"wave": [(cloth, "rotation_euler", wave(0.22, 2))]})
    return root


def bookends():
    """Bookends mark a confidence interval on the shelf."""
    root = empty("Bookends")
    for side, label in ((-1, "End_L"), (1, "End_R")):
        end = empty(label, (side * 0.45, 0, 0), root)
        box("foot", (0, 0, 0.012), (0.14, 0.18, 0.024), "brass", end, 0.006)
        box("upright", (side * -0.055, 0, 0.14), (0.028, 0.18, 0.28), "brass", end,
            0.008)
    merge_children(root)
    return root


def residual():
    """A residual square: the error of one fitted point, drawn to scale."""
    root = empty("Residual")
    body = empty("Body", parent=root)
    box("tile", (0, 0, 0.004), (0.3, 0.3, 0.008), "rose", body, 0.004)
    for x in (-0.147, 0.147):
        box("edge", (x, 0, 0.012), (0.008, 0.3, 0.008), "red", body)
    for y in (-0.147, 0.147):
        box("edge", (0, y, 0.012), (0.3, 0.008, 0.008), "red", body)
    merge_children(root)
    return root


def grid():
    """Reading-room floor grid: the chart plane for scatters and histograms."""
    root = empty("Grid")
    body = empty("Body", parent=root)
    box("plane", (0, 0, 0.004), (6.0, 6.0, 0.008), "paper", body)
    for index in range(7):
        offset = -3.0 + index
        box("line", (offset, 0, 0.01), (0.014, 6.0, 0.006), "belly_seam", body)
        box("line", (0, offset, 0.01), (6.0, 0.014, 0.006), "belly_seam", body)
    box("axis_x", (0, -3.0, 0.013), (6.0, 0.03, 0.01), "ink", body)
    box("axis_y", (-3.0, 0, 0.013), (0.03, 6.0, 0.01), "ink", body)
    merge_children(root)
    return root


def galton():
    """A Galton board; marbles fall into a bell of bins."""
    root = empty("Galton")
    body = empty("Body", parent=root)
    box("back", (0, 0.07, 0.8), (1.3, 0.04, 1.6), "leather", body, 0.015)
    for x in (-0.66, 0.66):
        box("side", (x, 0.02, 0.8), (0.05, 0.16, 1.6), "leather_dark", body, 0.01)
    box("hopper", (0, 0.02, 1.62), (0.28, 0.16, 0.12), "brass", body, 0.015)
    pins = empty("Pins", parent=root)
    for row in range(5):
        for column in range(row + 2):
            x = (column - (row + 1) / 2) * 0.2
            cylinder("pin", (x, 0.0, 1.32 - row * 0.19), 0.017, 0.07, "brass", pins,
                     vertices=6, rotation=(math.pi / 2, 0, 0))
    bins = empty("Bins", parent=root)
    for index in range(7):
        box("divider", (-0.6 + index * 0.2, 0.0, 0.16), (0.016, 0.14, 0.32),
            "leather_dark", bins, 0.006)
    box("floor", (0, 0.0, 0.015), (1.28, 0.16, 0.03), "shell", bins, 0.008)
    ball = empty("Ball", (-0.0, -0.02, 1.5), root)
    ellipsoid("ball", (0, 0, 0), (0.032, 0.032, 0.032), "rose", ball,
              segments=8, rings=4)
    merge_children(root)
    clips(root, {"drop": [(ball, "location",
                           [(1, (0, 0, 0)), (13, (-0.1, 0, -0.42)),
                            (25, (0.06, 0, -0.84)), (37, (-0.04, 0, -1.16)),
                            (49, (0.1, 0, -1.34))])]})
    return root


def chute():
    """A branching book chute: one where() split, in timber."""
    root = empty("Chute")
    body = empty("Body", parent=root)
    trunk = box("trunk", (0, 0.35, 1.0), (0.36, 0.7, 0.05), "leather", body, 0.012)
    trunk.rotation_euler = (0.55, 0, 0)
    for side in (-1, 1):
        branch = box("branch", (side * 0.32, -0.3, 0.5), (0.32, 0.8, 0.05),
                     "leather", body, 0.012)
        branch.rotation_euler = (0.6, 0, side * 0.5)
        box("rail", (side * 0.46, -0.3, 0.58), (0.03, 0.8, 0.1), "leather_dark",
            body, 0.008).rotation_euler = (0.6, 0, side * 0.5)
    for x in (-0.19, 0.19):
        box("rail", (x, 0.35, 1.06), (0.03, 0.7, 0.1), "leather_dark", body,
            0.008).rotation_euler = (0.55, 0, 0)
    gate = empty("Gate", (0, -0.02, 0.78), root)
    box("gate", (0, 0, 0), (0.4, 0.04, 0.16), "brass", gate, 0.01)
    merge_children(root)
    clips(root, {"split": [(gate, "rotation_euler", wave(0.5, 1))]})
    return root
