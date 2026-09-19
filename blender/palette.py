"""Original Shelf Life materials, in the brief's sRGB palette."""

COLORS = {
    "skin": "6FA37F", "skin_light": "93C49D", "skin_shadow": "4F7F60",
    "shell": "C27E41", "shell_light": "D89A55", "shell_top": "E3AE6A",
    "seam": "6E4020", "rim": "A8652F", "belly": "F0DDB2",
    "belly_seam": "B0925E", "brass": "C99A3E", "leather": "6B3A26",
    "leather_dark": "4E2A1B", "glass": "DDEBEA", "blue": "3E5C8A",
    "rose": "B5475A", "green": "4F8A6B", "ochre": "C28A2E",
    "plum": "7A5C9A", "pages": "F4ECD8", "band": "E6C46F",
    "feathers": "8C7B6B", "feathers_dark": "6B5B4D", "owl_belly": "D6C9B1",
    "chevron": "9E8C78", "face": "E6DAC4", "eyes": "E3A33A",
    "beak": "D9A441", "shawl": "5B3F63", "red": "C8323C",
    "gold": "E0B43A", "ghost": "8FB3D9", "ghost_light": "E4EEF7",
    "paper": "F4EEE2", "paper_light": "FBF8F1", "ink": "2A2522",
}


def linear(hex_color):
    values = [int(hex_color[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4
                 for v in values)
