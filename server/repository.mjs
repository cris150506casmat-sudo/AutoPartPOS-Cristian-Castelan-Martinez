import {pool} from './db.mjs';
// Este prototipo carga el conjunto de datos bajo un bloqueo global para simplificar
// la explicación y garantizar coherencia. Para catálogos grandes usar consultas paginadas.
export async function leer(c=pool){
 const [meta]=await c.query('SELECT revision,secuencia_venta FROM configuracion WHERE id=1');
 const [usuarios]=await c.query('SELECT usuario,password_hash AS passwordHash,rol FROM usuarios WHERE activo=1');
 const [productos]=await c.query('SELECT codigo,descripcion,categoria,precio_compra AS precioCompra,precio_venta AS precioVenta,stock,stock_minimo AS stockMinimo,activo FROM productos ORDER BY codigo');
 const [ordenes]=await c.query('SELECT id,folio,cliente,vehiculo,placas,servicio,mecanico,mano_obra AS manoObra,estado,fecha_iso AS fechaISO,usuario,venta_id AS ventaId,legado,importe_anterior AS importeAnterior FROM ordenes ORDER BY fecha_iso DESC');
 const [piezas]=await c.query('SELECT orden_id AS ordenId,producto_codigo AS codigo,descripcion,cantidad,precio_venta AS precioVenta FROM detalle_orden');
 const [ventas]=await c.query('SELECT id,folio,fecha_iso AS fechaISO,cajero,estado,metodo_pago AS metodoPago,subtotal,iva,total,mano_obra AS manoObra,pagado_con AS pagadoCon,cambio,pedido_id AS pedidoId,orden_id AS ordenId,motivo,anulada_por AS anuladaPor,anulada_iso AS anuladaISO FROM ventas ORDER BY fecha_iso,id');
 const [items]=await c.query('SELECT venta_id AS ventaId,producto_codigo AS codigo,descripcion,cantidad,precio_venta AS precioVenta,precio_compra AS precioCompra,subtotal FROM detalle_venta');
 const [pedidos]=await c.query('SELECT p.id,p.folio,p.cliente,p.telefono,p.producto_codigo AS codigo,p.cantidad,p.precio,p.fecha_iso AS fechaISO,p.estado,p.venta_id AS ventaId,p.motivo,r.descripcion AS producto FROM pedidos p JOIN productos r ON r.codigo=p.producto_codigo ORDER BY p.fecha_iso DESC');
 const [archivos]=await c.query('SELECT contenido FROM importaciones ORDER BY fecha_iso');
 const antiguas=archivos.flatMap(a=>(typeof a.contenido==='string'?JSON.parse(a.contenido):a.contenido).ventas||[]);
 const [movimientos]=await c.query('SELECT id,fecha_iso AS fechaISO,producto_codigo AS codigo,cantidad,tipo,referencia,motivo,usuario FROM movimientos ORDER BY fecha_iso,id');
 return {version:3,revision:Number(meta[0].revision),secuenciaVenta:Number(meta[0].secuencia_venta),usuarios,productos:productos.map(p=>({...p,activo:Boolean(p.activo)})),ordenes:ordenes.map(o=>({...o,piezas:piezas.filter(i=>i.ordenId===o.id)})),ventas:[...antiguas,...ventas.map(v=>({...v,items:items.filter(i=>i.ventaId===v.id)}))],pedidos,movimientos};
}
export function crearTransaccion(origen,leerDatos=leer,guardarDatos=persistir){return async function(fn){const c=await origen.getConnection();try{await c.beginTransaction();await c.query('SELECT id FROM configuracion WHERE id=1 FOR UPDATE');const actual=await leerDatos(c);const {estado,resultado}=await fn(actual,c);if(estado!==actual){await guardarDatos(c,actual,estado);await c.execute('UPDATE configuracion SET revision=revision+1,secuencia_venta=? WHERE id=1',[estado.secuenciaVenta]);}await c.commit();return {resultado};}catch(e){await c.rollback();throw e;}finally{c.release();}};}
export const transaccion=crearTransaccion(pool);
export async function persistir(c,anterior,s){
 const cambio=(lista,item,campo)=>JSON.stringify(lista.find(x=>x[campo]===item[campo]))!==JSON.stringify(item);
 for(const u of s.usuarios)if(cambio(anterior.usuarios,u,'usuario'))await c.execute('INSERT INTO usuarios(usuario,password_hash,rol) VALUES(?,?,?) ON DUPLICATE KEY UPDATE password_hash=?,rol=?',[u.usuario,u.passwordHash,u.rol,u.passwordHash,u.rol]);
 for(const p of s.productos)if(cambio(anterior.productos,p,'codigo'))await c.execute('INSERT INTO productos(codigo,descripcion,categoria,precio_compra,precio_venta,stock,stock_minimo,activo) VALUES(?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE descripcion=?,categoria=?,precio_compra=?,precio_venta=?,stock=?,stock_minimo=?,activo=?',[p.codigo,p.descripcion,p.categoria,p.precioCompra,p.precioVenta,p.stock,p.stockMinimo,p.activo,p.descripcion,p.categoria,p.precioCompra,p.precioVenta,p.stock,p.stockMinimo,p.activo]);
 // Primero las órdenes, sin venta_id: la venta se inserta enseguida.
 for(const o of s.ordenes)if(cambio(anterior.ordenes,o,'id')){
  await c.execute('INSERT INTO ordenes(id,folio,cliente,vehiculo,placas,servicio,mecanico,mano_obra,estado,fecha_iso,usuario,legado,importe_anterior) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE cliente=?,vehiculo=?,placas=?,servicio=?,mecanico=?,mano_obra=?,estado=?,legado=?,importe_anterior=?',[o.id,o.folio,o.cliente,o.vehiculo,o.placas,o.servicio,o.mecanico,o.manoObra,o.estado,o.fechaISO,o.usuario,Boolean(o.legado),o.importeAnterior??null,o.cliente,o.vehiculo,o.placas,o.servicio,o.mecanico,o.manoObra,o.estado,Boolean(o.legado),o.importeAnterior??null]);
  await c.execute('DELETE FROM detalle_orden WHERE orden_id=?',[o.id]);for(const i of o.piezas)await c.execute('INSERT INTO detalle_orden(orden_id,producto_codigo,descripcion,cantidad,precio_venta) VALUES(?,?,?,?,?)',[o.id,i.codigo,i.descripcion,i.cantidad,i.precioVenta]);
 }
 for(const v of s.ventas)if(!v.legado&&cambio(anterior.ventas,v,'id')){
  if(anterior.ventas.some(x=>x.id===v.id))await c.execute('UPDATE ventas SET estado=?,motivo=?,anulada_por=?,anulada_iso=? WHERE id=?',[v.estado,v.motivo||null,v.anuladaPor||null,v.anuladaISO||null,v.id]);
  else{await c.execute('INSERT INTO ventas(id,folio,fecha_iso,cajero,estado,metodo_pago,subtotal,iva,total,mano_obra,pagado_con,cambio,pedido_id,orden_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,?)',[v.id,v.folio,v.fechaISO,v.cajero,v.estado,v.metodoPago,v.subtotal,v.iva,v.total,v.manoObra,v.pagadoCon,v.cambio,v.ordenId]);
   for(const i of v.items)await c.execute('INSERT INTO detalle_venta(venta_id,producto_codigo,descripcion,cantidad,precio_venta,precio_compra,subtotal) VALUES(?,?,?,?,?,?,?)',[v.id,i.codigo,i.descripcion,i.cantidad,i.precioVenta,i.precioCompra,i.subtotal]);}
 }
 for(const p of s.pedidos)if(cambio(anterior.pedidos,p,'id'))await c.execute('INSERT INTO pedidos(id,folio,cliente,telefono,producto_codigo,cantidad,precio,fecha_iso,estado,venta_id,motivo) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE estado=?,venta_id=?,motivo=?',[p.id,p.folio,p.cliente,p.telefono,p.codigo,p.cantidad,p.precio,p.fechaISO,p.estado,p.ventaId||null,p.motivo||null,p.estado,p.ventaId||null,p.motivo||null]);
 for(const v of s.ventas)if(!v.legado&&v.pedidoId&&!anterior.ventas.some(x=>x.id===v.id))await c.execute('UPDATE ventas SET pedido_id=? WHERE id=?',[v.pedidoId,v.id]);
 for(const o of s.ordenes)if(cambio(anterior.ordenes,o,'id'))await c.execute('UPDATE ordenes SET venta_id=? WHERE id=?',[o.ventaId||null,o.id]);
 for(const m of s.movimientos)if(!anterior.movimientos.some(x=>x.id===m.id))await c.execute('INSERT INTO movimientos(id,fecha_iso,producto_codigo,cantidad,tipo,referencia,motivo,usuario) VALUES(?,?,?,?,?,?,?,?)',[m.id,m.fechaISO,m.codigo,m.cantidad,m.tipo,m.referencia||null,m.motivo||null,m.usuario]);
}
export function visible(s,u){
 const admin=u?.rol==='Administrador General',almacen=u?.rol==='Encargado de Almacén',caja=u?.rol==='Cajero / Ventas de Mostrador',taller=u?.rol==='Taller y Servicios Mecánicos';
 const productos=s.productos.filter(p=>u||p.activo).map(p=>admin||almacen?p:{...p,precioCompra:null});
 return {...s,productos,usuarios:admin?s.usuarios.map(({usuario,rol})=>({usuario,rol})):[],ventas:admin?s.ventas:caja?s.ventas.filter(v=>v.cajero===u.usuario).map(v=>({...v,items:v.items.map(i=>({...i,precioCompra:null}))})):[],pedidos:admin||caja?s.pedidos:[],ordenes:admin||caja||taller?s.ordenes:[],movimientos:admin||almacen?s.movimientos:[]};
}
