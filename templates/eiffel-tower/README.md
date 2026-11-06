# Template: The Man Who Sold the Eiffel Tower

The full source of the proven example short (57 s, 1080x1920, 30 fps).
- `assets/scene.js`: the whole short. World (Paris street, hotel, river, procedural Eiffel Tower, train set), 2D cards drawn in Canvas2D, light presets (day, golden, night, dawn), camera keys, staging per shot, FX cards, and the post pass (ink lines, lens blur, fog, grade).
- `index.html`: the HyperFrames root. It loads `assets/scene.js` and the voice.

## Reuse it
1. `npx hyperframes init <name> --example blank --resolution portrait --audio voice.wav`
2. Copy `assets/scene.js` into the new project, plus three.js: `npm pack three@0.181.2`, then copy `package/build/three.module.js` and `three.core.js` into `assets/`.
3. Copy the `<div id="world">` block and the module script tag from `index.html`.
4. Change, in this order: `T` (word times from Whisper), the world (`building`, props), `SPECS` (characters), camera keys `key(...)`, `stage(t)`, `fxAt(t)`, `dofAt(t)`, `LT` (light timeline).
