export function createHeart(color, opacity, scale) {
  const heart = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", 
   `M12.7692 6.70483C9.53846 2.01902 4 3.90245 4 8.68256C4 13.4627 13.2308 20 13.2308 
   20C13.2308 20 22 13.2003 22 8.68256C22 4.16479 16.9231 2.01903 13.6923 6.70483L13.2308 
   7.0791L12.7692 6.70483Z`);
  path.setAttribute("fill", color);
  path.setAttribute("opacity", opacity);
  path.setAttribute("transform", `scale(${scale})`);

  heart.appendChild(path);
  return heart;
}
