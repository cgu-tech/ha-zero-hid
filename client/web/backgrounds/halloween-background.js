createLeaf() {
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.classList.add("leaf");
  g.style.visibility = 'hidden'; // Hide until animation begins

  const rand = (min, max) => Math.random() * (max - min) + min;
  const typeRoll = Math.random(); // Random selector
  let element;

  if (typeRoll < 0.25) {
    // 🎃 Pumpkin (simple circle with a stem)
    element = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const pumpkin = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pumpkin.setAttribute("r", "8");
    pumpkin.setAttribute("cx", "0");
    pumpkin.setAttribute("cy", "0");
    pumpkin.setAttribute("fill", "#FF7518");
    pumpkin.setAttribute("stroke", "#A0522D");
    pumpkin.setAttribute("stroke-width", "1");

    const stem = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    stem.setAttribute("x", "-1");
    stem.setAttribute("y", "-10");
    stem.setAttribute("width", "2");
    stem.setAttribute("height", "4");
    stem.setAttribute("fill", "#654321");

    element.appendChild(pumpkin);
    element.appendChild(stem);
  } else if (typeRoll < 0.5) {
    // 👻 Ghost (stylized path)
    element = document.createElementNS("http://www.w3.org/2000/svg", "path");
    element.setAttribute("d", "M0,-10 Q5,-20 10,-10 Q15,-5 10,0 Q5,5 0,0 Q-5,-5 -10,0 Q-15,-5 -10,-10 Q-5,-20 0,-10 Z");
    element.setAttribute("fill", "#eeeeee");
    element.setAttribute("stroke", "#999");
    element.setAttribute("stroke-width", "0.5");
    element.setAttribute("opacity", rand(0.7, 1));
  } else if (typeRoll < 0.75) {
    // 🕷️ Spider (circle with 8 legs)
    element = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const body = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    body.setAttribute("r", "5");
    body.setAttribute("cx", "0");
    body.setAttribute("cy", "0");
    body.setAttribute("fill", "black");

    const createLeg = (x1, y1, x2, y2) => {
      const leg = document.createElementNS("http://www.w3.org/2000/svg", "line");
      leg.setAttribute("x1", x1);
      leg.setAttribute("y1", y1);
      leg.setAttribute("x2", x2);
      leg.setAttribute("y2", y2);
      leg.setAttribute("stroke", "black");
      leg.setAttribute("stroke-width", "1");
      return leg;
    };

    element.appendChild(body);
    // Add 8 legs
    element.appendChild(createLeg(-5, 0, -10, -5));
    element.appendChild(createLeg(-5, 0, -10, 5));
    element.appendChild(createLeg(5, 0, 10, -5));
    element.appendChild(createLeg(5, 0, 10, 5));
    element.appendChild(createLeg(-4, -3, -9, -8));
    element.appendChild(createLeg(-4, 3, -9, 8));
    element.appendChild(createLeg(4, -3, 9, -8));
    element.appendChild(createLeg(4, 3, 9, 8));
  } else {
    // 🕸️ Spider web (simple web shape)
    element = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("r", "8");
    circle.setAttribute("cx", "0");
    circle.setAttribute("cy", "0");
    circle.setAttribute("stroke", "#ccc");
    circle.setAttribute("fill", "none");
    circle.setAttribute("stroke-width", "0.5");

    const lines = [
      [-8, 0, 8, 0],
      [0, -8, 0, 8],
      [-6, -6, 6, 6],
      [-6, 6, 6, -6],
    ];

    element.appendChild(circle);
    for (const [x1, y1, x2, y2] of lines) {
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", x1);
      line.setAttribute("y1", y1);
      line.setAttribute("x2", x2);
      line.setAttribute("y2", y2);
      line.setAttribute("stroke", "#ccc");
      line.setAttribute("stroke-width", "0.5");
      element.appendChild(line);
    }
  }

  // Random scale + opacity (applies to whole group)
  const scale = rand(1.2, 2.8);
  element.setAttribute("transform", `scale(${scale})`);
  g.appendChild(element);
  this.svg.appendChild(g);
  this._leaves.push(g);
  return g;
}
