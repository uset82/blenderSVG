import { GeoShapeUtil, PathBuilder } from "tldraw";

/** Adds a persisted rounded rectangle variant to tldraw's geometry utility. */
export const StudioGeoShapeUtil = GeoShapeUtil.configure({
  customGeoTypes: {
    "studio-rounded-rectangle": {
      icon: "geo-rectangle",
      snapType: "polygon",
      getPath(width, height, shape) {
        const storedRadius = shape.meta.studioRadius;
        const radius = Math.min(
          Math.max(0, typeof storedRadius === "number" && Number.isFinite(storedRadius) ? storedRadius : 0),
          width / 2,
          height / 2
        );
        const isFilled = shape.props.fill !== "none";
        const startOptions = { geometry: { isFilled } };

        return new PathBuilder()
          .moveTo(radius, 0, startOptions)
          .lineTo(width - radius, 0)
          .arcTo(radius, radius, false, true, 0, width, radius)
          .lineTo(width, height - radius)
          .arcTo(radius, radius, false, true, 0, width - radius, height)
          .lineTo(radius, height)
          .arcTo(radius, radius, false, true, 0, 0, height - radius)
          .lineTo(0, radius)
          .arcTo(radius, radius, false, true, 0, radius, 0)
          .close();
      }
    }
  }
});
