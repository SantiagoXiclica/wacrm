# Seed Data — Agent Performance Dashboard (Seed 01)

## 1. Propósito

Poblar las cuentas de **comercial1** y **comercial2** con datos de prueba
para validar el dashboard `/dashboard/agent-performance` con métricas
reales de workload, response time, deals won/lost y flow handoffs.

El script es **idempotente**: limpia datos anteriores del seed antes de
insertar (solo borra registros de las dos cuentas target).

## 2. Mapa de Identificadores (existentes en producción)

| Usuario | `account_id` | `user_id` | `profile_id` | `account_role` |
|---------|-------------|-----------|-------------|----------------|
| comercial1 | `b5a395c0-565d-42da-9873-a0951f834d09` | `b976f1f9-56b4-4e94-bb04-cea715f04b91` | `4b5fa234-a8d9-4ddb-9294-8be33d871b42` | owner |
| comercial2 | `6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1` | `60a2c33a-c18f-41c4-979c-f4c34d81f4c9` | `f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9` | owner |

## 3. Resumen de datos generados

| Tabla | comercial1 | comercial2 | Total |
|-------|-----------|-----------|-------|
| contacts | 15 | 15 | 30 |
| pipelines | 1 | 1 | 2 |
| pipeline_stages | 4 | 4 | 8 |
| conversations | 10 | 10 | 20 |
| messages | ~50 | ~50 | ~100 |
| deals | 8 | 8 | 16 |
| flows | 3 | 3 | 6 |
| flow_runs | ~12 | ~12 | ~24 |

### Perfil de datos para cada cuenta

| Métrica | comercial1 | comercial2 |
|---------|-----------|------------|
| Conversaciones activas | 6 (open) | 6 (open) |
| Conversaciones cerradas | 4 (closed) | 4 (closed) |
| Messages enviados | ~25 agent | ~25 agent |
| Response time avg | ~3 min (rápido) | ~15 min (moderado) |
| Deals won | 3 | 3 |
| Deals lost | 2 | 2 |
| Deals open | 3 | 3 |
| Value won | ~$9.2M COP | ~$8.5M COP |
| Flows activos | 2 | 2 |
| Flow handoff rate | ~40% | ~50% |

## 4. SQL Seed Script

Ejecutar en el **SQL Editor** de Supabase o vía `supabase_execute_sql` de MCP.
El script usa `service_role` implícitamente (bypasses RLS).

### 4.1 Limpieza

```sql
BEGIN;

-- FK-safe delete order
DELETE FROM flow_runs
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM deals
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE account_id IN (
    'b5a395c0-565d-42da-9873-a0951f834d09',
    '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
  )
);

DELETE FROM conversations
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM pipeline_stages
WHERE pipeline_id IN (
  SELECT id FROM pipelines
  WHERE user_id IN (
    'b976f1f9-56b4-4e94-bb04-cea715f04b91',
    '60a2c33a-c18f-41c4-979c-f4c34d81f4c9'
  )
);

DELETE FROM pipelines
WHERE user_id IN (
  'b976f1f9-56b4-4e94-bb04-cea715f04b91',
  '60a2c33a-c18f-41c4-979c-f4c34d81f4c9'
);

DELETE FROM flows
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM contacts
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);
```

### 4.2 Contactos (30 — 15 por cuenta)

```sql
-- ============================================================
-- Contactos — comercial1 (15)
-- ============================================================
INSERT INTO contacts (id, user_id, account_id, phone, name, email, company) VALUES
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111001', 'Andrés Ramírez',       'andres.ramirez@gmail.com',      'IngeSoluciones'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111002', 'María Fernanda López', 'maria.lopez@correo.co',         'Distribuidora Andina'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111003', 'Carlos Gutiérrez',      'carlos.gutierrez@hotmail.com',  'Constructora Gutiérrez'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111004', 'Diana Patricia Rojas',  'diana.rojas@autosdelvalle.com', 'Autos del Valle'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111005', 'Jorge Eduardo Suárez',  'jorge.suarez@bancol.com',       'Bancol'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111006', 'Paola Andrea Moreno',   'paola.moreno@logisticaexpress.co', 'Logística Express'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111007', 'Felipe Vargas',         'felipe.vargas@nutri.com.co',    'NutriVida'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111008', 'Laura Sofía Herrera',   'laura.herrera@tecnosys.com',    'Tecnosys'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111009', 'Oscar Javier Medina',   'oscar.medina@agroexport.co',    'AgroExport Colombia'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111010', 'Camila Rodríguez',      'camila.rodriguez@fashion.com.co', 'Fashion Moda'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111011', 'Alberto Jiménez',       'alberto.jimenez@transportes.co',  'Transportes JM'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111012', 'Natalia Cardona',       'natalia.cardona@creativa.co',     'Agencia Creativa'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111013', 'Ricardo Andrés Acosta', 'ricardo.acosta@hardware.com.co',  'Hardware Center'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111014', 'Valentina García',      'valentina.garcia@serviciosrap.co', 'ServiRápido'),
(gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'b5a395c0-565d-42da-9873-a0951f834d09', '573011111015', 'Mauricio Torres',       'mauricio.torres@conserco.com',     'Conserco Ltda.');

-- ============================================================
-- Contactos — comercial2 (15)
-- ============================================================
INSERT INTO contacts (id, user_id, account_id, phone, name, email, company) VALUES
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222001', 'Diana Marcela Vargas',   'diana.vargas@soluciones.co',     'Soluciones IT'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222002', 'Gabriel Ochoa',           'gabriel.ochoa@medisin.net',     'MediSin'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222003', 'Estefanía Gómez',         'estefania.gomez@inmobiliaria.co', 'InmoAndina'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222004', 'Juan David Restrepo',     'juan.restrepo@tecnoglass.com',   'Tecnoglass'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222005', 'Karen Lizeth Castro',     'karen.castro@foodies.com.co',   'Foodies'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222006', 'Santiago Ríos',           'santiago.rios@asesoraseguros.co', 'AsesoraSeguros'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222007', 'Juliana Peláez',          'juliana.pelaez@ecopet.com',     'EcoPet'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222008', 'Hernán Darío Roldán',     'hernan.roldan@metalworks.co',   'MetalWorks'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222009', 'Alejandra Bustamante',    'alejandra.busta@marketing.co',  'MKT Digital'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222010', 'Wilson Fernando Arias',   'wilson.arias@prestamosya.co',   'Préstamos Ya'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222011', 'Adriana Lucía Franco',    'adriana.franco@clinicadelvalle.co', 'Clínica del Valle'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222012', 'Luis Miguel Perdomo',     'luis.perdomo@publicidad.co',    'PubliMax'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222013', 'Claudia Patricia Muñoz',  'claudia.munoz@farmaceutica.co', 'Farmalab'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222014', 'Diego Armando León',      'diego.leon@electrodomesticos.co', 'ElectroHogar'),
(gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1', '573022222015', 'Sandra Milena Osorio',    'sandra.osorio@conserjeria.com.co', 'Conserjería Total');
```

### 4.3 Pipelines y Stages

```sql
-- ============================================================
-- Pipeline comercial1 — "Ventas"
-- ============================================================
WITH pipe1 AS (
  INSERT INTO pipelines (id, user_id, name, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Ventas', 'b5a395c0-565d-42da-9873-a0951f834d09')
  RETURNING id
)
INSERT INTO pipeline_stages (id, pipeline_id, name, position, color)
SELECT gen_random_uuid(), pipe1.id, s.name, s.pos, s.color
FROM pipe1
CROSS JOIN (
  VALUES
    ('Contacto inicial',   1, '#3b82f6'),
    ('Cotización enviada', 2, '#f59e0b'),
    ('Negociación',        3, '#ef4444'),
    ('Cerrado',            4, '#22c55e')
) AS s(name, pos, color);

-- ============================================================
-- Pipeline comercial2 — "Ventas"
-- ============================================================
WITH pipe2 AS (
  INSERT INTO pipelines (id, user_id, name, account_id)
  VALUES (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Ventas', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1')
  RETURNING id
)
INSERT INTO pipeline_stages (id, pipeline_id, name, position, color)
SELECT gen_random_uuid(), pipe2.id, s.name, s.pos, s.color
FROM pipe2
CROSS JOIN (
  VALUES
    ('Contacto inicial',   1, '#3b82f6'),
    ('Cotización enviada', 2, '#f59e0b'),
    ('Negociación',        3, '#ef4444'),
    ('Cerrado',            4, '#22c55e')
) AS s(name, pos, color);
```

### 4.4 Conversations (10 por cuenta, esparcidas 90 días)

```sql
-- ============================================================
-- Conversations — comercial1 (10)
-- ============================================================
DO $$
DECLARE
  v_contacts UUID[];
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT array_agg(id ORDER BY name) INTO v_contacts
  FROM contacts WHERE account_id = 'b5a395c0-565d-42da-9873-a0951f834d09';

  -- Contacto 0 → open (hace 2h)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[1], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Perfecto, le envío la cotización mañana', v_now - INTERVAL '2 hours', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 1 → open (hace 1 día)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[2], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', '¿Cuál es el plazo de entrega?', v_now - INTERVAL '1 day', 1,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 2 → open (hace 3 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[3], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Listo, agendamos la visita para el viernes', v_now - INTERVAL '3 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 3 → open (hace 5 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[4], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Necesito el servicio urgente para esta semana', v_now - INTERVAL '5 days', 1,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 4 → open (hace 7 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[5], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Gracias por la información, lo reviso y te confirmo', v_now - INTERVAL '7 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 5 → open (hace 14 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[6], 'open',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', '¿Tienen servicio de mantenimiento?', v_now - INTERVAL '14 days', 1,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 6 → closed (hace 10 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[7], 'closed',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Muchas gracias, quedó perfecto', v_now - INTERVAL '10 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 7 → closed (hace 25 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[8], 'closed',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Pago realizado, gracias', v_now - INTERVAL '25 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 8 → closed (hace 40 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[9], 'closed',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Excelente servicio, los recomiendo', v_now - INTERVAL '40 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Contacto 9 → closed (hace 60 días)
  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_contacts[10], 'closed',
          'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Todo solucionado, gracias por la atención', v_now - INTERVAL '60 days', 0,
          'b5a395c0-565d-42da-9873-a0951f834d09');
END $$;

-- ============================================================
-- Conversations — comercial2 (10)
-- ============================================================
DO $$
DECLARE
  v_contacts UUID[];
  v_now TIMESTAMPTZ := NOW();
BEGIN
  SELECT array_agg(id ORDER BY name) INTO v_contacts
  FROM contacts WHERE account_id = '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1';

  INSERT INTO conversations (id, user_id, contact_id, status, assigned_agent_id, last_message_text, last_message_at, unread_count, account_id)
  VALUES (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[1], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Quedamos pendientes del envío', v_now - INTERVAL '4 hours', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[2], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '¿Me puedes confirmar la disponibilidad?', v_now - INTERVAL '2 days', 1,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[3], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'La reunión quedó para el lunes a las 10am', v_now - INTERVAL '4 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[4], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Necesitamos una solución ASAP', v_now - INTERVAL '6 days', 1,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[5], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'El presupuesto está dentro del rango', v_now - INTERVAL '10 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[6], 'open',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', '¿Hasta cuándo tienen la promoción?', v_now - INTERVAL '15 days', 1,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),

  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[7], 'closed',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Cerramos el contrato hoy, gracias', v_now - INTERVAL '12 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[8], 'closed',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Entregado a satisfacción', v_now - INTERVAL '30 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[9], 'closed',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Gracias, excelente soporte', v_now - INTERVAL '45 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_contacts[10], 'closed',
          '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Servicio impecable, volveremos a contactarlos', v_now - INTERVAL '70 days', 0,
          '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');
END $$;
```

### 4.5 Messages (~50 por cuenta — alternancia customer ↔ agent)

Cada conversación recibe 4–6 mensajes con alternancia `customer` → `agent`.
El `created_at` de cada mensaje se incrementa con offsets para simular
response times realistas.

```sql
-- ============================================================
-- Messages — comercial1 (response time rápido: ~3 min avg)
-- ============================================================
DO $$
DECLARE
  r RECORD;
  base_ts TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM conversations
    WHERE account_id = 'b5a395c0-565d-42da-9873-a0951f834d09'
    ORDER BY created_at
  LOOP
    base_ts := r.created_at;

    -- Message 1: customer opens
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Hola, buenos días. Quisiera información sobre sus servicios.', 'delivered', base_ts + INTERVAL '2 minutes');

    -- Message 2: agent replies quickly (2 min later)
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'text', 'Buenos días, claro que sí. ¿Qué servicio le interesa?', 'delivered', base_ts + INTERVAL '4 minutes');

    -- Message 3: customer follows up
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Principalmente el servicio de consultoría empresarial', 'delivered', base_ts + INTERVAL '8 minutes');

    -- Message 4: agent responds (3 min later — fast)
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'text', 'Perfecto, tenemos tres planes: Básico, Premium y Enterprise. ¿Le envío los detalles?', 'delivered', base_ts + INTERVAL '11 minutes');

    -- Message 5: customer confirms
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Sí por favor, envíemelos a mi correo', 'delivered', base_ts + INTERVAL '18 minutes');

    -- Message 6: agent closes
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'text', 'Listo, se los envío en los próximos minutos. ¡Gracias por contactarnos!', 'delivered', base_ts + INTERVAL '20 minutes');
  END LOOP;
END $$;

-- ============================================================
-- Messages — comercial2 (response time moderado: ~15 min avg)
-- ============================================================
DO $$
DECLARE
  r RECORD;
  base_ts TIMESTAMPTZ;
BEGIN
  FOR r IN
    SELECT id, created_at
    FROM conversations
    WHERE account_id = '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
    ORDER BY created_at
  LOOP
    base_ts := r.created_at;

    -- Message 1: customer
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Buenas tardes, necesito cotizar un proyecto', 'delivered', base_ts + INTERVAL '1 minutes');

    -- Message 2: agent replies (10 min later)
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'text', 'Buenas tardes. Con gusto, ¿de qué tipo de proyecto se trata?', 'delivered', base_ts + INTERVAL '11 minutes');

    -- Message 3: customer
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Desarrollo de software a medida para gestión de inventarios', 'delivered', base_ts + INTERVAL '15 minutes');

    -- Message 4: agent replies (15 min later — moderate)
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'text', 'Entendido. Necesitaría más detalles para darle una cotización precisa. ¿Podemos agendar una llamada?', 'delivered', base_ts + INTERVAL '30 minutes');

    -- Message 5: customer
    INSERT INTO messages (id, conversation_id, sender_type, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'customer', 'text', 'Sí, mañana a las 3pm me funciona', 'delivered', base_ts + INTERVAL '35 minutes');

    -- Message 6: agent closes (15 min later)
    INSERT INTO messages (id, conversation_id, sender_type, sender_id, content_type, content_text, status, created_at)
    VALUES (gen_random_uuid(), r.id, 'agent', '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'text', 'Perfecto, agendado. Le envío la invitación a su correo.', 'delivered', base_ts + INTERVAL '50 minutes');
  END LOOP;
END $$;
```

### 4.6 Deals (8 por cuenta)

**CRÍTICO**: `deals.assigned_to` → `profiles.id` (profileId, NO userId).  
`conversations.assigned_agent_id` → `auth.users.id` (userId).

```sql
-- ============================================================
-- Deals — comercial1 (8)
-- ============================================================
DO $$
DECLARE
  v_pipe_id UUID;
  v_stages UUID[4];
  v_contacts UUID[];
  v_convs UUID[];
BEGIN
  SELECT id INTO v_pipe_id FROM pipelines WHERE user_id = 'b976f1f9-56b4-4e94-bb04-cea715f04b91' LIMIT 1;
  SELECT array_agg(id ORDER BY position) INTO v_stages FROM pipeline_stages WHERE pipeline_id = v_pipe_id;
  SELECT array_agg(id ORDER BY name) INTO v_contacts FROM contacts WHERE account_id = 'b5a395c0-565d-42da-9873-a0951f834d09';
  SELECT array_agg(id ORDER BY created_at) INTO v_convs FROM conversations WHERE account_id = 'b5a395c0-565d-42da-9873-a0951f834d09';

  -- Won (3)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id, expected_close_date)
  VALUES
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[4],
     v_contacts[1], v_convs[1], 'Consultoría empresarial — Plan Premium',    4200000, 'COP', 'won',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE - INTERVAL '20 days'),
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[4],
     v_contacts[3], v_convs[3], 'Desarrollo web corporativo',                2800000, 'COP', 'won',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE - INTERVAL '30 days'),
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[4],
     v_contacts[7], v_convs[7], 'Servicio de mantenimiento anual',           2200000, 'COP', 'won',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE - INTERVAL '45 days');

  -- Lost (2)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id)
  VALUES
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[3],
     v_contacts[5], v_convs[5], 'Campaña de marketing digital',             1800000, 'COP', 'lost',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[3],
     v_contacts[9], v_convs[9], 'Implementación ERP básico',                5500000, 'COP', 'lost',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Open (3)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id, expected_close_date)
  VALUES
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[1],
     v_contacts[2], v_convs[2], 'Rediseño de identidad corporativa',        1500000, 'COP', 'open',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE + INTERVAL '15 days'),
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[2],
     v_contacts[4], v_convs[4], 'Automatización de procesos internos',      7200000, 'COP', 'open',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE + INTERVAL '30 days'),
    (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', v_pipe_id, v_stages[2],
     v_contacts[8], v_convs[8], 'Capacitación equipo de ventas',             950000, 'COP', 'open',
     '4b5fa234-a8d9-4ddb-9294-8be33d871b42', 'b5a395c0-565d-42da-9873-a0951f834d09',
     CURRENT_DATE + INTERVAL '10 days');
END $$;

-- ============================================================
-- Deals — comercial2 (8)
-- ============================================================
DO $$
DECLARE
  v_pipe_id UUID;
  v_stages UUID[4];
  v_contacts UUID[];
  v_convs UUID[];
BEGIN
  SELECT id INTO v_pipe_id FROM pipelines WHERE user_id = '60a2c33a-c18f-41c4-979c-f4c34d81f4c9' LIMIT 1;
  SELECT array_agg(id ORDER BY position) INTO v_stages FROM pipeline_stages WHERE pipeline_id = v_pipe_id;
  SELECT array_agg(id ORDER BY name) INTO v_contacts FROM contacts WHERE account_id = '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1';
  SELECT array_agg(id ORDER BY created_at) INTO v_convs FROM conversations WHERE account_id = '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1';

  -- Won (3)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id, expected_close_date)
  VALUES
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[4],
     v_contacts[2], v_convs[2], 'Software gestión de inventarios',         5600000, 'COP', 'won',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE - INTERVAL '15 days'),
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[4],
     v_contacts[5], v_convs[5], 'Migración de servidores cloud',          1800000, 'COP', 'won',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE - INTERVAL '40 days'),
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[4],
     v_contacts[8], v_convs[8], 'Desarrollo app móvil Android/iOS',       1100000, 'COP', 'won',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE - INTERVAL '55 days');

  -- Lost (2)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id)
  VALUES
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[3],
     v_contacts[4], v_convs[4], 'Rediseño portal corporativo',            4500000, 'COP', 'lost',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[3],
     v_contacts[10], v_convs[10], 'Consultoría mesa de ayuda IT',         3200000, 'COP', 'lost',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');

  -- Open (3)
  INSERT INTO deals (id, user_id, pipeline_id, stage_id, contact_id, conversation_id, title, value, currency, status, assigned_to, account_id, expected_close_date)
  VALUES
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[1],
     v_contacts[1], v_convs[1], 'Plataforma e-commerce',                  3500000, 'COP', 'open',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE + INTERVAL '20 days'),
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[2],
     v_contacts[6], v_convs[6], 'Sistema de facturación electrónica',     2800000, 'COP', 'open',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE + INTERVAL '25 days'),
    (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', v_pipe_id, v_stages[2],
     v_contacts[9], v_convs[9], 'Auditoría de seguridad informática',     4200000, 'COP', 'open',
     'f3a607b5-ce35-4fc7-a3e7-5cb496e04ff9', '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1',
     CURRENT_DATE + INTERVAL '45 days');
END $$;
```

### 4.7 Flows & Flow Runs

```sql
-- ============================================================
-- Flows — comercial1 (3)
-- ============================================================
INSERT INTO flows (id, user_id, name, status, trigger_type, trigger_config, execution_count, last_executed_at, account_id)
VALUES
  (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Atención inicial',
   'active', 'first_inbound_message', '{}'::jsonb, 12, NOW() - INTERVAL '1 day',
   'b5a395c0-565d-42da-9873-a0951f834d09'),
  (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Seguimiento post-venta',
   'active', 'keyword', '{"keywords":["gracias","satisfecho","excelente"]}'::jsonb, 8, NOW() - INTERVAL '3 days',
   'b5a395c0-565d-42da-9873-a0951f834d09'),
  (gen_random_uuid(), 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'Reactivación clientes inactivos',
   'active', 'manual', '{}'::jsonb, 5, NOW() - INTERVAL '10 days',
   'b5a395c0-565d-42da-9873-a0951f834d09');

-- ============================================================
-- Flows — comercial2 (3)
-- ============================================================
INSERT INTO flows (id, user_id, name, status, trigger_type, trigger_config, execution_count, last_executed_at, account_id)
VALUES
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Cotización automática',
   'active', 'keyword', '{"keywords":["cotizar","precio","cuánto cuesta"]}'::jsonb, 15, NOW() - INTERVAL '2 days',
   '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Soporte técnico nivel 1',
   'active', 'first_inbound_message', '{}'::jsonb, 20, NOW() - INTERVAL '1 day',
   '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
  (gen_random_uuid(), '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'Encuesta de satisfacción',
   'active', 'keyword', '{"keywords":["encuesta","feedback","opinión"]}'::jsonb, 6, NOW() - INTERVAL '7 days',
   '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');

-- ============================================================
-- Flow Runs — comercial1 (distribuidos entre flows)
-- 40% handed_off, 40% completed, 20% active
-- ============================================================
DO $$
DECLARE
  v_flows UUID[];
BEGIN
  SELECT array_agg(id ORDER BY name) INTO v_flows
  FROM flows WHERE account_id = 'b5a395c0-565d-42da-9873-a0951f834d09';

  -- Flow 1 "Atención inicial" (5 runs: 2 handed_off, 2 completed, 1 active)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[1], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'handed_off',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 2, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[1], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 0, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[1], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '8 days', NOW() - INTERVAL '8 days', 1, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[1], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'handed_off',
     NOW() - INTERVAL '4 days', NOW() - INTERVAL '4 days', 3, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[1], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'active',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, 'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Flow 2 "Seguimiento post-venta" (4 runs: 1 handed_off, 2 completed, 1 active)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[2], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', 0, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[2], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'handed_off',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 1, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[2], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', 0, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[2], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'active',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, 'b5a395c0-565d-42da-9873-a0951f834d09');

  -- Flow 3 "Reactivación" (3 runs: 1 handed_off, 2 completed)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[3], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 0, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[3], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'completed',
     NOW() - INTERVAL '20 days', NOW() - INTERVAL '20 days', 0, 'b5a395c0-565d-42da-9873-a0951f834d09'),
    (gen_random_uuid(), v_flows[3], 'b976f1f9-56b4-4e94-bb04-cea715f04b91', 'handed_off',
     NOW() - INTERVAL '15 days', NOW() - INTERVAL '15 days', 2, 'b5a395c0-565d-42da-9873-a0951f834d09');
END $$;

-- ============================================================
-- Flow Runs — comercial2 (distribuidos entre flows)
-- ============================================================
DO $$
DECLARE
  v_flows UUID[];
BEGIN
  SELECT array_agg(id ORDER BY name) INTO v_flows
  FROM flows WHERE account_id = '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1';

  -- Flow 1 "Cotización automática" (5 runs: 3 handed_off, 1 completed, 1 active)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[1], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'handed_off',
     NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days', 2, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[1], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'completed',
     NOW() - INTERVAL '6 days', NOW() - INTERVAL '6 days', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[1], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'handed_off',
     NOW() - INTERVAL '10 days', NOW() - INTERVAL '10 days', 1, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[1], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'handed_off',
     NOW() - INTERVAL '14 days', NOW() - INTERVAL '14 days', 3, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[1], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'active',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');

  -- Flow 2 "Soporte técnico" (4 runs: 2 handed_off, 2 active)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[2], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'handed_off',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 1, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[2], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'active',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[2], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'handed_off',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 2, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[2], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'active',
     NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');

  -- Flow 3 "Encuesta satisfacción" (3 runs: 0 handed_off, 2 completed, 1 active)
  INSERT INTO flow_runs (id, flow_id, user_id, status, started_at, last_advanced_at, reprompt_count, account_id)
  VALUES
    (gen_random_uuid(), v_flows[3], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'completed',
     NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[3], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'completed',
     NOW() - INTERVAL '12 days', NOW() - INTERVAL '12 days', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'),
    (gen_random_uuid(), v_flows[3], '60a2c33a-c18f-41c4-979c-f4c34d81f4c9', 'active',
     NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days', 0, '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1');
END $$;

COMMIT;
```

## 5. Ejecución

### Opción A — SQL Editor (recomendada)

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard) → seleccionar proyecto
2. Ir a **SQL Editor**
3. Copiar y pegar **todo el script** (secciones 4.1 a 4.7)
4. Ejecutar con `Run` (el SQL Editor usa `service_role`, bypasses RLS)

### Opción B — Supabase MCP

El script puede ejecutarse en bloques individuales vía `supabase_execute_sql`.
Tener en cuenta que `COMMIT` está al final — si se envían bloques separados,
quitar el `BEGIN;` inicial y el `COMMIT;` final, o ejecutar todo junto.

### Opción C — CLI local (si tienen `supabase` CLI)

```bash
supabase db execute --file supabase/seed_agent_performance.sql
```

## 6. Verificación

```bash
pnpm dev
```

1. Login como **comercial1@gmail.com** → `http://localhost:5644/dashboard/agent-performance`
2. Validar:
   - KPI cards (Total conv, messages, deals won, value won)
   - Bar chart de workload (1 barra: comercial1)
   - Bar chart de response time (~3 min avg)
   - Bar chart de deals won/lost (3 won verde, 2 lost pink)
   - Ranking table (1 fila, sortable por 7 columnas)
   - Flow handoff chart (3 flows, ~40% handoff)
3. Cerrar sesión, login como **comercial2@gmail.com**
4. Validar los mismos elementos con datos diferentes (~15 min response time)
5. Probar filtro de rango (7d / 30d / 90d) — los datos están esparcidos hasta 90 días atrás

## 7. Rollback

Para eliminar todos los datos seed sin afectar otras cuentas:

```sql
BEGIN;

DELETE FROM flow_runs
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM deals
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM messages
WHERE conversation_id IN (
  SELECT id FROM conversations
  WHERE account_id IN (
    'b5a395c0-565d-42da-9873-a0951f834d09',
    '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
  )
);

DELETE FROM conversations
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM pipeline_stages
WHERE pipeline_id IN (
  SELECT id FROM pipelines
  WHERE user_id IN (
    'b976f1f9-56b4-4e94-bb04-cea715f04b91',
    '60a2c33a-c18f-41c4-979c-f4c34d81f4c9'
  )
);

DELETE FROM pipelines
WHERE user_id IN (
  'b976f1f9-56b4-4e94-bb04-cea715f04b91',
  '60a2c33a-c18f-41c4-979c-f4c34d81f4c9'
);

DELETE FROM flows
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

DELETE FROM contacts
WHERE account_id IN (
  'b5a395c0-565d-42da-9873-a0951f834d09',
  '6ca58629-5ab8-4bb0-99c1-99bd64d6ecb1'
);

COMMIT;
```
