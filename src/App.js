import React,{useEffect,useState} from 'react';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import ClienteTienda from './Components/Pages/ClienteTienda';
import Login from './Components/Pages/Login';
import DashboardAdmin from './Components/Pages/DashboardAdmin';
import Inventario from './Components/Pages/Inventario';
import PuntoVenta from './Components/Pages/PuntoVenta';
import Taller from './Components/Pages/Taller';
import {ADMIN,CAJERO,ALMACEN,TALLER} from './data/domain.mjs';
import {iniciarDatos,sesion,salir,actividad,comprobarSesion,exportarAnterior,useDatos} from './data/store';
import {Aviso} from './Components/Shared';
const PERMISOS={dashboard:[ADMIN],pos:[ADMIN,CAJERO],inventario:[ADMIN,ALMACEN],taller:[ADMIN,TALLER]};
const TITULOS={dashboard:'Resumen',pos:'Punto de venta',inventario:'Inventario',taller:'Taller'};
function inicial(rol){return rol===CAJERO?'pos':rol===ALMACEN?'inventario':rol===TALLER?'taller':rol===ADMIN?'dashboard':'tienda';}
export default function App(){
 const [estado,setEstado]=useState({cargando:true});
 useEffect(()=>{let vivo=true;iniciarDatos().then(()=>{if(vivo)setEstado({ok:true});}).catch(e=>{if(vivo)setEstado({error:e.message});});return()=>{vivo=false;};},[]);
 if(estado.cargando)return <div className="container py-5">Conectando con la base de datos local…</div>;
 if(!estado.ok)return <div className="container py-5"><h1 className="h4">No se pudieron cargar los datos</h1><Aviso mensaje={estado.error}/><p>No se borraron tus datos anteriores. Revisa MySQL, el archivo .env y el servidor local.</p><button className="btn btn-primary" onClick={exportarAnterior}>Descargar datos originales</button></div>;
 return <Aplicacion/>;
}
function Aplicacion(){
 const {datos,error}=useDatos();
 const [usuario,setUsuario]=useState(sesion);
 const [vista,setVista]=useState(()=>inicial(sesion()?.rol));
 const [mensaje,setMensaje]=useState('');
 async function cerrar(){try{await salir();}finally{setUsuario(null);setVista('tienda');}}
 useEffect(()=>{
  const revisar=async()=>{let s;try{s=await comprobarSesion();}catch{return;}if(!s){if(usuario){setUsuario(null);setVista('login');setMensaje('La sesión finalizó. Ingresa nuevamente.');}}else if(usuario && (usuario.usuario!==s.usuario||usuario.rol!==s.rol)){setUsuario(s);setVista(inicial(s.rol));}};
  let ultimo=0;
  const tocar=()=>{if(Date.now()-ultimo<30000)return;ultimo=Date.now();actividad();};
  const timer=setInterval(revisar,5000);const eventos=['pointerdown','keydown','scroll'];eventos.forEach(e=>window.addEventListener(e,tocar));
  window.addEventListener('focus',revisar);return()=>{clearInterval(timer);eventos.forEach(e=>window.removeEventListener(e,tocar));window.removeEventListener('focus',revisar);};
 },[usuario]);
 const permitidas=Object.keys(PERMISOS).filter(k=>PERMISOS[k].includes(usuario?.rol));
 const pendientes=datos.pedidos.filter(p=>p.estado==='Pendiente').length;
 return <div className="app-shell"><nav className="topbar no-print"><button className="brand-button" onClick={()=>setVista('tienda')}><strong><span>Flujo de Nexus</span> POS de AutoPart</strong></button><div className="d-flex flex-wrap gap-2 align-items-center"><button className="btn btn-sm btn-outline-light" onClick={()=>setVista('tienda')}>🛒 Catálogo Tienda</button>{usuario?<><span className="user-label">{usuario.usuario} · {usuario.rol}</span><button className="btn btn-sm btn-outline-light" onClick={()=>setVista(inicial(usuario.rol))}>Mi área</button><button className="btn btn-sm btn-outline-light" onClick={cerrar}>Cerrar sesión</button></>:<button className="btn btn-primary btn-sm" onClick={()=>setVista('login')}>Acceso de empleados</button>}</div></nav><main className={`workspace view-${vista}`}><Aviso mensaje={error||mensaje} tipo={error?'danger':'info'}/>{usuario&&<nav className="module-nav no-print" aria-label="Módulos">{permitidas.map(k=><button key={k} aria-label={TITULOS[k]} className={`module-link ${vista===k?'active':''}`} onClick={()=>{setMensaje('');setVista(k);}}>{k==='dashboard'?'📊 Panel General / Dashboard':k==='pos'?'💳 Punto de Venta':k==='inventario'?'📦 Inventario':'🔧 Taller'}{k==='pos'&&pendientes>0&&<span className="badge bg-secondary ms-2">{pendientes}</span>}</button>)}</nav>}{vista==='tienda'&&<ClienteTienda/>}{vista==='login'&&!usuario&&<Login onLoginSuccess={u=>{setUsuario(u);setMensaje('');setVista(inicial(u.rol));}}/>}{usuario&&permitidas.includes(vista)&&<>{vista==='dashboard'&&<DashboardAdmin usuario={usuario}/>} {vista==='pos'&&<PuntoVenta usuario={usuario}/>} {vista==='inventario'&&<Inventario usuario={usuario}/>} {vista==='taller'&&<Taller usuario={usuario}/>}</>}</main><footer className="app-footer no-print">AutoPart POS · Gestión de refacciones y servicios</footer></div>;
}
