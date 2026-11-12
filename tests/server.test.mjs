import test from 'node:test';
import assert from 'node:assert/strict';
import {hashPassword,verificarPassword} from '../server/passwords.mjs';
import {aplicar} from '../server/actions.mjs';
import {crearTransaccion,persistir,visible} from '../server/repository.mjs';
import {pool} from '../server/db.mjs';
import {importarAnterior} from '../server/migration.mjs';
import {ADMIN,CAJERO,ALMACEN,BASE} from '../src/data/domain.mjs';
const admin={usuario:'admin',rol:ADMIN};
function estado(){return {version:3,revision:0,secuenciaVenta:0,productos:BASE.map(p=>({...p})),ventas:[],ordenes:[],pedidos:[],usuarios:[{...admin,passwordHash:'oculto'}],movimientos:[]};}
test('La contraseña no se guarda ni compara en texto plano',async()=>{const h=await hashPassword('prueba123');assert.notEqual(h,'prueba123');assert.ok(await verificarPassword('prueba123',h));assert.equal(await verificarPassword('otra',h),false);});
test('El servidor impide crear cuentas sin rol administrador',async()=>{await assert.rejects(()=>aplicar(estado(),'usuario.crear',{usuario:'atacante',password:'prueba123',rol:ADMIN},{usuario:'caja',rol:CAJERO}),/permiso/);});
test('Una petición directa de caja no modifica precios',async()=>{await assert.rejects(()=>aplicar(estado(),'producto.guardar',{...BASE[0],edicion:BASE[0].codigo,precioVenta:1},{usuario:'caja',rol:CAJERO}),/permiso/);});
test('El servidor valida código duplicado y ajustes de stock',async()=>{await assert.rejects(()=>aplicar(estado(),'producto.guardar',BASE[0],admin),/existe/);const r=await aplicar(estado(),'producto.ajustar',{codigo:BASE[0].codigo,cantidad:3,motivo:'Conteo'},admin);assert.equal(r.estado.productos[0].stock,3);assert.equal(r.estado.movimientos[0].cantidad,3-BASE[0].stock);});
test('El público no recibe ventas, cuentas, costos ni datos de otros clientes',()=>{const s=estado();s.pedidos=[{id:'privado',telefono:'5555555555'}];const r=visible(s,null);assert.deepEqual(r.usuarios,[]);assert.deepEqual(r.pedidos,[]);assert.deepEqual(r.ventas,[]);assert.equal(r.productos[0].precioCompra,null);assert.ok(!JSON.stringify(r).includes('oculto'));});
test('Almacén no recibe las ventas del negocio',()=>{const s=estado();s.ventas=[{id:'venta'}];assert.deepEqual(visible(s,{rol:ALMACEN}).ventas,[]);});
test('SQL utiliza parámetros; cantidad de marcadores coincide al guardar una venta completa',async()=>{
 const a=estado();const pedido=await aplicar(a,'pedido.crear',{cliente:'Cliente',telefono:'5555555555',codigo:BASE[0].codigo,cantidad:1},null);const conPedido=pedido.estado;
 const venta=await aplicar(conPedido,'venta.crear',{id:'venta-1',pedidoId:pedido.resultado.id,items:[{codigo:BASE[0].codigo,cantidad:1,precioVenta:BASE[0].precioVenta}],metodoPago:'Efectivo',recibido:1000},admin);
 let consultas=0;await persistir({execute:async(sql,param)=>{assert.equal((sql.match(/\?/g)||[]).length,param.length,sql);assert.ok(param.every(p=>p!==undefined),sql);consultas++;}},a,venta.estado);assert.ok(consultas>=5);
});
test('SQL de orden utiliza el número correcto de parámetros',async()=>{const a=estado();const r=await aplicar(a,'orden.guardar',{cliente:'Ana',vehiculo:'Versa',servicio:'Revisión',mecanico:'Carlos',manoObra:100,piezas:[{codigo:BASE[0].codigo,precioVenta:BASE[0].precioVenta,cantidad:1}]},admin);await persistir({execute:async(sql,p)=>{assert.equal((sql.match(/\?/g)||[]).length,p.length,sql);assert.ok(p.every(x=>x!==undefined),sql);}},a,r.estado);});
function fake(){const eventos=[];const c={beginTransaction:async()=>eventos.push('begin'),query:async q=>eventos.push(q.includes('FOR UPDATE')?'lock':'query'),execute:async()=>eventos.push('write'),commit:async()=>eventos.push('commit'),rollback:async()=>eventos.push('rollback'),release:()=>eventos.push('release')};return {eventos,c,origen:{getConnection:async()=>c}};}
test('La operación confirma después de guardar y bajo bloqueo',async()=>{const f=fake();const tx=crearTransaccion(f.origen,async()=>estado(),async()=>f.eventos.push('persist'));await tx(async s=>({estado:{...s},resultado:'ok'}));assert.deepEqual(f.eventos,['begin','lock','persist','write','commit','release']);});
test('Si falla persistencia se revierte y no se confirma',async()=>{const f=fake();const tx=crearTransaccion(f.origen,async()=>estado(),async()=>{throw Error('Fallo simulado');});await assert.rejects(()=>tx(async s=>({estado:{...s}})),/Fallo/);assert.deepEqual(f.eventos,['begin','lock','rollback','release']);});
test('Un rechazo de stock también revierte la transacción',async()=>{const f=fake();const tx=crearTransaccion(f.origen,async()=>estado(),async()=>{});await assert.rejects(()=>tx(async()=>{throw Error('Sin stock');}),/Sin stock/);assert.ok(f.eventos.includes('rollback'));assert.ok(!f.eventos.includes('commit'));});
test('La importación conserva el archivo de origen sin modificar el navegador y oculta contraseñas en el archivo SQL',async()=>{
 const previo={inventario_autopart:JSON.stringify([{...BASE[0],stock:7}]),ventas_autopart:JSON.stringify([{folio:'TICK-1234',total:522,items:[],cajero:'cris'}]),usuarios_registrados:JSON.stringify([{usuario:'cris',password:'123',rol:ADMIN}]),taller_autopart:'[]',pedidos_autopart:'[]'};
 const copia=JSON.stringify(previo);let archivo;
 const c={execute:async(sql,p)=>{if(sql.startsWith('SELECT'))return [[]];archivo=JSON.parse(p[2]);return [{}];}};
 const r=await importarAnterior(estado(),previo,admin,c);
 assert.equal(JSON.stringify(previo),copia);assert.equal(r.estado.productos.find(p=>p.codigo===BASE[0].codigo).stock,7);
 assert.equal(r.estado.productos.filter(p=>p.activo).length,1);assert.equal(archivo.ventas[0].folio,'TICK-1234');
 assert.equal(archivo.original.usuarios_registrados[0].password,'[omitida]');
 assert.ok(await verificarPassword('123',r.estado.usuarios.find(u=>u.usuario==='cris').passwordHash));
});
test('No importa datos antiguos sobre ventas nuevas',async()=>{const s=estado();s.ventas=[{id:'nueva'}];await assert.rejects(()=>importarAnterior(s,{},admin,{}),/antes de registrar/);});
test.after(async()=>{await pool.end();});
