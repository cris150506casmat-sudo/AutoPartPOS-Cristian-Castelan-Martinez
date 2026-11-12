import express from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { pool } from './db.mjs';
import { leer, transaccion, visible } from './repository.mjs';
import { aplicar } from './actions.mjs';
import { verificarPassword } from './passwords.mjs';
import { importarAnterior } from './migration.mjs';
import { ADMIN } from '../src/data/domain.mjs';
import { origenesLocales } from './origins.mjs';

export const app = express();

app.disable('x-powered-by');

const permitidos = origenesLocales(process.env.APP_ORIGIN);

app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');

  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (
      req.headers.origin &&
      !permitidos.has(req.headers.origin)
    ) {
      return res.status(403).json({
        error: 'Origen no permitido.'
      });
    }

    if (!req.is('application/json')) {
      return res.status(415).json({
        error: 'Se requiere JSON.'
      });
    }
  }

  next();
});

app.use(express.json({ limit: '6mb' }));

const cookieName = 'autopart_sid';

const hash = valor =>
  createHash('sha256').update(valor).digest('hex');

const DURACION_SESION = 15 * 60 * 1000;
const TIEMPO_BLOQUEO = 3 * 60 * 1000;
const MAX_INTENTOS = 10;

const cookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.COOKIE_SECURE === 'true',
  path: '/api'
};

app.use('/api', async (req, res, next) => {
  try {
    const token = String(req.headers.cookie || '')
      .split(';')
      .map(parte => parte.trim())
      .find(parte => parte.startsWith(cookieName + '='))
      ?.slice(cookieName.length + 1);

    if (token && /^[a-f0-9]{64}$/.test(token)) {
      req.tokenHash = hash(token);

      const [rows] = await pool.execute(
        `SELECT u.usuario, u.rol
         FROM sesiones s
         JOIN usuarios u ON u.usuario = s.usuario
         WHERE s.token_hash = ?
           AND s.expira > ?
           AND u.activo = 1`,
        [req.tokenHash, Date.now()]
      );

      req.usuario = rows[0] || null;
    }

    next();
  } catch (error) {
    next(error);
  }
});

async function snapshot(usuario) {
  const conexion = await pool.getConnection();

  try {
    await conexion.beginTransaction();

    const estado = await leer(conexion);

    await conexion.commit();

    return visible(estado, usuario);
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}

app.get('/api/estado', async (req, res) => {
  res.json({
    estado: await snapshot(req.usuario),
    usuario: req.usuario || null
  });
});

const intentos = new Map();

app.post('/api/login', async (req, res) => {
  const ip = req.ip;
  const ahora = Date.now();

  let registro = intentos.get(ip);

  if (!registro || registro.hasta <= ahora) {
    registro = {
      cantidad: 0,
      hasta: ahora + TIEMPO_BLOQUEO
    };
  }

  if (registro.cantidad >= MAX_INTENTOS) {
    return res.status(429).json({
      error: 'Demasiados intentos. Espera tres minutos.'
    });
  }

  registro.cantidad++;
  intentos.set(ip, registro);

  const { usuario, password } = req.body || {};

  const [rows] = await pool.execute(
    `SELECT usuario, rol, password_hash
     FROM usuarios
     WHERE usuario = ?
       AND activo = 1`,
    [typeof usuario === 'string' ? usuario.trim() : '']
  );

  const cuenta = rows[0];

  if (
    !cuenta ||
    !(await verificarPassword(password, cuenta.password_hash))
  ) {
    return res.status(401).json({
      error: 'Usuario o contraseña incorrectos.'
    });
  }

  intentos.delete(ip);

  const token = randomBytes(32).toString('hex');

  if (req.tokenHash) {
    await pool.execute(
      'DELETE FROM sesiones WHERE token_hash = ?',
      [req.tokenHash]
    );
  }

  await pool.execute(
    'DELETE FROM sesiones WHERE expira < ?',
    [Date.now()]
  );

  await pool.execute(
    `INSERT INTO sesiones(token_hash, usuario, expira)
     VALUES (?, ?, ?)`,
    [
      hash(token),
      cuenta.usuario,
      Date.now() + DURACION_SESION
    ]
  );

  res.cookie(cookieName, token, cookieOptions);

  res.json({
    usuario: {
      usuario: cuenta.usuario,
      rol: cuenta.rol
    },
    estado: await snapshot(cuenta)
  });
});

app.post('/api/logout', async (req, res) => {
  if (req.tokenHash) {
    await pool.execute(
      'DELETE FROM sesiones WHERE token_hash = ?',
      [req.tokenHash]
    );
  }

  res.clearCookie(cookieName, cookieOptions);
  res.json({ ok: true });
});

app.get('/api/sesion', (req, res) => {
  res.json({
    usuario: req.usuario || null
  });
});

app.post('/api/actividad', async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({
      error: 'La sesión finalizó.'
    });
  }

  await pool.execute(
    `UPDATE sesiones
     SET expira = ?
     WHERE token_hash = ?
       AND expira > ?`,
    [
      Date.now() + DURACION_SESION,
      req.tokenHash,
      Date.now()
    ]
  );

  res.json({ ok: true });
});

app.post('/api/operaciones', async (req, res) => {
  const { tipo, datos, revision } = req.body || {};

  if (tipo !== 'pedido.crear' && !req.usuario) {
    return res.status(401).json({
      error: 'Inicia sesión nuevamente.'
    });
  }

  try {
    const respuesta = await transaccion(async (estado, conexion) => {
      // Un reintento del mismo cobro no genera otra venta.
      if (
        tipo === 'venta.crear' &&
        estado.ventas.some(venta => venta.id === datos?.id)
      ) {
        return aplicar(estado, tipo, datos, req.usuario);
      }

      if (revision !== estado.revision) {
        const error = new Error(
          'Los datos cambiaron en otra pantalla. ' +
          'Se actualizaron; revisa y vuelve a intentar.'
        );

        error.status = 409;
        throw error;
      }

      if (tipo === 'datos.importar') {
        return importarAnterior(
          estado,
          datos.archivo,
          req.usuario,
          conexion
        );
      }

      return aplicar(
        estado,
        tipo,
        datos || {},
        req.usuario
      );
    });

    let resultado = respuesta.resultado || null;

    if (
      tipo === 'venta.crear' &&
      req.usuario?.rol !== ADMIN &&
      resultado
    ) {
      resultado = {
        ...resultado,
        items: resultado.items.map(item => ({
          ...item,
          precioCompra: null
        }))
      };
    }

    res.json({
      resultado,
      estado: await snapshot(req.usuario)
    });
  } catch (error) {
    if (error.status === 409) {
      return res.status(409).json({
        error: error.message,
        estado: await snapshot(req.usuario)
      });
    }

    throw error;
  }
});

app.get('/api/respaldo', async (req, res) => {
  if (req.usuario?.rol !== ADMIN) {
    return res.status(403).json({
      error: 'Solo administración puede exportar.'
    });
  }

  res.json(await snapshot(req.usuario));
});

const raiz = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'build'
);

app.use(
  '/imagenes',
  express.static(
    path.resolve(raiz, '..', 'public', 'imagenes')
  )
);

app.use(express.static(raiz));

app.get('/{*ruta}', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Ruta no encontrada.'
    });
  }

  res.sendFile(path.join(raiz, 'index.html'), error => {
    if (error && !res.headersSent) {
      res.status(404).send(
        'Inicia el frontend con npm start ' +
        'o genera build con npm run build.'
      );
    }
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }

  const errorConexion = [
    'ECONNREFUSED',
    'ER_ACCESS_DENIED_ERROR',
    'ER_BAD_DB_ERROR',
    'ER_NO_SUCH_TABLE'
  ].includes(error.code);

  if (errorConexion) {
    return res.status(503).json({
      error:
        'No se pudo acceder a MySQL. ' +
        'Revisa el servicio, .env y npm run db:setup.'
    });
  }

  if (error.code) {
    console.error('Error MySQL:', error.code);

    return res.status(500).json({
      error:
        'No se pudo guardar la operación. ' +
        'No se confirmaron los cambios.'
    });
  }

  res.status(error.status || 400).json({
    error: error.message || 'No se pudo completar la solicitud.'
  });
});