export const ADMIN = 'Administrador General';
export const CAJERO = 'Cajero / Ventas de Mostrador';
export const ALMACEN = 'Encargado de Almacén';
export const TALLER = 'Taller y Servicios Mecánicos';
export const ROLES = [ADMIN, CAJERO, ALMACEN, TALLER];
export const METODOS = ['Efectivo', 'Tarjeta de Débito / Crédito', 'Transferencia SPEI'];
export const BASE = [
  ['REF-181','Balata Delantera Cerámica','Frenos',250,450,15],
  ['REF-305','Filtro de Aceite PH3593A','Mantenimiento',90,180,8],
  ['REF-512','Aceite Sintético 5W30 1L','Fluidos',120,220,25],
  ['REF-901','Batería 12V LTH Heavy Duty','Eléctrico',1100,1850,5],
  ['REF-204','Amortiguador Gas Delantero','Suspensión',650,1200,10],
  ['REF-410','Bomba de Agua Tsuru III','Motor',320,620,6],
  ['REF-602','Juego de Bujías Iridio (4 pzas)','Afinación',280,480,12],
  ['REF-185','Disco de Freno Ventilado Versa','Frenos',490,890,7]
].map(([codigo,descripcion,categoria,precioCompra,precioVenta,stock]) => ({
  codigo, descripcion, categoria, precioCompra, precioVenta, stock, stockMinimo: 5, activo: true
}));
export function id(prefijo) {
  if (globalThis.crypto?.randomUUID) return `${prefijo}-${globalThis.crypto.randomUUID()}`;
  throw new Error('El navegador requiere un origen seguro (localhost) para generar identificadores.');
}
export function siguienteFolio(prefijo,lista) {
  const usados=new Set(lista.map(x=>String(x.folio)));
  let n=lista.reduce((max,x)=>{const m=String(x.folio||'').match(new RegExp(`^${prefijo}-(\\d+)$`));return m?Math.max(max,Number(m[1])):max;},0)+1;
  if(!Number.isSafeInteger(n))throw new Error('Se agotó la secuencia de folios.');
  let folio=`${prefijo}-${String(n).padStart(6,'0')}`;
  while(usados.has(folio)){n++;folio=`${prefijo}-${String(n).padStart(6,'0')}`;}
  return folio;
}
export function numero(valor, nombre = 'Importe', entero = false) {
  if (valor === '' || valor === null || valor === undefined || typeof valor === 'boolean') throw new Error(`${nombre}: captura un valor.`);
  const n = Number(valor);
  if (!Number.isFinite(n) || n < 0 || (entero && !Number.isSafeInteger(n))) throw new Error(`${nombre}: valor no válido.`);
  return n;
}
export function centavos(valor, nombre) {
  const n = Math.round((numero(valor, nombre) + Number.EPSILON) * 100);
  if (!Number.isSafeInteger(n)) throw new Error('El importe es demasiado grande.');
  return n;
}
export function permiso(usuario, roles) {
  if (!usuario || !roles.includes(usuario.rol)) throw new Error('Tu usuario no tiene permiso para esta operación.');
}
export function texto(valor, nombre, max = 160) {
  const s = String(valor ?? '').trim();
  if (!s || s.length > max) throw new Error(`${nombre}: captura de 1 a ${max} caracteres.`);
  return s;
}
export function totales(items, manoObra = 0) {
  let subtotalCentavos = centavos(manoObra, 'Mano de obra');
  for (const item of items) {
    const q = numero(item.cantidad, 'Cantidad', true);
    if (q < 1) throw new Error('La cantidad debe ser mayor que cero.');
    subtotalCentavos += q * centavos(item.precioVenta, 'Precio');
  }
  if (!Number.isSafeInteger(subtotalCentavos)) throw new Error('El total es demasiado grande.');
  const ivaCentavos = Math.round(subtotalCentavos * 16 / 100);
  return { subtotal: subtotalCentavos / 100, iva: ivaCentavos / 100, total: (subtotalCentavos + ivaCentavos) / 100 };
}
export function agregarCarrito(carrito, producto, cantidad) {
  if (!producto || producto.activo === false) throw new Error('Selecciona una pieza activa.');
  const q = numero(cantidad, 'Cantidad', true);
  if (q < 1) throw new Error('La cantidad debe ser mayor que cero.');
  const anterior = carrito.find(i => i.codigo === producto.codigo);
  const acumulada = q + (anterior?.cantidad || 0);
  if (acumulada > numero(producto.stock,'Stock',true)) throw new Error(`Stock insuficiente de ${producto.descripcion}. Disponible: ${producto.stock}.`);
  const nuevo = { codigo: producto.codigo, descripcion: producto.descripcion, precioVenta: numero(producto.precioVenta), cantidad: acumulada };
  return anterior ? carrito.map(i => i.codigo === producto.codigo ? nuevo : i) : [...carrito,nuevo];
}
export function completarVenta(estado, entrada, usuario) {
  permiso(usuario,[ADMIN,CAJERO]);
  if (!entrada.id) throw new Error('Falta el identificador de la venta.');
  const anterior = estado.ventas.find(v => v.id === entrada.id);
  if (anterior) return { estado, venta: anterior, repetida: true };
  let orden = null;
  if (entrada.ordenId) {
    orden = estado.ordenes.find(o => o.id === entrada.ordenId);
    if (!orden || orden.estado !== 'Terminado' || orden.ventaId) throw new Error('La orden no está disponible para cobro.');
  }
  const pedido = entrada.pedidoId ? estado.pedidos.find(p => p.id === entrada.pedidoId) : null;
  if (entrada.pedidoId && (!pedido || pedido.estado !== 'Pendiente')) throw new Error('El pedido ya fue atendido o cancelado.');
  const solicitados = orden ? (orden.piezas || []) : entrada.items;
  if (!Array.isArray(solicitados) || (!solicitados.length && !orden)) throw new Error('Agrega al menos una pieza.');
  const codigos = new Set();
  const items = solicitados.map(item => {
    if (codigos.has(item.codigo)) throw new Error('Hay piezas duplicadas en la venta.');
    codigos.add(item.codigo);
    const prod = estado.productos.find(p => p.codigo === item.codigo);
    if (!prod || prod.activo === false) throw new Error(`La pieza ${item.codigo} no está disponible.`);
    const cantidad = numero(item.cantidad,'Cantidad',true);
    if (!cantidad || cantidad > numero(prod.stock,'Stock',true)) throw new Error(`Stock insuficiente de ${prod.descripcion}.`);
    const precioVenta = numero(prod.precioVenta,'Precio');
    const precioCompra = prod.precioCompra === null || prod.precioCompra === undefined ? null : numero(prod.precioCompra,'Costo');
    if (centavos(precioVenta) !== centavos(item.precioVenta)) throw new Error(`Cambió el precio de ${prod.descripcion}. Carga nuevamente la venta.`);
    return { codigo:prod.codigo, descripcion:prod.descripcion, cantidad, precioVenta, precioCompra, subtotal:centavos(precioVenta)*cantidad/100 };
  });
  if (pedido && (items.length !== 1 || items[0].codigo !== pedido.codigo || items[0].cantidad !== pedido.cantidad)) throw new Error('La venta no coincide con el pedido.');
  const manoObra = orden ? numero(orden.manoObra,'Mano de obra') : 0;
  const importes = totales(items, manoObra);
  if (!METODOS.includes(entrada.metodoPago)) throw new Error('Selecciona un método de pago válido.');
  const efectivo = entrada.metodoPago === 'Efectivo';
  const recibido = efectivo ? centavos(entrada.recibido,'Efectivo recibido') : centavos(importes.total);
  if (recibido < centavos(importes.total)) throw new Error('El efectivo recibido es menor al total.');
  const venta = {
    id:entrada.id, folio:`TICK-${String(estado.secuenciaVenta + 1).padStart(6,'0')}`,
    fechaISO:new Date().toISOString(), cajero:usuario.usuario, estado:'Pagada', items,
    manoObra, ...importes, metodoPago:entrada.metodoPago, pagadoCon:recibido/100,
    cambio:efectivo ? (recibido-centavos(importes.total))/100 : 0,
    pedidoId:pedido?.id || null, ordenId:orden?.id || null
  };
  const productos = estado.productos.map(p => {
    const item = items.find(i => i.codigo === p.codigo);
    return item ? {...p,stock:p.stock-item.cantidad} : p;
  });
  const movimientos = items.map(i => ({ id:id('MOV'),fechaISO:venta.fechaISO,codigo:i.codigo,cantidad:-i.cantidad,tipo:'Venta',referencia:venta.folio,usuario:usuario.usuario }));
  return { venta, estado:{...estado, secuenciaVenta:estado.secuenciaVenta+1, productos,
    ventas:[...estado.ventas,venta], movimientos:[...estado.movimientos,...movimientos],
    pedidos:estado.pedidos.map(p => p.id===pedido?.id ? {...p,estado:'Atendido',ventaId:venta.id} : p),
    ordenes:estado.ordenes.map(o => o.id===orden?.id ? {...o,estado:'Pagado',ventaId:venta.id} : o)
  }};
}
export function anularVenta(estado, ventaId, motivo, usuario) {
  permiso(usuario,[ADMIN]);
  const razon = texto(motivo,'Motivo');
  const venta=estado.ventas.find(v=>v.id===ventaId);
  if (!venta || venta.estado !== 'Pagada') throw new Error('La venta no se puede anular.');
  if (venta.legado) throw new Error('Las ventas anteriores a la actualización se conservan solo como historial.');
  const productos=estado.productos.map(p=>{
    const item=venta.items.find(i=>i.codigo===p.codigo);
    return item ? {...p,stock:p.stock+item.cantidad} : p;
  });
  if (venta.items.some(i=>!productos.some(p=>p.codigo===i.codigo))) throw new Error('Falta una pieza del historial; no se puede revertir.');
  return {...estado,productos,
    ventas:estado.ventas.map(v=>v.id===ventaId?{...v,estado:'Anulada',motivo:razon,anuladaPor:usuario.usuario,anuladaISO:new Date().toISOString()}:v),
    movimientos:[...estado.movimientos,...venta.items.map(i=>({id:id('MOV'),fechaISO:new Date().toISOString(),codigo:i.codigo,cantidad:i.cantidad,tipo:'Anulación',referencia:venta.folio,usuario:usuario.usuario,motivo:razon}))],
    ordenes:estado.ordenes.map(o=>o.id===venta.ordenId?{...o,estado:'Terminado',ventaId:null}:o)
  };
}
export function resumenVentas(ventas) {
  const pagadas=ventas.filter(v=>v.estado!=='Anulada');
  const porMetodo=Object.fromEntries(METODOS.map(m=>[m,0]));
  let total=0,margen=0,sinCosto=0;
  for (const v of pagadas) {
    total+=centavos(v.total);
    porMetodo[v.metodoPago]=(porMetodo[v.metodoPago] || 0)+centavos(v.total);
    if (v.legado || !v.items?.length || v.items.some(i=>i.precioCompra===null || i.precioCompra===undefined) || v.manoObra>0) sinCosto++;
    else margen+=v.items.reduce((s,i)=>s+(centavos(i.precioVenta)-centavos(i.precioCompra))*i.cantidad,0);
  }
  return {total:total/100,margen:margen/100,sinCosto,porMetodo:Object.fromEntries(Object.entries(porMetodo).map(([k,v])=>[k,v/100])),cantidad:pagadas.length};
}
