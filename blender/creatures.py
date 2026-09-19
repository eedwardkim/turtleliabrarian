"""Queue patrons and hazards, sharing the accepted rabbit patron's proportions."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, wave


def patron_base(name, coat, fur, head=(0, -0.012, 0.425), head_size=(0.12, 0.095, 0.12)):
    """Shared patron silhouette: coat body, head at eye height, two feet."""
    root = empty(name)
    body = empty("Body", parent=root)
    ellipsoid("coat", (0, 0, 0.21), (0.135, 0.1, 0.17), coat, body)
    ellipsoid("head", head, head_size, fur, body)
    for x in (-0.055, 0.055):
        ellipsoid("eye", (x * head_size[0] / 0.12, head[1] - 0.088, head[2] + 0.015),
                  (0.013, 0.008, 0.02), "ink", body, segments=8, rings=4)
        ellipsoid("foot", (x, -0.035, 0.028), (0.045, 0.08, 0.028), fur, body,
                  segments=8, rings=4)
    return root, body


def patron_clips(root, body):
    clips(root, {
        "queue_idle": [(body, "rotation_euler", wave(0.035, 2))],
        "step_forward": [(root, "location", [(1, (0, 0, 0)), (49, (0, -0.4, 0))])],
        "happy": [(root, "location", wave(0.1, 2))],
        "puzzled": [(body, "rotation_euler", wave(0.15, 1))],
        "leave": [(root, "location", [(1, (0, 0, 0)), (49, (0.8, 0.2, 0))])],
    })


def heron():
    """Mr. Heron: precise, tall, all neck and beak."""
    root, body = patron_base("Heron", "ghost", "ghost_light",
                             head=(0, -0.02, 0.73), head_size=(0.085, 0.08, 0.085))
    cylinder("neck", (0, 0.005, 0.52), 0.035, 0.42, "ghost_light", body, vertices=8)
    cone("beak", (0, -0.093, 0.7), 0.026, 0, 0.16, "beak", body, vertices=6)
    cone("crest", (0, 0.07, 0.79), 0.02, 0, 0.09, "ghost", body, vertices=6)
    for x in (-0.05, 0.05):
        cylinder("leg", (x, -0.02, 0.07), 0.013, 0.14, "beak", body, vertices=6)
    ellipsoid("tail", (0, 0.14, 0.2), (0.05, 0.09, 0.05), "ghost", body,
              segments=8, rings=4)
    merge_children(root)
    patron_clips(root, body)
    return root


def badger():
    """Bramble: a grumpy striped researcher."""
    root, body = patron_base("Badger", "feathers_dark", "feathers_dark",
                             head=(0, -0.03, 0.4), head_size=(0.125, 0.11, 0.115))
    box("stripe", (0, -0.1, 0.44), (0.036, 0.13, 0.085), "paper_light", body)
    cone("snout", (0, -0.14, 0.375), 0.035, 0.012, 0.07, "ink", body, vertices=8)
    for x in (-0.085, 0.085):
        ellipsoid("ear", (x, -0.01, 0.485), (0.03, 0.016, 0.028), "paper_light", body,
                  segments=8, rings=4)
        ellipsoid("paw", (x * 1.25, -0.06, 0.16), (0.04, 0.05, 0.05), "feathers_dark",
                  body, segments=8, rings=4)
    ellipsoid("satchel", (0.12, 0.05, 0.19), (0.055, 0.09, 0.08), "leather", body,
              segments=8, rings=4)
    merge_children(root)
    patron_clips(root, body)
    return root


def newt():
    """Dr. Newt: low, damp, and fond of statistics."""
    root, body = patron_base("Newt", "green", "skin_light",
                             head=(0, -0.09, 0.3), head_size=(0.105, 0.115, 0.082))
    ellipsoid("tail", (0, 0.21, 0.19), (0.05, 0.16, 0.045), "green", body,
              segments=8, rings=4)
    for y in (-0.02, 0.06, 0.14):
        cone("crest", (0, y, 0.33), 0.022, 0, 0.055, "skin_light", body, vertices=6)
    for x in (-0.11, 0.11):
        ellipsoid("hand", (x, -0.09, 0.14), (0.04, 0.055, 0.03), "skin_light", body,
                  segments=8, rings=4)
    box("notebook", (0, -0.15, 0.17), (0.11, 0.015, 0.08), "plum", body)
    merge_children(root)
    patron_clips(root, body)
    return root


def geese():
    """The Gossip Geese: a pair that always arrives with a claim."""
    root = empty("Geese")
    bodies = []
    for side, label in ((-1, "Goose_L"), (1, "Goose_R")):
        goose = empty(label, (side * 0.16, side * 0.05, 0), root)
        ellipsoid("coat", (0, 0, 0.21), (0.125, 0.095, 0.16), "paper_light", goose)
        cylinder("neck", (0, -0.02, 0.44), 0.032, 0.3, "paper", goose, vertices=8)
        ellipsoid("head", (0, -0.05, 0.62), (0.075, 0.08, 0.075), "paper_light", goose,
                  segments=10, rings=5)
        cone("beak", (0, -0.13, 0.605), 0.026, 0.012, 0.085, "beak", goose, vertices=6)
        for x in (-0.03, 0.03):
            ellipsoid("eye", (x, -0.105, 0.645), (0.011, 0.008, 0.013), "ink", goose,
                      segments=6, rings=3)
            ellipsoid("foot", (x * 1.6, -0.02, 0.022), (0.04, 0.07, 0.022), "beak",
                      goose, segments=8, rings=4)
        ellipsoid("wing", (side * 0.1, 0.02, 0.23), (0.035, 0.1, 0.085), "paper",
                  goose, segments=8, rings=4)
        bodies.append(goose)
    merge_children(root)
    clips(root, {
        "queue_idle": [(bodies[0], "rotation_euler", wave(0.05, 2)),
                       (bodies[1], "rotation_euler", wave(-0.05, 2))],
        "step_forward": [(root, "location", [(1, (0, 0, 0)), (49, (0, -0.4, 0))])],
        "happy": [(bodies[0], "location", wave(0.1, 2)),
                  (bodies[1], "location", wave(0.08, 2))],
        "puzzled": [(bodies[0], "rotation_euler", wave(0.18, 1)),
                    (bodies[1], "rotation_euler", wave(0.18, 1))],
        "leave": [(root, "location", [(1, (0, 0, 0)), (49, (0.8, 0.2, 0))])],
    })
    return root


def hedgehog():
    """Hazel: round, bristled, full of odd facts."""
    root, body = patron_base("Hedgehog", "leather_dark", "belly",
                             head=(0, -0.085, 0.27), head_size=(0.085, 0.09, 0.08))
    for index in range(9):
        angle = math.tau * index / 9
        spike = cone("spike", (math.cos(angle) * 0.085, 0.02 + math.sin(angle) * 0.06,
                               0.3 + math.sin(angle) * 0.02), 0.026, 0, 0.09,
                     "leather_dark", body, vertices=6)
        spike.rotation_euler = (math.sin(angle) * 0.5, -math.cos(angle) * 0.5, 0)
    cone("snout", (0, -0.15, 0.25), 0.026, 0.008, 0.055, "ink", body, vertices=6)
    for x in (-0.06, 0.06):
        ellipsoid("ear", (x, -0.05, 0.325), (0.022, 0.012, 0.022), "belly", body,
                  segments=6, rings=3)
    merge_children(root)
    patron_clips(root, body)
    return root


def bookworm():
    """A hazard that eats holes in cards and spine plates."""
    root = empty("Bookworm")
    body = empty("Body", parent=root)
    for index in range(4):
        ellipsoid("segment", (0, index * 0.035 - 0.05, 0.035 - index * 0.004),
                  (0.03, 0.026, 0.03 - index * 0.003), "skin" if index % 2 else "skin_light",
                  body, segments=6, rings=3)
    head = empty("Head", (0, -0.085, 0.037), body)
    ellipsoid("head", (0, 0, 0), (0.032, 0.03, 0.032), "skin_light", head,
              segments=6, rings=4)
    for x in (-0.014, 0.014):
        ellipsoid("eye", (x, -0.024, 0.012), (0.007, 0.005, 0.008), "ink", head,
                  segments=4, rings=3)
    merge_children(root)
    clips(root, {
        "wiggle": [(body, "rotation_euler", wave(0.25, 2))],
        "nibble": [(head, "rotation_euler", wave(0.35))],
    })
    return root


def magpie():
    """A hazard that scrambles capitalization and adds trailing spaces."""
    root = empty("Magpie")
    body = empty("Body", parent=root)
    ellipsoid("body", (0, 0, 0.13), (0.075, 0.115, 0.08), "ink", body,
              segments=10, rings=5)
    ellipsoid("bib", (0, -0.055, 0.125), (0.05, 0.05, 0.05), "paper_light", body,
              segments=8, rings=4)
    ellipsoid("tail", (0, 0.17, 0.155), (0.028, 0.115, 0.02), "ink", body,
              segments=6, rings=3)
    head = empty("Head", (0, -0.085, 0.2), body)
    ellipsoid("head", (0, 0, 0), (0.05, 0.05, 0.05), "ink", head, segments=8, rings=4)
    cone("beak", (0, -0.062, -0.004), 0.017, 0, 0.055, "brass", head, vertices=6)
    for x in (-0.028, 0.028):
        ellipsoid("eye", (x, -0.038, 0.015), (0.01, 0.007, 0.011), "eyes", head,
                  segments=6, rings=3)
        ellipsoid("foot", (x, 0.01, -0.125), (0.014, 0.035, 0.012), "brass", head,
                  segments=6, rings=3)
    wings = []
    for side in (-1, 1):
        wing = empty("Wing_L" if side < 0 else "Wing_R", (side * 0.07, 0, 0.15), body)
        ellipsoid("wing", (side * 0.02, 0.01, 0), (0.026, 0.1, 0.055), "feathers_dark",
                  wing, segments=6, rings=4)
        wings.append(wing)
    merge_children(root)
    flap = [(wing, "rotation_euler", wave(0.8 * side, 1))
            for wing, side in zip(wings, (-1, 1))]
    clips(root, {
        "hop": [(root, "location", [(1, (0, 0, 0)), (13, (0, -0.08, 0.09)),
                                    (25, (0, -0.16, 0)), (37, (0, -0.24, 0.09)),
                                    (49, (0, -0.32, 0))])],
        "peck": [(head, "rotation_euler", wave(0.45))],
        "flap": flap,
        "fly_off": flap + [(root, "location", [(1, (0, 0, 0)), (49, (0.5, 0.4, 0.9))])],
    })
    return root
