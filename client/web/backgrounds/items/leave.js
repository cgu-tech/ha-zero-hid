export function createLeave(color, opacity, scale) {
  const leave = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M0,0 Q-5,10 0,20 Q5,10 0,0 Z");
  path.setAttribute("fill", color);
  path.setAttribute("opacity", opacity);
  path.setAttribute("transform", `scale(${scale})`);

  leave.appendChild(path);
  return leave;
}
