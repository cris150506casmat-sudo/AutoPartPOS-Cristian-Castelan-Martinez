# AutoPart POS · Nexus Flow

**Alumno:** Cristian Castelán Martínez

Sistema local para una refaccionaria con catálogo, punto de venta, inventario, taller y administración. La interfaz utiliza React y Bootstrap; la API utiliza Node.js y Express, con persistencia en MySQL.

## Módulos y permisos

| Puesto | Acceso |
| --- | --- |
| Administrador General | Todos los módulos y administración de cuentas |
| Cajero / Ventas de Mostrador | Ventas, cobros y solicitudes de clientes |
| Encargado de Almacén | Inventario y entradas de mercancía |
| Taller y Servicios Mecánicos | Órdenes de trabajo y refacciones |

El catálogo público permite consultar piezas y enviar solicitudes al mostrador. Una solicitud no reserva existencias ni realiza un pago. El puesto de cada empleado se obtiene de su cuenta en la base de datos.

## Requisitos

- Node.js con npm.
- MySQL Community Server 8.0.16 o posterior, iniciado.
- MySQL Workbench, opcional para consultar y respaldar los registros.

## Si ya utilizabas esta aplicación

Antes de sustituir la carpeta, conserva tu archivo `.env`. Cópialo dentro de esta carpeta, junto a `package.json`. No reemplaces tu configuración por el ejemplo. Los registros existentes permanecen en tu servicio MySQL; no están dentro de este ZIP. Conserva un respaldo SQL de la base antes de borrar tu carpeta anterior.

Instala las dependencias con `npm ci` y utiliza los dos comandos de inicio de la sección siguiente. No necesitas crear nuevamente la base ni las cuentas si ya existen. No elimines la base `autopart_pos`.

## Instalación en otra computadora

1. Descomprime la carpeta y ábrela en Visual Studio Code. `package.json` debe estar directamente dentro de la carpeta abierta.
2. En la terminal instala las dependencias:

```powershell
npm ci
```

3. Solo para una instalación nueva, crea la configuración:

```powershell
Copy-Item .env.example .env
```

4. Edita `.env`: configura `DB_USER` y `DB_PASSWORD` con los datos de MySQL. Define `ADMIN_USER` y una contraseña inicial de al menos ocho caracteres en `ADMIN_PASSWORD`. Guarda el archivo.
5. Con MySQL iniciado, prepara y comprueba la base:

```powershell
npm run db:setup
npm run db:check
```

La preparación crea las tablas, las relaciones, una cuenta administradora inicial y ocho productos si la base está vacía. No cambia contraseñas de cuentas existentes. El SQL se encuentra en `database/autopart_pos.sql`; ejecuta también `db:setup`, que completa las relaciones y genera el hash de la cuenta inicial.

## Iniciar la aplicación

En una terminal:

```powershell
npm run server
```

En otra terminal, dentro de la misma carpeta:

```powershell
npm start
```

Abre http://localhost:3000 y mantén ambas terminales abiertas. La API escucha en http://localhost:5000 y MySQL normalmente en el puerto 3306. Cierra los procesos con Ctrl+C.

Para entrar, utiliza el nombre de usuario configurado, no el texto `ADMIN_USER`. Las cuentas nuevas se registran desde administración. Las contraseñas se almacenan como hashes scrypt: no escribas contraseñas en texto plano en `usuarios.password_hash`. Cambiar `.env` no modifica cuentas que ya existen.

## Fotografías

Las ocho imágenes se incluyen en `public/imagenes`. Sus rutas y los códigos de producto asociados están en `src/data/images.js`. Un producto sin fotografía asignada muestra un indicador; no impide utilizar el inventario ni registrar operaciones.

## Base de datos y respaldos

MySQL guarda usuarios, productos, ventas y sus detalles, pedidos, órdenes y sus detalles, movimientos, sesiones, configuración e importaciones. Las ventas y sus movimientos de stock se guardan mediante transacciones.

Para revisar registros desde Workbench:

```sql
USE autopart_pos;
SELECT codigo, descripcion, stock FROM productos;
SELECT folio, cajero, total, estado FROM ventas ORDER BY fecha_iso DESC;
SELECT usuario, rol, activo FROM usuarios;
SELECT * FROM ordenes;
SELECT * FROM pedidos;
```

Para trasladar los registros actuales a otro equipo, exporta la base con Workbench (Server > Data Export) y conserva el SQL en un lugar privado. El archivo de estructura incluido no es una copia de tus ventas ni usuarios actuales. No publiques respaldos con datos personales o sesiones.

La opción de administración para importar datos del navegador corresponde únicamente al traslado inicial desde la versión anterior basada en localStorage. Descarga primero el archivo original, consérvalo de forma privada e importa antes de registrar operaciones nuevas en MySQL. No reemplaza un respaldo SQL completo.

## Comprobaciones

```powershell
npm run test:domain
npm test -- --watchAll=false --runInBand
npm run build
```

Las pruebas automáticas utilizan datos y conexiones simulados. Para comprobar la conexión real en cada equipo utiliza `npm run db:check` y registra una operación de prueba.

## Publicación del código

Sube el contenido de esta carpeta al repositorio. Conserva `src`, `public`, `server`, `database`, `tests`, los archivos de paquetes, `.env.example`, `.env.development`, `.gitignore` y este README. No subas `.env`, `node_modules`, `build` ni respaldos privados. Las dependencias se instalan con `npm ci`; la compilación se genera con `npm run build`.

El repositorio contiene el código para revisión y ejecución local. La aplicación completa requiere Node.js y MySQL; publicar únicamente los archivos en GitHub no inicia esos servicios.

## Alcance

Los cobros con tarjeta y transferencia registran el método confirmado por el operador; no realizan cargos bancarios. Los tickets son comprobantes internos. El sistema no incluye timbrado fiscal, pasarela de pago ni envío automático de notificaciones externas.
