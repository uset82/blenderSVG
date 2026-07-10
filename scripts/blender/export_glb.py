import argparse
import json
import os
import sys


def parse_args():
    parser = argparse.ArgumentParser(description="Export a Blender scene to GLB for Codex Avatar Studio.")
    parser.add_argument("--input", required=True, help="Path to the .blend file.")
    parser.add_argument("--output", required=True, help="Path to the output .glb file.")
    parser.add_argument("--manifest", default="", help="Optional manifest path to write.")
    return parser.parse_args(sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else [])


def main():
    args = parse_args()
    if not os.path.exists(args.input):
        raise FileNotFoundError("Input .blend file does not exist: {}".format(args.input))

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    import bpy

    bpy.ops.wm.open_mainfile(filepath=args.input)

    if not hasattr(bpy.ops.export_scene, "gltf"):
        raise RuntimeError("This Blender build does not include the glTF exporter.")

    bpy.ops.export_scene.gltf(
        filepath=args.output,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
    )

    if args.manifest:
        write_manifest(args.manifest, args.input, args.output, "glb")

    print("GLB export complete: {}".format(args.output))


def write_manifest(manifest_path, input_path, output_path, export_type):
    os.makedirs(os.path.dirname(os.path.abspath(manifest_path)), exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as file:
        json.dump(
            {
                "version": "0.1.0",
                "source": input_path,
                "exportType": export_type,
                "output": output_path,
                "guidance": "Use GLB for optional WebGL/Three.js avatar mode. Keep Blender optional for the IDE runtime.",
            },
            file,
            indent=2,
        )
        file.write("\n")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print("Codex Avatar Blender GLB export failed: {}".format(error), file=sys.stderr)
        sys.exit(1)
