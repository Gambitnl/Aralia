"""Headless TRELLIS.2 runner (executes ON the GPU VM, not locally).

Input:  /tmp/reference.png  (solid-background full-body creature reference)
Output: /tmp/master.glb

Pipeline calls mirror the official Space (microsoft/TRELLIS.2 app.py):
Trellis2ImageTo3DPipeline.run -> o_voxel.postprocess.to_glb.
"""
import sys

from PIL import Image

import o_voxel
from trellis2.pipelines import Trellis2ImageTo3DPipeline

RESOLUTION = "1024"  # 512 | 1024 (cascade) | 1536 (cascade)
DECIMATION_TARGET = 30000  # our combat triangle budget
TEXTURE_SIZE = 1024

def main() -> int:
    image = Image.open("/tmp/reference.png").convert("RGBA")
    print("loading pipeline (microsoft/TRELLIS.2-4B)…", flush=True)
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained("microsoft/TRELLIS.2-4B")
    pipeline.cuda()

    print("running image→3D…", flush=True)
    outputs = pipeline.run(
        image,
        seed=1,
        # our references have painted backgrounds — let the pipeline segment
        preprocess_image=True,
        pipeline_type={"512": "512", "1024": "1024_cascade", "1536": "1536_cascade"}[RESOLUTION],
    )
    mesh = outputs[0]

    print("extracting GLB…", flush=True)
    glb = o_voxel.postprocess.to_glb(
        vertices=mesh.vertices,
        faces=mesh.faces,
        attr_volume=mesh.attrs,
        coords=mesh.coords,
        attr_layout=pipeline.pbr_attr_layout,
        grid_size=mesh.res if hasattr(mesh, "res") else int(RESOLUTION),
        decimation_target=DECIMATION_TARGET,
        texture_size=TEXTURE_SIZE,
        remesh=True,
        use_tqdm=True,
    )
    glb.export("/tmp/master.glb", extension_webp=True)
    print("done: /tmp/master.glb", flush=True)
    return 0

if __name__ == "__main__":
    sys.exit(main())
