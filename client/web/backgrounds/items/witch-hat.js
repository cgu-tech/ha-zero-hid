export function createWitchHat(color, opacity, scale) {
  const witchHat = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", 
   `M 25.591 17.3092 c -0.0398 -0.2946 -0.7459 -1.5796 -3.9114 -3.313 l -2.1568 -0.5967 l -1.9131 -5.6218 l 4.4091 -3.2786 c 1.4317 -0.8285 0.9044 
   -1.4697 -0.4142 -1.4693 c -7.9944 0.0026 -11.5318 -0.98 -13.19 3.994 c -0.409 1.2264 -1.1555 3.9551 -1.7735 6.2736 C -0.1055 15.1024 -0.1832 16.7448 
   0.0705 17.2187 l 1.182 2.209 l 4.7125 2.2558 l 2.2233 -2.1851 v 2.6378 c 0 0 4.4467 0.98 8.366 0.2261 c 3.9196 -0.7539 6.0297 -1.7334 6.0297 -1.7334 
   l -0.6033 -1.6583 l 1.8849 0.8289 l 1.4777 -1.675 C 25.5402 17.9014 25.6303 17.6038 25.591 17.3092 z M 6.8016 16.1764 c 0.1358 -0.9531 0.5721 -1.9432 
   0.7008 -2.8485 c 3.7045 0.5274 7.4653 0.5274 11.1697 0 c 0.129 0.9053 0.5653 1.8955 0.7013 2.8485 C 15.2037 16.77 10.9712 16.77 6.8016 16.1764 z`);
  path.setAttribute("fill", color);
  path.setAttribute("opacity", opacity);
  path.setAttribute("transform", `scale(${scale})`);

  witchHat.appendChild(path);
  return witchHat;
}
