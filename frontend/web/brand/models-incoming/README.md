# Incoming character models

Drop character models from Meshy here, one `.glb` per character, named after the character
(for example `alien-zib.glb`, `astro-teal.glb`, `monster-gloop.glb`, `human-maya.glb`).

In Meshy's download settings:

- **Format:** `glb`, with textures (turn on PBR if offered).
- **Resize:** off is fine. **Origin:** Bottom.
- **Rigged and animated** (optional but best): rig the character, add a wave (for example
  "Big Wave Hello") and/or an idle, then download the GLB. The animation comes inside the file.

These are the source files. They're optimised (smaller textures, compressed geometry) into
`public/models/` for the site; this folder isn't served.
