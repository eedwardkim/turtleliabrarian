# Shelf Life original M1 assets

All geometry, character designs, palette application and rigid animation clips
in this folder and `public/models` were authored for Shelf Life using the
repository's headless Blender scripts. No downloaded model, image texture,
photograph or external asset pack is included.

## Reproduction

Install official Blender 4.5.14 LTS, then:

```sh
node scripts/models.mjs --preview
node scripts/models.mjs --scene-preview
node scripts/validate-models.mjs --report
```

Set `BLENDER_BIN` when Blender is not on PATH or in the standard macOS app
locations. Each asset has front, side, top and three-quarter CPU Cycles renders
and a four-angle contact sheet. `all-assets-contact.png` gathers silhouettes;
`m1-composition.png` is an offline art review assembled from the exported GLBs.
These are art previews, not screenshots or evidence of browser integration.

The generated `validation.json` records actual GLB triangle counts, primitives,
bounds, clip/node names, bytes and Khronos validator errors/warnings.
`asset-manifest.json` is the authoritative budget and palette specification.
Opaque palette colors are baked to vertex colors under one shared material per
rigid part to keep draw calls low. Glass remains a separate 30% alpha material.
Books retain three independent rigid parts for GPU instancing.

The scene contains no texture files or external requests. Render previews and
this validation report are development assets; only `public/models` ships as
runtime models.
