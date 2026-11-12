import React,{useState} from 'react';
import {entrar} from '../../data/store';
import {Aviso,Campo} from '../Shared';
export default function Login({onLoginSuccess}) {
 const [usuario,setUsuario]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
 async function enviar(e){e.preventDefault();try{onLoginSuccess(await entrar(usuario,password));}catch(err){setError(err.message);}}
 return <div className="login-wrap"><section className="card panel login-card"><div className="text-center mb-3"><span className="badge bg-primary px-3 py-2 fs-6 mb-2">AP</span><h1 className="h4 fw-bold mb-0">AutoPart POS</h1><small className="text-muted">Refacciones y Servicios "Nexus Flow"</small><h2 className="h6 text-primary mt-2">Módulo de Autenticación</h2></div><Aviso mensaje={error}/><form onSubmit={enviar}><Campo nombre="Usuario"><input className="form-control" value={usuario} onChange={e=>setUsuario(e.target.value)} placeholder="Ej. admin_mostrador" autoComplete="username" required maxLength={40}/></Campo><Campo nombre="Contraseña"><input type="password" className="form-control" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" required/></Campo><button className="btn btn-primary w-100 fw-bold py-2" type="submit">Ingresar</button></form><p className="small text-muted text-center mt-3 mb-0">El acceso a cada módulo depende del puesto registrado en tu cuenta.</p></section></div>;
}
