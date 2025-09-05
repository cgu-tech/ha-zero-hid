export function createGift(color, opacity, scale) {
  const gift = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const giftGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  giftGroup.setAttribute("opacity", opacity);
  giftGroup.setAttribute("transform", `scale(${scale})`);

  const polygon1 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon1.setAttribute("points", `13.5404,13.74985 22.0579,13.74985 22.0579,13.6833 22.0579,12.2238 22.0579,9.3058 13.5404,9.3058`);
  polygon1.setAttribute("fill", color);
  giftGroup.appendChild(polygon1);

  const polygon2 = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon2.setAttribute("points", `3.5419,12.2238 3.5419,13.6833 3.5419,13.74985 12.05935,13.74985 12.05935,9.3058 3.5419,9.3058`);
  polygon2.setAttribute("fill", color);
  giftGroup.appendChild(polygon2);

  const rect1 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect1.setAttribute("x", "13.5404");
  rect1.setAttribute("y", "15.23085");
  rect1.setAttribute("width", "8.5175");
  rect1.setAttribute("height", "10.36915");
  rect1.setAttribute("fill", color);
  giftGroup.appendChild(rect1);

  const rect2 = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  rect2.setAttribute("x", "3.5419");
  rect2.setAttribute("y", "15.23085");
  rect2.setAttribute("width", "8.51745");
  rect2.setAttribute("height", "10.36915");
  rect2.setAttribute("fill", color);
  giftGroup.appendChild(rect2);

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", 
   `M14.4824,8.5435C23.3927,7.0012,24.0256,1.07615,20.3084,0.14685C16.4015-0.8298,13.7447,3.30655,
    12.8001,5.43165C11.8553,3.30655,9.1985-0.8298,5.2916,0.14685C1.5744,1.07615,2.2073,7.0012,11.1177,
    8.5435c0.73355,0.1263,1.3212-0.1833,1.68225-0.6556C13.16115,8.36025,13.7488,8.66985,14.4824,8.5435z
    M17.8488,4.91535c-0.0345,0.9408-1.2798,2.16245-3.9325,2.62135c-0.0287,0.0048-0.05645,0.00715-0.08375,
    0.00715c-0.11245,0-0.2079-0.0459-0.2845-0.13635c-0.0852-0.10045-0.1299-0.2426-0.11125-0.35365c0.0799-0.44455,
    1.3083-3.1128,3.1532-3.1128c0.1656,0,0.33595,0.02155,0.50675,0.0646C17.59415,4.12865,17.8661,4.46015,
    17.8488,4.91535z
    M8.50345,4.00565c0.1706-0.043,0.34095-0.0646,0.5065-0.0646c1.8449,0,3.0733,2.66825,3.1532,3.1128
    c0.0187,0.11105-0.02605,0.2532-0.11125,0.35365c-0.0766,0.09045-0.17205,0.13635-0.2845,
    0.13635c-0.0273,0-0.0551-0.00235-0.0837-0.00715c-2.6528-0.4589-3.8981-1.68055-3.93255-2.62135
    C7.7336,4.46015,8.00555,4.12865,8.50345,4.00565z`);
  path.setAttribute("fill", color);
  giftGroup.appendChild(path);

  gift.appendChild(giftGroup);
  return gift;
}
