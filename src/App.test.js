import React from 'react';
import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import App from './App';
import {BASE,ADMIN} from './data/domain.mjs';
let estado;
beforeEach(()=>{
 estado={version:3,revision:0,secuenciaVenta:0,productos:BASE,usuarios:[],ventas:[],pedidos:[],ordenes:[],movimientos:[]};
 global.fetch=jest.fn(async(ruta)=>({ok:true,json:async()=>ruta==='/api/login'?{estado:{...estado,usuarios:[{usuario:'admin_mostrador',rol:ADMIN}]},usuario:{usuario:'admin_mostrador',rol:ADMIN}}:{estado,usuario:null}}));
});
afterEach(()=>{cleanup();jest.restoreAllMocks();});
test('Carga el catálogo desde la API y no permite registro público de administradores',async()=>{
 render(<App/>);
 expect(await screen.findByRole('heading',{name:/Catálogo de refacciones/i})).toBeTruthy();
 expect(screen.getAllByRole('button',{name:'Solicitar en mostrador'})).toHaveLength(8);
 fireEvent.click(screen.getByRole('button',{name:'Acceso de empleados'}));
 expect(screen.queryByText('Crear una cuenta nueva')).toBeNull();
 expect(screen.queryByRole('combobox')).toBeNull();
});
test('Una respuesta válida del servidor habilita los módulos de administración',async()=>{
 render(<App/>);await screen.findByRole('heading',{name:/Catálogo de refacciones/i});
 fireEvent.click(screen.getByRole('button',{name:'Acceso de empleados'}));
 fireEvent.change(screen.getByLabelText('Usuario'),{target:{value:'admin_mostrador'}});
 fireEvent.change(screen.getByLabelText('Contraseña'),{target:{value:'prueba123'}});
 fireEvent.click(screen.getByRole('button',{name:'Ingresar'}));
 expect(await screen.findByRole('heading',{name:/Panel de Control y Análisis Financiero/i})).toBeTruthy();
 expect(screen.getByRole('button',{name:'Inventario',exact:true})).toBeTruthy();
});
