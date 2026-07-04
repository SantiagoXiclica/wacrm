# NEXIA-CRM — Guía de Arquitectura para Agentes de IA

> Generado a partir del código fuente y las migraciones de Supabase.
> Última actualización: Julio 2026.

---

## 1. Stack Tecnológico

| Capa       | Tecnología                                             |
|------------|--------------------------------------------------------|
| Frontend   | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui |
| Backend    | Next.js API Routes, Supabase (Postgres + Auth + Storage + Realtime) |
| Lenguaje   | TypeScript ~6, Vitest                                  |
| WhatsApp   | Meta Cloud API v21.0                                   |
| IA         | OpenAI / Anthropic (BYOK), pgvector + FTS              |
| Paquetería | pnpm (`pnpm@11.9.0`), Node `>=20`                      |

**Scripts principales:** `dev` (port 5644), `build`, `start`, `lint`, `typecheck`, `format`, `test`, `test:watch`.

---

## 2. Estructura del Código

### 2.1 Directorios principales

| Directorio/Archivo         | Propósito                                              |
|----------------------------|--------------------------------------------------------|
| `src/app/`                 | Next.js 16 App Router — páginas + API routes           |
| `src/app/(auth)/`          | Auth pages (login, signup, forgot-password)            |
| `src/app/(dashboard)/`     | Dashboard pages (inbox, contacts, pipelines, etc.)     |
| `src/app/api/`             | API Route Handlers                                     |
| `src/components/`          | UI components agrupados por módulo                     |
| `src/components/ui/`       | shadcn/ui primitives (button, dialog, table, etc.)     |
| `src/hooks/`               | React hooks (auth, realtime, presence, RBAC, theme)    |
| `src/lib/`                 | Lógica de negocio server-side + compartida             |
| `src/lib/supabase/`        | Clientes Supabase (server.ts, client.ts)               |
| `src/lib/whatsapp/`        | Integración Meta Cloud API (send, templates, media)    |
| `src/lib/ai/`              | AI Assistant (BYOK provider, RAG, auto-reply)          |
| `src/lib/automations/`     | Motor de automatizaciones                              |
| `src/lib/flows/`           | Motor de flujos conversacionales                       |
| `src/lib/auth/`            | RBAC, multi-tenencia, roles, api-context              |
| `src/lib/webhooks/`        | Outbound webhooks (events, deliver, sign, ssrf)       |
| `src/lib/api-keys/`        | Public API key management (wacrm_live_*)               |
| `src/lib/api/v1/`          | Public REST API helpers (respond, paginate)            |
| `src/types/`               | TypeScript types compartidos                           |
| `src/middleware.ts`         | Edge middleware (session + token refresh + route guard)|

### 2.2 Rutas de Página (App Router)

| Ruta                    | Módulo        | Propósito                                         |
|-------------------------|---------------|---------------------------------------------------|
| `/`                     | —             | Landing page                                      |
| `/login`                | Auth          | Inicio de sesión                                  |
| `/signup`               | Auth          | Registro                                          |
| `/forgot-password`      | Auth          | Recuperación de contraseña                        |
| `/join/[token]`         | Invitaciones  | Aceptar invitación por token SHA-256              |
| `/dashboard`            | Dashboard     | KPIs, charts, activity feed                       |
| `/inbox`                | Inbox         | Bandeja compartida de WhatsApp                    |
| `/contacts`             | Contactos     | CRUD de contactos, tags, import CSV               |
| `/pipelines`            | Pipeline      | Kanban de ventas (drag-and-drop)                  |
| `/broadcasts`           | Broadcasts    | Listado de campañas de difusión                   |
| `/broadcasts/new`       | Broadcasts    | Wizard de 4 pasos para nueva campaña              |
| `/broadcasts/[id]`      | Broadcasts    | Detalle y tracking de campaña                     |
| `/automations`          | Automaciones  | Listado de reglas de automatización               |
| `/automations/new`      | Automaciones  | Crear automatización                              |
| `/automations/[id]/edit`| Automaciones  | Editor de automatización                          |
| `/automations/[id]/logs`| Automaciones  | Logs de ejecución                                 |
| `/flows`                | Flows         | Listado de flujos conversacionales                |
| `/flows/[id]`           | Flows         | Flow builder visual (React Flow)                  |
| `/flows/[id]/runs`      | Flows         | Historial de ejecuciones                          |
| `/settings`             | Settings      | Centro de configuración (11 secciones)            |
| `/notifications`        | Notificaciones| Centro de notificaciones                          |

### 2.3 API Routes

| Ruta                          | Propósito                                          |
|-------------------------------|----------------------------------------------------|
| `POST /api/whatsapp/webhook`  | Webhook Meta (HMAC-SHA256, inbound + status + template) |
| `POST /api/whatsapp/send`     | Enviar mensaje outbound                            |
| `POST /api/whatsapp/react`    | Reacción emoji                                     |
| `POST /api/whatsapp/broadcast`| Fan-out de broadcasts                              |
| `GET /api/whatsapp/media/[id]`| Proxy/descarga de media de Meta                   |
| `GET/PUT /api/whatsapp/config`| CRUD de configuración WhatsApp (encriptado)        |
| `POST /api/whatsapp/config/verify-registration` | Verificar registro del número       |
| `POST /api/whatsapp/templates/sync` | Sincronizar plantillas desde Meta            |
| `POST /api/whatsapp/templates/submit` | Enviar plantilla a Meta                    |
| `GET/POST /api/account/...`   | Gestión de cuenta, miembros, invitaciones          |
| `GET/POST /api/ai/config`     | Config AI assistant (provider, key, system prompt) |
| `POST /api/ai/draft`          | Generar draft con IA (1 clic)                      |
| `POST /api/ai/test`           | Test de conectividad del provider                  |
| `CRUD /api/ai/knowledge`     | Knowledge base documents                           |
| `POST /api/ai/knowledge/reindex` | Re-chunk + re-embed KB                         |
| `CRUD /api/automations/...`   | CRUD de automatizaciones + engine + cron           |
| `CRUD /api/flows/...`         | CRUD de flows + activate + runs + cron              |
| `GET /api/invitations/[token]/peek` | Vista previa de invitación anónima           |
| `POST /api/invitations/[token]/redeem` | Canjear invitación                        |
| `GET/POST /api/v1/*`          | Public REST API (Bearer token, scoped, rate-limited) |

### 2.4 Módulos Clave en `src/lib/`

| Módulo                  | Archivos clave                                      | Propósito                                        |
|-------------------------|-----------------------------------------------------|--------------------------------------------------|
| `whatsapp/`             | `meta-api.ts`, `send-message.ts`, `phone-utils.ts`, `encryption.ts`, `webhook-signature.ts`, `template-*.ts` | Integración completa Meta Cloud API v21.0 |
| `ai/`                   | `config.ts`, `admin-client.ts`, `auto-reply.ts`, `chunk.ts`, `embeddings.ts`, `context.ts` | BYOK AI assistant + RAG híbrido |
| `automations/`          | `engine.ts`, `meta-send.ts`, `validate.ts`, `steps-tree.ts` | Motor de automatizaciones paso a paso |
| `flows/`                | `engine.ts`, `types.ts`, `edges.ts`, `validate.ts`, `layout.ts`, `fallback.ts` | Motor de flujos conversacionales |
| `auth/`                 | `roles.ts`, `account.ts`, `api-context.ts`, `invitations.ts` | RBAC (owner>admin>agent>viewer), multi-tenencia |
| `api-keys/`             | `keys.ts`, `scopes.ts`, `store.ts`                  | API keys públicas (wacrm_live_*) |
| `webhooks/`             | `events.ts`, `endpoints.ts`, `sign.ts`, `deliver.ts`, `ssrf.ts` | Outbound webhooks con HMAC + SSRF protection |
| `contacts/`             | `parse-contact-csv.ts`, `dedupe.ts`, `resolve-import-tags.ts` | Importación CSV, deduplicación por teléfono |
| `dashboard/`            | `queries.ts`, `types.ts`, `date-utils.ts`           | Métricas del dashboard (Bogotá UTC-5) |
| `supabase/`             | `server.ts`, `client.ts`                            | Clientes Supabase SSR y browser |

---

## 3. Base de Datos — 34 Tablas

Todas las tablas tienen `ENABLE ROW LEVEL SECURITY` y usan `uuid_generate_v4()` o `gen_random_uuid()` como PK por defecto.
A partir de la migración 017, toda tabla operacional lleva `account_id` como columna de tenencia.

### 3.1 CRM

#### `profiles`
| Columna        | Tipo          | Constraints                              |
|----------------|---------------|------------------------------------------|
| id             | UUID          | PK, DEFAULT uuid_generate_v4()           |
| user_id        | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE, UNIQUE |
| full_name      | TEXT          | NOT NULL                                 |
| email          | TEXT          | NOT NULL                                 |
| avatar_url     | TEXT          | NULLABLE                                 |
| role           | TEXT          | DEFAULT 'user' (legacy, unused post-017) |
| account_id     | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (añadida 017) |
| account_role   | account_role_enum | NOT NULL (añadida 017)                |
| beta_features  | TEXT[]        | NOT NULL DEFAULT '{}' (añadida 011)      |
| created_at     | TIMESTAMPTZ   | DEFAULT NOW()                            |
| updated_at     | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **RLS:** `profiles_select` (owner o miembro del account), `profiles_update` (solo propio), `profiles_insert` (solo propio) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `contacts`
| Columna           | Tipo          | Constraints                              |
|-------------------|---------------|------------------------------------------|
| id                | UUID          | PK, DEFAULT uuid_generate_v4()           |
| account_id        | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (añadida 017) |
| user_id           | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| phone             | TEXT          | NOT NULL                                 |
| phone_normalized  | TEXT          | GENERATED ALWAYS AS (regexp_replace(phone, '\D', '', 'g')) STORED (añadida 022) |
| name              | TEXT          | NULLABLE                                 |
| email             | TEXT          | NULLABLE                                 |
| company           | TEXT          | NULLABLE                                 |
| avatar_url        | TEXT          | NULLABLE                                 |
| created_at        | TIMESTAMPTZ   | DEFAULT NOW()                            |
| updated_at        | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **Índices:** `idx_contacts_account` (account_id), `idx_contacts_user_id`, `idx_contacts_phone`, `idx_contacts_account_phone_normalized` UNIQUE WHERE phone_normalized <> '' (añadida 022) |
| **RLS:** `contacts_select` (viewer+), `contacts_insert/update/delete` (agent+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `tags`
| Columna     | Tipo          | Constraints                              |
|-------------|---------------|------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()           |
| account_id  | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (añadida 017) |
| user_id     | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| name        | TEXT          | NOT NULL                                 |
| color       | TEXT          | NOT NULL DEFAULT '#3b82f6'               |
| created_at  | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **RLS:** `tags_select` (viewer+), `tags_insert/update/delete` (admin+) |

#### `contact_tags`
| Columna     | Tipo          | Constraints                              |
|-------------|---------------|------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()           |
| contact_id  | UUID          | NOT NULL, FK → contacts(id) ON DELETE CASCADE |
| tag_id      | UUID          | NOT NULL, FK → tags(id) ON DELETE CASCADE |
| created_at  | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **UNIQUE:** (contact_id, tag_id) |
| **RLS:** `contact_tags_select` (viewer+ via parent), `contact_tags_modify` (agent+ via parent) |

#### `custom_fields`
| Columna      | Tipo          | Constraints                              |
|--------------|---------------|------------------------------------------|
| id           | UUID          | PK, DEFAULT uuid_generate_v4()           |
| account_id   | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (añadida 017) |
| user_id      | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| field_name   | TEXT          | NOT NULL                                 |
| field_type   | TEXT          | NOT NULL DEFAULT 'text'                  |
| field_options| JSONB         | NULLABLE                                 |
| created_at   | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **RLS:** `custom_fields_select` (viewer+), `custom_fields_insert/update/delete` (admin+) |

#### `contact_custom_values`
| Columna        | Tipo          | Constraints                              |
|----------------|---------------|------------------------------------------|
| id             | UUID          | PK, DEFAULT uuid_generate_v4()           |
| contact_id     | UUID          | NOT NULL, FK → contacts(id) ON DELETE CASCADE |
| custom_field_id| UUID          | NOT NULL, FK → custom_fields(id) ON DELETE CASCADE |
| value          | TEXT          | NULLABLE                                 |
| created_at     | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **UNIQUE:** (contact_id, custom_field_id) |
| **RLS:** `contact_custom_values_select` (viewer+ via parent), `contact_custom_values_modify` (agent+ via parent) |

#### `contact_notes`
| Columna     | Tipo          | Constraints                              |
|-------------|---------------|------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()           |
| account_id  | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (añadida 017) |
| contact_id  | UUID          | NOT NULL, FK → contacts(id) ON DELETE CASCADE |
| user_id     | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| note_text   | TEXT          | NOT NULL                                 |
| created_at  | TIMESTAMPTZ   | DEFAULT NOW()                            |
| **RLS:** `contact_notes_select` (viewer+), `contact_notes_insert/update/delete` (agent+) |

### 3.2 Inbox / Mensajería

#### `conversations`
| Columna              | Tipo          | Constraints                                       |
|----------------------|---------------|---------------------------------------------------|
| id                   | UUID          | PK, DEFAULT uuid_generate_v4()                    |
| account_id           | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017)|
| user_id              | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE   |
| contact_id           | UUID          | NOT NULL, FK → contacts(id) ON DELETE CASCADE      |
| status               | TEXT          | NOT NULL DEFAULT 'open', CHECK (open/pending/closed)|
| assigned_agent_id    | UUID          | NULLABLE                                          |
| last_message_text    | TEXT          | NULLABLE                                          |
| last_message_at      | TIMESTAMPTZ   | NULLABLE                                          |
| unread_count         | INTEGER       | DEFAULT 0                                         |
| ai_autoreply_disabled| BOOLEAN       | NOT NULL DEFAULT false (añadida 029)               |
| ai_reply_count       | INTEGER       | NOT NULL DEFAULT 0 (añadida 029)                   |
| created_at           | TIMESTAMPTZ   | DEFAULT NOW()                                     |
| updated_at           | TIMESTAMPTZ   | DEFAULT NOW()                                     |
| **RLS:** `conversations_select` (viewer+), `conversations_insert/update/delete` (agent+) |
| **Triggers:** `set_updated_at` BEFORE UPDATE, `on_conversation_assigned` AFTER INSERT/UPDATE OF assigned_agent_id |
| **Realtime:** sí (publicada en supabase_realtime) |

#### `messages`
| Columna                | Tipo          | Constraints                                       |
|------------------------|---------------|---------------------------------------------------|
| id                     | UUID          | PK, DEFAULT uuid_generate_v4()                    |
| conversation_id        | UUID          | NOT NULL, FK → conversations(id) ON DELETE CASCADE |
| sender_type            | TEXT          | NOT NULL, CHECK (customer/agent/bot)              |
| sender_id              | UUID          | NULLABLE                                          |
| content_type           | TEXT          | NOT NULL DEFAULT 'text', CHECK (text/image/document/audio/video/location/template/**interactive**) |
| content_text           | TEXT          | NULLABLE                                          |
| media_url              | TEXT          | NULLABLE                                          |
| template_name          | TEXT          | NULLABLE                                          |
| message_id             | TEXT          | NULLABLE                                          |
| status                 | TEXT          | NOT NULL DEFAULT 'sent', CHECK (sending/sent/delivered/read/failed) |
| reply_to_message_id    | UUID          | FK → messages(id) ON DELETE SET NULL, NULLABLE (añadida 009) |
| interactive_reply_id   | TEXT          | NULLABLE (añadida 010)                             |
| created_at             | TIMESTAMPTZ   | DEFAULT NOW()                                     |
| **RLS:** `messages_select` (viewer+ via conversation), `messages_modify` (agent+ via conversation) |
| **Realtime:** sí |

#### `message_reactions`
| Columna          | Tipo          | Constraints                                       |
|------------------|---------------|---------------------------------------------------|
| id               | UUID          | PK, DEFAULT uuid_generate_v4()                    |
| message_id       | UUID          | NOT NULL, FK → messages(id) ON DELETE CASCADE      |
| conversation_id  | UUID          | NOT NULL, FK → conversations(id) ON DELETE CASCADE |
| actor_type       | TEXT          | NOT NULL, CHECK (customer/agent)                  |
| actor_id         | UUID          | NULLABLE                                          |
| emoji            | TEXT          | NOT NULL                                          |
| created_at       | TIMESTAMPTZ   | DEFAULT NOW()                                     |
| **UNIQUE:** (message_id, actor_type, actor_id) |
| **RLS:** `message_reactions_select` (viewer+ via parent), `message_reactions_modify` (agent+ via parent) |
| **Realtime:** sí |

### 3.3 WhatsApp

#### `whatsapp_config`
| Columna                   | Tipo          | Constraints                                    |
|---------------------------|---------------|------------------------------------------------|
| id                        | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id                | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL, UNIQUE (017) |
| user_id                   | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE|
| phone_number_id           | TEXT          | NOT NULL, UNIQUE (013)                         |
| waba_id                   | TEXT          | NULLABLE                                       |
| access_token              | TEXT          | NOT NULL (encriptado AES-256-GCM)              |
| verify_token              | TEXT          | NULLABLE                                       |
| status                    | TEXT          | NOT NULL DEFAULT 'disconnected', CHECK (connected/disconnected) |
| registered_at             | TIMESTAMPTZ   | NULLABLE (015)                                 |
| subscribed_apps_at        | TIMESTAMPTZ   | NULLABLE (015)                                 |
| last_registration_error   | TEXT          | NULLABLE (015)                                 |
| connected_at              | TIMESTAMPTZ   | NULLABLE                                       |
| created_at                | TIMESTAMPTZ   | DEFAULT NOW()                                  |
| updated_at                | TIMESTAMPTZ   | DEFAULT NOW()                                  |
| **RLS:** `whatsapp_config_select` (viewer+), `whatsapp_config_insert/update/delete` (admin+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `message_templates`
| Columna              | Tipo          | Constraints                                    |
|----------------------|---------------|------------------------------------------------|
| id                   | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id           | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id              | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE|
| name                 | TEXT          | NOT NULL                                        |
| category             | TEXT          | NOT NULL DEFAULT 'Marketing', CHECK (Marketing/Utility/Authentication) |
| language             | TEXT          | DEFAULT 'en_US'                                 |
| header_type          | TEXT          | NULLABLE, CHECK (text/image/video/document)     |
| header_content       | TEXT          | NULLABLE                                        |
| body_text            | TEXT          | NOT NULL                                        |
| footer_text          | TEXT          | NULLABLE                                        |
| buttons              | JSONB         | NULLABLE, CHECK (array ≤ 10)                    |
| status               | TEXT          | NOT NULL DEFAULT 'DRAFT', CHECK (DRAFT/PENDING/APPROVED/REJECTED/PAUSED/DISABLED/IN_APPEAL/PENDING_DELETION) |
| sample_values        | JSONB         | NULLABLE (014)                                  |
| meta_template_id     | TEXT          | NULLABLE (014)                                  |
| rejection_reason     | TEXT          | NULLABLE (014)                                  |
| quality_score        | TEXT          | NULLABLE, CHECK (GREEN/YELLOW/RED) (014)        |
| header_handle        | TEXT          | NULLABLE (014)                                  |
| header_media_url     | TEXT          | NULLABLE (014)                                  |
| submission_error     | TEXT          | NULLABLE (014)                                  |
| last_submitted_at    | TIMESTAMPTZ   | NULLABLE (014)                                  |
| created_at           | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| updated_at           | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **Índice UNIQUE:** (user_id, name, language) (014) |
| **RLS:** `message_templates_select` (viewer+), `message_templates_insert/update/delete` (admin+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

### 3.4 Pipeline

#### `pipelines`
| Columna     | Tipo          | Constraints                                    |
|-------------|---------------|------------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id  | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id     | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| name        | TEXT          | NOT NULL                                        |
| created_at  | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **RLS:** `pipelines_select` (viewer+), `pipelines_insert/update/delete` (admin+) |

#### `pipeline_stages`
| Columna     | Tipo          | Constraints                                    |
|-------------|---------------|------------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| pipeline_id | UUID          | NOT NULL, FK → pipelines(id) ON DELETE CASCADE |
| name        | TEXT          | NOT NULL                                        |
| position    | INTEGER       | NOT NULL DEFAULT 0                              |
| color       | TEXT          | NOT NULL DEFAULT '#3b82f6'                      |
| created_at  | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **RLS:** `pipeline_stages_select` (viewer+ via parent), `pipeline_stages_modify` (admin+ via parent) |

#### `deals`
| Columna            | Tipo          | Constraints                                    |
|--------------------|---------------|------------------------------------------------|
| id                 | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id         | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id            | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| pipeline_id        | UUID          | NOT NULL, FK → pipelines(id) ON DELETE CASCADE |
| stage_id           | UUID          | NOT NULL, FK → pipeline_stages(id)              |
| contact_id         | UUID          | FK → contacts(id) ON DELETE SET NULL (004)      |
| conversation_id    | UUID          | NULLABLE, FK → conversations(id)                |
| assigned_to        | UUID          | NULLABLE, FK → profiles(id) ON DELETE SET NULL (002) |
| title              | TEXT          | NOT NULL                                        |
| value              | NUMERIC(12,2) | NOT NULL DEFAULT 0                              |
| currency           | TEXT          | DEFAULT 'USD'                                   |
| notes              | TEXT          | NULLABLE                                        |
| expected_close_date| DATE          | NULLABLE                                        |
| status             | TEXT          | NOT NULL DEFAULT 'open', CHECK (open/won/lost)  |
| created_at         | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| updated_at         | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **RLS:** `deals_select` (viewer+), `deals_insert/update/delete` (agent+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

### 3.5 Broadcasts

#### `broadcasts`
| Columna           | Tipo          | Constraints                                    |
|-------------------|---------------|------------------------------------------------|
| id                | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id        | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id           | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| name              | TEXT          | NOT NULL                                        |
| template_name     | TEXT          | NOT NULL                                        |
| template_language | TEXT          | NOT NULL DEFAULT 'en_US'                        |
| template_variables| JSONB         | NULLABLE                                        |
| audience_filter   | JSONB         | NULLABLE                                        |
| scheduled_at      | TIMESTAMPTZ   | NULLABLE                                        |
| status            | TEXT          | NOT NULL DEFAULT 'draft', CHECK (draft/scheduled/sending/sent/failed) |
| total_recipients  | INTEGER       | DEFAULT 0                                       |
| sent_count        | INTEGER       | DEFAULT 0 (actualizado por trigger)             |
| delivered_count   | INTEGER       | DEFAULT 0 (actualizado por trigger)             |
| read_count        | INTEGER       | DEFAULT 0 (actualizado por trigger)             |
| replied_count     | INTEGER       | DEFAULT 0 (actualizado por trigger)             |
| failed_count      | INTEGER       | DEFAULT 0 (actualizado por trigger)             |
| created_at        | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| updated_at        | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **RLS:** `broadcasts_select` (viewer+), `broadcasts_insert/update/delete` (agent+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `broadcast_recipients`
| Columna             | Tipo          | Constraints                                    |
|---------------------|---------------|------------------------------------------------|
| id                  | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| broadcast_id        | UUID          | NOT NULL, FK → broadcasts(id) ON DELETE CASCADE |
| contact_id          | UUID          | FK → contacts(id) ON DELETE SET NULL (004)      |
| status              | TEXT          | NOT NULL DEFAULT 'pending', CHECK (pending/sent/delivered/read/replied/failed) |
| whatsapp_message_id | TEXT          | NULLABLE, UNIQUE WHERE NOT NULL (003)           |
| sent_at             | TIMESTAMPTZ   | NULLABLE                                        |
| delivered_at        | TIMESTAMPTZ   | NULLABLE                                        |
| read_at             | TIMESTAMPTZ   | NULLABLE                                        |
| replied_at          | TIMESTAMPTZ   | NULLABLE                                        |
| error_message       | TEXT          | NULLABLE                                        |
| created_at          | TIMESTAMPTZ   | DEFAULT NOW()                                   |
| **Trigger:** `broadcast_recipients_aggregate` AFTER INSERT/UPDATE/DELETE (incremental counters en broadcasts) |
| **RLS:** `broadcast_recipients_select` (viewer+ via parent), `broadcast_recipients_modify` (agent+ via parent) |

### 3.6 Automations

#### `automations`
| Columna         | Tipo          | Constraints                                    |
|-----------------|---------------|------------------------------------------------|
| id              | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id      | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id         | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| name            | TEXT          | NOT NULL                                        |
| description     | TEXT          | NULLABLE                                        |
| trigger_type    | TEXT          | NOT NULL                                        |
| trigger_config  | JSONB         | NOT NULL DEFAULT '{}'                           |
| is_active       | BOOLEAN       | NOT NULL DEFAULT FALSE                          |
| execution_count | INTEGER       | NOT NULL DEFAULT 0                              |
| last_executed_at| TIMESTAMPTZ   | NULLABLE                                        |
| created_at      | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| updated_at      | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **Índices:** `idx_automations_account_active_trigger` (account_id, trigger_type) WHERE is_active |
| **RLS:** `automations_select` (viewer+), `automations_insert/update/delete` (agent+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `automation_steps`
| Columna        | Tipo          | Constraints                                    |
|----------------|---------------|------------------------------------------------|
| id             | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| automation_id  | UUID          | NOT NULL, FK → automations(id) ON DELETE CASCADE |
| parent_step_id | UUID          | FK → automation_steps(id) ON DELETE CASCADE, NULLABLE |
| branch         | TEXT          | NULLABLE, CHECK (yes/no)                        |
| step_type      | TEXT          | NOT NULL                                        |
| step_config    | JSONB         | NOT NULL DEFAULT '{}'                           |
| position       | INTEGER       | NOT NULL                                        |
| created_at     | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `automation_steps_select` (viewer+ via parent), `automation_steps_modify` (agent+ via parent) |

#### `automation_logs`
| Columna         | Tipo          | Constraints                                    |
|-----------------|---------------|------------------------------------------------|
| id              | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id      | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| automation_id   | UUID          | NOT NULL, FK → automations(id) ON DELETE CASCADE |
| user_id         | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| contact_id      | UUID          | FK → contacts(id) ON DELETE SET NULL            |
| trigger_event   | TEXT          | NOT NULL                                        |
| steps_executed  | JSONB         | NOT NULL DEFAULT '[]'                           |
| status          | TEXT          | NOT NULL, CHECK (success/partial/failed)        |
| error_message   | TEXT          | NULLABLE                                        |
| created_at      | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `automation_logs_select` (viewer+) |

#### `automation_pending_executions`
| Columna          | Tipo          | Constraints                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id       | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| automation_id    | UUID          | NOT NULL, FK → automations(id) ON DELETE CASCADE |
| user_id          | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| contact_id       | UUID          | FK → contacts(id) ON DELETE SET NULL            |
| log_id           | UUID          | FK → automation_logs(id) ON DELETE CASCADE      |
| parent_step_id   | UUID          | FK → automation_steps(id) ON DELETE SET NULL    |
| branch           | TEXT          | NULLABLE, CHECK (yes/no)                        |
| next_step_position| INTEGER      | NOT NULL                                        |
| context          | JSONB         | NOT NULL DEFAULT '{}'                           |
| status           | TEXT          | NOT NULL DEFAULT 'pending', CHECK (pending/running/done/failed) |
| run_at           | TIMESTAMPTZ   | NOT NULL                                        |
| created_at       | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** Sin políticas de cliente (solo service-role) |

### 3.7 Flows Conversacionales

#### `flows`
| Columna          | Tipo          | Constraints                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id       | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| user_id          | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| name             | TEXT          | NOT NULL                                        |
| description      | TEXT          | NULLABLE                                        |
| status           | TEXT          | NOT NULL DEFAULT 'draft', CHECK (draft/active/archived) |
| trigger_type     | TEXT          | NOT NULL, CHECK (keyword/first_inbound_message/manual) |
| trigger_config   | JSONB         | NOT NULL DEFAULT '{}'                           |
| entry_node_id    | TEXT          | NULLABLE (ref `flow_nodes.node_key`)            |
| fallback_policy  | JSONB         | NOT NULL DEFAULT con reprompt+handoff config    |
| execution_count  | INTEGER       | NOT NULL DEFAULT 0                              |
| last_executed_at | TIMESTAMPTZ   | NULLABLE                                        |
| created_at       | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| updated_at       | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **Índices:** `idx_flows_account_active` (account_id) WHERE status = 'active' |
| **RLS:** `flows_select` (viewer+), `flows_insert/update/delete` (agent+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `flow_nodes`
| Columna    | Tipo          | Constraints                                    |
|------------|---------------|------------------------------------------------|
| id         | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| flow_id    | UUID          | NOT NULL, FK → flows(id) ON DELETE CASCADE     |
| node_key   | TEXT          | NOT NULL                                        |
| node_type  | TEXT          | NOT NULL, CHECK (start/send_buttons/send_list/send_message/send_media/collect_input/condition/set_tag/handoff/http_fetch/end) |
| config     | JSONB         | NOT NULL DEFAULT '{}'                           |
| position_x | INTEGER       | NOT NULL DEFAULT 0                              |
| position_y | INTEGER       | NOT NULL DEFAULT 0                              |
| created_at | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **UNIQUE:** (flow_id, node_key) |
| **RLS:** `flow_nodes_select` (viewer+ via parent), `flow_nodes_modify` (agent+ via parent) |

#### `flow_runs`
| Columna             | Tipo          | Constraints                                    |
|---------------------|---------------|------------------------------------------------|
| id                  | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id          | UUID          | FK → accounts(id) ON DELETE CASCADE, NOT NULL (017) |
| flow_id             | UUID          | NOT NULL, FK → flows(id) ON DELETE CASCADE     |
| user_id             | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| contact_id          | UUID          | FK → contacts(id) ON DELETE SET NULL            |
| conversation_id     | UUID          | FK → conversations(id) ON DELETE SET NULL       |
| status              | TEXT          | NOT NULL DEFAULT 'active', CHECK (active/completed/handed_off/timed_out/paused_by_agent/failed) |
| current_node_key    | TEXT          | NULLABLE                                        |
| last_prompt_message_id| UUID        | FK → messages(id) ON DELETE SET NULL            |
| vars                | JSONB         | NOT NULL DEFAULT '{}'                           |
| reprompt_count      | INTEGER       | NOT NULL DEFAULT 0                              |
| started_at          | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| last_advanced_at    | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| ended_at            | TIMESTAMPTZ   | NULLABLE                                        |
| end_reason          | TEXT          | NULLABLE                                        |
| **Índice UNIQUE:** `idx_one_active_run_per_contact` (account_id, contact_id) WHERE status = 'active' |
| **RLS:** `flow_runs_select` (viewer+) — solo SELECT (writes via service-role) |
| **Realtime:** sí |

#### `flow_run_events`
| Columna     | Tipo          | Constraints                                    |
|-------------|---------------|------------------------------------------------|
| id          | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| flow_run_id | UUID          | NOT NULL, FK → flow_runs(id) ON DELETE CASCADE |
| event_type  | TEXT          | NOT NULL, CHECK (started/node_entered/message_sent/reply_received/fallback_fired/handoff/timeout/error/completed) |
| node_key    | TEXT          | NULLABLE                                        |
| payload     | JSONB         | NOT NULL DEFAULT '{}'                           |
| created_at  | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `flow_run_events_select` (viewer+ via parent) |

### 3.8 Multi-tenencia

#### `accounts`
| Columna           | Tipo          | Constraints                                    |
|-------------------|---------------|------------------------------------------------|
| id                | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| name              | TEXT          | NOT NULL                                        |
| owner_user_id     | UUID          | NOT NULL, FK → auth.users(id) ON DELETE RESTRICT, UNIQUE |
| default_currency  | TEXT          | NOT NULL DEFAULT 'USD', CHECK ~ '^[A-Z]{3}$' (021) |
| created_at        | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| updated_at        | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `accounts_select` (viewer+), `accounts_update` (admin+) |
| **Trigger:** `set_updated_at` BEFORE UPDATE |

#### `account_invitations`
| Columna            | Tipo          | Constraints                                    |
|--------------------|---------------|------------------------------------------------|
| id                 | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id         | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| token_hash         | TEXT          | NOT NULL, UNIQUE (SHA-256 del token)           |
| role               | account_role_enum | NOT NULL, CHECK (role <> 'owner')           |
| created_by_user_id | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| label              | TEXT          | NULLABLE                                        |
| created_at         | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| expires_at         | TIMESTAMPTZ   | NOT NULL                                        |
| accepted_at        | TIMESTAMPTZ   | NULLABLE                                        |
| accepted_by_user_id| UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| **RLS:** `account_invitations_select` (admin+), `account_invitations_modify` (admin+) |

#### `member_presence`
| Columna      | Tipo          | Constraints                                    |
|--------------|---------------|------------------------------------------------|
| user_id      | UUID          | PK, FK → auth.users(id) ON DELETE CASCADE       |
| account_id   | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| status       | TEXT          | NOT NULL DEFAULT 'online', CHECK (online/away)  |
| last_seen_at | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `member_presence_select` (viewer+ via account_id) |
| **Realtime:** sí |
| **RPC:** `touch_presence(p_status)` — upsert heartbeat, SECURITY DEFINER |

### 3.9 API Pública / Seguridad

#### `api_keys`
| Columna      | Tipo          | Constraints                                    |
|--------------|---------------|------------------------------------------------|
| id           | UUID          | PK, DEFAULT gen_random_uuid()                  |
| account_id   | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| created_by   | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| name         | TEXT          | NOT NULL                                        |
| key_prefix   | TEXT          | NOT NULL (display only: "wacrm_live_...")       |
| key_hash     | TEXT          | NOT NULL, UNIQUE (SHA-256 del full key)         |
| scopes       | TEXT[]        | NOT NULL DEFAULT '{}'                           |
| last_used_at | TIMESTAMPTZ   | NULLABLE                                        |
| expires_at   | TIMESTAMPTZ   | NULLABLE (NULL = never)                         |
| revoked_at   | TIMESTAMPTZ   | NULLABLE (NULL = active)                        |
| created_at   | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `api_keys_select` (viewer+), `api_keys_insert/update/delete` (admin+) |

#### `webhook_endpoints`
| Columna          | Tipo          | Constraints                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | PK, DEFAULT gen_random_uuid()                  |
| account_id       | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| created_by       | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| url              | TEXT          | NOT NULL (HTTPS endpoint)                      |
| secret           | TEXT          | NOT NULL (AES-256-GCM-encrypted HMAC secret)   |
| events           | TEXT[]        | NOT NULL DEFAULT '{}'                           |
| is_active        | BOOLEAN       | NOT NULL DEFAULT true                           |
| last_delivery_at | TIMESTAMPTZ   | NULLABLE                                        |
| failure_count    | INTEGER       | NOT NULL DEFAULT 0                              |
| created_at       | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `webhook_endpoints_select` (viewer+), `webhook_endpoints_insert/update/delete` (admin+) |

#### `notifications`
| Columna          | Tipo          | Constraints                                    |
|------------------|---------------|------------------------------------------------|
| id               | UUID          | PK, DEFAULT uuid_generate_v4()                 |
| account_id       | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| user_id          | UUID          | NOT NULL, FK → auth.users(id) ON DELETE CASCADE |
| type             | TEXT          | NOT NULL DEFAULT 'conversation_assigned', CHECK (conversation_assigned) |
| conversation_id  | UUID          | FK → conversations(id) ON DELETE CASCADE        |
| contact_id       | UUID          | FK → contacts(id) ON DELETE SET NULL            |
| actor_user_id    | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| title            | TEXT          | NOT NULL                                        |
| body             | TEXT          | NULLABLE                                        |
| read_at          | TIMESTAMPTZ   | NULLABLE                                        |
| created_at       | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `notifications_select` (auth.uid() = user_id), `notifications_update` (solo read_at, column-level REVOKE) |
| **Trigger:** Creadas por `notify_conversation_assigned()` |
| **Realtime:** sí (REPLICA IDENTITY FULL) |

### 3.10 AI Assistant

#### `ai_configs`
| Columna                       | Tipo          | Constraints                                    |
|-------------------------------|---------------|------------------------------------------------|
| id                            | UUID          | PK, DEFAULT gen_random_uuid()                  |
| account_id                    | UUID          | NOT NULL, UNIQUE, FK → accounts(id) ON DELETE CASCADE |
| created_by                    | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| provider                      | TEXT          | NOT NULL, CHECK (openai/anthropic)             |
| model                         | TEXT          | NOT NULL                                        |
| api_key                       | TEXT          | NOT NULL (AES-256-GCM-encrypted)               |
| embeddings_api_key            | TEXT          | NULLABLE (030, AES-256-GCM-encrypted)          |
| system_prompt                 | TEXT          | NULLABLE                                        |
| is_active                     | BOOLEAN       | NOT NULL DEFAULT false                          |
| auto_reply_enabled            | BOOLEAN       | NOT NULL DEFAULT false                          |
| auto_reply_max_per_conversation| INTEGER      | NOT NULL DEFAULT 3, CHECK (1-20)               |
| created_at                    | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| updated_at                    | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `ai_configs_select` (viewer+), `ai_configs_insert/update/delete` (admin+) |
| **Trigger:** `ai_configs_updated_at` BEFORE UPDATE |

#### `ai_knowledge_documents`
| Columna     | Tipo          | Constraints                                    |
|-------------|---------------|------------------------------------------------|
| id          | UUID          | PK, DEFAULT gen_random_uuid()                  |
| account_id  | UUID          | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| created_by  | UUID          | FK → auth.users(id) ON DELETE SET NULL          |
| title       | TEXT          | NOT NULL                                        |
| content     | TEXT          | NOT NULL                                        |
| created_at  | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| updated_at  | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()                          |
| **RLS:** `ai_knowledge_documents_select` (viewer+), `ai_knowledge_documents_insert/update/delete` (admin+) |
| **Trigger:** `ai_knowledge_documents_updated_at` BEFORE UPDATE |

#### `ai_knowledge_chunks`
| Columna     | Tipo            | Constraints                                    |
|-------------|-----------------|------------------------------------------------|
| id          | UUID            | PK, DEFAULT gen_random_uuid()                  |
| document_id | UUID            | NOT NULL, FK → ai_knowledge_documents(id) ON DELETE CASCADE |
| account_id  | UUID            | NOT NULL, FK → accounts(id) ON DELETE CASCADE   |
| chunk_index | INTEGER         | NOT NULL DEFAULT 0                              |
| content     | TEXT            | NOT NULL                                        |
| fts         | tsvector        | GENERATED ALWAYS AS (to_tsvector('simple', content)) STORED |
| embedding   | vector(1536)    | NULLABLE (solo si hay embeddings_api_key)       |
| created_at  | TIMESTAMPTZ     | NOT NULL DEFAULT NOW()                          |
| **Índices:** GIN en fts, HNSW en embedding (vector_cosine_ops) |
| **RLS:** `ai_knowledge_chunks_select` (viewer+), `ai_knowledge_chunks_insert/update/delete` (admin+) |

---

## 4. Funciones RPC (24)

### 4.1 Multi-tenencia y Miembros (017-019)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `is_account_member` | account_id, min_role | BOOLEAN | SECURITY DEFINER, STABLE | Predicado RLS keystone: verifica si auth.uid() pertenece a la cuenta con al menos min_role |
| `set_member_role` | p_user_id, p_new_role | VOID | SECURITY DEFINER | Admin+ cambia rol de miembro (no owner, no self) |
| `remove_account_member` | p_user_id | UUID | SECURITY DEFINER | Admin+ remueve miembro, crea cuenta personal vacía para el removido |
| `transfer_account_ownership` | p_new_owner_user_id | VOID | SECURITY DEFINER | Owner transfiere propiedad, se demuestra a admin |
| `peek_invitation` | p_token_hash | JSON | SECURITY DEFINER, STABLE | Lectura anónima de invitación por hash (anon + authenticated) |
| `redeem_invitation` | p_token_hash | UUID | SECURITY DEFINER | Mueve caller a la cuenta del invitador, elimina cuenta huérfana |

### 4.2 Contadores Atómicos (007, 012)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `increment_automation_execution_count` | p_automation_id | VOID | SECURITY DEFINER, sql | Atomic +1 a execution_count + refresh last_executed_at |
| `increment_flow_execution_count` | p_flow_id | VOID | SECURITY DEFINER, sql | Atomic +1 a execution_count + refresh last_executed_at |
| `claim_ai_reply_slot` | conversation_id, max_replies | BOOLEAN | SECURITY DEFINER, sql | Claim atómico de slot de auto-reply |

### 4.3 Broadcasts (003, 005)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `recompute_broadcast_counts` | bid | VOID | SECURITY DEFINER | Recalculo completo de contadores (safety net) |
| `broadcast_recipient_aggregate_trigger` | — | TRIGGER | SECURITY DEFINER | Trigger body: incremental O(1) bumps |
| `_bcast_bump` | bid, col, delta | VOID | SECURITY DEFINER | Helper: deltea una columna de contador |
| `_bcast_cols_for_status` | s | TEXT[] | IMMUTABLE | Mapea status a columnas de contador |

### 4.4 Consultas (022, 025)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `merge_duplicate_contacts` | — | INTEGER | SECURITY DEFINER | Merge de contactos duplicados por normalized phone |
| `filter_contacts_by_tags` | p_tag_ids, p_search, p_limit, p_offset | TABLE(contact, total_count) | SECURITY INVOKER | Filtro server-side por tags con paginación |

### 4.5 Presencia (024)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `touch_presence` | p_status | VOID | SECURITY DEFINER | Heartbeat upsert en member_presence |

### 4.6 Webhooks (028)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `record_webhook_failure` | endpoint_id, max_failures | VOID | SECURITY DEFINER, sql | Incremento atómico de failure_count + auto-disable |

### 4.7 AI Knowledge Base (030)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `match_ai_knowledge_fts` | p_account_id, p_query, p_match_count | TABLE(id, content, rank) | SECURITY DEFINER, STABLE | Búsqueda léxica FTS con ts_rank |
| `match_ai_knowledge_semantic` | p_account_id, p_query_embedding, p_match_count | TABLE(id, content, distance) | SECURITY DEFINER, STABLE | Búsqueda semántica con pgvector cosine distance |

### 4.8 Signup (001 → 017)

| Función | Params | Returns | Security | Propósito |
|---------|--------|---------|----------|-----------|
| `handle_new_user` | — | TRIGGER | SECURITY DEFINER | Crea profile + account al registrarse (v2 desde 017) |

---

## 5. Triggers (15)

| Trigger | Table | Timing | Event | Función |
|---------|-------|--------|-------|---------|
| `set_updated_at` | profiles | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | contacts | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | conversations | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | whatsapp_config | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | message_templates | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | deals | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | broadcasts | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | automations | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | flows | BEFORE | UPDATE | `update_updated_at_column()` |
| `set_updated_at` | accounts | BEFORE | UPDATE | `update_updated_at_column()` |
| `ai_configs_updated_at` | ai_configs | BEFORE | UPDATE | `update_ai_configs_updated_at()` |
| `ai_knowledge_documents_updated_at` | ai_knowledge_documents | BEFORE | UPDATE | `update_ai_knowledge_documents_updated_at()` |
| `on_auth_user_created` | auth.users | AFTER | INSERT | `public.handle_new_user()` |
| `broadcast_recipients_aggregate` | broadcast_recipients | AFTER | INSERT/UPDATE/DELETE | `public.broadcast_recipient_aggregate_trigger()` (incremental) |
| `on_conversation_assigned` | conversations | AFTER | INSERT/UPDATE OF assigned_agent_id | `public.notify_conversation_assigned()` |

---

## 6. Realtime (6 tablas publicadas en `supabase_realtime`)

| Tabla | Propósito |
|-------|-----------|
| `messages` | Stream de mensajes en vivo en el inbox |
| `conversations` | Estado de conversación (asignación, status) |
| `message_reactions` | Reacciones/emojis en tiempo real |
| `flow_runs` | Indicador "contacto en flow X, nodo Y" en inbox |
| `member_presence` | Presencia online/away de miembros |
| `notifications` | Feed de notificaciones (usa REPLICA IDENTITY FULL) |

---

## 7. Storage Buckets (3)

| Bucket | Público | Límite | MIME Types | Propósito |
|--------|---------|--------|------------|-----------|
| `avatars` | Sí | 2 MB | png, jpeg, webp, gif | Avatares de perfil |
| `flow-media` | Sí | 16 MB | images, videos, documents | Media para nodos send_media en flows |
| `chat-media` | Sí | 16 MB | images, videos, documents, audio | Adjuntos del inbox (composer) |

Path conventions:
- `avatars/{auth.uid()}/avatar-<ts>.<ext>` (per-user)
- `flow-media/account-<account_id>/<ts>-<base>.<ext>` (account-scoped post-020)
- `chat-media/account-<account_id>/<ts>-<base>.<ext>` (account-scoped)

---

## 8. Patrones Arquitectónicos Clave

### 8.1 Multi-tenencia con `accounts`

Cada usuario pertenece a exactamente **una** cuenta. La tenencia se implementa mediante:
- **Columna `account_id`** en toda tabla operacional (añadida en migración 017)
- **Función RPC `is_account_member()`** — predicado keystone usado por todas las RLS policies post-017
- **Jerarquía de roles:** `owner > admin > agent > viewer` (enum `account_role_enum`)
- **Invitations:** tokens SHA-256 con expiración, canjeables via RPC `redeem_invitation()`
- **Signup trigger:** crea automáticamente profile + account al registrarse

### 8.2 RBAC 3 Capas

1. **DB RLS:** `is_account_member()` en cada policy
2. **Server:** `requireRole()` en API routes + `lib/auth/roles.ts`
3. **Client:** `<RequireRole>` componente + `gated-button` + `use-can.ts`

### 8.3 Contadores Atómicos

Para evitar race conditions en operaciones concurrentes:
- **Broadcasts:** trigger incremental `broadcast_recipients_aggregate` (bumps O(1) por status change)
- **Automations:** RPC `increment_automation_execution_count` (CTE update atómico)
- **Flows:** RPC `increment_flow_execution_count` (CTE update atómico)
- **AI Replies:** RPC `claim_ai_reply_slot` (slot atómico con cap check en un UPDATE)

### 8.4 RAG Híbrido (FTS + pgvector)

- **Léxico (FTS):** `tsvector` generado + GIN index + `ts_rank` + `plainto_tsquery` (language-neutral 'simple' config)
- **Semántico (pgvector):** `vector(1536)` para embeddings OpenAI + índice HNSW (no IVFFlat, porque tablas empiezan vacías)
- Dos RPCs: `match_ai_knowledge_fts()` y `match_ai_knowledge_semantic()`, ambas SECURITY DEFINER

### 8.5 Flows: Invariante Active-Run

El índice `idx_one_active_run_per_contact` (UNIQUE parcial WHERE status = 'active') garantiza que un contacto tenga **como máximo un flow activo** a la vez. Dos webhooks concurrentes colisionan con SQLSTATE 23505 — el runner atrapa el error y retorna consumed:true.

### 8.6 Encriptación AES-256-GCM de Secrets

Todos los secrets se almacenan encriptados:
- `whatsapp_config.access_token`
- `webhook_endpoints.secret`
- `ai_configs.api_key` y `embeddings_api_key`
- `ENCRYPTION_KEY` en `.env` (64 hex chars = 32 bytes)

### 8.7 Idempotencia en Migraciones

Toda migración es idempotente y re-ejecutable usando:
- `IF NOT EXISTS` en tablas e índices
- `DROP ... IF EXISTS` en policies y triggers
- `ON CONFLICT DO UPDATE` en inserts de buckets
- Backfills en `DO $$` blocks con guardas

---

## 9. Convenciones de Código para Agentes de IA

1. **TypeScript ~6 estricto** — evitar `any`, usar tipos explícitos
2. **next-intl** — usar `useTranslations()` con `messages/es.json` (default) y `messages/en.json`
3. **Zona horaria** — `America/Bogotá` (UTC-5) para fechas, logs, cron jobs
4. **Moneda COP** — usar `formatCurrency()` con `DEFAULT_CURRENCY = "COP"` en nueva funcionalidad financiera
5. **Formato fecha** — DD/MM/AAAA con locale `es-CO`
6. **Supabase** — RLS vía `is_account_member()`, todas las tablas con `account_id`
7. **Tests** — Vitest, correr `pnpm test` antes de commit
8. **Lint + typecheck** — correr `pnpm lint` y `pnpm typecheck` antes de commit
9. **Secretos** — nunca loguear secrets; siempre usar `encrypt()`/`decrypt()` de `lib/whatsapp/encryption.ts`
10. **Contadores** — nunca usar read-modify-write; siempre RPC atómico o trigger incremental
