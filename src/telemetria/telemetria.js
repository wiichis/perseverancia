// Central de telemetría en miniatura, con el mismo patrón que Open MCT
// (src/api/telemetry/TelemetryAPI.js en nasa/openmct):
// - cada dato tiene su ficha (metadatos): nombre, unidad, formato y de qué campo sale
// - lo sirve un proveedor que sabe dar el historial (request) y, si puede, avisar en vivo (subscribe)
// - la central elige el proveedor adecuado para cada dato

const proveedores = [];

// Igual que en Open MCT, el último proveedor registrado tiene prioridad
export function agregarProveedor(proveedor) {
  proveedores.unshift(proveedor);
}

export function proveedorDe(dato, capacidad = 'supportsRequest') {
  return proveedores.find((p) => p[capacidad]?.(dato));
}

// Historial completo del dato: lista de { sol, valor } ordenada por sol
export async function pedirHistorial(dato) {
  const proveedor = proveedorDe(dato);
  if (!proveedor) throw new Error(`Ningún proveedor sirve "${dato.nombre}"`);
  return proveedor.request(dato);
}

// Avisa de cada valor nuevo en vivo. Devuelve una función para cancelar,
// o null si el proveedor no da datos en vivo.
export function suscribir(dato, alRecibir) {
  const proveedor = proveedorDe(dato, 'supportsSubscribe');
  return proveedor ? proveedor.subscribe(dato, alRecibir) : null;
}
