import { readdir, readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { NodeIO, getBounds } from '@gltf-transform/core';
import validator from 'gltf-validator';

const srgb = (channel) => Math.round(255 * (channel <= 0.0031308
  ? 12.92 * channel : 1.055 * channel ** (1 / 2.4) - 0.055));

export async function validateModels() {
  const manifest = JSON.parse(await readFile('asset-manifest.json', 'utf8'));
  const io = new NodeIO();
  const reports = [];
  const shipped = (await readdir('public/models'))
    .filter((file) => file.endsWith('.glb')).map((file) => file.slice(0, -4));
  const declared = new Set(manifest.assets.map((asset) => asset.name));
  const orphans = shipped.filter((name) => !declared.has(name));
  for (const asset of manifest.assets) {
    const path = `public/models/${asset.name}.glb`;
    const bytes = await readFile(path);
    const validation = await validator.validateBytes(new Uint8Array(bytes), { uri: path, maxIssues: 100 });
    const document = await io.read(path);
    const root = document.getRoot();
    const errors = [];
    const names = root.listNodes().map((node) => node.getName());
    const clips = root.listAnimations().map((animation) => animation.getName());
    let triangles = 0;
    let primitives = 0;
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMode() !== 4) errors.push('Non-triangle primitive');
        triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute('POSITION').getCount()) / 3;
        primitives += 1;
      }
    }
    for (const name of asset.nodes) if (!names.includes(name)) errors.push(`Missing node ${name}`);
    for (const name of asset.clips) if (!clips.includes(name)) errors.push(`Missing clip ${name}`);
    for (const name of clips) if (!asset.clips.includes(name)) errors.push(`Undeclared clip ${name}`);
    for (const animation of root.listAnimations()) {
      const channels = animation.listChannels();
      if (!channels.length) errors.push(`Empty clip ${animation.getName()}`);
      for (const channel of channels) {
        if (!channel.getTargetNode()) errors.push(`Dangling channel in ${animation.getName()}`);
      }
      for (const sampler of animation.listSamplers()) {
        const input = sampler.getInput();
        const first = input.getElement(0, [])[0];
        const span = input.getElement(input.getCount() - 1, [])[0] - first;
        if (span > 2.01) errors.push(`Clip ${animation.getName()} runs ${span}s over 2s`);
      }
    }
    if (root.listSkins().length) errors.push('Rigid asset contains skinning');
    if (root.listTextures().length) errors.push('Unexpected image texture');
    for (const node of root.listNodes()) {
      if (node.getScale().some((value) => Math.abs(value - 1) > 1e-5)) errors.push(`Unapplied scale ${node.getName()}`);
    }
    for (const material of root.listMaterials()) {
      const color = material.getBaseColorFactor();
      if (material.getName() === 'palette') {
        if (color.some((channel) => Math.abs(channel - 1) > 1e-5)) errors.push('Palette multiplier must be white');
        continue;
      }
      const expected = manifest.palette[material.getName()];
      if (!expected) { errors.push(`Unknown material ${material.getName()}`); continue; }
      for (let i = 0; i < 3; i += 1) {
        const channel = parseInt(expected.slice(i * 2, i * 2 + 2), 16);
        if (Math.abs(srgb(color[i]) - channel) > 1) errors.push(`Off-palette ${material.getName()}`);
      }
      if (material.getName() === 'glass' && Math.abs(color[3] - 0.3) > 0.001) errors.push('Glass alpha must be .3');
    }
    const allowed = Object.values(manifest.palette).map((hex) =>
      [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)));
    for (const mesh of root.listMeshes()) {
      for (const primitive of mesh.listPrimitives()) {
        if (primitive.getMaterial()?.getName() !== 'palette') continue;
        const colors = primitive.getAttribute('COLOR_0');
        if (!colors) { errors.push('Palette primitive is missing vertex colors'); continue; }
        for (let i = 0; i < colors.getCount(); i += 1) {
          const color = colors.getElement(i, []).slice(0, 3).map(srgb);
          if (!allowed.some((entry) => entry.every((value, channel) => Math.abs(color[channel] - value) <= 1))) {
            errors.push(`Off-palette vertex ${color.join(',')}`);
            break;
          }
        }
      }
    }
    const bounds = getBounds(root.listScenes()[0]);
    const height = bounds.max[1] - bounds.min[1];
    if (asset.grounded !== false && bounds.min[1] < -0.005) {
      errors.push(`Origin is not at ground level (min Y ${bounds.min[1]})`);
    }
    if (asset.maxHeight && height > asset.maxHeight) errors.push(`Height ${height} exceeds ${asset.maxHeight}`);
    if (triangles > asset.maxTriangles) errors.push(`${triangles} triangles exceeds ${asset.maxTriangles}`);
    if (validation.issues.numErrors) errors.push(...validation.issues.messages
      .filter((message) => message.severity === 0).map((message) => message.message));
    reports.push({ name: asset.name, triangles, primitives, bytes: bytes.length, nodes: names,
      clips, bounds, validatorErrors: validation.issues.numErrors,
      validatorWarnings: validation.issues.numWarnings, errors });
  }
  if (orphans.length) {
    reports.push({ name: 'manifest', triangles: 0, primitives: 0, bytes: 0, nodes: [],
      clips: [], bounds: null, validatorErrors: 0, validatorWarnings: 0,
      errors: orphans.map((name) => `Unmanifested model ${name}.glb`) });
  }
  return reports;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const reports = await validateModels();
  console.table(reports.map(({ name, triangles, primitives, validatorErrors, errors }) =>
    ({ name, triangles, primitives, validatorErrors, errors: errors.join('; ') })));
  if (process.argv.includes('--report')) await writeFile('assets/validation.json', `${JSON.stringify(reports, null, 2)}\n`);
  process.exitCode = reports.some((report) => report.errors.length > 0) ? 1 : 0;
}
