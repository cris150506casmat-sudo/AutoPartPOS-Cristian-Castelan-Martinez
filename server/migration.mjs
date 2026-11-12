import {createHash} from 'node:crypto';
import {ADMIN,ROLES,id,numero,texto} from '../src/data/domain.mjs';
import {hashPassword} from './passwords.mjs';
export async function importarAnterior(s,archivo,u,c){
 if(u?.rol!==ADMIN)throw new Error('Solo administración puede importar datos.');
 if(s.ventas.length||s.ordenes.length||s.pedidos.length||s.movimientos.length)throw new Error('La importación inicial solo se permite antes de registrar operaciones en MySQL. No se reemplazaron los datos.');
 const raw=typeof archivo==='string'?JSON.parse(archivo):archivo;
 if(!raw||typeof raw!=='object')throw new Error('Archivo no válido.');
 const hash=createHash('sha256').update(JSON.stringify(raw)).digest('hex');
 const [prev]=await c.execute('SELECT id FROM importaciones WHERE id=?',[hash]);if(prev.length)throw new Error('Este archivo ya fue importado.');
 let origen=raw;
 if(raw.autopart_estado_v2){origen=typeof raw.autopart_estado_v2==='string'?JSON.parse(raw.autopart_estado_v2):raw.autopart_estado_v2;}
 const obtener=(actual,anterior)=>{
  const dato=origen[actual]??raw[anterior];if(dato==null)return [];
  const lista=typeof dato==='string'?JSON.parse(dato):dato;if(!Array.isArray(lista))throw new Error(`El apartado ${actual} no es una lista.`);return lista;
 };
 if(!Array.isArray(origen.productos)&&raw.inventario_autopart==null)throw new Error('No se encontró un inventario en el archivo.');
 const inventario=obtener('productos','inventario_autopart').map(p=>({codigo:texto(p.codigo,'Código',40).toUpperCase(),descripcion:texto(p.descripcion,'Descripción'),categoria:texto(p.categoria||'General','Categoría',80),precioCompra:p.precioCompra==null?null:numero(p.precioCompra),precioVenta:numero(p.precioVenta),stock:numero(p.stock,'Stock',true),stockMinimo:numero(p.stockMinimo??5,'Mínimo',true),activo:p.activo!==false}));
 if(new Set(inventario.map(p=>p.codigo)).size!==inventario.length)throw new Error('Hay códigos duplicados en el inventario anterior.');
 const productos=[...s.productos.filter(p=>!inventario.some(x=>x.codigo===p.codigo)).map(p=>({...p,activo:false})),...inventario];
 const usuarios=[...s.usuarios];
 for(const cuenta of obtener('usuarios','usuarios_registrados')){
  if(!cuenta.usuario||!ROLES.includes(cuenta.rol))throw new Error('Hay una cuenta anterior con datos no válidos.');
  const nombre=texto(cuenta.usuario,'Usuario',40);
  // La cuenta de instalación conserva su clave de .env. Las demás conservan su contraseña anterior, migrada a hash.
  if(!usuarios.some(x=>x.usuario.toLowerCase()===nombre.toLowerCase()))usuarios.push({usuario:nombre,rol:cuenta.rol,passwordHash:await hashPassword(cuenta.password,true)});
 }
 const ventas=obtener('ventas','ventas_autopart').map((v,i)=>{numero(v.total,'Total de venta');return {...v,id:`ANT-${hash.slice(0,20)}-${i}`,folio:String(v.folio||`ANT-${i+1}`),items:Array.isArray(v.items)?v.items:[],estado:v.estado||'Pagada',legado:true};});
 const ordenes=obtener('ordenes','taller_autopart').map((o,i)=>({id:id('ORD'),folio:`ANT-ORD-${i+1}`,cliente:texto(o.cliente,'Cliente',80),vehiculo:texto(o.vehiculo,'Vehículo',80),placas:String(o.placas||'Sin placas').slice(0,80),servicio:texto(o.servicio,'Servicio'),mecanico:texto(o.mecanico||'Sin asignar','Mecánico',80),manoObra:numero(o.manoObra??o.costo??0),piezas:[],estado:o.estado==='Cancelado'?'Cancelado':'Pendiente',fechaISO:new Date().toISOString(),usuario:u.usuario,ventaId:null,legado:true,importeAnterior:numero(o.manoObra??o.costo??0)}));
 const pedidos=obtener('pedidos','pedidos_autopart').map((p,i)=>{const producto=productos.find(x=>x.codigo===p.codigo);if(!producto)throw new Error('Un pedido apunta a una pieza que no está en el inventario.');return {id:id('PED'),folio:`ANT-PED-${i+1}`,cliente:texto(p.cliente,'Cliente',80),telefono:String(p.telefono||'Sin teléfono').slice(0,20),codigo:producto.codigo,producto:producto.descripcion,cantidad:numero(p.cantidad??1,'Cantidad',true),precio:producto.precioVenta,fechaISO:new Date().toISOString(),estado:p.estado==='Atendido'?'Atendido':p.estado==='Cancelado'?'Cancelado':'Pendiente'};});
 const original=JSON.parse(JSON.stringify(raw));
 // El archivo local original no se modifica. El archivo que se conserva en SQL no contiene contraseñas en texto plano.
 function ocultar(obj){if(Array.isArray(obj)){obj.forEach(ocultar);return;}if(obj&&typeof obj==='object'){for(const k of Object.keys(obj)){if(k==='password'||k==='passwordHash')obj[k]='[omitida]';else if(typeof obj[k]==='string'&&['usuarios_registrados','autopart_estado_v2'].includes(k)){try{const t=JSON.parse(obj[k]);ocultar(t);obj[k]=t;}catch{obj[k]='[contenido no válido]';}}else ocultar(obj[k]);}}}
 ocultar(original);
 await c.execute('INSERT INTO importaciones(id,fecha_iso,contenido,usuario) VALUES(?,?,?,?)',[hash,new Date().toISOString(),JSON.stringify({original,ventas}),u.usuario]);
 const mayor=ventas.reduce((n,v)=>{const m=v.folio.match(/^TICK-(\d+)$/);return m?Math.max(n,Number(m[1])):n;},s.secuenciaVenta);
 return {estado:{...s,productos,usuarios,pedidos,ordenes,secuenciaVenta:mayor},resultado:{mensaje:'Datos importados. Revisa las órdenes anteriores y los costos incompletos antes de utilizarlos.'}};
}
