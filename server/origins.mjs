// react-scripts reescribe Origin al destino del proxy (127.0.0.1:5000).
// Se aceptan las dos formas del mismo servicio local; no se habilitan orígenes arbitrarios.
export function origenesLocales(extra=''){
 return new Set(['http://localhost:3000','http://127.0.0.1:3000','http://localhost:5000','http://127.0.0.1:5000',...extra.split(',').map(s=>s.trim()).filter(Boolean)]);
}
