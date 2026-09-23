"""
Blender Grease Pencil Adapter for blenderSVG

Specialized adapter for importing and exporting Grease Pencil drawings,
retaining stroke widths, fill colors, and frame-by-frame vector animations.
"""
from __future__ import annotations

import os
import bpy


def export_grease_pencil_to_svg(
    output_path: str,
    gp_object_name: str | None = None,
    start_frame: int | None = None,
    end_frame: int | None = None,
) -> str:
    """Export Grease Pencil strokes and fills to SVG (single frame or animation)."""
    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)

    target_obj = None
    if gp_object_name:
        target_obj = bpy.data.objects.get(gp_object_name)
    else:
        # Find first Grease Pencil or GPencil object in scene
        for obj in bpy.context.scene.objects:
            if obj.type in ("GPENCIL", "GREASEPENCIL"):
                target_obj = obj
                break

    if not target_obj:
        raise ValueError("No Grease Pencil object found in scene to export.")

    # Select target object
    bpy.ops.object.select_all(action="DESELECT")
    target_obj.select_set(True)
    bpy.context.view_layer.objects.active = target_obj

    # Configure frame range
    if start_frame is not None:
        bpy.context.scene.frame_start = start_frame
    if end_frame is not None:
        bpy.context.scene.frame_end = end_frame

    # Export using Blender's GP SVG operator
    # Blender 4.3+ / 4.5+ uses wm.gpencil_export_svg or grease_pencil export
    export_op = getattr(bpy.ops.wm, "gpencil_export_svg", None)
    if not export_op:
        export_op = getattr(bpy.ops.grease_pencil, "export_svg", None)

    if export_op:
        result = export_op(filepath=os.path.abspath(output_path), selected_object_type="ACTIVE")
        if "FINISHED" not in result:
            raise RuntimeError(f"Grease Pencil SVG export failed: {result}")
    else:
        raise NotImplementedError("Grease Pencil SVG exporter is not available in this Blender environment.")

    print(f"Exported Grease Pencil SVG to {output_path}")
    return os.path.abspath(output_path)
