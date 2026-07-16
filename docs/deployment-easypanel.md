# Guía de Despliegue: NEXIA-CRM + Supabase en Easypanel

> **Objetivo:** Desplegar Supabase self-hosted y el CRM (NEXIA-CRM) en
> Easypanel, con dominios separados y SSL automático.

---

## Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    Easypanel                            │
│                                                         │
│  ┌──────────────────────┐  ┌────────────────────────┐  │
│  │  Service 1:          │  │  Service 2:            │  │
│  │  Supabase Stack      │  │  NEXIA-CRM             │  │
│  │  (Docker Compose)    │  │  (Next.js 16)          │  │
│  │                      │  │                        │  │
│  │  - PostgreSQL        │  │  - App Router          │  │
│  │  - Kong (API GW)     │  │  - API Routes          │  │
│  │  - GoTrue (Auth)     │  │  - Realtime            │  │
│  │  - PostgREST         │  │                        │  │
│  │  - Realtime          │  │                        │  │
│  │  - Storage           │  │                        │  │
│  │  - Studio            │  │                        │  │
│  │  - Meta              │  │                        │  │
│  │                      │  │                        │  │
│  │  Puerto: 8000        │  │  Puerto: 3000          │  │
│  └──────────────────────┘  └────────────────────────┘  │
│                                                         │
│  Dominio: db.tudominio.com    crm.tudominio.com        │
└─────────────────────────────────────────────────────────┘
```

---

## Requisitos Previos

1. **Easypanel instalado** y funcionando en tu servidor
2. **Dominio** con DNS configurado:
   - `db.tudominio.com` → IP del servidor (para Supabase API)
   - `crm.tudominio.com` → IP del servidor (para el CRM)
   - `studio.tudominio.com` → IP del servidor (para Supabase Studio, opcional)
3. **Puertos abiertos**: 80, 443, 5432 (PostgreSQL externo, opcional)

---

## Paso 1: Generar Credenciales

En tu máquina local (o servidor):

```bash
cd wacrm

# Instalar dependencias del script
pip install cryptography

# Generar .env y credentials.txt
python3 generate_supabase_env.py
```

Esto crea:
- `.env` — Variables de entorno para Supabase
- `credentials.txt` — Resumen de todas las credenciales (**guardar en lugar seguro**)

---

## Paso 2: Desplegar Supabase en Easypanel

### 2.1 Crear el servicio en Easypanel

1. Abre Easypanel → **Services** → **New Service**
2. Selecciona **Docker Compose**
3. Nombre: `supabase`
4. Sube o pega el contenido de `easypanel/docker-compose.supabase.yml`

### 2.2 Configurar Variables de Entorno

En Easypanel, ve a **Environment** del servicio y agrega todas las variables del `.env` generado:

| Variable | Descripción |
|----------|-------------|
| `POSTGRES_PASSWORD` | Password de PostgreSQL |
| `JWT_SECRET` | Secreto para JWTs |
| `ANON_KEY` | API key anónima (HS256) |
| `SERVICE_ROLE_KEY` | API key service role (HS256) |
| `SUPABASE_PUBLIC_URL` | `https://db.tudominio.com` |
| `API_EXTERNAL_URL` | `https://db.tudominio.com/auth/v1` |
| `SITE_URL` | `https://crm.tudominio.com` |
| `SECRET_KEY_BASE` | Para Realtime encryption |
| `REALTIME_DB_ENC_KEY` | 16 chars hex |
| `PG_META_CRYPTO_KEY` | Para Studio |

> **Nota:** Las variables `NEXT_PUBLIC_*` NO van aquí — esas van en el CRM.

### 2.3 Configurar Dominio

1. En el servicio Supabase → **Networking** (o **Domains**)
2. Agrega dominio: `db.tudominio.com`
3. Puerto del contenedor: `8000` (Kong HTTP)
4. Habilita **SSL/TLS** (Let's Encrypt automático)

### 2.4 Archivos Volumen

Asegúrate de que estos archivos estén montados (Easypanel los crea automáticamente con Docker Compose):

- `kong.yml` → `/var/lib/kong/kong.yml:ro`
- `init-db/01-init-roles.sql` → `/docker-entrypoint-initdb.d/`

### 2.5 Desplegar

1. Haz clic en **Deploy** o **Update**
2. Espera a que todos los servicios estén saludables
3. Verifica accediendo a `https://db.tudominio.com` (debería retornar algo)

---

## Paso 3: Aplicar Migraciones del CRM

Una vez Supabase esté corriendo, necesitas crear las tablas del CRM.

### Opción A: Desde Supabase Studio

1. Abre `https://studio.tudominio.com` (o accede al puerto 3001)
2. Login: `supabase` / `tu-password`
3. Ve a **SQL Editor**
4. Ejecuta el script `schema_generated.sql` del proyecto

### Opción B: Desde línea de comandos

```bash
# Conectar a PostgreSQL externamente (si el puerto 5432 está expuesto)
psql "postgresql://postgres:POSTGRES_PASSWORD@db.tudominio.com:5432/postgres"

# O desde el contenedor
docker exec -it supabase-db-1 psql -U postgres -d postgres
```

Luego ejecuta las migraciones en orden:

```bash
for f in supabase/migrations/*.sql; do
  psql "postgresql://postgres:POSTGRES_PASSWORD@localhost:5432/postgres" -f "$f"
done
```

### Opción C: Script automático

```bash
# Crear script de migración
cat > migrate.sh << 'EOF'
#!/bin/bash
set -e

SUPABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:5432/postgres"

echo "Aplicando migraciones..."
for f in supabase/migrations/*.sql; do
  echo "  → $f"
  psql "$SUPABASE_URL" -f "$f"
done

echo "¡Migraciones completadas!"
EOF

chmod +x migrate.sh
```

---

## Paso 4: Desplegar el CRM en Easypanel

### 4.1 Crear el servicio

1. Easypanel → **Services** → **New Service**
2. Selecciona **Docker** (o **Docker Compose** si prefieres)
3. Nombre: `nexia-crm`
4. Imagen: Construir desde el Dockerfile del repo

### 4.2 Variables de Entorno del CRM

Estas son las variables que el CRM necesita para conectarse a Supabase:

```bash
# ── Supabase (obligatorio) ──
NEXT_PUBLIC_SUPABASE_URL=https://db.tudominio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_ACCESS_TOKEN=sb_publishable_...
SUPABASE_MCP_ACCESS_TOKEN=sbp_...

# ── WhatsApp (obligatorio) ──
ENCRYPTION_KEY=tu-64-char-hex-key
META_APP_SECRET=tu-meta-app-secret

# ── App ──
NEXT_PUBLIC_SITE_URL=https://crm.tudominio.com
```

> **Importante:** Las keys vienen de `credentials.txt`. Copia:
> - `ANON_KEY` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> - `SERVICE_ROLE_KEY` → `SUPABASE_SERVICE_ROLE_KEY`
> - `SUPABASE_PUBLISHABLE_KEY` → `SUPABASE_ACCESS_TOKEN`
> - `SUPABASE_SECRET_KEY` → (no se usa en el CRM)

### 4.3 Dominio del CRM

1. Servicio CRM → **Networking**
2. Dominio: `crm.tudominio.com`
3. Puerto: `3000`
4. SSL habilitado

### 4.4 Desplegar

1. **Deploy**
2. Verificar en `https://crm.tudominio.com/login`

---

## Paso 5: Configurar Meta Webhook

Para recibir mensajes de WhatsApp:

1. Ve a [Meta for Developers](https://developers.facebook.com)
2. Tu App → **WhatsApp** → **Configuration**
3. Webhook URL: `https://crm.tudominio.com/api/whatsapp/webhook`
4. Verify Token: (configúralo en Settings → WhatsApp del CRM)
5. Suscríbete a: `messages`, `message_template_status_update`

---

## Paso 6: Verificar

### Checklist

- [ ] `https://db.tudominio.com` responde (Kong)
- [ ] `https://db.tudominio.com/auth/v1/health` retorna `{}`
- [ ] `https://studio.tudominio.com` muestra Supabase Studio
- [ ] `https://crm.tudominio.com/login` muestra la página de login
- [ ] Puedes crear una cuenta en el CRM
- [ ] Los mensajes de WhatsApp llegan al inbox

### Troubleshooting

| Problema | Solución |
|----------|----------|
| CRM no conecta a Supabase | Verificar `NEXT_PUBLIC_SUPABASE_URL` apunta a `https://db.tudominio.com` |
| Auth no funciona | Verificar `ANON_KEY` y `SERVICE_ROLE_KEY` coinciden con las de Supabase |
| CORS errors | Verificar que el dominio del CRM está en `SITE_URL` de Supabase |
| Webhook no recibe | Verificar `META_APP_SECRET` y HTTPS en el CRM |
| Migraciones faltan | Ejecutar `schema_generated.sql` en Supabase Studio |

---

## Estructura de Archivos

```
wacrm/
├── easypanel/
│   ├── docker-compose.supabase.yml   # Stack de Supabase
│   ├── kong.yml                      # Configuración de Kong
│   ├── .env.supabase.example         # Template de variables
│   └── init-db/
│       └── 01-init-roles.sql         # Inicialización de roles
├── Dockerfile                        # Dockerfile del CRM
├── generate_supabase_env.py          # Generador de credenciales
├── schema_generated.sql              # Schema completo del CRM
└── supabase/
    └── migrations/                   # 33 migraciones SQL
```

---

## Seguridad

1. **NUNCA** subas `credentials.txt` a Git
2. **NUNCA** expongas el puerto 5432 al público (solo para debugging)
3. **Cambia** las credenciales por defecto del script generador
4. **Habilita** MFA en Supabase Studio si es accessible externamente
5. **Monitorea** los logs de Kong y GoTrue para detectar intentos de acceso

---

## Costos de Infraestructura (Referencia)

Para un VPS con Easypanel:

| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disco | 40 GB SSD | 80 GB SSD |
| Ancho de banda | 2 TB | 4 TB |

Supabase self-hosted consume ~2 GB de RAM con todos los servicios.

---

## Actualizaciones

### Actualizar Supabase

1. Actualiza las versiones de imagen en `docker-compose.supabase.yml`
2. Redespliega en Easypanel
3. Las migraciones de Supabase son automáticas

### Actualizar el CRM

1. `git pull origin main`
2. Reconstruye la imagen Docker
3. Redespliega en Easypanel

---

*Última actualización: Julio 2026*
