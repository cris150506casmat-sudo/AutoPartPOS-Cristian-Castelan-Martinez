import {randomBytes,scrypt as originalScrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(originalScrypt);
export async function hashPassword(password,migracion=false){
 if(typeof password!=='string'||password.length<(migracion?1:8)||password.length>128)throw new Error('La contraseña debe tener de 8 a 128 caracteres.');
 const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);
 return `scrypt$${salt}$${key.toString('hex')}`;
}
export async function verificarPassword(password,hash){
 if(typeof password!=='string'||password.length>128||typeof hash!=='string')return false;
 const [tipo,salt,guardada]=hash.split('$');if(tipo!=='scrypt'||!salt||!guardada)return false;
 const key=await scrypt(password,salt,64);const anterior=Buffer.from(guardada,'hex');
 return anterior.length===key.length&&timingSafeEqual(anterior,key);
}
