-- Agrega columna precio a reservas para guardar el precio efectivo al momento de reservar.
-- Esto permite calcular ingresos correctamente con franjas de precio variables.
ALTER TABLE reservas
  ADD COLUMN IF NOT EXISTS precio INTEGER NOT NULL DEFAULT 0;

-- Comentario descriptivo
COMMENT ON COLUMN reservas.precio IS 'Precio pagado por el cliente en el momento de la reserva (en pesos). Usa el precio base o de franja vigente.';
