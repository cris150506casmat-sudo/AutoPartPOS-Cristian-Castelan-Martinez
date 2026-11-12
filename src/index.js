import React from 'react';
import {createRoot} from 'react-dom/client';
import './index.css';
import App from './App';

const contenedor=document.getElementById('root');
createRoot(contenedor).render(<App/>);
