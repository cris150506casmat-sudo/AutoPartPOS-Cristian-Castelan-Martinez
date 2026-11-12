import {app} from './app.mjs';
import {pool} from './db.mjs';
const port=Number(process.env.PORT||5000),host=process.env.HOST||'127.0.0.1';
const server=app.listen(port,host,()=>console.log(`AutoPart POS API: http://localhost:${port}`));
async function cerrar(){server.close(async()=>{await pool.end();process.exit(0);});}
process.on('SIGINT',cerrar);process.on('SIGTERM',cerrar);
