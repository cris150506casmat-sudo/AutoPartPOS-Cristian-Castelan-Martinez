import React,{useState} from 'react';
import {useDatos,guardar} from '../../data/store';
import {texto,numero} from '../../data/domain.mjs';
import {Aviso,Campo,Encabezado,moneda} from '../Shared';
import ProductImage from '../ProductImage';
export default function ClienteTienda(){
 const {datos,error}=useDatos();
 const [nombre,setNombre]=useState(''),[telefono,setTelefono]=useState(''),[busqueda,setBusqueda]=useState(''),[cantidad,setCantidad]=useState(1),[aviso,setAviso]=useState(null);
 const productos=datos.productos.filter(p=>p.activo!==false&&`${p.codigo} ${p.descripcion} ${p.categoria}`.toLowerCase().includes(busqueda.toLowerCase()));
 async function pedir(codigo){try{
  const cliente=texto(nombre,'Nombre',80);const tel=telefono.trim();if(!/^\+?[\d\s()-]{10,20}$/.test(tel)||tel.replace(/\D/g,'').length<10)throw new Error('Captura un teléfono de 10 a 15 dígitos.');if(tel.replace(/\D/g,'').length>15)throw new Error('El teléfono es demasiado largo.');
  const q=numero(cantidad,'Cantidad',true);if(q<1)throw new Error('La cantidad debe ser mayor que cero.');
  const pedido=await guardar('pedido.crear',{cliente,telefono:tel,codigo,cantidad:q});const folio=pedido.folio;
  setAviso({tipo:'success',texto:`Solicitud registrada: ${folio}. Preséntate en mostrador; las piezas se confirman al cobrar.`});
 }catch(e){setAviso({tipo:'danger',texto:e.message});}}
 return <><Encabezado titulo='Catálogo de Refacciones "Nexus Flow"' detalle="Consulta las piezas y solicita tu pedido en mostrador."/><Aviso mensaje={error||aviso?.texto} tipo={error?'danger':aviso?.tipo}/><section className="card panel mb-4"><div className="row g-3"><div className="col-md-4"><Campo nombre="Nombre del cliente"><input className="form-control" value={nombre} onChange={e=>setNombre(e.target.value)} maxLength={80} autoComplete="name"/></Campo></div><div className="col-md-4"><Campo nombre="Teléfono de contacto"><input className="form-control" type="tel" value={telefono} onChange={e=>setTelefono(e.target.value)} maxLength={20} autoComplete="tel"/></Campo></div><div className="col-md-2"><Campo nombre="Cantidad a solicitar"><input className="form-control" type="number" min="1" step="1" value={cantidad} onChange={e=>setCantidad(e.target.value)}/></Campo></div><div className="col-md-2"><Campo nombre="Buscar pieza"><input className="form-control" value={busqueda} onChange={e=>setBusqueda(e.target.value)} placeholder="Código o nombre"/></Campo></div></div><p className="small text-secondary mb-0">Precios en MXN antes de IVA. Esta solicitud no reserva existencias ni realiza un pago.</p></section><div className="row g-3">{productos.map(p=><div className="col-sm-6 col-xl-3" key={p.codigo}><article className="card panel product-card h-100"><ProductImage producto={p}/><span className="small text-secondary mt-3">{p.codigo} · {p.categoria}</span><h2 className="h6 mt-2">{p.descripcion}</h2><strong className="product-price">{moneda(p.precioVenta)} <small>+ IVA</small></strong><p className="small text-secondary">{p.stock>0?`${p.stock} unidades disponibles`:'Agotado'}</p><button className="btn btn-primary mt-auto" disabled={p.stock<1||Boolean(error)} onClick={()=>pedir(p.codigo)}>Solicitar en mostrador</button></article></div>)}{!productos.length&&<p className="text-secondary">No hay piezas que coincidan con la búsqueda.</p>}</div></>;
}
