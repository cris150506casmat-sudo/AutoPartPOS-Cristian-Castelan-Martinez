import React,{useState} from 'react';
import {imagenes} from '../data/images';
export default function ProductImage({producto,mini=false}){
 const [fallo,setFallo]=useState(false);const src=imagenes[producto.codigo];
 return <div className={mini?'product-image mini':'product-image'}>{src&&!fallo?<img src={src} alt={producto.descripcion} onError={()=>setFallo(true)}/>:<span className="text-secondary small">Sin fotografía</span>}</div>;
}
