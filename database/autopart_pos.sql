-- Ejecutar desde MySQL Workbench o desde npm run db:setup.
-- MySQL 8.0.16 o superior. No borra tablas existentes.
CREATE DATABASE IF NOT EXISTS autopart_pos CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE autopart_pos;
CREATE TABLE IF NOT EXISTS configuracion (
 id TINYINT PRIMARY KEY,
 revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
 secuencia_venta BIGINT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;
INSERT IGNORE INTO configuracion(id) VALUES(1);
CREATE TABLE IF NOT EXISTS usuarios (
 usuario VARCHAR(40) PRIMARY KEY,
 password_hash VARCHAR(255) NOT NULL,
 rol VARCHAR(80) NOT NULL,
 activo BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS productos (
 codigo VARCHAR(40) PRIMARY KEY,
 descripcion VARCHAR(160) NOT NULL,
 categoria VARCHAR(80) NOT NULL,
 precio_compra DECIMAL(12,2) NULL,
 precio_venta DECIMAL(12,2) NOT NULL,
 stock INT UNSIGNED NOT NULL,
 stock_minimo INT UNSIGNED NOT NULL DEFAULT 5,
 activo BOOLEAN NOT NULL DEFAULT TRUE,
 CHECK(precio_venta>=0), CHECK(precio_compra IS NULL OR precio_compra>=0),
 INDEX idx_productos_descripcion(descripcion)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ordenes (
 id VARCHAR(80) PRIMARY KEY,
 folio VARCHAR(80) NOT NULL UNIQUE,
 cliente VARCHAR(80) NOT NULL,
 vehiculo VARCHAR(80) NOT NULL,
 placas VARCHAR(80) NOT NULL,
 servicio VARCHAR(160) NOT NULL,
 mecanico VARCHAR(80) NOT NULL,
 mano_obra DECIMAL(12,2) NOT NULL,
 estado VARCHAR(20) NOT NULL,
 fecha_iso VARCHAR(30) NOT NULL,
 usuario VARCHAR(40) NOT NULL,
 venta_id VARCHAR(80) NULL,
 legado BOOLEAN NOT NULL DEFAULT FALSE,
 importe_anterior DECIMAL(12,2) NULL,
 CHECK(mano_obra>=0),
 FOREIGN KEY(usuario) REFERENCES usuarios(usuario),
 INDEX idx_orden_estado(estado)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS detalle_orden (
 orden_id VARCHAR(80) NOT NULL,
 producto_codigo VARCHAR(40) NOT NULL,
 descripcion VARCHAR(160) NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 precio_venta DECIMAL(12,2) NOT NULL,
 PRIMARY KEY(orden_id,producto_codigo),
 CHECK(cantidad>0), CHECK(precio_venta>=0),
 FOREIGN KEY(orden_id) REFERENCES ordenes(id),
 FOREIGN KEY(producto_codigo) REFERENCES productos(codigo)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS ventas (
 id VARCHAR(80) PRIMARY KEY,
 folio VARCHAR(80) NOT NULL UNIQUE,
 fecha_iso VARCHAR(30) NOT NULL,
 cajero VARCHAR(40) NOT NULL,
 estado VARCHAR(20) NOT NULL,
 metodo_pago VARCHAR(50) NOT NULL,
 subtotal DECIMAL(12,2) NOT NULL,
 iva DECIMAL(12,2) NOT NULL,
 total DECIMAL(12,2) NOT NULL,
 mano_obra DECIMAL(12,2) NOT NULL DEFAULT 0,
 pagado_con DECIMAL(12,2) NOT NULL,
 cambio DECIMAL(12,2) NOT NULL,
 pedido_id VARCHAR(80) NULL,
 orden_id VARCHAR(80) NULL,
 motivo VARCHAR(160) NULL,
 anulada_por VARCHAR(40) NULL,
 anulada_iso VARCHAR(30) NULL,
 CHECK(total>=0), CHECK(subtotal>=0), CHECK(iva>=0),
 FOREIGN KEY(cajero) REFERENCES usuarios(usuario),
 FOREIGN KEY(orden_id) REFERENCES ordenes(id),
 FOREIGN KEY(anulada_por) REFERENCES usuarios(usuario),
 INDEX idx_ventas_fecha(fecha_iso), INDEX idx_ventas_estado(estado)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS detalle_venta (
 venta_id VARCHAR(80) NOT NULL,
 producto_codigo VARCHAR(40) NOT NULL,
 descripcion VARCHAR(160) NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 precio_venta DECIMAL(12,2) NOT NULL,
 precio_compra DECIMAL(12,2) NULL,
 subtotal DECIMAL(12,2) NOT NULL,
 PRIMARY KEY(venta_id,producto_codigo),
 CHECK(cantidad>0), CHECK(precio_venta>=0),
 FOREIGN KEY(venta_id) REFERENCES ventas(id),
 FOREIGN KEY(producto_codigo) REFERENCES productos(codigo)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS pedidos (
 id VARCHAR(80) PRIMARY KEY,
 folio VARCHAR(80) NOT NULL UNIQUE,
 cliente VARCHAR(80) NOT NULL,
 telefono VARCHAR(20) NOT NULL,
 producto_codigo VARCHAR(40) NOT NULL,
 cantidad INT UNSIGNED NOT NULL,
 precio DECIMAL(12,2) NOT NULL,
 fecha_iso VARCHAR(30) NOT NULL,
 estado VARCHAR(20) NOT NULL,
 venta_id VARCHAR(80) NULL,
 motivo VARCHAR(160) NULL,
 CHECK(cantidad>0),
 FOREIGN KEY(producto_codigo) REFERENCES productos(codigo),
 FOREIGN KEY(venta_id) REFERENCES ventas(id),
 INDEX idx_pedidos_estado(estado)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS movimientos (
 id VARCHAR(80) PRIMARY KEY,
 fecha_iso VARCHAR(30) NOT NULL,
 producto_codigo VARCHAR(40) NOT NULL,
 cantidad INT NOT NULL,
 tipo VARCHAR(40) NOT NULL,
 referencia VARCHAR(80) NULL,
 motivo VARCHAR(160) NULL,
 usuario VARCHAR(40) NOT NULL,
 FOREIGN KEY(producto_codigo) REFERENCES productos(codigo),
 FOREIGN KEY(usuario) REFERENCES usuarios(usuario)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sesiones (
 token_hash CHAR(64) PRIMARY KEY,
 usuario VARCHAR(40) NOT NULL,
 expira BIGINT NOT NULL,
 FOREIGN KEY(usuario) REFERENCES usuarios(usuario),
 INDEX idx_sesiones_expira(expira)
) ENGINE=InnoDB;
-- Las referencias circulares se crean después de ambas tablas.
-- db:setup agrega estas restricciones si todavía no existen.

CREATE TABLE IF NOT EXISTS importaciones (
 id CHAR(64) PRIMARY KEY, fecha_iso VARCHAR(30) NOT NULL, contenido JSON NOT NULL, usuario VARCHAR(40) NOT NULL, FOREIGN KEY(usuario) REFERENCES usuarios(usuario)
) ENGINE=InnoDB;
