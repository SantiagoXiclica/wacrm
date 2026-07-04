<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:nexia-crm-guide -->
# NEXIA-CRM — Portal Completo

CRM autogestionable (self-hosted) para WhatsApp Business API construido con **Next.js 16**, **Supabase** y **React 19**.

## Stack

| Capa       | Tecnología                                   |
|------------|----------------------------------------------|
| Frontend   | Next.js 16 (App Router), React 19, Tailwind v4, shadcn/ui |
| Backend    | Next.js API Routes, Supabase (Postgres + Auth + Storage + RLS) |
| Lenguaje   | TypeScript ~6, Vitest                        |
| WhatsApp   | Meta Cloud API v21.0                         |
| IA         | OpenAI / Anthropic (BYOK), pgvector + FTS    |
| Paquetería | pnpm                                         |

## Personalización Colombia

- **Idioma:** Español (`es`) — default en next-intl
- **Moneda:** COP (Peso Colombiano) — `DEFAULT_CURRENCY = "COP"` en `src/lib/currency.ts`, agregado al listado `CURRENCIES`
- **Zona horaria:** Bogotá (UTC-5 / `America/Bogotá`) — usar en fechas, schedules, cron y logs
- **Formato de fecha:** DD/MM/AAAA — configurar `Intl.DateTimeFormat` con locale `es-CO`
- **Formato numérico:** punto como separador de miles, coma como separador decimal (ej. $1.234.567,89)

## Módulos del Portal

### 1. Autenticación y Autorización
- **Auth:** Supabase Auth (email/password, magic links, password reset)
- **Middleware:** `src/middleware.ts` — session cookie + token refresh, protege rutas dashboard, redirects auth
- **RBAC:** 4 roles — `owner > admin > agent > viewer`
- **Multi-tenencia:** cada usuario tiene su `accounts`, miembros via invite links (SHA-256)
- **3 capas de enforcement:** DB RLS (`is_account_member()`), servidor (`requireRole()`), cliente (`<RequireRole>`)
- **Páginas:** `/login`, `/signup`, `/forgot-password`, `/join/[token]`

### 2. Dashboard (`/dashboard`)
- Métricas: conversaciones activas, contactos nuevos hoy, valor de deals abiertos, mensajes enviados hoy (vs ayer)
- Charts: conversaciones en el tiempo (Recharts), tiempo de respuesta por día de semana
- Donut de pipeline (deals por etapa)
- Feed de actividad multi-módulo
- Quick actions

### 3. Bandeja Compartida — Inbox (`/inbox`)
- Conversaciones multi-agente en un mismo número WhatsApp
- Asignación de conversaciones con presencia en tiempo real
- Composer con soporte para: texto, imágenes, video, documentos, audio, notas de voz (opus-recorder), plantillas, drafts con IA
- Message quoting, emoji reactions
- Status tracking (sending/sent/delivered/read/failed)
- Contact sidebar con datos del contacto

### 4. Contactos (`/contacts`)
- CRUD con teléfono (E.164), nombre, email, empresa, avatar
- Tags many-to-many con colores
- Campos personalizados (tipo texto, JSONB options)
- Notas por contacto
- Importación CSV con resolución de tags
- Deduplicación por teléfono

### 5. Pipeline de Ventas (`/pipelines`)
- Múltiples pipelines con etapas configurables
- Kanban drag-and-drop (@dnd-kit)
- Deals: título, valor, moneda, estado (open/won/lost), fecha cierre, agente asignado
- Deals vinculados a contactos y conversaciones
- Analytics del pipeline

### 6. Broadcasts (`/broadcasts`)
- Wizard de 4 pasos: elegir plantilla Meta → seleccionar audiencia → personalizar variables → programar/enviar
- Tracking por webhook: sent/delivered/read/replied/failed
- Agregados O(1) via DB triggers
- API: hasta 1000 destinatarios por request

### 7. Automaciones (`/automations`)
- **Triggers:** `new_message_received`, `keyword_match`, `new_contact_created`, `conversation_assigned`, `tag_added`, `scheduled` (cron)
- **Acciones:** send_message, send_template, add_tag/remove_tag, condition, wait, assign_conversation, update_contact_field, create_deal, send_webhook, close_conversation
- Engine completo con logging atómico, cola de ejecución pendiente, resumen por cron

### 8. Flows Conversacionales (`/flows`)
- Builder visual con @xyflow/react (React Flow)
- **10 tipos de nodo:** start, send_message, send_buttons, send_list, send_media, collect_input, condition, set_tag, handoff, http_fetch, end
- **Triggers:** keyword, first_inbound_message, manual
- Política de fallback configurable (reprompt/handoff/ignore)
- Engine: invariante de active run por contacto, idempotencia, OCC, timeouts por cron

### 9. Asistente IA (`/api/ai/*`)
- **BYOK:** OpenAI o Anthropic, API key almacenada AES-256-GCM
- Drafts con 1 clic en el inbox
- Auto-reply bot con tope por conversación y handoff por sentinel
- **Knowledge Base (RAG):** documentos FAQ/policy/product, chunking + embeddings (text-embedding-3-small), híbrido FTS + pgvector
- API: `/draft`, `/config`, `/knowledge/*`, `/test`

### 10. Configuración (`/settings`) — 11 secciones
| Sección       | Descripción                                   |
|---------------|-----------------------------------------------|
| Overview      | Landing de settings                           |
| Profile       | Nombre, email, avatar                         |
| Security      | Cambio contraseña, sesiones                   |
| Appearance    | Tema, locale                                  |
| WhatsApp      | Número, WABA, credenciales, registro          |
| Templates     | Plantillas Meta (crear/sync/editar/borrar)    |
| Fields & Tags | Campos personalizados + tags                  |
| Deals         | Etapas de pipeline, moneda por defecto        |
| Members       | Miembros, invitar, roles, remover             |
| AI Assistant  | Provider, modelo, API key, system prompt, auto-reply, KB |
| API Keys      | Crear/revocar API keys con scopes             |

### 11. API Pública REST (`/api/v1`)
- **Auth:** Bearer token (`wacrm_live_*`), SHA-256 hash, scopes
- **Scopes:** messages:send/read, contacts:read/write, conversations:read, broadcasts:send, webhooks:manage
- **12 endpoints:** me, messages, contacts, conversations, broadcasts, webhooks
- **Rate limiting:** 120 req/min por API key
- **Outbound webhooks:** 3 eventos (message.received, message.status_updated, conversation.created), HMAC-SHA256, SSRF protection, auto-disable

### 12. Webhooks WhatsApp (`/api/whatsapp/webhook`)
- Verificación HMAC-SHA256 con Meta App Secret
- Inbound: text, media, reactions, interactive replies
- Status updates: delivery/read para messages y broadcasts
- Template status: approved/rejected
- Find-or-create contact + conversación
- Dispatch: flows → automations → AI auto-reply
- Outbound webhook events

### 13. Integración WhatsApp (`src/lib/whatsapp/`)
- Meta Cloud API v21.0 completa: send, media, templates, interactives (buttons/list), reactions
- Encriptación AES-256-GCM para todos los secrets
- Utilidades: sanitizePhone, normalizePhone, phoneVariants, phone retry para números sandbox
- Template system: componentes, validadores, lifecycle, webhook, status normalize

### 14. Seguridad
- CSP (Report-Only), HSTS 2 años, X-Content-Type-Options, X-Frame-Options: DENY, Referrer-Policy
- Rate limiting multi-nivel (key/user/account)
- Encriptación de secrets AES-256-GCM
- HMAC-SHA256 para webhooks (Meta y outbound)
- SSRF protection en outbound webhooks
- Dockerfile con `output: "standalone"`

## Reglas de Desarrollo

1. **Next.js 16:** leer `node_modules/next/dist/docs/` antes de escribir código — hay breaking changes
2. **TypeScript ~6:** usar tipos estrictos, evitar `any`
3. **i18n:** usar `next-intl`, mensajes en `messages/es.json` y `messages/en.json` — español es default
4. **Moneda COP:** en formateo de valores usar `formatCurrency()` con `"COP"`, toda nueva feature financiera debe usar COP por defecto
5. **Zona horaria:** usar `America/Bogotá` (UTC-5) para fechas, schedules, cron jobs, logs
6. **Formato fecha/hora:** DD/MM/AAAA, locale `es-CO`
7. **Supabase:** RLS policies vía `is_account_member()`, todas las tablas con `account_id`
8. **Tests:** Vitest, correr `pnpm test` antes de commit
9. **Lint + typecheck:** correr `pnpm lint` y `pnpm typecheck` antes de commit
<!-- END:nexia-crm-guide -->
