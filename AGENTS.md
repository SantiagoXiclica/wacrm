<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

Next.js 16 tiene breaking changes — APIs, convenciones y estructura de
archivos pueden diferir de tus datos de entrenamiento. ANTES de escribir
código, lee la guía relevante en `node_modules/next/dist/docs/`. Respeta
los avisos de deprecación. Si dudas sobre una API, búscala ahí; no la asumas.
<!-- END:nextjs-agent-rules -->

# NEXIA-CRM — Instrucciones para Agentes de IA

CRM autogestionable (self-hosted) para WhatsApp Business API sobre
**Next.js 16**, **Supabase** y **React 19**. Fork de wacrm personalizado
para Colombia.

## 0. Reglas críticas (leer primero)

### Secrets y variables de entorno
- **NUNCA** leas `.env`, `.env.local` ni ningún archivo con valores reales.
  Contienen secretos sensibles (service-role key, ENCRYPTION_KEY,
  META_APP_SECRET, tokens de acceso).
- La ú́nica referencia de nombres de vars es **`.env.local.example`** .
  Léelo para saber qué vars existen; sus ejemplos comentados
  (`sbp_asda...` = Supabase MCP token, `sb_publishable_...` = Supabase
  access token, `your-64-char-hex-key-here` = AES key, etc.) permiten
  inferir el tipo de cada token SIN exponer valores reales.
- Accede a las vars vía `process.env.NOMBRE_VAR`. Usa `!` solo cuando
  sea obligatoria (ver patrón en `src/lib/supabase/server.ts`).
- **Server-only** (`SUPABASE_SERVICE_ROLE_KEY`, `META_APP_SECRET`,
  `ENCRYPTION_KEY`, `SUPABASE_ACCESS_TOKEN`): NUNCA las expongas en
  código cliente ni les pongas prefijo `NEXT_PUBLIC_`. Verifica con
  `grep` si una var server-only aparece en un archivo `.tsx` o en
  una carpeta de cliente.
- Nunca imprimas, loguees ni incluyas en diffs valores de env vars,
  tokens, keys ni secrets.

### Decisiones críticas — preguntar antes de continuar
Detente y pregunta cuando haya:
- Más de un enfoque razonable con impacto distinto.
- Cambios en esquema/DB (migraciones), RLS, auth, webhooks o encriptación.
- Elección de librería nueva, cambio de patrón arquitectónico o de API
  pública.
- Eliminación de código o ruptura de compatibilidad (breaking change).
- Dudas sobre el comportamiento esperado, datos sensibles o impacto en
  producción.
No asumas: resume el plan y espera aprobación.

### Código mantenible y escalable
- DRY/KISS. Antes de construir desde cero, verifica si ya existe una
  utilidad (busca en `src/lib/`). Reutiliza antes que duplicar.
- Funciones pequeñas y puras cuando sea posible; I/O aislada y testeable
  (ver patrón en `src/lib/auth/roles.ts` — lógica sin I/O + tests puros).
- Tipos estrictos, sin `any` (usa `unknown` y narrowing). Evita casteos
  innecesarios.
- Cada convención es un solo source of truth:
  - RBAC → predicados en `roles.ts`
  - Moneda → `currency.ts` + columna `accounts.default_currency`
  - Roles de cuenta → `account_role_enum` en SQL
- Piensa en el siguiente cambio: nombres claros, documenta el *por qué*
  (no el qué), deja extensión fácil.
- Prefiere async/await sobre `.then()`; evita promesas colgadas
  (unhandled rejections).

## 1. Stack (versiones pinneadas)

| Capa       | Tecnología                                               |
|------------|----------------------------------------------------------|
| Frontend   | Next.js 16.2.6 (App Router), React 19.2, Tailwind v4, shadcn/ui, Recharts |
| Backend    | Next.js API Routes, Supabase (Postgres + Auth + Storage + Realtime + RLS) |
| Lenguaje   | TypeScript 6 (strict), pnpm 11.9, Node ≥20               |
| WhatsApp   | Meta Cloud API v21.0 (send, media, templates, interactive) |
| IA         | OpenAI / Anthropic BYOK, pgvector + FTS                  |
| Tests      | Vitest 4 (co-located `*.test.ts`)                        |

## 2. Setup y comandos

```bash
pnpm install                         # instalar dependencias
pnpm dev                             # dev server en puerto 5644
pnpm build                           # build producción (incluye typecheck)
pnpm typecheck                       # tsc --noEmit (rápido)
pnpm lint                            # eslint
pnpm format                          # prettier --write .
pnpm format:check                    # prettier check-only (CI)
pnpm test                            # vitest run
pnpm test:watch                      # vitest en watch
```

## 3. Estructura del código (resumen)

| Ruta | Propósito |
|------|-----------|
| `src/app/(auth)/` | Páginas de auth (login, signup, forgot-password) |
| `src/app/(dashboard)/` | Dashboard (inbox, contacts, pipelines, broadcasts, automations, flows, settings) |
| `src/app/api/` | API Routes: `v1/` (pública), `whatsapp/` (webhooks), `ai/`, `account/`, `automations/`, `flows/` |
| `src/components/ui/` | Primitivas shadcn/ui |
| `src/hooks/` | React hooks (auth, realtime, presence, RBAC, unread) |
| `src/lib/` | Lógica server-side y compartida (auth, whatsapp, ai, automations, flows, webhooks, contacts, api-keys) |
| `src/lib/supabase/` | Clientes Supabase (`server.ts` SSR, `client.ts` browser) |
| `src/lib/whatsapp/` | Integración Meta Cloud API (send, templates, media, encryption, phone-utils) |
| `src/lib/auth/` | Auth, roles, API context, invitations |
| `src/types/` | Tipos globales (index.ts, opus-recorder.d.ts) |
| `src/i18n/` | Configuración de next-intl (`request.ts`) |
| `supabase/migrations/` | Migraciones SQL numeradas (001–030) |
| `docs/` | Documentación: `schema.md` (arquitectura completa), `public-api.md`, `road_map.md` |

👉 **Arquitectura detallada** (864 líneas, cada módulo con tablas, RLS,
   endpoints e invariantes): **`docs/schema.md`**

## 4. Personalización Colombia

- **Idioma:** español (`es`) — default en next-intl; mensajes en
  `messages/es.json` (y `en.json` como fallback).
- **Zona horaria:** `America/Bogota` (UTC-5) para fechas, schedules,
  cron jobs, logs y `Intl.DateTimeFormat`.
- **Formato fecha:** DD/MM/AAAA, locale `es-CO`.
- **Formato numérico:** punto como separador de miles, coma como
  separador decimal (ej. $1.234.567,89).
- **Moneda — ⚠️ META PENDIENTE:** el objetivo es **COP** como default,
  pero el código actual usa **USD** (`DEFAULT_CURRENCY = "USD"` en
  `src/lib/currency.ts:14`) y COP no está en `CURRENCIES`. Ver item 1
  en `pendientes.md`. Mientras, toda feature financiera usa
  `formatCurrency()` con la moneda de la cuenta (columna
  `accounts.default_currency`).

## 5. Convenciones de código

- **Imports:** alias `@/*` -> `./src/*`. ESM imports siempre, sin `require()`.
- **Exports:** named exports siempre. Default exports solo para páginas
  Next.js (App Router lo requiere).
- **Server vs client:** las API routes y `src/lib/*` con I/O de server
  corren en Node. Los componentes con interactividad llevan
  `'use client'`. Las env vars server-only nunca cruzan a cliente.
- **RBAC:** usa los **predicados** de `src/lib/auth/roles.ts`
  (`canManageMembers`, `canEditSettings`, `canSendMessages`,
  `canViewOnly`, `canDeleteAccount`, `canTransferOwnership`) en lugar
  de comparar strings de rol. Esto mantiene la política en un solo
  archivo.
- **Multi-tenencia:** toda tabla lleva `account_id` REFERENCES. RLS
  enforcement vía `is_account_member(account_id, min_role)`. En
  server-side sin sesión (API pública), filtrar explícitamente por
  `accountId` del contexto (ver `api-context.ts`).
- **Encriptación:** secrets de WhatsApp se guardan AES-256-GCM
  (formato `iv:ct:tag`). Usar `encrypt()` / `decrypt()` de
  `src/lib/whatsapp/encryption.ts`. La key está en
  `process.env.ENCRYPTION_KEY` (64 hex chars).
- **Tests:** co-localizados (`*.test.ts` junto al fuente). Usa Vitest.
  Prioriza lógica pura (tipos, validadores, transformaciones) sobre
  tests de integración.
- **Comentarios:** documenta el *por qué*, no el *qué* ni el *cómo*.
  Sin comentarios obvios.

## 6. Módulos del portal (resumen)

| # | Módulo | Ruta principal | Propósito |
|---|--------|----------------|-----------|
| 1 | Auth & RBAC | `src/lib/auth/`, `src/middleware.ts` | Supabase Auth, 4 roles, multi-tenencia x invite |
| 2 | Dashboard | `(dashboard)/` | Métricas, charts (Recharts), donut pipeline, activity feed |
| 3 | Inbox | `(dashboard)/inbox` | Bandeja multi-agente, composer, quoting, reactions, status tracking |
| 4 | Contactos | `(dashboard)/contacts` | CRUD + tags + custom fields + CSV import + dedup |
| 5 | Pipelines | `(dashboard)/pipelines` | Kanban drag-drop (@dnd-kit), deals vinculados |
| 6 | Broadcasts | `(dashboard)/broadcasts` | Wizard 4 pasos, tracking webhook, O(1) aggregates |
| 7 | Automaciones | `(dashboard)/automations` | Triggers + acciones + engine atómico + cron |
| 8 | Flows | `(dashboard)/flows` | Builder visual (@xyflow/react), 10 nodos, engine invariante |
| 9 | Asistente IA | `/api/ai/*` | BYOK, drafts, auto-reply, RAG (pgvector + FTS) |
| 10 | Settings | `(dashboard)/settings` | 11 secciones (WhatsApp, plantillas, AI, API keys, miembros…) |
| 11 | API pública | `/api/v1/*` | 12 endpoints, Bearer `wacrm_live_*`, rate 120/min |
| 12 | Webhooks WhatsApp | `/api/whatsapp/webhook` | HMAC-SHA256, inbound + status, dispatch chain |
| 13 | WhatsApp lib | `src/lib/whatsapp/` | Meta Cloud API v21, encryption, phone utils, templates |
| 14 | Seguridad | transversal | CSP, HSTS, rate-limit, encryption, HMAC, SSRF |

Detalle completo (tablas SQL, RLS policies, invariantes, contratos de
API): **`docs/schema.md`** y **`docs/public-api.md`**.

## 7. Práctica con IA (agentes sobre el código)

- **Explica antes de actuar:** para tareas no triviales, presenta un
  plan breve y espera confirmación.
- **Verifica con tests:** tras cambios, ejecuta `pnpm test`. Crea o
  actualiza tests del código que tocas.
- **No asumas APIs:** Next.js 16 y Supabase tienen breaking changes.
  Consulta `node_modules/next/dist/docs/` y el código existente antes
  de escribir.
- **Lee el contexto existente:** inspecciona archivos vecinos y los
  patrones que usan; imita el estilo del código circundante. Busca en
  `src/lib/` antes de reinventar.
- **Cambios pequeños y enfocados:** cada cambio resuelve una tarea
  lógica. Si una tarea puede dividirse, proponlo.
- **Contratos estables:** no rompas la API pública `/api/v1` ni los
  contratos del webhook entrante/saliente sin aprobar. Los cambios en
  tipos compartidos deben ser compatibles hacia atrás o requerir
  migración coordinada.
- **Cuando algo no cierra:** pregunta (ver §0 — Decisiones críticas).

## 8. Límites — qué NO hacer

- **NO** modifiques migraciones ya aplicadas (`supabase/migrations/*`):
  crea una nueva numerada.
- **NO** introduzcas dependencias nuevas sin confirmar su necesidad (se
  auditan periódicamente).
- **NO** uses `any`. Usa `unknown` y narrowing, o tipos más específicos.
- **NO** expongas secrets en cliente ni loguees tokens/env vars.
- **NO** hardcodees URLs de producción ni valores sensibles.
- **NO** agregues lógica de rol inline: usa los predicados de `roles.ts`.
- **NO** toques los directorios `public/opus/` (worker minificado) ni
  `node_modules/`.
- **NO** uses `require()` — ESM imports siempre.
- **NO** uses `moment.js` (usa `date-fns`), `lodash` (usa nativas),
  ni bibliotecas deprecadas en el proyecto.

## 9. Antes de terminar (Definition of Done)

1. `pnpm typecheck` pasa sin errores.
2. `pnpm lint` pasa sin warnings.
3. `pnpm test` pasa (incluye tests nuevos del cambio).
4. Si tocaste esquema: migración nueva creada en `supabase/migrations/`.
   No modifiques migraciones existentes.
5. Si tocaste UI: mensajes i18n en `messages/es.json` (y `en.json` si
   aplica).
6. Si tocaste feature financiera: usa `formatCurrency()` con la moneda
   de cuenta. No asumas USD/COP duro.
7. Sin secrets en el diff: verifica que ningún `.env*` file real, token
   ni key esté incluido en los cambios.
8. Un cambio lógico por commit. Commit message: imperativo + conciso.
