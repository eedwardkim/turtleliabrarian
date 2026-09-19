Opaque rigid parts bake the exact linear palette into a `Color` vertex attribute
and share one white `palette` material. This preserves the palette while allowing
one draw per rigid part. Glass retains its own 30% material. Books retain three
plain material parts so instance colors can replace cover colors without tinting
the page or brass band geometry.
# Shelf Life assets

All meshes and animation are original, authored with the adjacent bpy families.
Blender 4.5.14 LTS is pinned for reproduction. No downloaded models or textures.

Run `node scripts/models.mjs` to rebuild GLBs; append `--preview` for 24-sample,
480px CPU Cycles front/side/top/three-quarter renders. Asset names can precede
the flag to rebuild a family member. `BLENDER_BIN` overrides executable discovery.
`node scripts/validate-models.mjs` validates the committed files.

Blender authoring uses Z-up, forward -Y. The official glTF export converts to
Y-up, +Z forward. A unit is one meter. Origins are ground center; named empty
nodes provide rigid pivots and stable attachment sockets. Mesh scales and
rotations are applied before export. No armatures or skinning.

PascalCase node names identify rigid parts; `_mesh` is their joined geometry.
Exact brief sRGB colors are converted to linear material factors for glTF.
Transparent spectacle glass is 30% alpha. Each rigid part is joined so tile,
spine, seam, and facial detail do not create independent draw calls.

NLA tracks with identical names across parts become named glTF clips. World
seeks these clips from parent-owned event progress; no wall clock changes game
state. Books retain separate Cover/Pages/Band nodes for instancing.

The M1 rabbit patron makes delivery visible. Other patrons, hazards, advanced
machines, cosmetics and wings belong to the later asset milestone.
