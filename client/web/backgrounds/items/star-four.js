export function createStarFour(color, opacity, scale) {
  const star = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", 
   `M 6 1.5 L 7.0179 4.0808 C 7.1118 4.319 7.1588 4.4381 7.2307 4.5385 C 7.2945 4.6276 7.3724 
   4.7055 7.4615 4.7693 C 7.5619 4.8412 7.681 4.8882 7.9192 4.9822 L 10.5 6 L 7.9192 7.0179 
   C 7.681 7.1118 7.5619 7.1588 7.4615 7.2307 C 7.3724 7.2945 7.2945 7.3724 7.2307 7.4615 
   C 7.1588 7.5619 7.1118 7.681 7.0179 7.9192 L 6 10.5 L 4.9822 7.9192 C 4.8882 7.681 4.8412 
   7.5619 4.7693 7.4615 C 4.7055 7.3724 4.6276 7.2945 4.5385 7.2307 C 4.4381 7.1588 4.319 
   7.1118 4.0808 7.0179 L 1.5 6 L 4.0808 4.9822 C 4.319 4.8882 4.4381 4.8412 4.5385 4.7693 
   C 4.6276 4.7055 4.7055 4.6276 4.7693 4.5385 C 4.8412 4.4381 4.8882 4.319 4.9822 4.0808 L 6 1.5 Z`);
  path.setAttribute("fill", color);
  path.setAttribute("opacity", opacity);
  path.setAttribute("transform", `scale(${scale})`);

  star.appendChild(path);
  return star;
}
