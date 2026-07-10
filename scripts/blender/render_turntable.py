import argparse
import json
import math
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Render a PNG preview or simple turntable from a Blender scene.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the output PNG file or frame prefix.")
    parser.add_argument("--manifest", default="", help="Optional manifest path to write.")
    parser.add_argument("--frames", type=int, default=1, help="Number of preview frames to render.")
    parser.add_argument("--resolution", type=int, default=1024, help="Square render resolution.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        raise FileNotFoundError("Input .blend file does not exist: {}".format(args.input))

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)
    ensure_camera(bpy)

    scene = bpy.context.scene
    scene.render.resolution_x = args.resolution
    scene.render.resolution_y = args.resolution
    scene.render.film_transparent = True

    frames = max(1, args.frames)
    for frame_index in range(frames):
        if frames > 1:
            rotate_avatar_collection(bpy, (math.tau / frames) * frame_index)
            output_path = frame_path(args.output, frame_index)
        else:
            output_path = args.output

        scene.render.filepath = output_path
        bpy.ops.render.render(write_still=True)
        print("PNG preview frame complete: {}".format(output_path))

    if args.manifest:
        write_manifest(args.manifest, args.input, args.output, "png-preview")


def ensure_camera(bpy):
    scene = bpy.context.scene
    camera = scene.camera
    if camera is None:
        bpy.ops.object.camera_add(location=(0, -6, 2.4), rotation=(math.radians(68), 0, 0))
        camera = bpy.context.object
        scene.camera = camera

    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.0


def rotate_avatar_collection(bpy, angle):
    collection = bpy.data.collections.get("Avatar") or bpy.context.scene.collection
    for obj in collection.objects:
        if obj.type in {"MESH", "CURVE", "GPENCIL", "EMPTY"}:
            obj.rotation_euler[2] = angle


def frame_path(output_path, frame_index):
    root, extension = os.path.splitext(output_path)
    return "{}_{:03d}{}".format(root, frame_index + 1, extension or ".png")


def write_manifest(manifest_path, input_path, output_path, export_type):
    os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "version": "0.1.0",
                "source": input_path,
                "exportType": export_type,
                "output": output_path,
                "guidance": "Use PNG previews for review and thumbnails. Keep generated renders local.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar Blender PNG preview failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
