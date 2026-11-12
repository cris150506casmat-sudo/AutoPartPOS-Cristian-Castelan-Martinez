import mysql from 'mysql2/promise';
import 'dotenv/config';
export const database=process.env.DB_NAME||'autopart_pos';
if(!/^[A-Za-z0-9_]+$/.test(database))throw new Error('DB_NAME solo admite letras, números y guion bajo.');
export const config={host:process.env.DB_HOST||'127.0.0.1',port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER||'root',password:process.env.DB_PASSWORD||'',database,charset:'utf8mb4',decimalNumbers:true};
export const pool=mysql.createPool({...config,connectionLimit:5});
