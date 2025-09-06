export function createWeb(color, opacity, scale) {
  const web = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const webGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  webGroup.setAttribute("fill", "transparent");
  webGroup.setAttribute("stroke-width", "1");
  webGroup.setAttribute("stroke-linejoin", "round");
  webGroup.setAttribute("stroke", color);
  webGroup.setAttribute("opacity", opacity);
  webGroup.setAttribute("transform", `scale(${scale})`);

  const paths = [
    // Axes
    "M0,13.5 L31.65,13.5",
    "M7.4,0.05 L24.25,26.95",
    "M7.5,27 L24.15,0",

    // Web rings
    "M9,24.95 L2.15,13.5 L9,2.05 L22.65,2.05 L29.5,13.5 L22.65,24.95 L9,24.95 Z",
    "M10.8,22 L5.8,13.5 L10.8,5 L20.8,5 L25.8,13.5 L20.8,22 L10.8,22 Z",
    "M12.8,18.5 L9.8,13.5 L12.8,8.5 L18.8,8.5 L21.8,13.5 L18.8,18.5 L12.8,18.5 Z"
  ];

  paths.forEach(d => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    webGroup.appendChild(path);
  });

  web.appendChild(webGroup);
  return web;
}
