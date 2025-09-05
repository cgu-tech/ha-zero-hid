export function createCircle(color, opacity, scale) {
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("r", scale);
  circle.setAttribute("fill", color);
  circle.setAttribute("opacity", opacity);
  return circle;
}
