<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Growing Plant with Blooming Flowers</title>
  <style>
    html, body {
      margin: 0;
      height: 100%;
      overflow: hidden;
      background: #0b0f0c;
    }

    svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    .content {
      position: absolute;
      z-index: 1;
      color: white;
      text-align: center;
      width: 100%;
      top: 40%;
      font-family: sans-serif;
    }

    .background {
      position: absolute;
      inset: 0;
      pointer-events: none;
      z-index: 0;
    }

    .plant-part {
      transform-box: fill-box;
      transform-origin: bottom center;
    }

    .flower {
      transform-box: fill-box;
      transform-origin: center;
      opacity: 0;
    }
  </style>
</head>
<body>

  <div class="background">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300" preserveAspectRatio="xMidYMax meet">
      <g id="plant"></g>
    </svg>
  </div>

  <div class="content">
    <h1>🌸 Growing Garden</h1>
    <p>Watch as the plant grows and blooms...</p>
  </div>

  <script>
    const svgNS = "http://www.w3.org/2000/svg";
    const plant = document.getElementById("plant");
    const flowerColors = ["#ff69b4", "#ff6347", "#ffa500", "#ff1493", "#adff2f", "#00ffff"];

    function createStem(x, y, height) {
      const line = document.createElementNS(svgNS, "rect");
      line.setAttribute("x", x - 1);
      line.setAttribute("y", y - height);
      line.setAttribute("width", 2);
      line.setAttribute("height", height);
      line.setAttribute("fill", "#2e8b57");
      line.classList.add("plant-part");
      plant.appendChild(line);

      line.animate([
        { transform: "scaleY(0)" },
        { transform: "scaleY(1)" }
      ], {
        duration: 3000,
        fill: "forwards",
        easing: "ease-out"
      });
    }

    function createLeaf(x, y, direction = 1) {
      const path = document.createElementNS(svgNS, "path");
      const d = `
        M ${x},${y}
        q ${10 * direction},-5 ${15 * direction},-15
        q ${-5 * direction},10 ${-15 * direction},15
        Z`;
      path.setAttribute("d", d);
      path.setAttribute("fill", "#3cb371");
      path.classList.add("plant-part");
      plant.appendChild(path);

      path.animate([
        { transform: "scale(0)" },
        { transform: "scale(1)" }
      ], {
        duration: 2000,
        delay: 1000,
        fill: "forwards",
        easing: "ease-out"
      });
    }

    function createFlower(x, y) {
      const g = document.createElementNS(svgNS, "g");
      g.classList.add("flower");
      g.setAttribute("transform", `translate(${x}, ${y}) scale(0)`);

      const petals = 6;
      const color = flowerColors[Math.floor(Math.random() * flowerColors.length)];

      for (let i = 0; i < petals; i++) {
        const angle = (360 / petals) * i;
        const petal = document.createElementNS(svgNS, "ellipse");
        petal.setAttribute("cx", 0);
        petal.setAttribute("cy", -6);
        petal.setAttribute("rx", 2.5);
        petal.setAttribute("ry", 6);
        petal.setAttribute("fill", color);
        petal.setAttribute("transform", `rotate(${angle})`);
        g.appendChild(petal);
      }

      const center = document.createElementNS(svgNS, "circle");
      center.setAttribute("r", 2);
      center.setAttribute("fill", "#ffffcc");
      g.appendChild(center);

      plant.appendChild(g);

      g.animate([
        { transform: `translate(${x}px, ${y}px) scale(0)`, opacity: 0 },
        { transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 }
      ], {
        duration: 2000,
        delay: 2000 + Math.random() * 2000,
        fill: "forwards",
        easing: "ease-out"
      });
    }

    function growPlant() {
      const stemHeight = 100;
      const baseX = 100;
      const baseY = 280;

      // Main stem
      createStem(baseX, baseY, stemHeight);

      // Side leaves
      setTimeout(() => {
        createLeaf(baseX - 2, baseY - 30, -1);
        createLeaf(baseX + 2, baseY - 50, 1);
        createLeaf(baseX - 2, baseY - 70, -1);
      }, 1000);

      // Flowers at top
      setTimeout(() => {
        createFlower(baseX, baseY - stemHeight - 5);
        createFlower(baseX - 10, baseY - stemHeight + 5);
        createFlower(baseX + 10, baseY - stemHeight + 5);
      }, 2500);
    }

    growPlant();
  </script>
</body>
</html>
