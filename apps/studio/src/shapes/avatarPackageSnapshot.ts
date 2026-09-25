const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const STATIC_ATTRIBUTES = [
  "display",
  "visibility",
  "opacity",
  "fill",
  "fill-opacity",
  "stroke",
  "stroke-width",
  "stroke-linecap",
  "stroke-linejoin",
  "clip-path",
  "mask",
  "filter",
  "stop-color",
  "stop-opacity"
] as const;

const DEFAULT_VALUES: Record<(typeof STATIC_ATTRIBUTES)[number], string> = {
  display: "inline",
  visibility: "visible",
  opacity: "1",
  fill: "rgb(0, 0, 0)",
  "fill-opacity": "1",
  stroke: "none",
  "stroke-width": "1px",
  "stroke-linecap": "butt",
  "stroke-linejoin": "miter",
  "clip-path": "none",
  mask: "none",
  filter: "none",
  "stop-color": "rgb(0, 0, 0)",
  "stop-opacity": "1"
};

/** Makes a local, inert SVG snapshot from the SVG currently visible in the avatar stage. */
export function serializeAvatarSvgSnapshot(source: SVGSVGElement): string {
  if (source.localName !== "svg" || source.namespaceURI !== SVG_NAMESPACE || !source.ownerDocument.defaultView) {
    throw new Error("The avatar artwork is not an SVG element.");
  }

  const clone = source.cloneNode(true) as SVGSVGElement;
  const sourceNodes: SVGElement[] = [source, ...Array.from(source.querySelectorAll<SVGElement>("*"))];
  const cloneNodes: SVGElement[] = [clone, ...Array.from(clone.querySelectorAll<SVGElement>("*"))];
  const getComputedStyle = source.ownerDocument.defaultView.getComputedStyle.bind(source.ownerDocument.defaultView);

  for (const [index, original] of sourceNodes.entries()) {
    const target = cloneNodes[index];
    if (!target) continue;
    const computed = getComputedStyle(original);
    const parentStyle = original.parentElement ? getComputedStyle(original.parentElement) : null;
    for (const attribute of STATIC_ATTRIBUTES) {
      const value = computed.getPropertyValue(attribute).trim();
      const explicitlyStyled = original.style.getPropertyValue(attribute).trim() !== "";
      if (!value || value === DEFAULT_VALUES[attribute] || (original.hasAttribute(attribute) && !explicitlyStyled))
        continue;
      if (parentStyle?.getPropertyValue(attribute).trim() === value) continue;
      target.setAttribute(attribute, value);
    }
    target.removeAttribute("style");
    target.removeAttribute("class");
    target.removeAttribute("role");
    for (const name of Array.from(target.attributes, (item) => item.name)) {
      if (name.startsWith("data-") || name.startsWith("aria-")) target.removeAttribute(name);
    }
  }

  clone.removeAttribute("xmlns");
  const viewBox = clone.getAttribute("viewBox");
  const dimensions = viewBox
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (dimensions?.length === 4 && dimensions[2] && dimensions[3]) {
    if (!clone.hasAttribute("width")) clone.setAttribute("width", String(dimensions[2]));
    if (!clone.hasAttribute("height")) clone.setAttribute("height", String(dimensions[3]));
  }

  return new source.ownerDocument.defaultView.XMLSerializer().serializeToString(clone);
}
