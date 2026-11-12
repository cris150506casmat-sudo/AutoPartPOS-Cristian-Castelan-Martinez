import {useEffect,useState} from 'react';
const EVENTO='autopart:actualizado';
let cache=null,activo=null;
async function api(ruta,opciones={}){
 let res;try{res=await fetch(`/api${ruta}`,{credentials:'same-origin',...opciones,headers:{'Content-Type':'application/json',...opciones.headers}});}catch{throw new Error('No se pudo conectar con el servidor. Inicia MySQL y npm run server.');}
 let json;try{json=await res.json();}catch{throw new Error('El servidor no respondió con JSON. Comprueba el puerto 5000 y reinicia npm start.');}
 if(json.estado){cache=json.estado;window.dispatchEvent(new Event(EVENTO));}
 if(Object.prototype.hasOwnProperty.call(json,'usuario'))activo=json.usuario;
 if(!res.ok){if(res.status===401)activo=null;throw new Error(json.error||'No se pudo completar la solicitud.');}
 return json;
}
export async function iniciarDatos(){const r=await api('/estado');return r.estado;}
export function leerEstado(){if(!cache)throw new Error('Los datos todavía no están disponibles.');return cache;}
export function sesion(){return activo;}
export async function comprobarSesion(){const r=await api('/sesion');activo=r.usuario;return activo;}
export async function entrar(usuario,password){const r=await api('/login',{method:'POST',body:JSON.stringify({usuario,password})});activo=r.usuario;return activo;}
export async function salir(){try{await api('/logout',{method:'POST',body:'{}'});}finally{activo=null;await iniciarDatos().catch(()=>{});}}
export async function actividad(){if(activo)await api('/actividad',{method:'POST',body:'{}'}).catch(()=>{});}
export async function guardar(tipo,datos={}){
 const r=await api('/operaciones',{method:'POST',body:JSON.stringify({tipo,datos,revision:leerEstado().revision})});
 return r.resultado;
}
export function useDatos(){
 const [datos,setDatos]=useState(leerEstado),[error,setError]=useState('');
 useEffect(()=>{let vivo=true;const actualizar=()=>{if(vivo){setDatos(leerEstado());setError('');}};
  const refrescar=()=>api('/estado').catch(e=>{if(vivo)setError(e.message);});
  window.addEventListener(EVENTO,actualizar);window.addEventListener('focus',refrescar);const timer=setInterval(refrescar,10000);
  return()=>{vivo=false;clearInterval(timer);window.removeEventListener(EVENTO,actualizar);window.removeEventListener('focus',refrescar);};
 },[]);
 return {datos,error};
}
export function descargar(nombre,contenido,tipo='application/json'){
 const url=URL.createObjectURL(new Blob([contenido],{type:tipo}));const a=document.createElement('a');a.href=url;a.download=nombre;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export async function exportar(){const r=await api('/respaldo');descargar(`AutoPartPOS_Consulta_${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(r,null,2));}
export function exportarAnterior(){
 const claves=['inventario_autopart','ventas_autopart','pedidos_autopart','taller_autopart','usuarios_registrados','bitacora_accesos','autopart_estado_v2'];
 descargar('AutoPartPOS_Datos_Originales.json',JSON.stringify(Object.fromEntries(claves.map(k=>[k,localStorage.getItem(k)])),null,2));
}
export async function restaurar(texto){return guardar('datos.importar',{archivo:JSON.parse(texto)});}
