/** SVG path for a triangle arrow marker (open or filled). */
export function arrowTrianglePath(size: number): string {
  return `M 0 0 L ${size} ${size / 2} L 0 ${size} Z`;
}

/** Alias — same geometry as triangle, rendered filled via the `<marker>` `fill`. */
export function arrowTriangleFilledPath(size: number): string {
  return arrowTrianglePath(size);
}

/** SVG path for a diamond arrow marker. */
export function arrowDiamondPath(size: number): string {
  const h = size / 2;
  return `M ${h} 0 L ${size} ${h} L ${h} ${size} L 0 ${h} Z`;
}

/** SVG path for a circle arrow marker. */
export function arrowCirclePath(size: number): string {
  const r = size / 2;
  return [
    `M ${size} ${r}`,
    `A ${r} ${r} 0 1 0 0 ${r}`,
    `A ${r} ${r} 0 1 0 ${size} ${r}`,
  ].join(" ");
}
