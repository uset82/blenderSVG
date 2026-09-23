"""
Blender Curve Adapter for blenderSVG

Imports SVG paths as native 2D/3D Curves with bevel, extrusion,
and hierarchical collections for 3D modeling.
"""
from __future__ import annotations

import os
import bpy


def import_svg_as_curves(
    svg_path: str,
    target_collection_name: str = "Curves_3D",
    extrude: float = 0.01,
    bevel_depth: float = 0.002,
) -> list[bpy.types.Object]:
    """Import SVG file as 2D/3D editable curve objects with depth."""
    if not os.path.isfile(svg_path):
        raise FileNotFoundError(f"SVG file not found: {svg_path}")

    # Ensure SVG add-on enabled
    if not hasattr(bpy.ops.import_curve, "svg"):
        try:
            bpy.ops.preferences.addon_enable(module="io_curve_svg")
        except Exception as e:
            print(f"Warning enabling io_curve_svg: {e}")

    # Track newly created objects
    before = set(bpy.data.objects)
    result = bpy.ops.import_curve.svg(filepath=os.path.abspath(svg_path))
    if "FINISHED" not in result:
        raise RuntimeError("Blender import_curve.svg did not finish successfully.")

    imported = [obj for obj in bpy.data.objects if obj not in before and obj.type == "CURVE"]
    if not imported:
        raise RuntimeError("No curve objects were created from SVG.")

    # Target collection
    col = bpy.data.collections.get(target_collection_name)
    if not col:
        col = bpy.data.collections.new(target_collection_name)
        bpy.context.scene.collection.children.link(col)

    for obj in imported:
        for user_col in list(obj.users_collection):
            user_col.objects.unlink(obj)
        col.objects.link(obj)

        obj.data.dimensions = "2D"
        obj.data.extrude = extrude
        obj.data.bevel_depth = bevel_depth
        obj.data.fill_mode = "BOTH"

    print(f"Imported {len(imported)} curve objects into collection '{target_collection_name}'.")
    return imported
