# NEXIA-CRM — Esquema Completo de Base de Datos

> **Generado:** Julio 2026  
> **Fuente:** Supabase (Postgres 15+) + migraciones del proyecto  
> **Propósito:** Documentación ultra detallada de cada tabla, columna, tipo, relación y propósito

---

## Índice

1. [Resumen Arquitectónico](#1-resumen-arquitectónico)
2. [Extensiones de Postgres](#2-extensiones-de-postgres)
3. [Tipos Personalizados (Enums)](#3-tipos-personalizados-enums)
4. [Tablas — Referencia Completa](#4-tablas--referencia-completa)
   - 4.1 [Cuentas y Miembros (Multi-tenencia)](#41-cuentas-y-miembros-multi-tenencia)
   - 4.2 [CRM / Contactos](#42-crm--contactos)
   - 4.3 [Inbox y Mensajería](#43-inbox-y-mensajería)
   - 4.4 [WhatsApp](#44-whatsapp)
   - 4.5 [Pipeline / Ventas](#45-pipeline--ventas)
   - 4.6 [Broadcasts / Campañas](#46-broadcasts--campañas)
   - 4.7 [Automatizaciones](#47-automatizaciones)
   - 4.8 [Flows Conversacionales](#48-flows-conversacionales)
   - 4.9 [API Pública y Seguridad](#49-api-pública-y-seguridad)
   - 4.10 [Asistente IA](#410-asistente-ia)
   - 4.11 [Notificaciones y Presencia](#411-notificaciones-y-presencia)
5. [Funciones RPC](#5-funciones-rpc)
6. [Triggers](#6-triggers)
7. [Realtime](#7-realtime)
8. [Storage Buckets](#8-storage-buckets)
9. [Índices Clave](#9-índices-clave)
10. [Mapa de Migraciones](#10-mapa-de-migraciones)
11. [Relaciones entre Tablas (FK Map)](#11-relaciones-entre-tablas-fk-map)

---

## 1. Resumen Arquitectónico

**Single-tenant empresarial.** El CRM opera con una única cuenta corporativa.  
Todos los usuarios (`profiles`) pertenecen a la misma organización.

- **34 tablas** en esquema `public`
- **Row Level Security (RLS)** activo en todas
- **6 tablas** publicadas en `supabase_realtime`
- **3 Storage Buckets** (avatars, flow-media, chat-media)
- **~24 funciones RPC** (operaciones atómicas, consultas, auth)
- **15 triggers** (updated_at, contadores, notificaciones)

**Estructura de tenencia:** Toda tabla operacional tiene `account_id` → `accounts(id)`.  
El RLS keystone es la función `is_account_member(account_id, min_role)`.

---

## 2. Extensiones de Postgres

| Extensión   | Versión | Propósito                              |
|-------------|---------|----------------------------------------|
| `uuid-ossp` | 1.1     | Generación de UUIDs (`uuid_generate_v4()`) |
| `pgcrypto`  | 1.3     | Criptografía (`gen_random_uuid()`, hashing) |
| `vector`    | 0.8.2   | pgvector — embeddings para RAG semántico (columna `embedding vector`) |

---

## 3. Tipos Personalizados (Enums)

### `account_role_enum`

Creaado en migración 017. Define la jerarquía de roles de la organización.

```sql
CREATE TYPE account_role_enum AS ENUM ('owner', 'admin', 'agent', 'viewer');
```

| Valor    | Jerarquía | Descripción                                           |
|----------|-----------|-------------------------------------------------------|
| `owner`  | 4 (máx)   | Dueño de la cuenta. Puede transferir propiedad.        |
| `admin`  | 3         | Administrador. Gestiona miembros, configuración, API.  |
| `agent`  | 2         | Agente de ventas/soporte. Opera el CRM.                |
| `viewer` | 1 (mín)   | Solo lectura. Dashboard, informes, consultas.          |

**Usado en:** `profiles.account_role`, `account_invitations.role`

---

## 4. Tablas — Referencia Completa

---

### 4.1 Cuentas y Miembros (Multi-tenencia)

---

#### `accounts` — Cuenta corporativa

> **Propósito:** Es la **entidad raíz del sistema**. Cada organización tiene exactamente UNA fila en esta tabla.  
> **Single-tenant:** Solo existe 1 cuenta (unified account ID: `5f88a46f-0433-41df-9646-fd8ff36a2cdb`).  
> **Dónde se usa:** Referenciada por todas las tablas operacionales via `account_id`.  
> **Dónde modificarlo:** `src/lib/auth/account.ts`, migraciones de cuenta, Settings → General.

| Columna            | Tipo           | Default                | Constraints                  | Descripción                                              |
|--------------------|----------------|------------------------|------------------------------|----------------------------------------------------------|
| `id`               | `uuid`         | `uuid_generate_v4()`   | PK                           | Identificador único de la cuenta                         |
| `name`             | `text`         | —                      | NOT NULL                     | Nombre comercial de la organización                      |
| `owner_user_id`    | `uuid`         | —                      | NOT NULL, FK → `auth.users.id`, UNIQUE | Usuario propietario (dueño de la cuenta)    |
| `default_currency` | `text`         | `'COP'`                | NOT NULL, CHECK (~ `^[A-Z]{3}$`) | Moneda por defecto (COP desde migración 031)      |
| `created_at`       | `timestamptz`  | `now()`                | NOT NULL                     | Fecha de creación                                        |
| `updated_at`       | `timestamptz`  | `now()`                | NOT NULL                     | Fecha de última modificación                             |

**RLS:** `accounts_select` (viewer+), `accounts_update` (admin+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `profiles` — Perfiles de usuario (miembros del equipo)

> **Propósito:** Extiende `auth.users` con datos del CRM. Cada persona del equipo tiene un perfil aquí.  
> **Clave:** `user_id` UNIQUE → `auth.users(id)` (1:1 con auth).  
> **Single-tenant:** NO filtrar por `account_id` en consultas de equipo.  
> **Dónde modificarlo:** `src/lib/auth/roles.ts`, Settings → Members, `src/hooks/use-profile.ts`.

| Columna         | Tipo              | Default                  | Constraints                             | Descripción                                              |
|-----------------|-------------------|--------------------------|-----------------------------------------|----------------------------------------------------------|
| `id`            | `uuid`            | `uuid_generate_v4()`     | PK                                      | ID único del perfil                                      |
| `user_id`       | `uuid`            | —                        | NOT NULL, UNIQUE, FK → `auth.users.id` ON DELETE CASCADE | Referencia al usuario auth de Supabase |
| `full_name`     | `text`            | —                        | NOT NULL                                | Nombre completo del miembro                              |
| `email`         | `text`            | —                        | NOT NULL                                | Correo electrónico                                       |
| `avatar_url`    | `text`            | —                        | NULLABLE                                | URL del avatar (Storage bucket `avatars`)                |
| `role`          | `text`            | `'user'`                 | NULLABLE (legacy, unused post-017)      | Rol legacy (reemplazado por `account_role`)              |
| `account_id`    | `uuid`            | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta a la que pertenece                    |
| `account_role`  | `account_role_enum` | —                      | NOT NULL                                | Rol en la organización (owner/admin/agent/viewer)        |
| `beta_features` | `text[]`          | `ARRAY[]::text[]`        | NOT NULL                                | Flags de funcionalidades beta (ej: flows)                |
| `created_at`    | `timestamptz`     | `now()`                 | NOT NULL                                | Fecha de creación                                        |
| `updated_at`    | `timestamptz`     | `now()`                 | NOT NULL                                | Fecha de última modificación                             |

**RLS:** Select (owner o miembro del account), Update (solo propio), Insert (solo propio)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `account_invitations` — Invitaciones pendientes

> **Propósito:** Gestiona el flujo de invitación de nuevos miembros.  
> El token se hashea con SHA-256 y se guarda como `token_hash`.  
> **Dónde modificarlo:** `src/lib/auth/invitations.ts`, `src/app/(auth)/join/[token]/page.tsx`.

| Columna               | Tipo                | Default                  | Constraints                                   | Descripción                                              |
|-----------------------|---------------------|--------------------------|-----------------------------------------------|----------------------------------------------------------|
| `id`                  | `uuid`              | `uuid_generate_v4()`     | PK                                            | ID único de la invitación                                |
| `account_id`          | `uuid`              | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta destino                                         |
| `token_hash`          | `text`              | —                        | NOT NULL, UNIQUE                              | SHA-256 del token de invitación                          |
| `role`                | `account_role_enum` | —                        | NOT NULL, CHECK (role <> 'owner')             | Rol asignado al invitar (no se puede invitar como owner) |
| `created_by_user_id`  | `uuid`              | —                        | NULLABLE, FK → `auth.users.id` ON DELETE SET NULL | Quién creó la invitación                               |
| `label`               | `text`              | —                        | NULLABLE                                      | Etiqueta opcional (ej: "Invitación para Juan")           |
| `created_at`          | `timestamptz`       | `now()`                 | NOT NULL                                      | Fecha de creación                                        |
| `expires_at`          | `timestamptz`       | —                        | NOT NULL                                      | Fecha de expiración                                      |
| `accepted_at`         | `timestamptz`       | —                        | NULLABLE                                      | Cuándo se aceptó                                         |
| `accepted_by_user_id` | `uuid`              | —                        | NULLABLE, FK → `auth.users.id` ON DELETE SET NULL | Quién aceptó la invitación                             |

**RLS:** Select (admin+), Modify (admin+)

---

#### `member_presence` — Presencia en línea de miembros

> **Propósito:** Estado online/away de cada miembro para mostrar quién está activo.  
> **Clave:** `user_id` es PK (1 perfil = 1 fila de presencia).  
> **Actualización:** Via RPC `touch_presence(p_status)` desde cliente con heartbeat.  
> **Dónde modificarlo:** `src/hooks/use-presence.ts`, `src/lib/auth/account.ts`.

| Columna        | Tipo           | Default    | Constraints                             | Descripción                            |
|----------------|----------------|------------|-----------------------------------------|----------------------------------------|
| `user_id`      | `uuid`         | —          | PK, FK → `auth.users(id)` ON DELETE CASCADE | Referencia al usuario auth          |
| `account_id`   | `uuid`         | —          | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta a la que pertenece          |
| `status`       | `text`         | `'online'` | NOT NULL, CHECK (online/away)           | Estado de presencia                    |
| `last_seen_at` | `timestamptz`  | `now()`    | NOT NULL                                | Último heartbeat                      |

**RLS:** Select (viewer+ via account_id)  
**Realtime:** Sí

---

#### `roles` — Roles del sistema (RBAC extendido)

> **Propósito:** Tabla de roles flexibles con permisos JSONB para extender el RBAC más allá del enum fijo.  
> **Creada en:** migración `roles_table` (aplicada directamente, sin archivo local).  
> **Contiene:** 4 filas (owner, admin, agent, viewer) con sus permisos y jerarquía.  
> **Dónde modificarlo:** `src/lib/auth/roles.ts`.

| Columna       | Tipo           | Default           | Constraints                             | Descripción                              |
|---------------|----------------|-------------------|-----------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `gen_random_uuid()` | PK                                    | ID único del rol                         |
| `account_id`  | `uuid`         | —                 | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta (single-tenant)               |
| `name`        | `text`         | —                 | NOT NULL                                | Nombre del rol (owner/admin/agent/viewer) |
| `rank`        | `integer`      | —                 | NOT NULL                                | Jerarquía numérica (4=owner, 1=viewer)    |
| `is_system`   | `boolean`      | `false`           | NOT NULL                                | Si es rol del sistema (no editable)       |
| `permissions` | `jsonb`        | `'{}'::jsonb`     | NOT NULL                                | Mapa de permisos ({canManageMembers: true, ...}) |
| `created_at`  | `timestamptz`  | `now()`           | NOT NULL                                | Fecha de creación                        |
| `updated_at`  | `timestamptz`  | `now()`           | NOT NULL                                | Fecha de modificación                    |

---

### 4.2 CRM / Contactos

---

#### `contacts` — Contactos (clientes/pacientes)

> **Propósito:** Personas externas con las que el equipo se comunica via WhatsApp.  
> **Datos actuales:** 31 contactos.  
> **Normalización:** `phone_normalized` es GENERATED (solo dígitos) para deduplicación.  
> **Dónde modificarlo:** `src/app/(dashboard)/contacts/`, `src/lib/contacts/`.

| Columna             | Tipo           | Default                   | Constraints                                          | Descripción                                              |
|---------------------|----------------|---------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`                | `uuid`         | `uuid_generate_v4()`      | PK                                                   | ID único del contacto                                    |
| `account_id`        | `uuid`         | —                         | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta a la que pertenece                                |
| `user_id`           | `uuid`         | —                         | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Creador del contacto                                     |
| `phone`             | `text`         | —                         | NOT NULL                                             | Teléfono (formato internacional: `+573001234567`)        |
| `phone_normalized`  | `text`         | `regexp_replace(phone, '\D', '', 'g')` | GENERATED STORED, NULLABLE           | Dígitos solos del teléfono (para matching/búsqueda)     |
| `name`              | `text`         | —                         | NULLABLE                                             | Nombre del contacto                                      |
| `email`             | `text`         | —                         | NULLABLE                                             | Correo electrónico                                       |
| `company`           | `text`         | —                         | NULLABLE                                             | Empresa/organización                                     |
| `avatar_url`        | `text`         | —                         | NULLABLE                                             | URL del avatar                                           |
| `created_at`        | `timestamptz`  | `now()`                  | NOT NULL                                             | Fecha de creación                                        |
| `updated_at`        | `timestamptz`  | `now()`                  | NOT NULL                                             | Fecha de modificación                                    |

**Índices:** `idx_contacts_account` (account_id), `idx_contacts_user_id`, `idx_contacts_phone`,  
`idx_contacts_account_phone_normalized` UNIQUE WHERE phone_normalized <> ''  
**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `tags` — Etiquetas para contactos

> **Propósito:** Clasificación de contactos (ej: "VIP", "Colombia", "Leads 2026").  
> **Dónde modificarlo:** `src/app/(dashboard)/contacts/`, UI de tags.

| Columna      | Tipo           | Default                  | Constraints                             | Descripción                              |
|--------------|----------------|--------------------------|-----------------------------------------|------------------------------------------|
| `id`         | `uuid`         | `uuid_generate_v4()`     | PK                                      | ID único de la etiqueta                  |
| `account_id` | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                               |
| `user_id`    | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                              |
| `name`       | `text`         | —                        | NOT NULL                                | Nombre de la etiqueta                    |
| `color`      | `text`         | `'#3b82f6'`              | NOT NULL                                | Color hex (ej: #3b82f6 = blue-500)       |
| `created_at` | `timestamptz`  | `now()`                 | NOT NULL                                | Fecha de creación                        |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

#### `contact_tags` — Relación N:M entre contactos y tags

> **Propósito:** Asignación de etiquetas a contactos (un contacto puede tener muchas tags).  
> **UNIQUE:** `(contact_id, tag_id)` — no se puede asignar la misma tag dos veces al mismo contacto.  
> **Dónde modificarlo:** Indirectamente via UI de contactos.

| Columna       | Tipo           | Default                  | Constraints                                       | Descripción                           |
|---------------|----------------|--------------------------|---------------------------------------------------|---------------------------------------|
| `id`          | `uuid`         | `uuid_generate_v4()`     | PK                                                | ID único                              |
| `contact_id`  | `uuid`         | —                        | NOT NULL, FK → `contacts(id)` ON DELETE CASCADE   | Contacto                              |
| `tag_id`      | `uuid`         | —                        | NOT NULL, FK → `tags(id)` ON DELETE CASCADE       | Tag                                   |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                          | Fecha de asignación                   |

**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)

---

#### `custom_fields` — Campos personalizados para contactos

> **Propósito:** Definición de campos extra (ej: "Tipo de documento", "Ciudad", "Método de pago").  
> **field_type:** `text`, `number`, `date`, `select`, `boolean`, etc.  
> **field_options:** JSON con opciones para type=select (ej: `["option1","option2"]`).  
> **Dónde modificarlo:** Settings → Contact Fields.

| Columna        | Tipo           | Default                  | Constraints                                     | Descripción                              |
|----------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`           | `uuid`         | `uuid_generate_v4()`     | PK                                              | ID único del campo                       |
| `account_id`   | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `user_id`      | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                |
| `field_name`   | `text`         | —                        | NOT NULL                                        | Nombre del campo (ej: "tipo_documento")  |
| `field_type`   | `text`         | `'text'`                | NOT NULL                                        | Tipo de dato (`text`, `number`, `date`, `select`, `boolean`) |
| `field_options`| `jsonb`        | —                        | NULLABLE                                        | Opciones para selects/validaciones       |
| `created_at`   | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                        |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

#### `contact_custom_values` — Valores de campos personalizados por contacto

> **Propósito:** Almacena el valor de cada campo personalizado para cada contacto.  
> **UNIQUE:** `(contact_id, custom_field_id)` — un valor por campo por contacto.  
> **Dónde modificarlo:** Indirectamente via UI de contacto.

| Columna           | Tipo           | Default                  | Constraints                                              | Descripción                           |
|-------------------|----------------|--------------------------|----------------------------------------------------------|---------------------------------------|
| `id`              | `uuid`         | `uuid_generate_v4()`     | PK                                                       | ID único                              |
| `contact_id`      | `uuid`         | —                        | NOT NULL, FK → `contacts(id)` ON DELETE CASCADE          | Contacto                              |
| `custom_field_id` | `uuid`         | —                        | NOT NULL, FK → `custom_fields(id)` ON DELETE CASCADE     | Campo personalizado                   |
| `value`           | `text`         | —                        | NULLABLE                                                 | Valor almacenado (siempre text, parseado según field_type) |
| `created_at`      | `timestamptz`  | `now()`                 | NOT NULL                                                 | Fecha de creación                     |

**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)

---

#### `contact_notes` — Notas internas sobre contactos

> **Propósito:** Registro de observaciones, seguimiento, historia interna.  
> **Dónde modificarlo:** Modal de detalle de contacto.

| Columna       | Tipo           | Default                  | Constraints                                          | Descripción                           |
|---------------|----------------|--------------------------|------------------------------------------------------|---------------------------------------|
| `id`          | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                              |
| `account_id`  | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                |
| `contact_id`  | `uuid`         | —                        | NOT NULL, FK → `contacts(id)` ON DELETE CASCADE      | Contacto                              |
| `user_id`     | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Creador de la nota                    |
| `note_text`   | `text`         | —                        | NOT NULL                                              | Contenido de la nota                  |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                              | Fecha de creación                     |

**RLS:** Select (viewer+), Insert/Update/Delete (agent+)

---

### 4.3 Inbox y Mensajería

---

#### `conversations` — Hilos de conversación

> **Propósito:** Representa una conversación entre un agente y un contacto via WhatsApp.  
> **Datos actuales:** 21 conversaciones.  
> **Estados:** `open` (activa), `pending` (sin agente asignado), `closed` (finalizada).  
> **Realtime:** Sí — para actualizar la lista de conversaciones en vivo.  
> **Dónde modificarlo:** `src/app/(dashboard)/inbox/`, `src/hooks/use-conversations.ts`.

| Columna                | Tipo           | Default                  | Constraints                                          | Descripción                                              |
|------------------------|----------------|--------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`                   | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                                 |
| `account_id`           | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                                   |
| `user_id`              | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Creador de la conversación                               |
| `contact_id`           | `uuid`         | —                        | NOT NULL, FK → `contacts(id)` ON DELETE CASCADE      | Contacto                                                 |
| `status`               | `text`         | `'open'`                | NOT NULL, CHECK (open/pending/closed)                | Estado de la conversación                                |
| `assigned_agent_id`    | `uuid`         | —                        | NULLABLE                                              | Agente actualmente asignado (refers to profiles.id)      |
| `last_message_text`    | `text`         | —                        | NULLABLE                                              | Texto del último mensaje (para vista previa)             |
| `last_message_at`      | `timestamptz`  | —                        | NULLABLE                                              | Timestamp del último mensaje                             |
| `unread_count`         | `integer`      | `0`                      | NULLABLE                                              | Mensajes no leídos                                       |
| `ai_autoreply_disabled`| `boolean`      | `false`                  | NOT NULL                                              | Si se desactivó la auto-respuesta IA manualmente         |
| `ai_reply_count`       | `integer`      | `0`                      | NOT NULL                                              | Contador de respuestas IA en esta conversación           |
| `created_at`           | `timestamptz`  | `now()`                 | NOT NULL                                              | Fecha de creación                                        |
| `updated_at`           | `timestamptz`  | `now()`                 | NOT NULL                                              | Fecha de modificación                                    |

**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Triggers:** `set_updated_at`, `on_conversation_assigned` (crea notificación al asignar)  
**Realtime:** Sí

---

#### `messages` — Mensajes individuales

> **Propósito:** Cada mensaje enviado o recibido en una conversación.  
> **Datos actuales:** 141 mensajes.  
> **Tipos de contenido:** text, image, document, audio, video, location, template, interactive.  
> **sender_type:** customer (cliente), agent (agente), bot (IA).  
> **Realtime:** Sí — para streaming en vivo de mensajes.  
> **Dónde modificarlo:** `src/lib/whatsapp/send-message.ts`, `src/lib/whatsapp/webhook-inbound.ts`.

| Columna                | Tipo           | Default                  | Constraints                                          | Descripción                                              |
|------------------------|----------------|--------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`                   | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único del mensaje                                     |
| `conversation_id`      | `uuid`         | —                        | NOT NULL, FK → `conversations(id)` ON DELETE CASCADE | Conversación a la que pertenece                          |
| `sender_type`          | `text`         | —                        | NOT NULL, CHECK (customer/agent/bot)                 | Quién envió el mensaje                                   |
| `sender_id`            | `uuid`         | —                        | NULLABLE                                             | ID del sender (profiles.id si agent, null si customer)   |
| `content_type`         | `text`         | `'text'`                | NOT NULL, CHECK (text/image/document/audio/video/location/template/interactive) | Tipo de contenido     |
| `content_text`         | `text`         | —                        | NULLABLE                                             | Contenido textual (caption para media)                   |
| `media_url`            | `text`         | —                        | NULLABLE                                             | URL del media (imagen, video, etc.)                      |
| `template_name`        | `text`         | —                        | NULLABLE                                             | Nombre del template si es mensaje template               |
| `message_id`           | `text`         | —                        | NULLABLE                                             | ID del mensaje en Meta Cloud API                         |
| `status`               | `text`         | `'sent'`                | NOT NULL, CHECK (sending/sent/delivered/read/failed) | Estado de entrega                                        |
| `reply_to_message_id`  | `uuid`         | —                        | NULLABLE, FK → `messages(id)` ON DELETE SET NULL     | Mensaje al que responde (cita/quote)                     |
| `interactive_reply_id` | `text`         | —                        | NULLABLE                                             | ID del reply en interacciones (botones/listas)           |
| `created_at`           | `timestamptz`  | `now()`                 | NOT NULL                                              | Fecha de creación                                        |

**RLS:** Select (viewer+ via conversation), Modify (agent+ via conversation)  
**Realtime:** Sí

---

#### `message_reactions` — Reacciones (emojis) en mensajes

> **Propósito:** Reacciones emoji estilo WhatsApp (👍❤️😂😮😢🙏).  
> **UNIQUE:** `(message_id, actor_type, actor_id)` — una reacción por actor por mensaje.  
> **actor_type:** customer o agent.  
> **Dónde modificarlo:** `src/app/(dashboard)/inbox/`, reacción en UI.

| Columna           | Tipo           | Default                  | Constraints                                              | Descripción                           |
|-------------------|----------------|--------------------------|----------------------------------------------------------|---------------------------------------|
| `id`              | `uuid`         | `uuid_generate_v4()`     | PK                                                       | ID único                              |
| `message_id`      | `uuid`         | —                        | NOT NULL, FK → `messages(id)` ON DELETE CASCADE          | Mensaje reaccionado                   |
| `conversation_id` | `uuid`         | —                        | NOT NULL, FK → `conversations(id)` ON DELETE CASCADE     | Conversación (denormalizado para Realtime) |
| `actor_type`      | `text`         | —                        | NOT NULL, CHECK (customer/agent)                        | Quién reaccionó                       |
| `actor_id`        | `uuid`         | —                        | NULLABLE                                                | ID del actor (profiles.id si agent)   |
| `emoji`            | `text`         | —                        | NOT NULL                                                | Caracter emoji (👍❤️)               |
| `created_at`      | `timestamptz`  | `now()`                 | NOT NULL                                                 | Fecha de reacción                     |

**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)  
**Realtime:** Sí

---

### 4.4 WhatsApp

---

#### `whatsapp_config` — Configuración de conexión WhatsApp Business API

> **Propósito:** Credenciales y estado de la integración con Meta Cloud API.  
> **Datos actuales:** 1 configuración (una cuenta de WhatsApp conectada).  
> **Seguridad:** `access_token` encriptado con AES-256-GCM.  
> **UNIQUE:** `phone_number_id` — solo un número de teléfono configurable.  
> **Dónde modificarlo:** `src/lib/whatsapp/`, `src/app/api/whatsapp/config/`, Settings → WhatsApp.

| Columna                   | Tipo           | Default                     | Constraints                                   | Descripción                                              |
|---------------------------|----------------|-----------------------------|-----------------------------------------------|----------------------------------------------------------|
| `id`                      | `uuid`         | `uuid_generate_v4()`        | PK                                            | ID único                                                 |
| `account_id`              | `uuid`         | —                           | NOT NULL, UNIQUE, FK → `accounts(id)` ON DELETE CASCADE | Cuenta (1 cuenta = 1 config)              |
| `user_id`                 | `uuid`         | —                           | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                               |
| `phone_number_id`         | `text`         | —                           | NOT NULL, UNIQUE                              | ID del número de teléfono en Meta                        |
| `waba_id`                 | `text`         | —                           | NULLABLE                                      | WhatsApp Business Account ID                             |
| `access_token`            | `text`         | —                           | NOT NULL                                      | Token de acceso (encriptado AES-256-GCM)                |
| `verify_token`            | `text`         | —                           | NULLABLE                                      | Token de verificación webhook                            |
| `status`                  | `text`         | `'disconnected'`           | NOT NULL, CHECK (connected/disconnected)      | Estado de la conexión                                    |
| `registered_at`           | `timestamptz`  | —                           | NULLABLE                                      | Cuándo se registró el número en Meta                     |
| `subscribed_apps_at`      | `timestamptz`  | —                           | NULLABLE                                      | Cuándo se suscribieron las apps                          |
| `last_registration_error` | `text`         | —                           | NULLABLE                                      | Último error de registro                                 |
| `connected_at`            | `timestamptz`  | —                           | NULLABLE                                      | Cuándo se conectó                                        |
| `created_at`              | `timestamptz`  | `now()`                    | NULLABLE                                      | Fecha de creación                                        |
| `updated_at`              | `timestamptz`  | `now()`                    | NULLABLE                                      | Fecha de modificación                                    |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `message_templates` — Plantillas de mensaje WhatsApp

> **Propósito:** Plantillas aprobadas por Meta para mensajes outbound (notificaciones, marketing).  
> **Datos actuales:** 6 plantillas.  
> **Estado:** DRAFT → PENDING → APPROVED/REJECTED (flujo de aprobación de Meta).  
> **Dónde modificarlo:** `src/lib/whatsapp/templates/`, Settings → Plantillas.

| Columna              | Tipo           | Default                  | Constraints                                      | Descripción                                              |
|----------------------|----------------|--------------------------|--------------------------------------------------|----------------------------------------------------------|
| `id`                 | `uuid`         | `uuid_generate_v4()`     | PK                                               | ID único                                                 |
| `account_id`         | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE  | Cuenta                                                   |
| `user_id`            | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                                |
| `name`               | `text`         | —                        | NOT NULL                                         | Nombre de la plantilla (ej: `bienvenida_cliente`)        |
| `category`           | `text`         | `'Marketing'`            | NOT NULL, CHECK (Marketing/Utility/Authentication) | Categoría en Meta                                      |
| `language`           | `text`         | `'en_US'`               | NULLABLE                                         | Código de idioma (es_CO, en_US)                          |
| `header_type`        | `text`         | —                        | NULLABLE, CHECK (text/image/video/document)      | Tipo de header                                           |
| `header_content`     | `text`         | —                        | NULLABLE                                         | Contenido del header (texto o handle de media)           |
| `body_text`          | `text`         | —                        | NOT NULL                                         | Cuerpo del mensaje (con {{variables}})                   |
| `footer_text`        | `text`         | —                        | NULLABLE                                         | Texto del footer                                         |
| `buttons`            | `jsonb`        | —                        | NULLABLE, CHECK (array ≤ 10)                    | Botones (quick_reply, call_to_action, url)               |
| `status`             | `text`         | `'DRAFT'`               | NOT NULL, CHECK (DRAFT/PENDING/APPROVED/REJECTED/PAUSED/DISABLED/IN_APPEAL/PENDING_DELETION) | Estado en Meta |
| `sample_values`      | `jsonb`        | —                        | NULLABLE                                         | Valores de ejemplo para vista previa                     |
| `meta_template_id`   | `text`         | —                        | NULLABLE                                         | ID de la plantilla en Meta                               |
| `rejection_reason`   | `text`         | —                        | NULLABLE                                         | Razón de rechazo de Meta                                 |
| `quality_score`      | `text`         | —                        | NULLABLE, CHECK (GREEN/YELLOW/RED)              | Score de calidad según Meta                              |
| `header_handle`      | `text`         | —                        | NULLABLE                                         | Handle del media del header                              |
| `header_media_url`   | `text`         | —                        | NULLABLE                                         | URL del media del header                                 |
| `submission_error`   | `text`         | —                        | NULLABLE                                         | Error de envío a Meta                                    |
| `last_submitted_at`  | `timestamptz`  | —                        | NULLABLE                                         | Último envío a Meta                                      |
| `created_at`         | `timestamptz`  | `now()`                 | NULLABLE                                         | Fecha de creación                                        |
| `updated_at`         | `timestamptz`  | `now()`                 | NULLABLE                                         | Fecha de modificación                                    |

**Índice UNIQUE:** `(user_id, name, language)`  
**RLS:** Select (viewer+), Insert/Update/Delete (admin+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

### 4.5 Pipeline / Ventas

---

#### `pipelines` — Pipelines de ventas

> **Propósito:** Define los procesos de venta (ej: "Ventas Comercial", "Matrículas").  
> **Datos actuales:** 6 pipelines.  
> **Dónde modificarlo:** `src/app/(dashboard)/pipelines/`.

| Columna       | Tipo           | Default                  | Constraints                                     | Descripción                              |
|---------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `uuid_generate_v4()`     | PK                                              | ID único del pipeline                    |
| `account_id`  | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `user_id`     | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                |
| `name`        | `text`         | —                        | NOT NULL                                        | Nombre del pipeline (ej: "Matrículas 2026") |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                        |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

#### `pipeline_stages` — Etapas de cada pipeline

> **Propósito:** Columnas del kanban (ej: "Nuevo", "Contactado", "Propuesta", "Negociación", "Cerrado").  
> **Datos actuales:** 28 etapas (aprox. 4-5 por pipeline).  
> **Orden:** `position` determina el orden en el kanban.  
> **Dónde modificarlo:** UI de pipelines.

| Columna       | Tipo           | Default                  | Constraints                                          | Descripción                              |
|---------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único de la etapa                     |
| `pipeline_id` | `uuid`         | —                        | NOT NULL, FK → `pipelines(id)` ON DELETE CASCADE     | Pipeline al que pertenece                |
| `name`        | `text`         | —                        | NOT NULL                                             | Nombre de la etapa                       |
| `position`    | `integer`      | `0`                      | NOT NULL                                             | Orden en el kanban (0 = primera)         |
| `color`       | `text`         | `'#3b82f6'`             | NOT NULL                                             | Color hex de la columna                  |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha de creación                        |

**RLS:** Select (viewer+ via parent), Modify (admin+ via parent)

---

#### `deals` — Oportunidades de negocio (deals)

> **Propósito:** Cada deal es una oportunidad vinculada a un pipeline/stage, contacto y opcionalmente una conversación.  
> **Datos actuales:** 17 deals.  
> **Estados:** `open` (activo), `won` (ganado), `lost` (perdido).  
> **Campos clave:** `value` (monto), `currency`, `assigned_to` (agente responsable).  
> **Dónde modificarlo:** `src/app/(dashboard)/pipelines/`, kanban drag & drop.

| Columna              | Tipo           | Default                  | Constraints                                          | Descripción                                              |
|----------------------|----------------|--------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`                 | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único del deal                                        |
| `account_id`         | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                                   |
| `user_id`            | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Creador                                                  |
| `pipeline_id`        | `uuid`         | —                        | NOT NULL, FK → `pipelines(id)` ON DELETE CASCADE     | Pipeline al que pertenece                               |
| `stage_id`           | `uuid`         | —                        | NOT NULL, FK → `pipeline_stages(id)`                 | Etapa actual                                             |
| `contact_id`         | `uuid`         | —                        | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto vinculado                                       |
| `conversation_id`    | `uuid`         | —                        | NULLABLE, FK → `conversations(id)`                   | Conversación vinculada                                   |
| `assigned_to`        | `uuid`         | —                        | NULLABLE, FK → `profiles(id)` ON DELETE SET NULL     | Agente asignado                                          |
| `title`              | `text`         | —                        | NOT NULL                                             | Título del deal (ej: "Matrícula Juan Pérez")             |
| `value`              | `numeric(12,2)`| `0`                      | NOT NULL                                             | Valor monetario del deal                                 |
| `currency`           | `text`         | `'USD'`                 | NULLABLE                                             | Moneda (tres letras mayúsculas, ej: COP, USD)            |
| `notes`              | `text`         | —                        | NULLABLE                                             | Notas internas                                           |
| `expected_close_date`| `date`         | —                        | NULLABLE                                             | Fecha estimada de cierre                                 |
| `status`             | `text`         | `'open'`                | NULLABLE, CHECK (open/won/lost)                      | Estado del deal                                          |
| `created_at`         | `timestamptz`  | `now()`                 | NULLABLE                                             | Fecha de creación                                        |
| `updated_at`         | `timestamptz`  | `now()`                 | NULLABLE                                             | Fecha de modificación                                    |

**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

### 4.6 Broadcasts / Campañas

---

#### `broadcasts` — Campañas de difusión

> **Propósito:** Envío masivo de mensajes plantilla a múltiples contactos.  
> **Datos actuales:** 1 campaña.  
> **Contadores:** `sent_count`, `delivered_count`, `read_count`, `replied_count`, `failed_count` (actualizados incrementalmente via trigger).  
> **Dónde modificarlo:** `src/app/(dashboard)/broadcasts/`, `src/lib/whatsapp/broadcast.ts`.

| Columna             | Tipo           | Default                  | Constraints                                     | Descripción                                              |
|---------------------|----------------|--------------------------|-------------------------------------------------|----------------------------------------------------------|
| `id`                | `uuid`         | `uuid_generate_v4()`     | PK                                              | ID único                                                 |
| `account_id`        | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                                   |
| `user_id`           | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                                |
| `name`              | `text`         | —                        | NOT NULL                                        | Nombre de la campaña                                     |
| `template_name`     | `text`         | —                        | NOT NULL                                        | Plantilla a usar                                         |
| `template_language` | `text`         | `'en_US'`               | NOT NULL                                        | Idioma de la plantilla                                   |
| `template_variables`| `jsonb`        | —                        | NULLABLE                                        | Variables para personalizar la plantilla                  |
| `audience_filter`   | `jsonb`        | —                        | NULLABLE                                        | Filtro de audiencia (tags, etc.)                         |
| `scheduled_at`      | `timestamptz`  | —                        | NULLABLE                                        | Fecha programada (null = enviar ahora)                   |
| `status`            | `text`         | `'draft'`               | NOT NULL, CHECK (draft/scheduled/sending/sent/failed) | Estado de la campaña                               |
| `total_recipients`  | `integer`      | `0`                      | NULLABLE                                        | Total de destinatarios                                   |
| `sent_count`        | `integer`      | `0`                      | NULLABLE                                        | Enviados                                                 |
| `delivered_count`   | `integer`      | `0`                      | NULLABLE                                        | Entregados                                               |
| `read_count`        | `integer`      | `0`                      | NULLABLE                                        | Leídos                                                   |
| `replied_count`     | `integer`      | `0`                      | NULLABLE                                        | Respondieron                                             |
| `failed_count`      | `integer`      | `0`                      | NULLABLE                                        | Fallaron                                                 |
| `created_at`        | `timestamptz`  | `now()`                 | NULLABLE                                        | Fecha de creación                                        |
| `updated_at`        | `timestamptz`  | `now()`                 | NULLABLE                                        | Fecha de modificación                                    |

**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `broadcast_recipients` — Destinatarios individuales de campañas

> **Propósito:** Tracking por destinatario: estado de entrega, timestamps, ID de mensaje de Meta.  
> **Contador incremental:** Trigger `broadcast_recipients_aggregate` ajusta contadores en `broadcasts`.  
> **Dónde modificarlo:** `src/lib/whatsapp/broadcast.ts`.

| Columna              | Tipo           | Default                  | Constraints                                          | Descripción                              |
|----------------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`                 | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `broadcast_id`       | `uuid`         | —                        | NOT NULL, FK → `broadcasts(id)` ON DELETE CASCADE    | Campaña                                  |
| `contact_id`         | `uuid`         | —                        | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto destino                         |
| `status`             | `text`         | `'pending'`             | NOT NULL, CHECK (pending/sent/delivered/read/replied/failed) | Estado individual              |
| `whatsapp_message_id`| `text`         | —                        | NULLABLE, UNIQUE WHERE NOT NULL                      | ID del mensaje en Meta                   |
| `sent_at`            | `timestamptz`  | —                        | NULLABLE                                             | Fecha de envío                           |
| `delivered_at`       | `timestamptz`  | —                        | NULLABLE                                             | Fecha de entrega                         |
| `read_at`            | `timestamptz`  | —                        | NULLABLE                                             | Fecha de lectura                         |
| `replied_at`         | `timestamptz`  | —                        | NULLABLE                                             | Fecha de respuesta                       |
| `error_message`      | `text`         | —                        | NULLABLE                                             | Mensaje de error si falló                |
| `created_at`         | `timestamptz`  | `now()`                 | NULLABLE                                             | Fecha de creación                        |

**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)  
**Trigger:** `broadcast_recipients_aggregate` AFTER INSERT/UPDATE/DELETE

---

### 4.7 Automatizaciones

---

#### `automations` — Reglas de automatización

> **Propósito:** Reglas "cuando ocurre X → haz Y" para inbound/outbound.  
> **Datos actuales:** 1 automatización.  
> **trigger_type:** Tipos: `inbound_message`, `status_change`, `deal_created`, `cron`, `webhook`.  
> **Dónde modificarlo:** `src/app/(dashboard)/automations/`, `src/lib/automations/engine.ts`.

| Columna            | Tipo           | Default                  | Constraints                                     | Descripción                              |
|--------------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`               | `uuid`         | `uuid_generate_v4()`     | PK                                              | ID único                                 |
| `account_id`       | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `user_id`          | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                |
| `name`             | `text`         | —                        | NOT NULL                                        | Nombre de la automatización              |
| `description`      | `text`         | —                        | NULLABLE                                        | Descripción                              |
| `trigger_type`     | `text`         | —                        | NOT NULL                                        | Tipo de trigger                          |
| `trigger_config`   | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                        | Config del trigger (keywords, horarios, etc.) |
| `is_active`        | `boolean`      | `false`                  | NOT NULL                                        | Si está activa o pausada                 |
| `execution_count`  | `integer`      | `0`                      | NOT NULL                                        | Veces ejecutada                          |
| `last_executed_at` | `timestamptz`  | —                        | NULLABLE                                        | Última ejecución                         |
| `created_at`       | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                        |
| `updated_at`       | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de modificación                    |

**Índice:** `idx_automations_account_active_trigger` (account_id, trigger_type) WHERE is_active  
**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `automation_steps` — Pasos de cada automatización

> **Propósito:** Árbol de pasos secuenciales con branches (yes/no).  
> **parent_step_id:** Para branching (auto-referencia).  
> **branch:** `'yes'` o `'no'` — qué rama seguir según condición del paso anterior.  
> **step_type:** send_message, condition, delay, update_contact, set_tag, webhook, end.  
> **Dónde modificarlo:** Editor de automatizaciones.

| Columna          | Tipo           | Default                  | Constraints                                          | Descripción                              |
|------------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`             | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `automation_id`  | `uuid`         | —                        | NOT NULL, FK → `automations(id)` ON DELETE CASCADE   | Automatización                           |
| `parent_step_id` | `uuid`         | —                        | NULLABLE, FK → `automation_steps(id)` ON DELETE CASCADE | Paso padre (para branching)          |
| `branch`         | `text`         | —                        | NULLABLE, CHECK (yes/no)                             | Rama (yes/no)                            |
| `step_type`      | `text`         | —                        | NOT NULL                                             | Tipo de paso                             |
| `step_config`    | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                             | Config del paso (mensaje, delay, etc.)   |
| `position`       | `integer`      | —                        | NOT NULL                                             | Orden de ejecución                       |
| `created_at`     | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha de creación                        |

**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)

---

#### `automation_logs` — Logs de ejecución de automatizaciones

> **Propósito:** Historial de cada vez que se ejecutó una automatización.  
> **Datos actuales:** 0 registros.  
> **Dónde modificarlo:** `src/lib/automations/engine.ts`.

| Columna         | Tipo           | Default                  | Constraints                                          | Descripción                              |
|-----------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`            | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `account_id`    | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                   |
| `automation_id` | `uuid`         | —                        | NOT NULL, FK → `automations(id)` ON DELETE CASCADE   | Automatización                           |
| `user_id`       | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Usuario que ejecutó                      |
| `contact_id`    | `uuid`         | —                        | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto vinculado                       |
| `trigger_event` | `text`         | —                        | NOT NULL                                             | Evento que disparó la ejecución          |
| `steps_executed`| `jsonb`        | `'[]'::jsonb`           | NOT NULL                                             | Array de pasos ejecutados                |
| `status`        | `text`         | —                        | NOT NULL, CHECK (success/partial/failed)             | Estado de la ejecución                   |
| `error_message` | `text`         | —                        | NULLABLE                                             | Mensaje de error si falló                |
| `created_at`    | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha de ejecución                       |

**RLS:** Select (viewer+)

---

#### `automation_pending_executions` — Ejecuciones pendientes (delay/cron)

> **Propósito:** Almacena pasos que deben ejecutarse en el futuro (delays, schedules).  
> **Procesado por:** Motor de automatizaciones vía cron.  
> **Dónde modificarlo:** `src/lib/automations/engine.ts`.

| Columna           | Tipo           | Default                  | Constraints                                          | Descripción                              |
|-------------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`              | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `account_id`      | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                   |
| `automation_id`   | `uuid`         | —                        | NOT NULL, FK → `automations(id)` ON DELETE CASCADE   | Automatización                           |
| `user_id`         | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Usuario                                  |
| `contact_id`      | `uuid`         | —                        | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto                                 |
| `log_id`          | `uuid`         | —                        | NULLABLE, FK → `automation_logs(id)` ON DELETE CASCADE | Log de ejecución asociado              |
| `parent_step_id`  | `uuid`         | —                        | NULLABLE, FK → `automation_steps(id)` ON DELETE SET NULL | Paso actual                           |
| `branch`          | `text`         | —                        | NULLABLE, CHECK (yes/no)                             | Rama a seguir                            |
| `next_step_position`| `integer`    | —                        | NOT NULL                                             | Siguiente paso a ejecutar                |
| `context`         | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                             | Contexto de ejecución (variables, etc.)  |
| `status`          | `text`         | `'pending'`             | NOT NULL, CHECK (pending/running/done/failed)        | Estado                                   |
| `run_at`          | `timestamptz`  | —                        | NOT NULL                                             | Cuándo ejecutar                          |
| `created_at`      | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha de creación                        |

**RLS:** Sin políticas de cliente (solo service-role)

---

### 4.8 Flows Conversacionales

---

#### `flows` — Flujos conversacionales

> **Propósito:** Bots conversacionales estilo "árbol de decisión" para WhatsApp.  
> **Datos actuales:** 7 flujos.  
> **trigger_type:** keyword (palabra clave), first_inbound_message (primer mensaje), manual (solo a petición).  
> **fallback_policy:** JSON con política de agotamiento (handoff, reprompt, timeout).  
> **Dónde modificarlo:** `src/app/(dashboard)/flows/`, `src/lib/flows/engine.ts`.

| Columna             | Tipo           | Default                 | Constraints                                   | Descripción                                              |
|---------------------|----------------|-------------------------|-----------------------------------------------|----------------------------------------------------------|
| `id`                | `uuid`         | `uuid_generate_v4()`    | PK                                            | ID único                                                 |
| `account_id`        | `uuid`         | —                       | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                                 |
| `user_id`           | `uuid`         | —                       | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE | Creador                                                |
| `name`              | `text`         | —                       | NOT NULL                                      | Nombre del flow                                          |
| `description`       | `text`         | —                       | NULLABLE                                      | Descripción                                             |
| `status`            | `text`         | `'draft'`              | NOT NULL, CHECK (draft/active/archived)       | Estado del flow                                          |
| `trigger_type`      | `text`         | —                       | NOT NULL, CHECK (keyword/first_inbound_message/manual) | Cómo se activa                               |
| `trigger_config`    | `jsonb`        | `'{}'::jsonb`          | NOT NULL                                      | Config del trigger (keywords, etc.)                       |
| `entry_node_id`     | `text`         | —                       | NULLABLE                                      | Nodo de entrada (ref `flow_nodes.node_key`)              |
| `fallback_policy`   | `jsonb`        | `{"on_exhaust":"handoff","max_reprompts":2,"on_timeout_hours":24,"on_unknown_reply":"reprompt"}` | NOT NULL | Política cuando el bot no entiende       |
| `execution_count`   | `integer`      | `0`                     | NOT NULL                                      | Veces ejecutado                                           |
| `last_executed_at`  | `timestamptz`  | —                       | NULLABLE                                      | Última ejecución                                          |
| `created_at`        | `timestamptz`  | `now()`                | NOT NULL                                      | Fecha de creación                                         |
| `updated_at`        | `timestamptz`  | `now()`                | NOT NULL                                      | Fecha de modificación                                     |

**Índice:** `idx_flows_account_active` (account_id) WHERE status = 'active'  
**RLS:** Select (viewer+), Insert/Update/Delete (agent+)  
**Trigger:** `set_updated_at` BEFORE UPDATE

---

#### `flow_nodes` — Nodos del flow (bloques visuales)

> **Propósito:** Cada nodo es un bloque en el builder visual (React Flow).  
> **Datos actuales:** 6 nodos.  
> **Tipos de nodo:** start, send_buttons, send_list, send_message, send_media, collect_input, condition, set_tag, handoff, http_fetch, end.  
> **node_key:** Identificador string único dentro del flow (ej: "nodo-1", "start").  
> **Dónde modificarlo:** Builder visual en `/flows/[id]`.

| Columna      | Tipo           | Default                  | Constraints                                          | Descripción                              |
|--------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`         | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `flow_id`    | `uuid`         | —                        | NOT NULL, FK → `flows(id)` ON DELETE CASCADE         | Flow al que pertenece                    |
| `node_key`   | `text`         | —                        | NOT NULL                                             | Identificador único dentro del flow      |
| `node_type`  | `text`         | —                        | NOT NULL, CHECK (start/send_buttons/send_list/send_message/send_media/collect_input/condition/set_tag/handoff/http_fetch/end) | Tipo de nodo |
| `config`     | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                             | Config específica del tipo de nodo       |
| `position_x` | `integer`      | `0`                      | NOT NULL                                             | Posición X en el canvas                  |
| `position_y` | `integer`      | `0`                      | NOT NULL                                             | Posición Y en el canvas                  |
| `created_at` | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha de creación                        |

**UNIQUE:** `(flow_id, node_key)`  
**RLS:** Select (viewer+ via parent), Modify (agent+ via parent)

---

#### `flow_runs` — Ejecuciones de flows (sesiones activas/completadas)

> **Propósito:** Sesión de un contacto ejecutando un flow.  
> **Datos actuales:** 24 ejecuciones.  
> **Invariante:** Un contacto solo puede tener UN flow activo a la vez (índice UNIQUE parcial).  
> **Realtime:** Sí — para mostrar estado en inbox.  
> **Dónde modificarlo:** `src/lib/flows/engine.ts`.

| Columna                | Tipo           | Default                  | Constraints                                          | Descripción                                              |
|------------------------|----------------|--------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`                   | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                                 |
| `account_id`           | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                                   |
| `flow_id`              | `uuid`         | —                        | NOT NULL, FK → `flows(id)` ON DELETE CASCADE         | Flow                                                     |
| `user_id`              | `uuid`         | —                        | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Usuario que inició                                       |
| `contact_id`           | `uuid`         | —                        | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto                                                 |
| `conversation_id`      | `uuid`         | —                        | NULLABLE, FK → `conversations(id)` ON DELETE SET NULL | Conversación                                            |
| `status`               | `text`         | `'active'`              | NOT NULL, CHECK (active/completed/handed_off/timed_out/paused_by_agent/failed) | Estado de la ejecución |
| `current_node_key`     | `text`         | —                        | NULLABLE                                             | Nodo actual                                              |
| `last_prompt_message_id`| `uuid`        | —                        | NULLABLE, FK → `messages(id)` ON DELETE SET NULL     | Último mensaje enviado por el flow                       |
| `vars`                 | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                             | Variables recolectadas durante el flow                    |
| `reprompt_count`       | `integer`      | `0`                      | NOT NULL                                             | Veces que se ha re-preguntado                             |
| `started_at`           | `timestamptz`  | `now()`                 | NOT NULL                                             | Inicio                                                   |
| `last_advanced_at`     | `timestamptz`  | `now()`                 | NOT NULL                                             | Último avance                                            |
| `ended_at`             | `timestamptz`  | —                        | NULLABLE                                             | Fin                                                      |
| `end_reason`           | `text`         | —                        | NULLABLE                                             | Razón de finalización                                    |

**Índice UNIQUE parcial:** `idx_one_active_run_per_contact` (account_id, contact_id) WHERE status = 'active'  
**RLS:** Select (viewer+) — writes via service-role  
**Realtime:** Sí

---

#### `flow_run_events` — Eventos/auditoría de ejecución de flows

> **Propósito:** Registro detallado de cada paso del flow (started, node_entered, message_sent, etc.).  
> **Datos actuales:** 0 eventos.  
> **Dónde modificarlo:** `src/lib/flows/engine.ts`.

| Columna       | Tipo           | Default                  | Constraints                                          | Descripción                              |
|---------------|----------------|--------------------------|------------------------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `uuid_generate_v4()`     | PK                                                   | ID único                                 |
| `flow_run_id` | `uuid`         | —                        | NOT NULL, FK → `flow_runs(id)` ON DELETE CASCADE     | Run asociado                             |
| `event_type`  | `text`         | —                        | NOT NULL, CHECK (started/node_entered/message_sent/reply_received/fallback_fired/handoff/timeout/error/completed) | Tipo de evento |
| `node_key`    | `text`         | —                        | NULLABLE                                             | Nodo relacionado                         |
| `payload`     | `jsonb`        | `'{}'::jsonb`           | NOT NULL                                             | Datos del evento                         |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                             | Fecha del evento                         |

**RLS:** Select (viewer+ via parent)

---

### 4.9 API Pública y Seguridad

---

#### `api_keys` — Claves de API pública

> **Propósito:** Autenticación para API REST pública (`/api/v1/*`).  
> **Formato:** `wacrm_live_<prefix>` (el full key se hashea con SHA-256).  
> **Datos actuales:** 0 claves.  
> **Dónde modificarlo:** `src/lib/api-keys/`, Settings → API Keys.

| Columna       | Tipo           | Default                  | Constraints                                     | Descripción                              |
|---------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `gen_random_uuid()`      | PK                                              | ID único                                 |
| `account_id`  | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `created_by`  | `uuid`         | —                        | NULLABLE, FK → `auth.users(id)` ON DELETE SET NULL | Creador                                |
| `name`        | `text`         | —                        | NOT NULL                                        | Nombre identificativo                    |
| `key_prefix`  | `text`         | —                        | NOT NULL                                        | Prefijo visible (display only)           |
| `key_hash`    | `text`         | —                        | NOT NULL, UNIQUE                                | SHA-256 del full key                     |
| `scopes`      | `text[]`       | `'{}'::text[]`          | NOT NULL                                        | Permisos (ej: {messages:read,contacts:write}) |
| `last_used_at`| `timestamptz`  | —                        | NULLABLE                                        | Último uso                               |
| `expires_at`  | `timestamptz`  | —                        | NULLABLE (NULL = never)                         | Fecha de expiración                      |
| `revoked_at`  | `timestamptz`  | —                        | NULLABLE (NULL = active)                        | Fecha de revocación                      |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                        |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

#### `webhook_endpoints` — Outbound webhooks (📌 PENDIENTE: migración 028 no aplicada)

> ⚠️ **ESTA TABLA AÚN NO EXISTE EN LA BD.**  
> La migración `028_webhook_endpoints.sql` crea esta tabla pero NO ha sido aplicada aún.

> **Propósito:** Permite enviar eventos del CRM a URLs externas via webhook con HMAC.  
> **Dónde modificarlo:** `src/lib/webhooks/`, Settings → Webhooks.

| Columna           | Tipo           | Default                  | Constraints                                     | Descripción                              |
|-------------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`              | `uuid`         | `gen_random_uuid()`      | PK                                              | ID único                                 |
| `account_id`      | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `created_by`      | `uuid`         | —                        | NULLABLE, FK → `auth.users(id)` ON DELETE SET NULL | Creador                                |
| `url`             | `text`         | —                        | NOT NULL (HTTPS endpoint)                       | URL destino                               |
| `secret`          | `text`         | —                        | NOT NULL (encriptado AES-256-GCM)              | Secreto HMAC                              |
| `events`          | `text[]`       | `'{}'::text[]`          | NOT NULL                                        | Suscripción a eventos                     |
| `is_active`       | `boolean`      | `true`                   | NOT NULL                                        | Si está activo                            |
| `last_delivery_at`| `timestamptz`  | —                        | NULLABLE                                        | Último delivery                           |
| `failure_count`   | `integer`      | `0`                      | NOT NULL                                        | Fallos consecutivos (auto-desactiva)      |
| `created_at`      | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                         |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

### 4.10 Asistente IA

---

#### `ai_configs` — Configuración del asistente IA

> **Propósito:** Configuración del proveedor de IA (OpenAI, Anthropic, Xicloca IA).  
> **Datos actuales:** 1 config activa.  
> **Seguridad:** `api_key` y `embeddings_api_key` encriptados AES-256-GCM.  
> **UNIQUE:** `account_id` — una configuración por cuenta.  
> **Dónde modificarlo:** `src/lib/ai/config.ts`, Settings → AI Config.

| Columna                        | Tipo           | Default                  | Constraints                                     | Descripción                                              |
|--------------------------------|----------------|--------------------------|-------------------------------------------------|----------------------------------------------------------|
| `id`                           | `uuid`         | `gen_random_uuid()`      | PK                                              | ID único                                                 |
| `account_id`                   | `uuid`         | —                        | NOT NULL, UNIQUE, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                             |
| `created_by`                   | `uuid`         | —                        | NULLABLE, FK → `auth.users(id)` ON DELETE SET NULL | Creador                                                |
| `provider`                     | `text`         | —                        | NOT NULL, CHECK (openai/anthropic/xiclica-ia-plan) | Proveedor de IA                                      |
| `model`                        | `text`         | —                        | NOT NULL                                        | Modelo (gpt-4o, claude-3, etc.)                          |
| `api_key`                      | `text`         | —                        | NOT NULL (encriptado AES-256-GCM)               | API key del proveedor                                    |
| `embeddings_api_key`           | `text`         | —                        | NULLABLE (encriptado AES-256-GCM)               | API key para embeddings (opcional, separada)             |
| `system_prompt`                | `text`         | —                        | NULLABLE                                        | Prompt del sistema para el asistente                     |
| `is_active`                    | `boolean`      | `false`                  | NOT NULL                                        | Si el asistente está activo                              |
| `auto_reply_enabled`           | `boolean`      | `false`                  | NOT NULL                                        | Si responde automáticamente a mensajes entrantes         |
| `auto_reply_max_per_conversation`| `integer`   | `3`                      | NOT NULL, CHECK (1-20)                         | Máximo de respuestas automáticas por conversación        |
| `created_at`                   | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                                        |
| `updated_at`                   | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de modificación                                    |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)  
**Trigger:** `ai_configs_updated_at` BEFORE UPDATE

---

#### `ai_knowledge_documents` — Documentos de la base de conocimiento

> **Propósito:** Documentos fuente que alimentan el RAG (Retrieval-Augmented Generation) del asistente IA.  
> **Datos actuales:** 0 documentos.  
> **Dónde modificarlo:** `src/lib/ai/`, Settings → AI Knowledge.

| Columna       | Tipo           | Default                  | Constraints                                     | Descripción                              |
|---------------|----------------|--------------------------|-------------------------------------------------|------------------------------------------|
| `id`          | `uuid`         | `gen_random_uuid()`      | PK                                              | ID único                                 |
| `account_id`  | `uuid`         | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE | Cuenta                                   |
| `created_by`  | `uuid`         | —                        | NULLABLE, FK → `auth.users(id)` ON DELETE SET NULL | Creador                                |
| `title`       | `text`         | —                        | NOT NULL                                        | Título del documento                     |
| `content`     | `text`         | —                        | NOT NULL                                        | Contenido completo del documento         |
| `created_at`  | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de creación                        |
| `updated_at`  | `timestamptz`  | `now()`                 | NOT NULL                                        | Fecha de modificación                    |

**RLS:** Select (viewer+), Insert/Update/Delete (admin+)  
**Trigger:** `ai_knowledge_documents_updated_at` BEFORE UPDATE

---

#### `ai_knowledge_chunks` — Fragmentos (chunks) de documentos con embeddings

> **Propósito:** Cada documento se divide en chunks, cada uno con vector embedding para búsqueda semántica + FTS.  
> **Datos actuales:** 0 chunks.  
> **Búsqueda híbrida:** `fts` (tsvector para búsqueda léxica) + `embedding` (pgvector para búsqueda semántica).  
> **Dónde modificarlo:** `src/lib/ai/chunk.ts`, `src/lib/ai/embeddings.ts`.

| Columna       | Tipo            | Default                  | Constraints                                          | Descripción                                              |
|---------------|-----------------|--------------------------|------------------------------------------------------|----------------------------------------------------------|
| `id`          | `uuid`          | `gen_random_uuid()`      | PK                                                   | ID único                                                 |
| `document_id` | `uuid`          | —                        | NOT NULL, FK → `ai_knowledge_documents(id)` ON DELETE CASCADE | Documento fuente                                    |
| `account_id`  | `uuid`          | —                        | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                                   |
| `chunk_index` | `integer`       | `0`                      | NOT NULL                                             | Índice del chunk dentro del documento                    |
| `content`     | `text`          | —                        | NOT NULL                                             | Texto del chunk                                          |
| `fts`         | `tsvector`      | `to_tsvector('simple', content)` | GENERATED STORED, NULLABLE                    | Vector de búsqueda texto completo                        |
| `embedding`   | `vector(1536)`  | —                        | NULLABLE                                             | Embedding vector (1536 dimensiones para OpenAI ada-002)  |
| `created_at`  | `timestamptz`   | `now()`                 | NOT NULL                                             | Fecha de creación                                        |

**Índices:** GIN en `fts`, HNSW en `embedding` (vector_cosine_ops)  
**RLS:** Select (viewer+), Insert/Update/Delete (admin+)

---

### 4.11 Notificaciones y Presencia

---

#### `notifications` — Notificaciones del sistema

> **Propósito:** Notificaciones push/in-app para los miembros del equipo.  
> **Datos actuales:** 22 notificaciones.  
> **Tipo principal:** `conversation_assigned` (cuando se asigna una conversación a un agente).  
> **Realtime:** Sí (REPLICA IDENTITY FULL para cambios en `read_at`).  
> **Dónde modificarlo:** `src/hooks/use-notifications.ts`, `src/lib/notifications/`.

| Columna           | Tipo           | Default                       | Constraints                                          | Descripción                              |
|-------------------|----------------|-------------------------------|------------------------------------------------------|------------------------------------------|
| `id`              | `uuid`         | `uuid_generate_v4()`          | PK                                                   | ID único                                 |
| `account_id`      | `uuid`         | —                             | NOT NULL, FK → `accounts(id)` ON DELETE CASCADE      | Cuenta                                   |
| `user_id`         | `uuid`         | —                             | NOT NULL, FK → `auth.users(id)` ON DELETE CASCADE    | Destinatario                             |
| `type`            | `text`         | `'conversation_assigned'`    | NOT NULL, CHECK (conversation_assigned/...)          | Tipo de notificación                     |
| `conversation_id` | `uuid`         | —                             | NULLABLE, FK → `conversations(id)` ON DELETE CASCADE | Conversación relacionada                 |
| `contact_id`      | `uuid`         | —                             | NULLABLE, FK → `contacts(id)` ON DELETE SET NULL     | Contacto relacionado                     |
| `actor_user_id`   | `uuid`         | —                             | NULLABLE, FK → `auth.users(id)` ON DELETE SET NULL   | Quién realizó la acción                  |
| `title`           | `text`         | —                             | NOT NULL                                             | Título de la notificación                |
| `body`            | `text`         | —                             | NULLABLE                                             | Cuerpo de la notificación                |
| `read_at`         | `timestamptz`  | —                             | NULLABLE                                             | Cuándo se leyó                           |
| `created_at`      | `timestamptz`  | `now()`                      | NOT NULL                                             | Fecha de creación                        |

**RLS:** Select (auth.uid() = user_id), Update (solo read_at, column-level REVOKE)  
**Trigger:** Creadas por `notify_conversation_assigned()`  
**Realtime:** Sí (REPLICA IDENTITY FULL)

---

## 5. Funciones RPC

24 funciones almacenadas para operaciones atómicas y consultas server-side.

### 5.1 Multi-tenencia y Miembros

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `is_account_member` | account_id, min_role | BOOLEAN | SECURITY DEFINER, STABLE | Predicado RLS keystone: verifica si `auth.uid()` pertenece a la cuenta con al menos `min_role` |
| `set_member_role` | p_user_id, p_new_role | VOID | SECURITY DEFINER | Admin+ cambia rol de miembro (no owner, no self) |
| `remove_account_member` | p_user_id | UUID | SECURITY DEFINER | Admin+ remueve miembro, crea cuenta personal vacía para el removido |
| `transfer_account_ownership` | p_new_owner_user_id | VOID | SECURITY DEFINER | Owner transfiere propiedad, se demote a admin |
| `peek_invitation` | p_token_hash | JSON | SECURITY DEFINER, STABLE | Lectura anónima de invitación por hash (anon + authenticated) |
| `redeem_invitation` | p_token_hash | UUID | SECURITY DEFINER | Mueve caller a la cuenta del invitador, elimina cuenta huérfana |

### 5.2 Contadores Atómicos

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `increment_automation_execution_count` | p_automation_id | VOID | SECURITY DEFINER | Atomic +1 a execution_count + refresh last_executed_at |
| `increment_flow_execution_count` | p_flow_id | VOID | SECURITY DEFINER | Atomic +1 a execution_count + refresh last_executed_at |
| `claim_ai_reply_slot` | conversation_id, max_replies | BOOLEAN | SECURITY DEFINER | Claim atómico de slot de auto-reply (cap check) |

### 5.3 Broadcasts

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `recompute_broadcast_counts` | bid | VOID | SECURITY DEFINER | Recalculo completo de contadores (safety net) |
| `broadcast_recipient_aggregate_trigger` | — | TRIGGER | SECURITY DEFINER | Trigger body: incremental O(1) bumps |
| `_bcast_bump` | bid, col, delta | VOID | SECURITY DEFINER | Helper: deltea una columna de contador |
| `_bcast_cols_for_status` | s | TEXT[] | IMMUTABLE | Mapea status a columnas de contador |

### 5.4 Consultas

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `merge_duplicate_contacts` | — | INTEGER | SECURITY DEFINER | Merge de contactos duplicados por normalized phone |
| `filter_contacts_by_tags` | p_tag_ids, p_search, p_limit, p_offset | TABLE(contact, total_count) | SECURITY INVOKER | Filtro server-side por tags con paginación |

### 5.5 Presencia

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `touch_presence` | p_status | VOID | SECURITY DEFINER | Heartbeat upsert en member_presence |

### 5.6 Webhooks

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `record_webhook_failure` | endpoint_id, max_failures | VOID | SECURITY DEFINER | Incremento atómico de failure_count + auto-disable |

### 5.7 AI Knowledge Base

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `match_ai_knowledge_fts` | p_account_id, p_query, p_match_count | TABLE(id, content, rank) | SECURITY DEFINER, STABLE | Búsqueda léxica FTS con ts_rank |
| `match_ai_knowledge_semantic` | p_account_id, p_query_embedding, p_match_count | TABLE(id, content, distance) | SECURITY DEFINER, STABLE | Búsqueda semántica con pgvector cosine distance |

### 5.8 Signup

| Función | Params | Returns | Seguridad | Propósito |
|---------|--------|---------|-----------|-----------|
| `handle_new_user` | — | TRIGGER | SECURITY DEFINER | Crea profile + asigna al tenant unificado (v2 desde migración 033) |

---

## 6. Triggers

15 triggers en el sistema:

| Trigger | Tabla | Timing | Evento | Función | Propósito |
|---------|-------|--------|--------|---------|-----------|
| `set_updated_at` | profiles, contacts, conversations, whatsapp_config, message_templates, deals, broadcasts, automations, flows, accounts | BEFORE | UPDATE | `update_updated_at_column()` | Actualiza `updated_at` automáticamente |
| `ai_configs_updated_at` | ai_configs | BEFORE | UPDATE | `update_ai_configs_updated_at()` | Actualiza `updated_at` en config IA |
| `ai_knowledge_documents_updated_at` | ai_knowledge_documents | BEFORE | UPDATE | `update_ai_knowledge_documents_updated_at()` | Actualiza `updated_at` en KB |
| `on_auth_user_created` | auth.users | AFTER | INSERT | `public.handle_new_user()` | Crea perfil al registrarse |
| `broadcast_recipients_aggregate` | broadcast_recipients | AFTER | INSERT/UPDATE/DELETE | `public.broadcast_recipient_aggregate_trigger()` | Contadores O(1) en broadcasts |
| `on_conversation_assigned` | conversations | AFTER | INSERT/UPDATE OF assigned_agent_id | `public.notify_conversation_assigned()` | Crea notificación al asignar |

---

## 7. Realtime

6 tablas publicadas en `supabase_realtime`:

| Tabla | Propósito |
|-------|-----------|
| `messages` | Stream de mensajes en vivo en el inbox |
| `conversations` | Estado de conversación (asignación, status, unread) |
| `message_reactions` | Reacciones/emojis en tiempo real |
| `flow_runs` | Indicador "contacto en flow X, nodo Y" en inbox |
| `member_presence` | Presencia online/away de miembros |
| `notifications` | Feed de notificaciones (REPLICA IDENTITY FULL) |

---

## 8. Storage Buckets

| Bucket | Público | Límite | MIME Types | Propósito |
|--------|---------|--------|------------|-----------|
| `avatars` | Sí | 2 MB | png, jpeg, webp, gif | Avatares de perfil |
| `flow-media` | Sí | 16 MB | images, videos, documents | Media para nodos send_media en flows |
| `chat-media` | Sí | 16 MB | images, videos, documents, audio | Adjuntos del inbox (composer) |

**Convención de rutas:**
- `avatars/{auth.uid()}/avatar-<ts>.<ext>` (por usuario)
- `flow-media/account-<account_id>/<ts>-<base>.<ext>` (por cuenta)
- `chat-media/account-<account_id>/<ts>-<base>.<ext>` (por cuenta)

---

## 9. Índices Clave

| Índice | Tabla | Columnas | Tipo | Propósito |
|--------|-------|----------|------|-----------|
| `idx_contacts_account_phone_normalized` | contacts | (account_id, phone_normalized) | UNIQUE WHERE phone_normalized <> '' | Dedup de contactos |
| `idx_automations_account_active_trigger` | automations | (account_id, trigger_type) | WHERE is_active | Lookup rápido de automatizaciones activas |
| `idx_flows_account_active` | flows | (account_id) | WHERE status = 'active' | Lookup rápido de flows activos |
| `idx_one_active_run_per_contact` | flow_runs | (account_id, contact_id) | UNIQUE WHERE status = 'active' | Invariante: 1 flow activo por contacto |
| GIN index | ai_knowledge_chunks | fts | GIN | Búsqueda FTS léxica |
| HNSW index | ai_knowledge_chunks | embedding | HNSW (vector_cosine_ops) | Búsqueda semántica con pgvector |
| `idx_contacts_account` | contacts | account_id | B-tree | Scroll de contactos por cuenta |
| `idx_contacts_user_id` | contacts | user_id | B-tree | Filtro por creador |

---

## 10. Mapa de Migraciones

| # | Archivo | Fecha | Propósito | Estado |
|---|---------|-------|-----------|--------|
| 001 | `001_initial_schema.sql` | — | Schema inicial: 22 tablas (CRM, inbox, pipelines, broadcasts, automations) | ✅ Aplicada |
| 002 | `002_pipelines_enhancements.sql` | — | deals.assigned_to + status CHECK | ✅ Aplicada |
| 003 | `003_broadcast_recipient_wamid.sql` | — | whatsapp_message_id + agregador | ✅ Aplicada |
| 004 | `004_contact_delete_set_null.sql` | — | ON DELETE SET NULL en contact_id | ✅ Aplicada |
| 005 | `005_broadcast_counts_incremental.sql` | — | Trigger O(1) en broadcast_recipients | ✅ Aplicada |
| 006 | `006_automations.sql` | — | Tablas de automatización | ✅ Aplicada |
| 007 | `007_automations_increment_counter.sql` | — | RPC increment_automation_execution_count | ✅ Aplicada |
| 008 | `008_profile_avatars_storage.sql` | — | Bucket avatars | ✅ Aplicada |
| 009 | `009_message_actions.sql` | — | reply_to + message_reactions | ✅ Aplicada |
| 010 | `010_flows.sql` | — | Tablas de flows conversacionales | ✅ Aplicada |
| 011 | `011_profile_beta_features.sql` | — | profiles.beta_features column | ✅ Aplicada |
| 012 | `012_flows_increment_counter.sql` | — | RPC increment_flow_execution_count | ✅ Aplicada |
| 013 | `013_whatsapp_config_phone_number_id_unique.sql` | — | UNIQUE en phone_number_id | ✅ Aplicada |
| 014 | `014_message_templates_meta_integration.sql` | — | Columnas Meta en message_templates | ✅ Aplicada |
| 015 | `015_whatsapp_config_registration.sql` | — | Estado de registro en whatsapp_config | ✅ Aplicada |
| 016 | `016_flow_media.sql` | — | Bucket flow-media + nodo send_media | ✅ Aplicada |
| 017 | `017_account_sharing.sql` | — | Multi-usuario: account_role_enum, account_id en tablas | ✅ Aplicada |
| 018 | `018_account_member_rpcs.sql` | — | RPCs de gestión de miembros | ✅ Aplicada |
| 019 | `019_invitation_rpcs.sql` | — | RPCs peek_invitation + redeem_invitation | ✅ Aplicada |
| 020 | `020_account_sharing_followups.sql` | — | Índices compuestos + RLS account-scoped | ✅ Aplicada |
| 021 | `021_account_default_currency.sql` | — | accounts.default_currency | ✅ Aplicada |
| 022 | `022_contact_phone_dedup.sql` | — | phone_normalized + dedup | ✅ Aplicada |
| 023 | `023_chat_media.sql` | — | Bucket chat-media | ✅ Aplicada |
| 024 | `024_member_presence.sql` | — | Tabla member_presence + RPC touch_presence | ✅ Aplicada |
| 025 | `025_filter_contacts_by_tags.sql` | — | RPC filter_contacts_by_tags | ✅ Aplicada |
| 026 | `026_api_keys.sql` | — | Tabla api_keys | ✅ Aplicada |
| 027 | `027_notifications.sql` | — | Tabla notifications | ✅ Aplicada |
| 028 | `028_webhook_endpoints.sql` | — | 📌 Tabla webhook_endpoints (NO aplicada aún) | ⏳ Pendiente |
| 029 | `029_ai_reply.sql` | — | Tabla ai_configs + columnas auto-reply en conversations | ✅ Aplicada |
| 030 | `030_ai_knowledge.sql` | — | Tablas ai_knowledge_documents + ai_knowledge_chunks + RPCs FTS/vector | ✅ Aplicada |
| 031 | `031_default_currency_cop.sql` | 05/07/2026 | Default currency USD → COP | ✅ Aplicada |
| 032 | `032_ai_provider_xiclica.sql` | 05/07/2026 | Provider xiclica-ia-plan en ai_configs | ✅ Aplicada |
| roles_table | *(sin archivo local)* | 07/07/2026 | Tabla `roles` con permisos JSONB | ✅ Aplicada |
| 033 | `033_single_tenant_signup.sql` | 07/07/2026 | Single-tenant: handle_new_user asigna al tenant unificado | ✅ Aplicada |

---

## 11. Relaciones entre Tablas (FK Map)

### Núcleo: `accounts`

```
accounts (1) ──< profiles (N)
accounts (1) ──< contacts (N)
accounts (1) ──< conversations (N)
accounts (1) ──< whatsapp_config (1)
accounts (1) ──< message_templates (N)
accounts (1) ──< pipelines (N)
accounts (1) ──< deals (N)
accounts (1) ──< broadcasts (N)
accounts (1) ──< automations (N)
accounts (1) ──< flows (N)
accounts (1) ──< flow_runs (N)
accounts (1) ──< tags (N)
accounts (1) ──< custom_fields (N)
accounts (1) ──< contact_notes (N)
accounts (1) ──< account_invitations (N)
accounts (1) ──< member_presence (N)
accounts (1) ──< api_keys (N)
accounts (1) ──< notifications (N)
accounts (1) ──< ai_configs (1)
accounts (1) ──< ai_knowledge_documents (N)
accounts (1) ──< ai_knowledge_chunks (N)
accounts (1) ──< roles (N)
```

### Inbox / Mensajería

```
conversations (1) ──< messages (N)
conversations (1) ──< message_reactions (N)
messages (1) ──< messages (N)  (reply_to_message_id, self-FK)
messages (1) ──< message_reactions (N)
contacts (1) ──< conversations (N)
profiles (1) ──< conversations (N)  (assigned_agent_id)
```

### Contactos

```
contacts (1) ──< contact_tags (N)
tags (1) ──< contact_tags (N)
contacts (1) ──< contact_notes (N)
contacts (1) ──< contact_custom_values (N)
custom_fields (1) ──< contact_custom_values (N)
```

### Pipeline

```
pipelines (1) ──< pipeline_stages (N)
pipelines (1) ──< deals (N)
pipeline_stages (1) ──< deals (N)
contacts (1) ──< deals (N)
conversations (1) ──< deals (N)
profiles (1) ──< deals (N)  (assigned_to)
```

### Broadcasts

```
broadcasts (1) ──< broadcast_recipients (N)
contacts (1) ──< broadcast_recipients (N)
```

### Automatizaciones

```
automations (1) ──< automation_steps (N)
automation_steps (1) ──< automation_steps (N)  (parent_step_id, self-FK)
automations (1) ──< automation_logs (N)
automations (1) ──< automation_pending_executions (N)
automation_logs (1) ──< automation_pending_executions (N)
automation_steps (1) ──< automation_pending_executions (N)
```

### Flows

```
flows (1) ──< flow_nodes (N)
flows (1) ──< flow_runs (N)
flow_runs (1) ──< flow_run_events (N)
messages (1) ──< flow_runs (N)  (last_prompt_message_id)
contacts (1) ──< flow_runs (N)
conversations (1) ──< flow_runs (N)
```

### AI Knowledge

```
ai_knowledge_documents (1) ──< ai_knowledge_chunks (N)
```

### Notificaciones

```
conversations (1) ──< notifications (N)
contacts (1) ──< notifications (N)
```

### Auth → Public

```
auth.users (1) ──< profiles (1)
auth.users (1) ──< contacts (N)
auth.users (1) ──< conversations (N)
auth.users (1) ──< whatsapp_config (N)
auth.users (1) ──< message_templates (N)
auth.users (1) ──< pipelines (N)
auth.users (1) ──< deals (N)
auth.users (1) ──< broadcasts (N)
auth.users (1) ──< automations (N)
auth.users (1) ──< flows (N)
auth.users (1) ──< flow_runs (N)
auth.users (1) ──< tags (N)
auth.users (1) ──< custom_fields (N)
auth.users (1) ──< contact_notes (N)
auth.users (1) ──< automation_logs (N)
auth.users (1) ──< automation_pending_executions (N)
auth.users (1) ──< account_invitations (N)  (created_by, accepted_by)
auth.users (1) ──< member_presence (1)
auth.users (1) ──< api_keys (N)
auth.users (1) ──< notifications (N)  (user_id, actor_user_id)
auth.users (1) ──< ai_configs (N)
auth.users (1) ──< ai_knowledge_documents (N)
```

---

## Apéndice: Hostpot de modificación (dónde cambiar qué)

| Si necesitas... | Mira en... |
|----------------|------------|
| **Cambiar un campo de contacto** | `src/app/(dashboard)/contacts/` + `src/lib/contacts/` |
| **Agregar/enviar un mensaje** | `src/lib/whatsapp/send-message.ts` |
| **Procesar webhook entrante** | `src/lib/whatsapp/webhook-inbound.ts` |
| **Configurar WhatsApp** | `src/app/api/whatsapp/config/` + `src/lib/whatsapp/` |
| **Modificar el pipeline/kanban** | `src/app/(dashboard)/pipelines/` |
| **Ajustar reglas de automatización** | `src/lib/automations/engine.ts` |
| **Modificar un flow conversacional** | `src/lib/flows/engine.ts` |
| **Configurar el asistente IA** | `src/lib/ai/config.ts` + Settings → AI Config |
| **Agregar documentos a la KB** | `src/lib/ai/chunk.ts` + Settings → AI Knowledge |
| **Gestionar miembros/roles** | `src/lib/auth/roles.ts` + Settings → Members |
| **Configurar API keys** | `src/lib/api-keys/` + Settings → API Keys |
| **Crear/editar migración** | `supabase/migrations/` (numerada correlativa) |
| **Agregar un campo a la BD** | Crear migración nueva + actualizar types en `src/types/` |
| **Publicar tabla en Realtime** | Supabase Dashboard → Replication |
| **Cambiar RLS policy** | Migración SQL con DROP/CREATE POLICY |

---

> **Documento generado desde el análisis directo de la base de datos Supabase + migraciones del proyecto.**  
> Cualquier discrepancia entre este documento y `docs/schema.md` — este documento tiene la fuente de verdad sobre la BD actual.
