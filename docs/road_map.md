# Roadmap: Agent Performance Analytics

> **Objetivo:** Guía paso a paso para que cualquier agente de IA implemente
> una página de analíticas de rendimiento de agentes en el portal NEXIA-CRM.
>
> **Huella:** 3 archivos nuevos + 3 ediciones menores. Cero migraciones SQL.
> Cero API Routes. Cero componentes nuevos (se reutilizan los existentes).
>
> **Progreso:** ✅ Fase 1 (types.ts) · ✅ Fase 2 (queries.ts) · ✅ Fase 3 (página) · ✅ Fase 4 (sidebar) · ✅ Fase 5 (i18n)

---

## 0. Resumen Ejecutivo

### Qué se construye

Una nueva página en `/dashboard/agent-performance` visible solo para
`admin` y `owner`, que muestra:

1. **KPIs globales** del equipo (conversaciones, mensajes, deals ganados)
2. **Workload por agente** (conversaciones activas — bar chart)
3. **Tiempo de respuesta por agente** (bar chart)
4. **Deals won/lost por agente** (bar chart)
5. **Ranking tabular** con todos los KPIs por agente (tabla sorteable)
6. **Flows con mayor tasa de handoff** (insight para mejorar guiones)

### Principio rector: "lo menos posible"

| Regla | Aplicación |
|-------|-----------|
| Seguir patrones existentes | Las queries son **client-side** como `dashboard/queries.ts` — NO usar RPCs SQL |
| Reutilizar componentes | `MetricCard`, `BarChart` Tremor, `Table` shadcn — NO crear componentes nuevos |
| Cero migraciones | Todos los datos ya existen en las 34 tablas — solo es cuestión de agregarlos |
| Cero API Routes | El dashboard actual no usa API Routes para sus queries — usar Supabase client directo |

### Archivos a tocar

| # | Acción | Ruta | Líneas estimadas | Estado |
|---|--------|------|------------------|--------|
| 1 | **CREAR** | `src/lib/agent-analytics/types.ts` | ~70 | ✅ Fase 1 |
| 2 | **CREAR** | `src/lib/agent-analytics/queries.ts` | ~250 | ✅ Fase 2 |
| 3 | **CREAR** | `src/app/(dashboard)/dashboard/agent-performance/page.tsx` | ~350 | ✅ Fase 3 |
| 4 | **EDITAR** | `src/components/layout/sidebar.tsx` | +5 líneas | ✅ Fase 4 |
| 5 | **EDITAR** | `messages/es.json` | +15 keys | ✅ Fase 5 |
| 6 | **EDITAR** | `messages/en.json` | +15 keys | ✅ Fase 5 |

---

## 1. Contexto Crítico — Leer Antes de Empezar

### 1.1 Patrón de queries client-side

El archivo `src/lib/dashboard/queries.ts` es el **modelo a seguir
exactamente**. Cada función:

```typescript
export async function loadXxx(db: DB, ...params): Promise<SomeType> {
  const { data, error } = await db
    .from('tabla')
    .select('columnas')
    // RLS filtra por account_id automáticamente — NUNCA poner .eq('account_id', ...)
  if (error) throw error
  // Agregar en JavaScript con Maps/arrays
  return resultado
}
```

**NUNCA** filtres por `account_id` en las queries — RLS lo hace
automáticamente. Solo filtra por `assigned_agent_id IS NOT NULL`, rangos
de fecha, etc.

### 1.2 Distinción CRÍTICA de IDs

Este es el detalle más importante de toda la implementación. Hay DOS
IDs diferentes en `profiles`:

```
profiles.id      → UUID del row del perfil (ej: a1b2c3d4-...)
profiles.user_id → UUID de auth.users (ej: e5f6g7h8-...)
```

Y se usan en columnas distintas:

| Columna | Referencia a | Equivale a |
|---------|-------------|------------|
| `conversations.assigned_agent_id` | `auth.users.id` | `profiles.user_id` |
| `messages.sender_id` | `auth.users.id` | `profiles.user_id` |
| `deals.assigned_to` | `profiles.id` | `profiles.id` (¡distinto!) |

**Por eso** al consultar profiles hay que traer AMBOS campos (`id` y
`user_id`) y construir dos maps:

```typescript
const userIdMap = new Map<string, AgentInfo>()      // user_id → info
const profileIdMap = new Map<string, string>()      // profile.id → user_id
```

### 1.3 Patrón de la página dashboard

El archivo `src/app/(dashboard)/dashboard/page.tsx` es el **modelo a
seguir**. Estructura:

```
"use client"
imports...
export default function Page() {
  const t = useTranslations('namespace')
  const { ... } = useAuth()
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)

  const loadAll = useCallback(() => {
    const db = createClient()
    void loadXxx(db)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  return (<JSX con loading skeleton → empty state → data>)
}
```

### 1.4 Hook useAuth — qué provee

```typescript
const {
  profile,        // { id, user_id, full_name, account_role, ... }
  accountRole,    // 'owner' | 'admin' | 'agent' | 'viewer' | null
  isAdmin,        // boolean
  isOwner,        // boolean
  defaultCurrency // 'USD' | 'COP' | ...
} = useAuth()
```

Usar `isAdmin || isOwner` para el role gate de la página.

---

## 2. Fase 1 — Tipos (`src/lib/agent-analytics/types.ts`) ✅

### Instrucciones

Crear el archivo `src/lib/agent-analytics/types.ts` con el siguiente
contenido **completo**. Este archivo define todas las estructuras de
datos que las queries retornan y la página consume.

### Código

```typescript
// Tipos para las analíticas de rendimiento de agentes.
// Sigue el mismo patrón que src/lib/dashboard/types.ts.

/** Info básica de un agente para mostrar en charts y tablas. */
export interface AgentInfo {
  userId: string
  profileId: string
  fullName: string
  avatarUrl: string | null
  role: string
}

/** Métricas de conversaciones por agente. */
export interface AgentConversationStats {
  agentId: string
  totalAssigned: number
  activeNow: number
  closed: number
  resolutionRate: number // 0-1
}

/** Métricas de mensajes por agente. */
export interface AgentMessageStats {
  agentId: string
  messagesSent: number
}

/** Tiempo de respuesta por agente (en minutos). */
export interface AgentResponseTime {
  agentId: string
  avgMinutes: number | null
  sampleCount: number
}

/** Métricas de deals por agente. */
export interface AgentDealStats {
  agentId: string
  dealsOpen: number
  dealsWon: number
  dealsLost: number
  totalValueWon: number
}

/** Una fila combinada para la tabla de ranking. */
export interface AgentPerformanceRow {
  agent: AgentInfo
  conversations: AgentConversationStats | null
  messages: AgentMessageStats | null
  responseTime: AgentResponseTime | null
  deals: AgentDealStats | null
}

/** Set completo de datos que la página consume. */
export interface AgentPerformanceData {
  agents: AgentInfo[]
  rows: AgentPerformanceRow[]
  totals: {
    totalConversations: number
    totalMessages: number
    totalDealsWon: number
    totalValueWon: number
    avgResponseMinutes: number | null
  }
}

/** Estadística de handoff por flow (para insights). */
export interface FlowHandoffStat {
  flowId: string
  flowName: string
  totalRuns: number
  handoffRuns: number
  handoffRate: number // 0-1
}

/** Datos para el bar chart de workload. */
export interface AgentChartData {
  name: string
  [key: string]: string | number
}
```

---

## 3. Fase 2 — Queries (`src/lib/agent-analytics/queries.ts`) ✅

### Instrucciones

Crear el archivo `src/lib/agent-analytics/queries.ts`. Este archivo
contiene **todas** las funciones de consulta. Sigue el patrón exacto de
`src/lib/dashboard/queries.ts`: cada función recibe `db: SupabaseClient`,
usa RLS, y agrega en JavaScript.

### 3.0 Imports y tipo DB

```typescript
import type { SupabaseClient } from "@supabase/supabase-js";
import { daysAgoStart } from "@/lib/dashboard/date-utils";
import type {
  AgentChartData,
  AgentDealStats,
  AgentInfo,
  AgentConversationStats,
  AgentMessageStats,
  AgentPerformanceData,
  AgentPerformanceRow,
  AgentResponseTime,
  FlowHandoffStat,
} from "./types";

type DB = SupabaseClient;
```

### 3.1 loadAgentRoster — lista de agentes

```typescript
/**
 * Obtiene la lista de miembros de la cuenta que son agentes, admins
 * u owners (excluye viewers — no atienden conversaciones).
 * RLS filtra por account_id automáticamente.
 */
export async function loadAgentRoster(db: DB): Promise<{
  agents: AgentInfo[];
  userIdMap: Map<string, AgentInfo>;
  profileIdMap: Map<string, string>;
}> {
  const { data, error } = await db
    .from("profiles")
    .select("id, user_id, full_name, avatar_url, account_role")
    .in("account_role", ["owner", "admin", "agent"])
    .order("full_name", { ascending: true });

  if (error) throw error;

  const agents: AgentInfo[] = (data ?? []).map((p) => ({
    userId: p.user_id,
    profileId: p.id,
    fullName: p.full_name || "Agente",
    avatarUrl: p.avatar_url,
    role: p.account_role,
  }));

  const userIdMap = new Map<string, AgentInfo>();
  const profileIdMap = new Map<string, string>();
  for (const a of agents) {
    userIdMap.set(a.userId, a);
    profileIdMap.set(a.profileId, a.userId);
  }

  return { agents, userIdMap, profileIdMap };
}
```

### 3.2 loadAgentConversationStats

```typescript
/**
 * Cuenta conversaciones por agente (asignado). Incluye todas las
 * conversaciones históricas (sin filtro de fecha) para que la carga
 * actual y la resolución rate sean precisas.
 */
export async function loadAgentConversationStats(
  db: DB,
): Promise<Map<string, AgentConversationStats>> {
  const { data, error } = await db
    .from("conversations")
    .select("assigned_agent_id, status")
    .not("assigned_agent_id", "is", null);

  if (error) throw error;

  const map = new Map<string, AgentConversationStats>();

  for (const row of data ?? []) {
    const agentId = row.assigned_agent_id as string;
    if (!map.has(agentId)) {
      map.set(agentId, {
        agentId,
        totalAssigned: 0,
        activeNow: 0,
        closed: 0,
        resolutionRate: 0,
      });
    }
    const s = map.get(agentId)!;
    s.totalAssigned++;
    if (row.status === "open") s.activeNow++;
    if (row.status === "closed") s.closed++;
  }

  for (const s of map.values()) {
    s.resolutionRate =
      s.totalAssigned > 0 ? s.closed / s.totalAssigned : 0;
  }

  return map;
}
```

### 3.3 loadAgentMessageStats

```typescript
/**
 * Cuenta mensajes enviados por cada agente en un período.
 * Solo cuenta sender_type = 'agent' (excluye 'customer' y 'bot').
 */
export async function loadAgentMessageStats(
  db: DB,
  fromDate: string,
): Promise<Map<string, AgentMessageStats>> {
  const { data, error } = await db
    .from("messages")
    .select("sender_id")
    .eq("sender_type", "agent")
    .gte("created_at", fromDate);

  if (error) throw error;

  const map = new Map<string, AgentMessageStats>();

  for (const row of data ?? []) {
    if (!row.sender_id) continue;
    const agentId = row.sender_id as string;
    if (!map.has(agentId)) {
      map.set(agentId, { agentId, messagesSent: 0 });
    }
    map.get(agentId)!.messagesSent++;
  }

  return map;
}
```

### 3.4 loadAgentResponseTimes — adaptación de loadResponseTime

**Esta es la función más compleja.** Adapta la lógica existente en
`src/lib/dashboard/queries.ts` (función `loadResponseTime`, líneas
172-264) para agrupar por agente en vez de por día de la semana.

**Cambios clave respecto al original:**
1. Agregar `sender_id` al `select`
2. Solo contar respuestas de `sender_type === 'agent'` (NO `'bot'`)
3. Capturar `sender_id` en cada sample
4. Agrupar samples por `sender_id` en vez de por día de la semana

```typescript
/**
 * Calcula el tiempo de primera respuesta por agente.
 *
 * Adaptación de loadResponseTime (dashboard/queries.ts):
 *   - Agrega sender_id al select
 *   - Solo cuenta respuestas humanas (sender_type = 'agent', NO 'bot')
 *   - Agrupa samples por sender_id en vez de por día de la semana
 */
export async function loadAgentResponseTimes(
  db: DB,
  fromDate: string,
): Promise<Map<string, AgentResponseTime>> {
  const { data, error } = await db
    .from("messages")
    .select("conversation_id, sender_type, sender_id, created_at")
    .gte("created_at", fromDate)
    .order("conversation_id", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as {
    conversation_id: string;
    sender_type: string;
    sender_id: string | null;
    created_at: string;
  }[];

  // Pairing: mismo algoritmo que loadResponseTime del dashboard.
  // Por cada conversación, encontrar el primer mensaje del customer
  // y emparejarlo con el primer mensaje del agente que sigue.
  interface Sample {
    agentId: string;
    minutes: number;
  }
  const samples: Sample[] = [];

  let currentConv = "";
  let pendingCustomer: Date | null = null;

  for (const row of rows) {
    if (row.conversation_id !== currentConv) {
      currentConv = row.conversation_id;
      pendingCustomer = null;
    }
    const ts = new Date(row.created_at);

    if (row.sender_type === "customer") {
      if (!pendingCustomer) pendingCustomer = ts;
    } else if (
      row.sender_type === "agent" &&
      row.sender_id &&
      pendingCustomer
    ) {
      // SOLO agent, NO bot — mide respuesta humana.
      const diffMin = (ts.getTime() - pendingCustomer.getTime()) / 60_000;
      if (diffMin >= 0) {
        samples.push({ agentId: row.sender_id, minutes: diffMin });
      }
      pendingCustomer = null;
    }
  }

  // Agrupar por agentId y calcular promedio.
  const byAgent = new Map<string, number[]>();
  for (const s of samples) {
    if (!byAgent.has(s.agentId)) byAgent.set(s.agentId, []);
    byAgent.get(s.agentId)!.push(s.minutes);
  }

  const result = new Map<string, AgentResponseTime>();
  for (const [agentId, mins] of byAgent) {
    const avg =
      mins.length > 0
        ? mins.reduce((a, b) => a + b, 0) / mins.length
        : null;
    result.set(agentId, {
      agentId,
      avgMinutes: avg,
      sampleCount: mins.length,
    });
  }

  return result;
}
```

### 3.5 loadAgentDealStats

```typescript
/**
 * Agrega deals por agente (assigned_to). Nota: deals.assigned_to
 * referencia profiles.id, NO profiles.user_id — usar profileIdMap
 * para convertir al user_id que se usa en el resto de las queries.
 */
export async function loadAgentDealStats(
  db: DB,
): Promise<Map<string, AgentDealStats>> {
  // Mapa: profile.id → stats. Se convierte a user_id en loadAgentPerformance.
  const { data, error } = await db
    .from("deals")
    .select("assigned_to, status, value")
    .not("assigned_to", "is", null);

  if (error) throw error;

  const map = new Map<string, AgentDealStats>();

  for (const row of data ?? []) {
    const profileId = row.assigned_to as string;
    if (!map.has(profileId)) {
      map.set(profileId, {
        agentId: profileId,
        dealsOpen: 0,
        dealsWon: 0,
        dealsLost: 0,
        totalValueWon: 0,
      });
    }
    const s = map.get(profileId)!;
    if (row.status === "open") s.dealsOpen++;
    if (row.status === "won") {
      s.dealsWon++;
      s.totalValueWon += Number(row.value) || 0;
    }
    if (row.status === "lost") s.dealsLost++;
  }

  return map;
}
```

### 3.6 loadFlowHandoffStats — insights para mejorar guiones

```typescript
/**
 * Calcula la tasa de handoff por flow. Los flows con alta tasa de
 * handoff son candidatos a revisión — indican que el guión no está
 * resolviendo la necesidad del cliente y requiere intervención humana.
 */
export async function loadFlowHandoffStats(
  db: DB,
): Promise<FlowHandoffStat[]> {
  // Traer nombres de flows.
  const { data: flows, error: flowsErr } = await db
    .from("flows")
    .select("id, name")
    .order("name", { ascending: true });
  if (flowsErr) throw flowsErr;

  // Traer conteo de runs por flow y status.
  const { data: runs, error: runsErr } = await db
    .from("flow_runs")
    .select("flow_id, status");
  if (runsErr) throw runsErr;

  const flowNames = new Map<string, string>();
  for (const f of flows ?? []) flowNames.set(f.id, f.name);

  // Agregar por flow_id.
  const stats = new Map<
    string,
    { total: number; handoff: number }
  >();

  for (const r of runs ?? []) {
    if (!stats.has(r.flow_id)) {
      stats.set(r.flow_id, { total: 0, handoff: 0 });
    }
    const s = stats.get(r.flow_id)!;
    s.total++;
    if (r.status === "handed_off") s.handoff++;
  }

  const result: FlowHandoffStat[] = [];
  for (const [flowId, s] of stats) {
    result.push({
      flowId,
      flowName: flowNames.get(flowId) ?? "Flow sin nombre",
      totalRuns: s.total,
      handoffRuns: s.handoff,
      handoffRate: s.total > 0 ? s.handoff / s.total : 0,
    });
  }

  // Ordenar por tasa de handoff descendente (los peores primero).
  result.sort((a, b) => b.handoffRate - a.handoffRate);

  return result;
}
```

### 3.7 loadAgentPerformance — función agregadora

```typescript
/**
 * Carga todas las métricas en paralelo y las combina en una sola
 * estructura lista para que la página consuma.
 */
export async function loadAgentPerformance(
  db: DB,
  rangeDays: number,
): Promise<{
  data: AgentPerformanceData;
  flowStats: FlowHandoffStat[];
}> {
  const fromDate = daysAgoStart(rangeDays - 1).toISOString();

  const [
    { agents, userIdMap, profileIdMap },
    convStats,
    msgStats,
    respTimes,
    dealStatsByProfile,
    flowStats,
  ] = await Promise.all([
    loadAgentRoster(db),
    loadAgentConversationStats(db),
    loadAgentMessageStats(db, fromDate),
    loadAgentResponseTimes(db, fromDate),
    loadAgentDealStats(db),
    loadFlowHandoffStats(db),
  ]);

  // Convertir dealStats de profile.id → user_id.
  const dealStats = new Map<string, AgentDealStats>();
  for (const [profileId, stats] of dealStatsByProfile) {
    const userId = profileIdMap.get(profileId);
    if (userId) {
      dealStats.set(userId, { ...stats, agentId: userId });
    }
  }

  // Construir filas combinadas.
  const rows: AgentPerformanceRow[] = agents.map((agent) => ({
    agent,
    conversations: convStats.get(agent.userId) ?? null,
    messages: msgStats.get(agent.userId) ?? null,
    responseTime: respTimes.get(agent.userId) ?? null,
    deals: dealStats.get(agent.userId) ?? null,
  }));

  // Totales globales.
  const allRespTimes = Array.from(respTimes.values());
  const totalSamples = allRespTimes.reduce(
    (sum, r) => sum + r.sampleCount,
    0,
  );
  const weightedRespSum = allRespTimes.reduce(
    (sum, r) => sum + (r.avgMinutes ?? 0) * r.sampleCount,
    0,
  );

  const totals = {
    totalConversations: rows.reduce(
      (s, r) => s + (r.conversations?.totalAssigned ?? 0),
      0,
    ),
    totalMessages: rows.reduce(
      (s, r) => s + (r.messages?.messagesSent ?? 0),
      0,
    ),
    totalDealsWon: rows.reduce(
      (s, r) => s + (r.deals?.dealsWon ?? 0),
      0,
    ),
    totalValueWon: rows.reduce(
      (s, r) => s + (r.deals?.totalValueWon ?? 0),
      0,
    ),
    avgResponseMinutes:
      totalSamples > 0 ? weightedRespSum / totalSamples : null,
  };

  return {
    data: { agents, rows, totals },
    flowStats,
  };
}
```

---

## 4. Fase 3 — Página (`src/app/(dashboard)/dashboard/agent-performance/page.tsx`)

### Instrucciones

Crear el archivo de página. Es un **client component** que sigue el
patrón de `src/app/(dashboard)/dashboard/page.tsx`.

### 4.1 Estructura general

```
"use client"

imports (React, next-intl, useAuth, queries, types, componentes UI)

export default function AgentPerformancePage() {
  // 1. Hooks: useTranslations, useAuth
  // 2. State: data, loading, rangeDays, flowStats, error
  // 3. useCallback: loadAll (crea db client, llama loadAgentPerformance)
  // 4. useEffect: disparar loadAll al montar y al cambiar rangeDays
  // 5. Role gate: si !isAdmin && !isOwner → mostrar acceso denegado
  // 6. Render: skeleton → error → empty → data con charts
}
```

### 4.2 Código de la página

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTranslations } from "next-intl";
import { formatCurrency } from "@/lib/currency";
import {
  MessageSquare,
  Timer,
  Trophy,
  DollarSign,
  TrendingUp,
  AlertCircle,
} from "lucide-react";

import { loadAgentPerformance } from "@/lib/agent-analytics/queries";
import type {
  AgentPerformanceData,
  FlowHandoffStat,
} from "@/lib/agent-analytics/types";

import { BarChart } from "@/components/tremor/bar-chart";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/dashboard/skeleton";
import { EmptyState } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

type RangeDays = 7 | 30 | 90;

export default function AgentPerformancePage() {
  const t = useTranslations("agentPerformance");
  const { isAdmin, isOwner, defaultCurrency } = useAuth();

  const [data, setData] = useState<AgentPerformanceData | null>(null);
  const [flowStats, setFlowStats] = useState<FlowHandoffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<RangeDays>(30);

  const loadAll = useCallback(
    (rangeDays: RangeDays) => {
      setLoading(true);
      setError(false);
      const db = createClient();
      void loadAgentPerformance(db, rangeDays)
        .then((result) => {
          setData(result.data);
          setFlowStats(result.flowStats);
        })
        .catch((err) => {
          console.error("[agent-performance] load failed:", err);
          setError(true);
        })
        .finally(() => setLoading(false));
    },
    [],
  );

  useEffect(() => {
    loadAll(range);
  }, [range, loadAll]);

  // --- Role gate ---
  if (!isAdmin && !isOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title={t("accessDenied")}
          hint={t("accessDeniedHint")}
        />
      </div>
    );
  }

  // --- Formatters ---
  const fmtMinutes = (mins: number | null | undefined): string => {
    if (mins == null) return "—";
    if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`;
    if (mins < 60) return `${mins.toFixed(1)}m`;
    return `${(mins / 60).toFixed(1)}h`;
  };

  const fmtPercent = (rate: number | undefined): string => {
    if (rate == null) return "—";
    return `${(rate * 100).toFixed(0)}%`;
  };

  // --- Chart data transforms ---
  const workloadChartData =
    data?.rows.map((r) => ({
      name: r.agent.fullName,
      Conversaciones: r.conversations?.activeNow ?? 0,
    })) ?? [];

  const responseTimeChartData =
    data?.rows
      .filter((r) => r.responseTime?.avgMinutes != null)
      .map((r) => ({
        name: r.agent.fullName,
        "Min promedio": r.responseTime?.avgMinutes ?? 0,
      })) ?? [];

  const dealsChartData =
    data?.rows
      .filter((r) => r.deals && (r.deals.dealsWon > 0 || r.deals.dealsLost > 0))
      .map((r) => ({
        name: r.agent.fullName,
        Ganados: r.deals?.dealsWon ?? 0,
        Perdidos: r.deals?.dealsLost ?? 0,
      })) ?? [];

  const hasAnyData =
    data != null && data.rows.some(
      (r) =>
        r.conversations != null ||
        r.messages != null ||
        r.deals != null,
    );

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        {/* Range selector */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          {([7, 30, 90] as RangeDays[]).map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                range === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : error ? (
        <EmptyState
          icon={AlertCircle}
          title={t("errorTitle")}
          hint={t("errorHint")}
        />
      ) : !data || !hasAnyData ? (
        <EmptyState
          icon={TrendingUp}
          title={t("noData")}
          hint={t("noDataHint")}
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={MessageSquare}
              label={t("totalConversations")}
              value={String(data.totals.totalConversations)}
            />
            <KpiCard
              icon={MessageSquare}
              label={t("totalMessages")}
              value={String(data.totals.totalMessages)}
            />
            <KpiCard
              icon={Trophy}
              label={t("totalDealsWon")}
              value={String(data.totals.totalDealsWon)}
            />
            <KpiCard
              icon={DollarSign}
              label={t("totalValueWon")}
              value={formatCurrency(
                data.totals.totalValueWon,
                defaultCurrency,
              )}
            />
          </div>

          {/* Workload chart */}
          <ChartCard
            title={t("workloadTitle")}
            subtitle={t("workloadSubtitle")}
          >
            {workloadChartData.length > 0 ? (
              <BarChart
                data={workloadChartData}
                index="name"
                categories={["Conversaciones"]}
                colors={["blue"]}
                showLegend={false}
                yAxisWidth={48}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={MessageSquare}
                title={t("noWorkload")}
                hint={t("noWorkloadHint")}
              />
            )}
          </ChartCard>

          {/* Response time chart */}
          <ChartCard
            title={t("responseTimeTitle")}
            subtitle={t("responseTimeSubtitle")}
          >
            {responseTimeChartData.length > 0 ? (
              <BarChart
                data={responseTimeChartData}
                index="name"
                categories={["Min promedio"]}
                colors={["violet"]}
                showLegend={false}
                yAxisWidth={48}
                valueFormatter={(v) => fmtMinutes(v as number)}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={Timer}
                title={t("noResponseTime")}
                hint={t("noResponseTimeHint")}
              />
            )}
          </ChartCard>

          {/* Deals chart */}
          <ChartCard
            title={t("dealsTitle")}
            subtitle={t("dealsSubtitle")}
          >
            {dealsChartData.length > 0 ? (
              <BarChart
                data={dealsChartData}
                index="name"
                categories={["Ganados", "Perdidos"]}
                colors={["emerald", "rose"]}
                showLegend={true}
                yAxisWidth={48}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={Trophy}
                title={t("noDeals")}
                hint={t("noDealsHint")}
              />
            )}
          </ChartCard>

          {/* Ranking table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">
                {t("rankingTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("colAgent")}</TableHead>
                    <TableHead className="text-right">
                      {t("colConversations")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colMessages")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colResponseTime")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colResolution")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colDealsWon")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("colValueWon")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((row) => (
                    <TableRow key={row.agent.userId}>
                      <TableCell className="font-medium">
                        {row.agent.fullName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.conversations?.totalAssigned ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.messages?.messagesSent ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtMinutes(row.responseTime?.avgMinutes)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPercent(row.conversations?.resolutionRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deals?.dealsWon ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          row.deals?.totalValueWon ?? 0,
                          defaultCurrency,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Flow handoff insights */}
          {flowStats.length > 0 && (
            <ChartCard
              title={t("handoffTitle")}
              subtitle={t("handoffSubtitle")}
            >
              <BarChart
                data={flowStats.slice(0, 10).map((f) => ({
                  name: f.flowName,
                  "% Handoff": Math.round(f.handoffRate * 100),
                }))}
                index="name"
                categories={["% Handoff"]}
                colors={["amber"]}
                showLegend={false}
                yAxisWidth={48}
                valueFormatter={(v) => `${v}%`}
                className="h-[260px]"
              />
            </ChartCard>
          )}
        </>
      )}
    </div>
  );
}

// --- Helper components (inline, no crear archivos nuevos) ---

function KpiCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MessageSquare;
  label: string;
  value: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
```

### 4.3 Notas sobre imports de UI

Los componentes `Card`, `CardHeader`, `CardTitle`, `CardContent` y
`Table*` ya existen en el proyecto bajo `@/components/ui/`. Verificar
que los imports sean correctos — si algún componente no existe, usar
`div` con clases de Tailwind en su lugar.

**Verificar existencia:**

```bash
# Ejecutar para confirmar que existen:
ls src/components/ui/card.tsx
ls src/components/ui/table.tsx
```

Si `card.tsx` no existe, reemplazar los `Card` por `<section>` con
clases `rounded-xl border border-border bg-card p-5`.

---

## 5. Fase 4 — Sidebar (editar `src/components/layout/sidebar.tsx`)

### Instrucción

En el archivo `src/components/layout/sidebar.tsx`, línea ~106, el
`useMemo` de `navItems` debe modificarse para incluir el nuevo item de
forma **condicional** (solo admin+).

### 5.1 Agregar import de icono

En el bloque de imports de `lucide-react` (líneas 11-28), agregar
`TrendingUp`:

```diff
 import {
   Bell,
   Crown,
   GitBranch,
   LayoutDashboard,
   LogOut,
   MessageSquare,
   Radio,
   Settings,
   Shield,
   User,
   UserCog,
   Users,
   UsersRound,
   Workflow,
+  TrendingUp,
   X,
   Zap,
 } from "lucide-react";
```

### 5.2 Modificar navItems

Reemplazar el `useMemo` de `navItems` (líneas 106-115):

```diff
   const navItems = useMemo<NavItem[]>(() => [
     { href: "/dashboard", label: t("dashboard"), icon: LayoutDashboard },
     { href: "/inbox", label: t("inbox"), icon: MessageSquare },
     { href: "/notifications", label: t("notifications"), icon: Bell },
     { href: "/contacts", label: t("contacts"), icon: Users },
     { href: "/pipelines", label: t("pipelines"), icon: GitBranch },
     { href: "/broadcasts", label: t("broadcasts"), icon: Radio },
     { href: "/automations", label: t("automations"), icon: Zap },
     { href: "/flows", label: t("flows"), icon: Workflow, beta: true },
-  ], [t]);
+    // Admin-only: Agent Performance Analytics
+    ...(accountRole === "admin" || accountRole === "owner"
+      ? [
+          {
+            href: "/dashboard/agent-performance",
+            label: t("agentPerformance"),
+            icon: TrendingUp,
+          },
+        ]
+      : []),
+  ], [t, accountRole]);
```

**Nota:** `accountRole` ya está disponible en el scope del componente
(línea 102: `const { ..., accountRole, ... } = useAuth()`).

---

## 6. Fase 5 — i18n (`messages/es.json` y `messages/en.json`)

### 6.1 Clave del sidebar

En `messages/es.json`, dentro del namespace `"nav"`:

```json
"agentPerformance": "Rendimiento"
```

En `messages/en.json`, dentro del namespace `"nav"`:

```json
"agentPerformance": "Performance"
```

### 6.2 Claves de la página

En `messages/es.json`, agregar un nuevo namespace `"agentPerformance"`:

```json
"agentPerformance": {
  "title": "Rendimiento de Agentes",
  "subtitle": "Métricas de productividad y efectividad del equipo",
  "accessDenied": "Acceso restringido",
  "accessDeniedHint": "Solo administradores pueden ver esta página",
  "errorTitle": "Error al cargar",
  "errorHint": "Intenta recargar la página",
  "noData": "Sin datos suficientes",
  "noDataHint": "Aún no hay conversaciones ni mensajes asignados a agentes",
  "totalConversations": "Conversaciones totales",
  "totalMessages": "Mensajes enviados",
  "totalDealsWon": "Deals ganados",
  "totalValueWon": "Valor ganado",
  "workloadTitle": "Carga de trabajo actual",
  "workloadSubtitle": "Conversaciones activas por agente",
  "noWorkload": "Sin conversaciones activas",
  "noWorkloadHint": "No hay conversaciones asignadas actualmente",
  "responseTimeTitle": "Tiempo de respuesta",
  "responseTimeSubtitle": "Tiempo promedio de primera respuesta por agente",
  "noResponseTime": "Sin datos de respuesta",
  "noResponseTimeHint": "No hay suficientes mensajes para calcular tiempos",
  "dealsTitle": "Conversión de deals",
  "dealsSubtitle": "Deals ganados y perdidos por agente",
  "noDeals": "Sin deals",
  "noDealsHint": "No hay deals asignados a agentes en el período",
  "rankingTitle": "Ranking de agentes",
  "colAgent": "Agente",
  "colConversations": "Conversaciones",
  "colMessages": "Mensajes",
  "colResponseTime": "Respuesta",
  "colResolution": "Resolución",
  "colDealsWon": "Ganados",
  "colValueWon": "Valor ganado",
  "handoffTitle": "Flujos con mayor handoff",
  "handoffSubtitle": "Los flujos con más handoffs pueden necesitar revisión del guión"
}
```

En `messages/en.json`, agregar el mismo namespace en inglés:

```json
"agentPerformance": {
  "title": "Agent Performance",
  "subtitle": "Team productivity and effectiveness metrics",
  "accessDenied": "Access restricted",
  "accessDeniedHint": "Only administrators can view this page",
  "errorTitle": "Failed to load",
  "errorHint": "Try reloading the page",
  "noData": "Not enough data",
  "noDataHint": "No conversations or messages assigned to agents yet",
  "totalConversations": "Total conversations",
  "totalMessages": "Messages sent",
  "totalDealsWon": "Deals won",
  "totalValueWon": "Value won",
  "workloadTitle": "Current workload",
  "workloadSubtitle": "Active conversations per agent",
  "noWorkload": "No active conversations",
  "noWorkloadHint": "No conversations currently assigned",
  "responseTimeTitle": "Response time",
  "responseTimeSubtitle": "Average first response time per agent",
  "noResponseTime": "No response data",
  "noResponseTimeHint": "Not enough messages to calculate times",
  "dealsTitle": "Deal conversion",
  "dealsSubtitle": "Won and lost deals per agent",
  "noDeals": "No deals",
  "noDealsHint": "No deals assigned to agents in this period",
  "rankingTitle": "Agent ranking",
  "colAgent": "Agent",
  "colConversations": "Conversations",
  "colMessages": "Messages",
  "colResponseTime": "Response",
  "colResolution": "Resolution",
  "colDealsWon": "Won",
  "colValueWon": "Value won",
  "handoffTitle": "Top handoff flows",
  "handoffSubtitle": "Flows with high handoff rates may need script review"
}
```

---

## 7. Fase 6 — Verificación

### 7.1 Comandos a ejecutar

```bash
# Type-check (debe pasar sin errores)
pnpm typecheck

# Lint (debe pasar sin errores)
pnpm lint

# Tests (no debería romper nada existente)
pnpm test

# Dev server para probar manualmente
pnpm dev
```

### 7.2 Checklist de verificación manual

| # | Verificación | Cómo probarlo |
|---|-------------|---------------|
| 1 | La página existe en `/dashboard/agent-performance` | Navegar a la URL |
| 2 | Un `viewer` NO ve el link en el sidebar | Loguearse como viewer |
| 3 | Un `agent` NO ve el link en el sidebar | Loguearse como agent |
| 4 | Un `admin` SÍ ve el link en el sidebar | Loguearse como admin |
| 5 | Un `owner` SÍ ve el link en el sidebar | Loguearse como owner |
| 6 | La página muestra skeletons mientras carga | Abrir la página |
| 7 | Los KPI cards muestran números reales | Después de cargar |
| 8 | Los bar charts renderizan con datos | Después de cargar |
| 9 | La tabla muestra todos los agentes | Después de cargar |
| 10 | El selector 7d/30d/90d recarga los datos | Click en cada botón |
| 11 | La página no crashea sin datos asignados | Crear cuenta nueva vacía |
| 12 | El flow handoff chart aparece si hay flows | Si hay flows con runs |

### 7.3 Problemas comunes y soluciones

| Problema | Causa | Solución |
|----------|-------|----------|
| `Cannot find module '@/components/ui/card'` | No existe `card.tsx` | Reemplazar `Card` por `<section className="rounded-xl border border-border bg-card">` |
| Los agents aparecen sin datos | Conversaciones sin `assigned_agent_id` | Es normal — solo se muestran agents con datos |
| `sender_id` es null en messages | Mensajes antiguos o del webhook | Es normal — el código ya filtra `if (!row.sender_id) continue` |
| El chart de response time está vacío | No hay agents que hayan respondido en el período | Reducir el período o asignar conversaciones |
| Type error en `accountRole` | El tipo puede ser `null` | Usar `accountRole === "admin" \|\| accountRole === "owner"` |

---

## 8. Apéndice A — Patrones de Referencia

### Archivos a leer antes de implementar

| Archivo | Por qué leerlo |
|---------|----------------|
| `src/lib/dashboard/queries.ts` | Patrón de query client-side a replicar |
| `src/lib/dashboard/types.ts` | Patrón de tipos a replicar |
| `src/lib/dashboard/date-utils.ts` | Helpers de fecha a reutilizar |
| `src/app/(dashboard)/dashboard/page.tsx` | Patrón de página a replicar |
| `src/components/dashboard/response-time-chart.tsx` | Patrón de uso de BarChart Tremor |
| `src/components/dashboard/metric-card.tsx` | Componente a reutilizar |
| `src/components/dashboard/empty-state.tsx` | Componente a reutilizar |
| `src/components/dashboard/skeleton.tsx` | Componente a reutilizar |
| `src/hooks/use-auth.tsx` | Hook que provee `isAdmin`, `isOwner`, `defaultCurrency` |
| `src/lib/currency.ts` | `formatCurrency()` para formatear valores |

### Convenciones del proyecto

1. **ESLint:** El proyecto usa ESLint 9 con `eslint-config-next`. No
   usar `any` — siempre tipar explícitamente.
2. **Imports:** Usar `@/` alias (configurado en `tsconfig.json`).
3. **i18n:** Toda string visible al usuario debe ir por
   `useTranslations()`. Español es el default.
4. **Fechas:** Usar `daysAgoStart` de `@/lib/dashboard/date-utils` para
   rangos. La zona horaria es America/Bogotá (UTC-5).
5. **Moneda:** Usar `formatCurrency(value, defaultCurrency)` de
   `@/lib/currency`. El default es COP.
6. **RLS:** NUNCA filtrar por `account_id` manualmente en las queries
   — RLS lo hace automáticamente.
7. **Comentarios:** No agregar comentarios a menos que sea absolutamente
   necesario (regla del proyecto).

---

## 9. Apéndice B — Modelo de Datos Subyacente

### Queries SQL equivalentes (para referencia)

Lo que las queries client-side hacen, expresado como SQL:

```sql
-- Conversations per agent
SELECT assigned_agent_id, status, count(*)
FROM conversations
WHERE assigned_agent_id IS NOT NULL
GROUP BY assigned_agent_id, status;

-- Messages per agent (in date range)
SELECT sender_id, count(*)
FROM messages
WHERE sender_type = 'agent'
  AND created_at >= '[fromDate]'
GROUP BY sender_id;

-- Deals per agent
SELECT assigned_to, status, sum(value)
FROM deals
WHERE assigned_to IS NOT NULL
GROUP BY assigned_to, status;

-- Flow handoff rates
SELECT flow_id, status, count(*)
FROM flow_runs
GROUP BY flow_id, status;
```

### Por qué NO usar RPCs SQL

El patrón establecido en `src/lib/dashboard/queries.ts` es
**client-side aggregation** con un comentario explícito:

> *"if a tenant's dataset outgrows this, migrate the heavy aggregations
> to SQL RPCs""

Para esta feature, seguimos el mismo patrón por consistencia. Si en el
futuro el volumen de mensajes crece significativamente, las funciones
`loadAgentResponseTimes` y `loadAgentMessageStats` son las candidatas
a migrar a RPCs SQL (siguiendo el patrón de `filter_contacts_by_tags`
en la migración `025`).

---

## 10. Resumen Final

| Métrica | Origen DB | Función de Query |
|---------|-----------|-----------------|
| Conversaciones por agente | `conversations.assigned_agent_id` | `loadAgentConversationStats` |
| Mensajes por agente | `messages.sender_id WHERE sender_type='agent'` | `loadAgentMessageStats` |
| Tiempo de respuesta | `messages` pairing customer→agent | `loadAgentResponseTimes` |
| Deals por agente | `deals.assigned_to` (→ profiles.id) | `loadAgentDealStats` |
| Handoff de flows | `flow_runs.status = 'handed_off'` | `loadFlowHandoffStats` |
| Lista de agentes | `profiles WHERE account_role IN (...)` | `loadAgentRoster` |

**Total: 3 archivos nuevos, 3 ediciones, 0 migraciones, 0 API routes.**
