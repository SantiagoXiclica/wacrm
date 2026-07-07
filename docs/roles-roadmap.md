# Roadmap: Sistema de Roles Configurable

## Visión general

Transformar el sistema de roles hardcodeado actual en un sistema configurable
almacenado en BD, con permisos granulares por módulo/acción, UI de configuración
para el owner, y sidebar dinámico que oculte funciones no permitidas.

---

## Fase 1: Migración BD + Seed de roles por defecto

**Objetivo:** Crear la tabla `roles` y sembrar los 4 roles por defecto para
todas las cuentas existentes.

### Archivos afectados
- `supabase/migrations/031_roles_table.sql` (nueva)
- `src/types/index.ts` (nuevos tipos)

### Detalles
1. Tabla `roles` con columnas:
   - `id UUID PK DEFAULT gen_random_uuid()`
   - `account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE`
   - `name TEXT NOT NULL` (ej: "Propietario", "Administrador", "Agente", "Visor")
   - `rank INT NOT NULL` (jerarquía: 10=owner, 8=admin, 5=agent, 1=viewer)
   - `is_system BOOLEAN DEFAULT false` (roles built-in no se borran)
   - `permissions JSONB NOT NULL DEFAULT '{}'`
   - `created_at TIMESTAMPTZ DEFAULT now()`
   - `updated_at TIMESTAMPTZ DEFAULT now()`
   - `UNIQUE(account_id, name)`

2. Índices:
   - `idx_roles_account_id` en `account_id`
   - `idx_roles_account_rank` en `(account_id, rank)`

3. RLS policies:
   - SELECT: `is_account_member(account_id)` (todos los miembros pueden leer)
   - INSERT/UPDATE/DELETE: solo owners (`is_account_member(account_id, 'owner')`)

4. Seed: para cada cuenta existente, insertar 4 roles por defecto con
   permisos completos (owner/admin/agent) o solo lectura (viewer).

5. Trigger `set_updated_at` en la tabla roles.

### Criterio de aceptación
- `pnpm typecheck` pasa
- Tabla existe en BD con RLS correcto
- Roles sembrados para cuentas existentes
- Migración reversible (DOWN)

---

## Fase 2: Tipos + hooks + lógica de permisos

**Objetivo:** Crear los tipos TypeScript, hooks de React, y la lógica para
leer permisos desde BD y verificar acciones.

### Archivos afectados
- `src/types/index.ts` (tipos de permisos)
- `src/lib/auth/roles.ts` (nuevas funciones + compatibilidad)
- `src/hooks/use-role-permissions.ts` (nuevo)
- `src/hooks/use-can.ts` (actualizar)
- `src/hooks/use-auth.tsx` (agregar rolePermissions)
- `src/lib/supabase/server.ts` (query de roles en server-side)

### Detalles
1. Tipos:
   ```typescript
   type PermissionModule = 'dashboard' | 'inbox' | 'contacts' | 'pipelines' |
     'broadcasts' | 'automations' | 'flows' | 'agent_performance' | 'settings';
   
   type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'send' |
     'import' | 'move_deals' | 'whatsapp' | 'templates' | 'fields_tags' |
     'deals_currency' | 'members' | 'ai' | 'api_keys' | 'roles';
   
   interface RolePermissions {
     [module: string]: { [action: string]: boolean };
   }
   
   interface Role {
     id: string;
     account_id: string;
     name: string;
     rank: number;
     is_system: boolean;
     permissions: RolePermissions;
   }
   ```

2. Funciones en `roles.ts`:
   - `canDo(role, module, action)` → boolean (lee de permissions)
   - `getModules(role)` → string[] (módulos disponibles)
   - Mantener `canManageMembers`, `canEditSettings`, etc. como wrappers
     que consultan BD con fallback a hardcodeado

3. Hook `useRolePermissions()`:
   - Fetch `roles` desde BD para el `account_id` del usuario
   - Retorna `Role[]` y `userRole: Role | null`
   - Cache en contexto para evitar re-fetchs

4. Actualizar `useCan()`:
   - Agregar acciones granulares: `"create-contact"`, `"edit-deal"`, etc.
   - Cada acción se mapea a `(module, action)` y se verifica contra BD
   - Fallback a hardcodeado si no hay roles configurados

5. Server-side:
   - Helper `getRolePermissions(supabase, accountId, role)` para API routes

### Criterio de aceptación
- `pnpm typecheck` pasa
- Tests unitarios para `canDo()` y `getModules()`
- `useRolePermissions()` retorna roles de BD
- `useCan()` funciona con nuevas acciones
- Fallback a hardcodeado funciona cuando no hay roles en BD

---

## Fase 3: Sidebar dinámico

**Objetivo:** El sidebar oculta items según los permisos del rol del usuario.

### Archivos afectados
- `src/components/layout/sidebar.tsx`

### Detalles
1. Importar `useRolePermissions()` en el sidebar
2. Definir mapeo `navItem → permissionKey`:
   ```typescript
   const NAV_PERMISSIONS: Record<string, { module: string; action: string }> = {
     '/dashboard': { module: 'dashboard', action: 'view' },
     '/inbox': { module: 'inbox', action: 'view' },
     '/notifications': { module: 'dashboard', action: 'view' },
     '/contacts': { module: 'contacts', action: 'view' },
     '/pipelines': { module: 'pipelines', action: 'view' },
     '/broadcasts': { module: 'broadcasts', action: 'view' },
     '/automations': { module: 'automations', action: 'view' },
     '/flows': { module: 'flows', action: 'view' },
     '/dashboard/agent-performance': { module: 'agent_performance', action: 'view' },
   };
   ```
3. Filtrar `navItems` usando `canDo(userRole, module, action)`
4. Mantener comportamiento actual para owner (siempre ve todo)
5. Redirigir a `/dashboard` si el usuario navega a una ruta oculta

### Criterio de aceptación
- `pnpm typecheck` pasa
- Viewer solo ve items con `view: true`
- Agente ve módulos operacionales
- Admin ve todo excepto lo que el owner haya deshabilitado
- Owner siempre ve todo
- Si un item oculto está en la URL, redirige a dashboard

---

## Fase 4: Settings → sección "Roles"

**Objetivo:** Crear la UI para que el owner gestione roles y permisos.

### Archivos afectados
- `src/components/settings/settings-sections.ts` (nueva sección)
- `src/components/settings/roles-settings.tsx` (nuevo componente)
- `src/components/settings/settings-rail.tsx` (agregar item)
- `src/components/settings/settings-page.tsx` (agregar case)
- `src/app/api/account/roles/route.ts` (nuevo API route)
- `src/app/api/account/roles/[id]/route.ts` (nuevo API route)
- `messages/es.json` (i18n)
- `messages/en.json` (i18n)

### Detalles
1. Sección "Roles" en el rail:
   - Solo visible para owner (`<RequireRole min="owner">`)
   - Grupo "workspace", icono `Shield`
   - Position: después de "Team Members"

2. API Routes:
   - `GET /api/account/roles` → listar roles de la cuenta
   - `POST /api/account/roles` → crear rol
   - `PUT /api/account/roles/[id]` → actualizar rol
   - `DELETE /api/account/roles/[id]` → eliminar rol (si no es system)
   - Todas verifican `owner` role server-side

3. UI `RolesSettings`:
   - Lista de roles con badge de rank
   - Botón "Crear rol" → dialog con nombre + rank
   - Cada rol expandible → tree de permisos:
     ```
     ☑ Dashboard
       ☑ Ver
     ☑ Bandeja (Inbox)
       ☑ Ver
       ☑ Enviar mensajes
       ☑ Leer mensajes
     ☑ Contactos
       ☑ Ver
       ☑ Crear
       ☑ Editar
       ☑ Eliminar
       ☑ Importar
     ☑ Pipelines
       ☑ Ver
       ☑ Editar deals
       ☑ Mover deals
     ☑ Broadcasts
       ☑ Ver
       ☑ Crear
       ☑ Enviar
     ☑ Automations
       ☑ Ver
       ☑ Crear
       ☑ Editar
     ☑ Flows
       ☑ Ver
       ☑ Crear
       ☑ Editar
     ☑ Rendimiento de agentes
       ☑ Ver
     ☑ Configuración
       ☑ WhatsApp
       ☑ Plantillas
       ☑ Campos y etiquetas
       ☑ Deals y moneda
       ☑ Miembros del equipo
       ☑ Asistente IA
       ☑ API Keys
       ☑ Roles
     ```
   - Roles system (owner/admin/agent/viewer) tienen rank fijo, solo se editan permisos
   - Roles custom se pueden borrar
   - Guardar cambios → PUT a API

4. i18n:
   - Agregar claves en `es.json` y `en.json` para:
     - `settings.roles`, `settings.createRole`, `settings.roleName`, etc.
     - Nombres de permisos: `permissions.dashboard`, `permissions.inbox.view`, etc.

### Criterio de aceptación
- `pnpm typecheck` pasa
- `pnpm lint` pasa
- Owner ve la sección "Roles"
- Admin/Agent/Viewer NO ven la sección
- CRUD de roles funciona (crear, editar permisos, eliminar)
- Roles system no se pueden eliminar
- Permisos se guardan correctamente en BD
- UI muestra tree de permisos con checkboxes

---

## Fase 5: Settings rail filtrado + Protección de rutas

**Objetivo:** El rail de settings se filtra por permisos y las rutas API
verifican permisos granulares.

### Archivos afectados
- `src/components/settings/settings-rail.tsx` (filtrar por permisos)
- `src/components/settings/settings-page.tsx` (redirigir si sección oculta)
- `src/app/api/account/members/route.ts` (verificar permiso `settings.members`)
- `src/app/api/contacts/route.ts` (verificar permiso `contacts.create`)
- `src/app/api/deals/route.ts` (verificar permiso `pipelines.edit`)
- etc.

### Detalles
1. Settings rail:
   - Importar `useRolePermissions()`
   - Definir mapeo `section → permissionKey`:
     ```typescript
     const SECTION_PERMISSIONS: Record<string, { module: string; action: string }> = {
       whatsapp: { module: 'settings', action: 'whatsapp' },
       templates: { module: 'settings', action: 'templates' },
       fields: { module: 'settings', action: 'fields_tags' },
       deals: { module: 'settings', action: 'deals_currency' },
       members: { module: 'settings', action: 'members' },
       ai: { module: 'settings', action: 'ai' },
       api: { module: 'settings', action: 'api_keys' },
       // profile, security, appearance → siempre visibles
     };
     ```
   - Filtrar items del rail según permisos
   - Overview y secciones de cuenta siempre visibles

2. Protección de rutas:
   - Agregar helper `requirePermission(supabase, module, action)` en API routes
   - Verificar permiso antes de ejecutar operación
   - Retornar 403 si no tiene permiso

3. Redirección:
   - Si usuario navega a `?tab=roles` y no es owner → redirigir a overview
   - Si usuario navega a `?tab=whatsapp` y no tiene permiso → redirigir a overview

### Criterio de aceptación
- `pnpm typecheck` pasa
- `pnpm lint` pasa
- Settings rail oculta secciones sin permiso
- API routes retornan 403 para permisos denegados
- Redirección funciona al navegar a sección oculta

---

## Fase 6: Tests + Revisión exhaustiva

**Objetivo:** Tests completos y revisión línea por línea.

### Archivos afectados
- `src/lib/auth/roles.test.ts` (actualizar)
- `src/hooks/use-role-permissions.test.ts` (nuevo)
- `src/components/settings/roles-settings.test.tsx` (nuevo)
- `src/app/api/account/roles/route.test.ts` (nuevo)

### Detalles
1. Tests unitarios:
   - `canDo()` con diferentes roles y permisos
   - `getModules()` retorna módulos correctos
   - Fallback a hardcodeado cuando no hay roles
   - Seed de roles por defecto

2. Tests de integración:
   - API routes verifican permisos
   - CRUD de roles funciona
   - RLS previene acceso no autorizado

3. Tests de UI:
   - Sidebar oculta items según permisos
   - Settings rail filtra secciones
   - RolesSettings muestra tree de permisos

4. Revisión exhaustiva:
   - Verificar que no hay `any` types
   - Verificar que no hay secrets en código
   - Verificar que RLS está correcto
   - Verificar que el fallback funciona
   - Verificar que owner siempre tiene acceso total
   - Verificar que roles system no se borran

### Criterio de aceptación
- `pnpm test` pasa (todos los tests)
- `pnpm typecheck` pasa
- `pnpm lint` pasa
- No hay regresiones en funcionalidad existente
- Documentación actualizada

---

## Resumen de fases

| Fase | Descripción | Dependencias |
|------|-------------|--------------|
| 1 | Migración BD + Seed | Ninguna |
| 2 | Tipos + hooks + lógica | Fase 1 |
| 3 | Sidebar dinámico | Fase 2 |
| 4 | Settings → Roles UI | Fase 2 |
| 5 | Settings rail + API protection | Fases 3, 4 |
| 6 | Tests + Revisión | Todas |

---

## Notas importantes

1. **Fallback**: Si una cuenta no tiene roles en BD, se usan los
   hardcodeados actuales. Esto garantiza backward compatibility.

2. **Owner siempre tiene todo**: El owner ignora los permisos configurados
   y siempre tiene acceso completo.

3. **Roles system**: owner, admin, agent, viewer son roles built-in que
   no se pueden eliminar. Solo se pueden editar sus permisos.

4. **Multitenant**: Cada cuenta tiene sus propios roles. Los permisos
   son independientes por cuenta.

5. **Performance**: Los permisos se cachean en el contexto de auth.
   Solo se re-fetchan cuando el usuario cambia de cuenta o refresca.
