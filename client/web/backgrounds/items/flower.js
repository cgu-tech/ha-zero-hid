export function createFlower(color, opacity, scale) {
  const flower = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const flowerGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  flowerGroup.setAttribute("fill", "transparent");
  flowerGroup.setAttribute("opacity", opacity);
  flowerGroup.setAttribute("transform", `scale(${scale})`);

  // Create the flower petals (5..8)
  const petals = 5 + Math.floor(Math.random() * 3);
  for (let i = 0; i < petals; i++) {
    const angle = (360 / petals) * i;
    const petal = document.createElementNS("http://www.w3.org/2000/svg", "ellipse");
    petal.setAttribute("cx", 0);
    petal.setAttribute("cy", -4);
    petal.setAttribute("rx", 2.5);
    petal.setAttribute("ry", 5);
    petal.setAttribute("fill", color);
    petal.setAttribute("transform", `rotate(${angle})`);
    flowerGroup.appendChild(petal);
  }

  const center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  center.setAttribute("r", 1.5);
  center.setAttribute("fill", "#ffffcc");
  flowerGroup.appendChild(center);

  flower.appendChild(flowerGroup);
  return flower;
}
