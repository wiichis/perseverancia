// Gráfica pequeña de toda la misión (eje X: soles; eje Y: valor) dibujada en un canvas 2D

const COLOR_LINEA = '#f0a46e';
const COLOR_AREA = 'rgba(240, 164, 110, 0.16)';
const COLOR_TEXTO = 'rgba(246, 220, 194, 0.6)';
const COLOR_PUNTO = '#ffe2c4';

export function dibujarGrafica(lienzo, historial, solHoy) {
  const ppp = Math.min(window.devicePixelRatio || 1, 2);
  const ancho = lienzo.clientWidth;
  const alto = lienzo.clientHeight;
  lienzo.width = ancho * ppp;
  lienzo.height = alto * ppp;
  const ctx = lienzo.getContext('2d');
  ctx.scale(ppp, ppp);
  ctx.clearRect(0, 0, ancho, alto);

  const valores = historial.map((d) => d.valor);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const solFin = Math.max(solHoy, historial[historial.length - 1].sol);
  const margenAbajo = 12;
  const x = (sol) => (sol / solFin) * ancho;
  const y = (v) => 2 + (1 - (v - min) / (max - min || 1)) * (alto - margenAbajo - 4);

  // Área bajo la línea y línea
  ctx.beginPath();
  historial.forEach((d, i) => (i ? ctx.lineTo(x(d.sol), y(d.valor)) : ctx.moveTo(x(d.sol), y(d.valor))));
  const ultimo = historial[historial.length - 1];
  ctx.strokeStyle = COLOR_LINEA;
  ctx.lineWidth = 1.5;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.lineTo(x(ultimo.sol), alto - margenAbajo);
  ctx.lineTo(x(historial[0].sol), alto - margenAbajo);
  ctx.fillStyle = COLOR_AREA;
  ctx.fill();

  // Punto del último valor
  ctx.beginPath();
  ctx.arc(x(ultimo.sol), y(ultimo.valor), 2.5, 0, Math.PI * 2);
  ctx.fillStyle = COLOR_PUNTO;
  ctx.fill();

  // Eje de soles
  ctx.fillStyle = COLOR_TEXTO;
  ctx.font = '10px ui-monospace, Menlo, monospace';
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'left';
  ctx.fillText('sol 0', 0, alto);
  ctx.textAlign = 'right';
  ctx.fillText(`sol ${Math.floor(solFin)}`, ancho, alto);
}
