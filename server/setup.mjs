import mysql from 'mysql2/promise';
import {readFile} from 'node:fs/promises';
import {config,database,pool} from './db.mjs';
import {BASE,ADMIN} from '../src/data/domain.mjs';
import {hashPassword} from './passwords.mjs';
let c;
try{
 const password=process.env.ADMIN_PASSWORD;if(!password||password.length<8)throw new Error('Configura ADMIN_PASSWORD con al menos 8 caracteres en .env antes de inicializar.');
 c=await mysql.createConnection({...config,database:undefined,multipleStatements:true});
 const sql=(await readFile(new URL('../database/autopart_pos.sql',import.meta.url),'utf8')).replace(/autopart_pos/g,database);
 await c.query(sql);
 const claves=[['ordenes','fk_orden_venta','venta_id','ventas','id'],['ventas','fk_venta_pedido','pedido_id','pedidos','id']];
 for(const [tabla,nombre,columna,referencia,pk] of claves){const [r]=await c.execute('SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA=? AND TABLE_NAME=? AND CONSTRAINT_NAME=?',[database,tabla,nombre]);if(!r.length)await c.query(`ALTER TABLE ${tabla} ADD CONSTRAINT ${nombre} FOREIGN KEY(${columna}) REFERENCES ${referencia}(${pk})`);}
 await c.beginTransaction();await c.query('SELECT id FROM configuracion WHERE id=1 FOR UPDATE');
 const usuario=process.env.ADMIN_USER||'admin_mostrador';if(!/^[a-zA-Z0-9_.-]{3,40}$/.test(usuario))throw new Error('ADMIN_USER no válido.');const [cuentas]=await c.query('SELECT COUNT(*) AS total FROM usuarios');
 if(!cuentas[0].total)await c.execute('INSERT INTO usuarios(usuario,password_hash,rol) VALUES(?,?,?)',[usuario,await hashPassword(password),ADMIN]);
 const [productos]=await c.query('SELECT COUNT(*) AS total FROM productos');
 if(!productos[0].total)for(const p of BASE)await c.execute('INSERT INTO productos(codigo,descripcion,categoria,precio_compra,precio_venta,stock,stock_minimo,activo) VALUES(?,?,?,?,?,?,?,1)',[p.codigo,p.descripcion,p.categoria,p.precioCompra,p.precioVenta,p.stock,p.stockMinimo]);
 await c.commit();console.log(`Base ${database} preparada. No se cambiaron contraseñas de cuentas existentes.`);
}catch(e){if(c)await c.rollback().catch(()=>{});console.error('No se pudo preparar la base:',e.message);process.exitCode=1;}finally{if(c)await c.end();await pool.end();}
