import {ADMIN,CAJERO,ALMACEN,TALLER,ROLES,BASE,id,numero,texto,centavos,permiso,siguienteFolio,agregarCarrito,completarVenta,anularVenta} from '../src/data/domain.mjs';
import {hashPassword} from './passwords.mjs';
export async function aplicar(s,tipo,d,u){
 const fechaISO=new Date().toISOString();
 switch(tipo){
 case 'producto.guardar':{
  permiso(u,[ADMIN,ALMACEN]);const codigo=texto(d.codigo,'Código',40).toUpperCase();if(!/^[A-Z0-9_-]+$/.test(codigo))throw new Error('Código no válido.');
  const anterior=s.productos.find(p=>p.codigo===codigo);if(d.edicion&&!anterior)throw new Error('La pieza no existe.');if(!d.edicion&&anterior)throw new Error('El código ya existe.');
  const p={codigo,descripcion:texto(d.descripcion,'Descripción'),categoria:texto(d.categoria,'Categoría',80),precioCompra:centavos(d.precioCompra,'Costo')/100,precioVenta:centavos(d.precioVenta,'Precio')/100,stock:anterior?anterior.stock:numero(d.stock,'Stock',true),stockMinimo:numero(d.stockMinimo,'Mínimo',true),activo:anterior?anterior.activo:true};
  return {estado:{...s,productos:anterior?s.productos.map(x=>x.codigo===codigo?p:x):[...s.productos,p],movimientos:!anterior&&p.stock?[...s.movimientos,{id:id('MOV'),codigo,cantidad:p.stock,tipo:'Stock inicial',fechaISO,usuario:u.usuario}]:s.movimientos},resultado:p};
 }
 case 'producto.activar':{
  permiso(u,[ADMIN,ALMACEN]);const p=s.productos.find(p=>p.codigo===d.codigo);if(!p)throw new Error('La pieza no existe.');return {estado:{...s,productos:s.productos.map(x=>x.codigo===d.codigo?{...x,activo:!x.activo}:x)}};
 }
 case 'producto.entrada':case 'producto.ajustar':{
  permiso(u,tipo==='producto.entrada'?[ADMIN,ALMACEN]:[ADMIN]);const p=s.productos.find(p=>p.codigo===d.codigo);if(!p)throw new Error('La pieza no existe.');const q=numero(d.cantidad,'Cantidad',true);if(tipo==='producto.entrada'&&(!q||!p.activo))throw new Error('Entrada no válida.');const motivo=texto(d.motivo,'Motivo');const stock=tipo==='producto.entrada'?p.stock+q:q;
  return {estado:{...s,productos:s.productos.map(x=>x.codigo===d.codigo?{...x,stock}:x),movimientos:[...s.movimientos,{id:id('MOV'),codigo:p.codigo,cantidad:stock-p.stock,tipo:tipo==='producto.entrada'?'Entrada':'Ajuste físico',fechaISO,motivo,usuario:u.usuario}]}};
 }
 case 'pedido.crear':{
  const cliente=texto(d.cliente,'Cliente',80),telefono=texto(d.telefono,'Teléfono',20);if(!/^\+?[\d\s()-]{10,20}$/.test(telefono)||telefono.replace(/\D/g,'').length<10||telefono.replace(/\D/g,'').length>15)throw new Error('Teléfono no válido.');const p=s.productos.find(p=>p.codigo===d.codigo&&p.activo);const cantidad=numero(d.cantidad,'Cantidad',true);if(!p||!cantidad||cantidad>p.stock)throw new Error('No hay existencias suficientes.');
  const pedido={id:id('PED'),folio:siguienteFolio('PED',s.pedidos),cliente,telefono,codigo:p.codigo,producto:p.descripcion,cantidad,precio:p.precioVenta,fechaISO,estado:'Pendiente'};return {estado:{...s,pedidos:[pedido,...s.pedidos]},resultado:pedido};
 }
 case 'pedido.cancelar':{
  permiso(u,[ADMIN,CAJERO]);const p=s.pedidos.find(p=>p.id===d.id&&p.estado==='Pendiente');if(!p)throw new Error('El pedido ya fue atendido o cancelado.');return {estado:{...s,pedidos:s.pedidos.map(x=>x.id===p.id?{...x,estado:'Cancelado',motivo:texto(d.motivo,'Motivo')}:x)}};
 }
 case 'orden.guardar':{
  permiso(u,[ADMIN,TALLER]);const a=d.edicion?s.ordenes.find(o=>o.id===d.edicion):null;if(d.edicion&&(!a||['Pagado','Cancelado'].includes(a.estado)))throw new Error('La orden no se puede editar.');let piezas=[];if(!Array.isArray(d.piezas))throw new Error('Refacciones no válidas.');for(const i of d.piezas){const p=s.productos.find(p=>p.codigo===i.codigo);if(!p||Number(p.precioVenta)!==Number(i.precioVenta))throw new Error('Una pieza cambió de precio.');piezas=agregarCarrito(piezas,p,i.cantidad);}
  const o={id:a?.id||id('ORD'),folio:a?.folio||siguienteFolio('ORD',s.ordenes),cliente:texto(d.cliente,'Cliente',80),vehiculo:texto(d.vehiculo,'Vehículo',80),placas:String(d.placas||'Sin placas').trim().toUpperCase().slice(0,80),servicio:texto(d.servicio,'Servicio'),mecanico:texto(d.mecanico,'Mecánico',80),manoObra:centavos(d.manoObra,'Mano de obra')/100,piezas,estado:a?.estado||'Pendiente',fechaISO:a?.fechaISO||fechaISO,usuario:a?.usuario||u.usuario,ventaId:a?.ventaId||null,legado:false,importeAnterior:a?.importeAnterior??null};
  return {estado:{...s,ordenes:a?s.ordenes.map(x=>x.id===o.id?o:x):[o,...s.ordenes]},resultado:o};
 }
 case 'orden.estado':{
  permiso(u,[ADMIN,TALLER]);const o=s.ordenes.find(o=>o.id===d.id);if(!o||['Pagado','Cancelado'].includes(o.estado)||!['Pendiente','En Proceso','Terminado','Cancelado'].includes(d.estado))throw new Error('Cambio de estado no válido.');if(o.legado&&d.estado==='Terminado')throw new Error('Revisa y guarda la orden anterior antes de cobrarla.');return {estado:{...s,ordenes:s.ordenes.map(x=>x.id===o.id?{...x,estado:d.estado}:x)}};
 }
 case 'venta.crear':{
  permiso(u,[ADMIN,CAJERO]);if(typeof d.id!=='string'||d.id.length>80)throw new Error('Identificador no válido.');const anterior=s.ventas.find(v=>v.id===d.id);if(anterior&&anterior.cajero!==u.usuario&&u.rol!==ADMIN)throw new Error('La venta pertenece a otro usuario.');
  const r=completarVenta(s,d,u);return {estado:r.estado,resultado:r.venta};
 }
 case 'venta.anular':return {estado:anularVenta(s,d.id,d.motivo,u)};
 case 'usuario.crear':{
  permiso(u,[ADMIN]);const usuario=texto(d.usuario,'Usuario',40);if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(usuario)||!ROLES.includes(d.rol))throw new Error('Usuario o puesto no válido.');if(s.usuarios.some(x=>x.usuario.toLowerCase()===usuario.toLowerCase()))throw new Error('El usuario ya existe.');const nueva={usuario,rol:d.rol,passwordHash:await hashPassword(d.password)};return {estado:{...s,usuarios:[...s.usuarios,nueva]}};
 }
 default:throw new Error('Operación desconocida.');
 }
}
