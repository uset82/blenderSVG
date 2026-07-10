import argparse
import json
import math
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Export Blender line art to SVG when Blender SVG support is available.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the output .svg file.")
    parser.add_argument("--manifest", default="", help="Optional manifest path to write.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        raise FileNotFoundError("Input .blend file does not exist: {}".format(args.input))

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)
    ensure_orthographic_camera(bpy)

    if try_grease_pencil_svg_export(bpy, args.output):
        if args.manifest:
            write_manifest(args.manifest, args.input, args.output, "svg-line-art")
        print("SVG line-art export complete: {}".format(args.output))
        return

    raise RuntimeError(
        "No supported SVG exporter was found. Use Blender's Grease Pencil SVG export or install/enable a Freestyle SVG export workflow."
    )


def ensure_orthographic_camera(bpy):
    scene = bpy.context.scene
    camera = scene.camera
    if camera is None:
        bpy.ops.object.camera_add(location=(0, -6, 2.4), rotation=(math.radians(68), 0, 0))
        camera = bpy.context.object
        scene.camera = camera

    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 4.0
    scene.render.use_freestyle = True


def try_grease_pencil_svg_export(bpy, output_path):
    if not hasattr(bpy.ops.wm, "grease_pencil_export_svg"):
        return False

    grease_pencil_objects = [obj for obj in bpy.context.scene.objects if obj.type in {"GPENCIL", "GREASEPENCIL"}]
    if not grease_pencil_objects:
        return False

    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    for obj in grease_pencil_objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = grease_pencil_objects[0]

    bpy.ops.wm.grease_pencil_export_svg(filepath=output_path)
    return os.path.exists(output_path)


def write_manifest(manifest_path, input_path, output_path, export_type):
    os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "version": "0.1.0",
                "source": input_path,
                "exportType": export_type,
                "output": output_path,
                "guidance": "Use Blender SVG export for line art and references. Rive/Live2D characters still need clean named layers.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar Blender SVG export failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
