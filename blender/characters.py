"""Shelby, Mrs. Quill, Atlas and the M1 rabbit patron."""

import math

from common import box, clips, cone, cylinder, ellipsoid, empty, merge_children, ring, wave


def shelby():
    root = empty("Shelby")
    body = empty("Body", parent=root)
    ellipsoid("plastron", (0, 0.035, 0.19), (0.195, 0.235, 0.115), "belly", body)
    ellipsoid("shell_rim", (0, 0.05, 0.23), (0.23, 0.275, 0.06), "rim", body)
    ellipsoid("shell_seams", (0, 0.05, 0.29), (0.222, 0.258, 0.185), "seam", body)
    for x, y, z, r in [(0, 0.03, 0.445, 0.115), (-0.115, 0.04, 0.41, 0.087),
                        (0.115, 0.04, 0.41, 0.087), (-0.08, 0.17, 0.397, 0.083),
                        (0.08, 0.17, 0.397, 0.083), (0, -0.12, 0.41, 0.089)]:
        cylinder("hex_plate", (x, y, z), r, 0.03, "shell_top", body, vertices=6)
    saddle = empty("Saddle", parent=body)
    for x in (-0.12, 0.12):
        box("strap", (x, 0.065, 0.42), (0.032, 0.32, 0.033), "leather", saddle)
    box("saddle", (0, 0.15, 0.465), (0.24, 0.12, 0.018), "leather_dark", saddle)
    for i in range(3):
        empty(f"BookSlot_{i}", (-0.08 + i * 0.08, 0.15, 0.48), saddle)
        box("slot", (-0.08 + i * 0.08, 0.15, 0.48), (0.009, 0.13, 0.018),
            "brass", saddle)
    pocket = empty("BellyPocket", parent=body)
    box("pocket", (0, -0.15, 0.112), (0.12, 0.08, 0.015), "leather", pocket, 0.009)
    head = empty("Head", (0, -0.205, 0.27), body)
    ellipsoid("head", (0, -0.09, 0), (0.158, 0.172, 0.143), "skin_light", head)
    ellipsoid("snout", (0, -0.2, -0.055), (0.12, 0.065, 0.065), "skin", head)
    for x in (-0.069, 0.069):
        ellipsoid("eye", (x, -0.223, 0.029), (0.028, 0.014, 0.04), "ink", head,
                  segments=8, rings=4)
        ellipsoid("glint", (x - 0.007, -0.239, 0.04), (0.008, 0.004, 0.01), "pages",
                  head, segments=6, rings=3)
        ring("spectacles", (x, -0.239, 0.029), 0.056, 0.006, "brass", head)
        ellipsoid("lens", (x, -0.239, 0.029), (0.046, 0.003, 0.046), "glass", head,
                  segments=10, rings=4)
    box("bridge", (0, -0.245, 0.038), (0.045, 0.013, 0.01), "brass", head)
    feet = []
    for label, x, y in [("FL", -0.155, -0.13), ("FR", 0.155, -0.13),
                         ("BL", -0.15, 0.21), ("BR", 0.15, 0.21)]:
        foot = empty("Foot_" + label, (x, y, 0.07), root)
        ellipsoid("foot", (0, 0, 0), (0.077, 0.092, 0.066), "skin", foot,
                  segments=8, rings=4)
        feet.append(foot)
    ellipsoid("tail", (0, 0.32, 0.16), (0.035, 0.09, 0.025), "skin", body,
              segments=8, rings=4)
    merge_children(root)
    gait = [(foot, "rotation_euler", wave(0.34 * (-1 if i % 2 else 1)))
            for i, foot in enumerate(feet)]
    specifications = {
        "idle": [(head, "rotation_euler", wave(0.07, 2))],
        "walk": gait,
        "carry_walk": gait + [(body, "rotation_euler", wave(0.055, 1))],
        "push_cart": gait + [(head, "rotation_euler", wave(-0.13))],
        "pull_lever": [(feet[0], "rotation_euler", wave(-0.8))],
        "stamp": [(body, "location", wave(-0.065, 2))],
        "drop_marble": [(head, "rotation_euler", wave(0.38))],
        "think": [(head, "rotation_euler", wave(0.22, 1))],
        "cheer": [(root, "location", [(1, (0, 0, 0)), (13, (0, 0, 0.16)),
                                     (25, (0, 0, 0)), (37, (0, 0, 0.12)), (49, (0, 0, 0))]),
                  (body, "rotation_euler", wave(0.2, 2))],
        "deliver": [(head, "rotation_euler", wave(0.24))],
        "flip": [(root, "rotation_euler", [(1, (0, 0, 0)), (25, (0, math.pi, 0)),
                                          (49, (0, math.pi, 0))]),
                 (root, "location", [(1, (0, 0, 0)), (25, (0, 0, 0.48)),
                                    (49, (0, 0, 0.48))])],
        "flail_loop": gait + [(body, "rotation_euler", wave(0.12, 2))],
        "get_up": [(root, "rotation_euler", [(1, (0, math.pi, 0)), (49, (0, 0, 0))]),
                   (root, "location", [(1, (0, 0, 0.48)), (49, (0, 0, 0))])],
    }
    clips(root, specifications)
    return root


def quill():
    root = empty("Quill")
    body = empty("Body", parent=root)
    ellipsoid("body", (0, 0, 0.25), (0.17, 0.13, 0.225), "feathers", body)
    ellipsoid("bib", (0, -0.115, 0.23), (0.124, 0.024, 0.158), "owl_belly", body)
    for z in (0.17, 0.23, 0.29):
        for x in (-0.065, 0, 0.065):
            mark = box("chevron", (x, -0.141, z), (0.025, 0.008, 0.014), "chevron", body)
            mark.rotation_euler.y = 0.4 if x > 0 else -0.4
    head = empty("Head", (0, -0.025, 0.405), body)
    ellipsoid("head", (0, 0, 0), (0.166, 0.12, 0.14), "feathers_dark", head)
    for x in (-0.083, 0.083):
        ellipsoid("face_lobe", (x * 0.65, -0.101, -0.002), (0.091, 0.029, 0.105),
                  "face", head)
        cone("tuft", (x * 1.4, 0.007, 0.124), 0.046, 0, 0.12, "feathers_dark", head)
        ellipsoid("eye", (x * 0.67, -0.132, 0.007), (0.035, 0.013, 0.038),
                  "eyes", head, segments=10, rings=4)
        ellipsoid("pupil", (x * 0.67, -0.144, 0.006), (0.016, 0.007, 0.025),
                  "ink", head, segments=8, rings=4)
        box("stern_lid", (x * 0.67, -0.145, 0.036), (0.075, 0.01, 0.023),
            "feathers_dark", head)
        ring("half_moon", (x * 0.67, -0.157, -0.008), 0.047, 0.005,
             "brass", head, half=True)
        for i in range(5):
            ellipsoid("chain", (x * 1.55, -0.1 + i * 0.025, -0.025 - i * 0.014),
                      (0.006, 0.006, 0.006), "brass", head, segments=6, rings=3)
    cone("beak", (0, -0.16, -0.045), 0.024, 0, 0.067, "beak", head)
    box("bridge", (0, -0.16, 0.003),
        (0.03, 0.012, 0.008), "brass", head)
    shawl = empty("Shawl", parent=body)
    for x in (-0.13, 0.13):
        ellipsoid("shawl_fold", (x, -0.018, 0.29), (0.06, 0.135, 0.11),
                  "shawl", shawl, segments=8, rings=4)
    ellipsoid("brooch", (0, -0.147, 0.335), (0.024, 0.008, 0.025), "brass", shawl,
              segments=8, rings=4)
    wings = []
    for side in (-1, 1):
        wing = empty("Wing_L" if side < 0 else "Wing_R", (side * 0.15, 0, 0.29), body)
        ellipsoid("wing", (side * 0.028, 0, -0.04), (0.06, 0.105, 0.145),
                  "feathers_dark", wing, segments=8, rings=4)
        wings.append(wing)
    cylinder("Pen", (0.045, -0.08, -0.08), 0.012, 0.3, "red", wings[1], vertices=8)
    cone("nib", (0.045, -0.08, -0.245), 0.012, 0, 0.03, "brass", wings[1])
    for x in (-0.072, 0.072):
        ellipsoid("foot", (x, -0.01, 0.019), (0.055, 0.075, 0.02), "beak", body,
                  segments=8, rings=4)
    merge_children(root)
    flap = [(wing, "rotation_euler", wave(0.7 * side, 1))
            for wing, side in zip(wings, (-1, 1))]
    clips(root, {
        "idle": [(head, "rotation_euler", wave(0.03, 2))],
        "fly_in": flap + [(root, "location", [(1, (0, 0, 1)), (49, (0, 0, 0))])],
        "land": [(body, "location", wave(-0.04, 2))],
        "mark": [(wings[1], "rotation_euler", wave(0.5))],
        "stern_look": [(head, "rotation_euler", wave(-0.13, 2))],
        "approving_nod": [(head, "rotation_euler", wave(0.2))],
        "fly_out": flap + [(root, "location", [(1, (0, 0, 0)), (49, (0, 0, 1))])],
    })
    return root


def atlas():
    root = empty("Atlas")
    body = empty("Body", parent=root)
    ellipsoid("belly", (0, 0, 0.95), (3.23, 2.75, 0.9), "belly", body, segments=24, rings=8)
    ellipsoid("shell", (0, 0, 1.1), (3.55, 3, 0.75), "shell", body, segments=24, rings=8)
    ellipsoid("rim", (0, 0, 1.36), (3.65, 3.08, 0.32), "rim", body, segments=24, rings=6)
    head = empty("Head", (0, -3.03, 0.95), root)
    ellipsoid("head", (0, -0.55, 0.06), (0.75, 0.96, 0.53), "skin", head, segments=16)
    ellipsoid("chin", (0, -0.73, -0.16), (0.64, 0.75, 0.25), "skin_light", head)
    for x in (-0.5, 0.5):
        ellipsoid("eye", (x, -1.17, 0.18), (0.09, 0.07, 0.09), "ink", head,
                  segments=10, rings=4)
        ellipsoid("brow", (x, -1.16, 0.28), (0.15, 0.085, 0.045), "skin_shadow", head)
    flippers = []
    for x, y, label in [(-2.9, -1.5, "FL"), (2.9, -1.5, "FR"),
                         (-2.7, 1.5, "BL"), (2.7, 1.5, "BR")]:
        part = empty("Flipper_" + label, (x, y, 0.8), root)
        fin = ellipsoid("flipper", ((-0.65 if x < 0 else 0.65), 0, -0.07),
                        (1.15, 0.55, 0.18), "skin", part, segments=12, rings=4)
        fin.rotation_euler.z = -0.45 if x * y < 0 else 0.45
        flippers.append(part)
    ellipsoid("tail", (0, 3.05, 0.91), (0.23, 1.05, 0.18), "skin_shadow", body)
    merge_children(root)
    clips(root, {"swim_idle": [(p, "rotation_euler", wave(0.075, 1)) for p in flippers]})
    return root


def patron():
    root = empty("Patron")
    body = empty("Body", parent=root)
    ellipsoid("coat", (0, 0, 0.21), (0.135, 0.1, 0.17), "blue", body)
    ellipsoid("head", (0, -0.012, 0.425), (0.12, 0.095, 0.12), "paper", body)
    for x in (-0.055, 0.055):
        ellipsoid("ear", (x, 0, 0.63), (0.035, 0.035, 0.13), "paper", body, segments=8)
        ellipsoid("inner_ear", (x, -0.031, 0.635), (0.017, 0.006, 0.08), "belly", body,
                  segments=8, rings=4)
        ellipsoid("eye", (x, -0.1, 0.44), (0.013, 0.008, 0.02), "ink", body,
                  segments=8, rings=4)
        ellipsoid("foot", (x, -0.035, 0.028), (0.045, 0.08, 0.028), "paper", body,
                  segments=8, rings=4)
    cone("nose", (0, -0.108, 0.4), 0.018, 0, 0.028, "leather", body)
    merge_children(root)
    clips(root, {
        "queue_idle": [(body, "rotation_euler", wave(0.035, 2))],
        "step_forward": [(root, "location", [(1, (0, 0, 0)), (49, (0, -0.4, 0))])],
        "happy": [(root, "location", wave(0.1, 2))],
        "puzzled": [(body, "rotation_euler", wave(0.15, 1))],
        "leave": [(root, "location", [(1, (0, 0, 0)), (49, (0.8, 0.2, 0))])],
    })
    return root
