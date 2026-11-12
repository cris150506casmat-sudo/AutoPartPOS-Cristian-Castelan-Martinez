import {pool} from './db.mjs';
import {transaccion} from './repository.mjs';
try{
 const [v]=await pool.query('SELECT VERSION() AS version,DATABASE() AS base');
 const r=await transaccion(async s=>({estado:s,resultado:{productos:s.productos.length,usuarios:s.usuarios.length,ventas:s.ventas.length}}));
 console.log('Conexión correcta:',v[0]);console.log('Tablas y transacción de lectura correctas:',r.resultado);
}catch(e){console.error('No se pudo verificar la base:',e.message);process.exitCode=1;}finally{await pool.end();}
