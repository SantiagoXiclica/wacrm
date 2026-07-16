# Mejora de la UI de Rendimiento — Agentes de Inscripción Universitaria

> **Fecha:** 06 de julio de 2026  
> **Objetivo:** Rediseñar la página `/dashboard/agent-performance` para que sea útil para una empresa aliada de universidades que cobra comisiones por inscribir estudiantes.

---

## 1. Investigación — Métricas relevantes para educación

### 1.1 Fuentes consultadas

| Fuente | URL | Resumen |
|--------|-----|---------|
| SmartX CRM Guide 2026 | smartxcrm.com | CRM completo para educación con commission tracking, agent performance, lead scoring |
| LeadSquared Education | leadsquared.com | KPIs de counselors: conversion rate, SLA compliance, pipeline hygiene |
| UniversityHub | universityhub.com | Métricas de consultores: app-to-enrollment, retención, ROI |
| EducationDynamics | educationdynamics.com | Benchmarks 2026: cost per application, cost per enrollment |
| Scale Growth Digital | scalegrowth.digital | 15 métricas de marketing para educación |
| UniCloud360 | unicloud360.com | Dashboard de counsellor targets vs actual con RAG status |
| Prose Media | prosemedia.com | Dashboard template: 8-12 KPIs executive level |
| Monday.com | monday.com | Education agent CRM platforms |
| Higher Education Marketing | higher-education-marketing.com | Métricas de funnel: speed-to-lead, yield rate, melt rate |

### 1.2 Métricas que SÍ son útiles (por categoría)

#### Funnel del estudiante (lead → matrícula)
| Métrica | Descripción | Benchmark |
|---------|-------------|-----------|
| Leads asignados por agente | Prospectos asignados en el período | — |
| Tasa de contacto | % de leads contactados vs asignados | ≥80% |
| Tasa lead → solicitud | % de leads que generan solicitud/aplicación | 15-25% |
| Tasa solicitud → matrícula | % de aplicaciones que resultan en matrícula | 40-60% |
| Tasa lead → matrícula (global) | Conversión total del embudo | 8-15% |
| Tiempo lead → matrícula | Días promedio desde primer contacto hasta inscripción | — |

#### Actividad del agente
| Métrica | Descripción |
|---------|-------------|
| Leads asignados | Prospectos nuevos o reasignados |
| Contactos realizados | Primer contacto registrado (WhatsApp, llamada, etc.) |
| Aplicaciones generadas | Estudiantes que completaron solicitud |
| Matrículas cerradas | Estudiantes efectivamente inscritos |
| Velocidad de respuesta (primer contacto) | Tiempo promedio desde asignación hasta primer mensaje |
| Seguimientos realizados | Follow-ups al mismo lead |

#### Financiero / Comisiones
| Métrica | Descripción |
|---------|-------------|
| Comisiones generadas | Valor monetario total de comisiones por inscripciones |
| Comisiones pagadas | Comisiones efectivamente abonadas al agente |
| Comisiones pendientes | Valor en pipeline de comisiones |
| Valor promedio por matrícula | Comisión promedio (depende del programa/universidad) |
| Ingreso proyectado | Pipeline actual × comisión promedio |

#### Cumplimiento de metas (targets)
| Métrica | Descripción | RAG |
|---------|-------------|-----|
| % de meta alcanzada | Enrollments reales vs target | 🟢 ≥100%, 🟡 ≥75%, 🔴 <75% |
| Ranking por comisiones | Agentes ordenados por valor generado | — |
| Evolución semanal/matriculaciones | Tendencia temporal | — |

#### Distribución
| Métrica | Descripción |
|---------|-------------|
| Matrículas por universidad | Cuántos estudiantes inscritos por universidad aliada |
| Matrículas por programa | Distribución entre programas de la misma universidad |
| Leads por fuente | ¿De dónde vienen los leads de cada agente? |

### 1.3 Métricas que NO son útiles en este contexto

| Métrica actual | Por qué NO sirve |
|----------------|-------------------|
| Conversaciones activas (workload) | Mide volumen de chat, no pipeline de inscripciones |
| Mensajes enviados | Vanity metric; no indica calidad ni conversión |
| Deals ganados/perdidos genérico | No distingue etapas del funnel educativo |
| Handoff de flows | Irrelevante para comerciales de admisiones |
| Resolución de conversaciones | Métrica de soporte, no de ventas de inscripción |

---

## 2. Análisis de la página actual

### 2.1 Lo que tiene hoy

**Archivo:** `src/app/(dashboard)/dashboard/agent-performance/page.tsx` (580 líneas)

| Sección | Tipo | Qué muestra |
|---------|------|-------------|
| KPI Cards (4) | MetricCard | Conversaciones totales, Mensajes enviados, Deals ganados, Valor ganado |
| Carga de trabajo | Bar chart azul | Conversaciones activas por agente |
| Tiempo de respuesta | Bar chart violeta | Min promedio de primera respuesta por agente |
| Conversión de deals | Bar chart emerald+pink | Deals ganados vs perdidos por agente |
| Ranking | Sortable table (7 cols) | Conversaciones, Mensajes, Respuesta, Resolución, Deals, Valor |
| Handoff flows | Bar chart amber | Top 10 flows con mayor tasa de handoff |

**Estado actual del modelo de datos:**

| Tabla necesaria | Existe? | Notas |
|-----------------|---------|-------|
| `universities` | ❌ | — |
| `programs` | ❌ | — |
| `enrollment_leads` | ❌ | — |
| `commission_payments` | ❌ | — |
| `deals` | ✅ | Genérico, sin etapas de inscripción |
| `contacts` | ✅ | Sin tipo estudiante |
| `conversations` | ✅ | Útil para velocidad de respuesta |

### 2.2 Problemas identificados

1. **Sin contexto de negocio**: Las métricas son genéricas (conversaciones, deals) y no reflejan el proceso real (lead → aplicación → matrícula → comisión)
2. **Sin targets**: No hay sistema de metas por agente
3. **Sin programa/universidad**: No se puede filtrar ni desglosar por programa o universidad aliada
4. **Flow handoff irrelevante**: La gráfica de handoff de flows no aplica para este tipo de negocio
5. **Ranking incompleto**: La tabla no incluye métricas de conversión ni de comisiones
6. **KPIs débiles**: "Conversaciones totales" y "Mensajes enviados" no miden resultados

---

## 3. Plan de implementación

### Fase 1 — Modelo de datos (Migraciones SQL)

#### 1.1 `universities` — Universidades aliadas

```sql
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  country TEXT DEFAULT 'Colombia',
  contact_name TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_universities_account ON universities(account_id);
ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY universities_select ON universities FOR SELECT USING (is_account_member(account_id, 'viewer'));
CREATE POLICY universities_insert ON universities FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY universities_update ON universities FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY universities_delete ON universities FOR DELETE USING (is_account_member(account_id, 'owner'));
```

#### 1.2 `programs` — Programas / Carreras ofrecidos

```sql
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  university_id UUID NOT NULL REFERENCES universities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('pregrado','posgrado','diplomado','curso','otro')),
  commission_type TEXT NOT NULL CHECK (commission_type IN ('fixed','percentage')),
  commission_value NUMERIC(12,2) NOT NULL DEFAULT 0,
  commission_currency TEXT DEFAULT 'COP',
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_programs_account ON programs(account_id);
CREATE INDEX idx_programs_university ON programs(university_id);
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY programs_select ON programs FOR SELECT USING (is_account_member(account_id, 'viewer'));
CREATE POLICY programs_insert ON programs FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY programs_update ON programs FOR UPDATE USING (is_account_member(account_id, 'admin'));
CREATE POLICY programs_delete ON programs FOR DELETE USING (is_account_member(account_id, 'owner'));
```

#### 1.3 `enrollment_leads` — Prospectos de estudiantes

```sql
CREATE TABLE enrollment_leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES profiles(id) ON DELETE SET NULL,
  program_id UUID REFERENCES programs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','contacted','applied','enrolled','commission_paid','lost')),
  source TEXT,
  target_date DATE,
  applied_at TIMESTAMPTZ,
  enrolled_at TIMESTAMPTZ,
  commission_earned NUMERIC(12,2) DEFAULT 0,
  commission_paid NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_enrollment_leads_account ON enrollment_leads(account_id);
CREATE INDEX idx_enrollment_leads_assigned ON enrollment_leads(assigned_to);
CREATE INDEX idx_enrollment_leads_program ON enrollment_leads(program_id);
CREATE INDEX idx_enrollment_leads_status ON enrollment_leads(status);
ALTER TABLE enrollment_leads ENABLE ROW LEVEL SECURITY;

-- Agent solo ve leads asignados a ellos
CREATE POLICY enrollment_leads_agent_select ON enrollment_leads
  FOR SELECT USING (
    is_account_member(account_id, 'agent')
    AND assigned_to = auth.uid()
  );
-- Admin/owner ven todos
CREATE POLICY enrollment_leads_admin_select ON enrollment_leads
  FOR SELECT USING (is_account_member(account_id, 'admin'));
-- Admin/owner insertan
CREATE POLICY enrollment_leads_insert ON enrollment_leads
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
-- Agent actualiza sus propios leads
CREATE POLICY enrollment_leads_agent_update ON enrollment_leads
  FOR UPDATE USING (
    is_account_member(account_id, 'agent')
    AND assigned_to = auth.uid()
  );
CREATE POLICY enrollment_leads_admin_update ON enrollment_leads
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
```

#### 1.4 `commission_payments` — Pagos de comisiones

```sql
CREATE TABLE commission_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES enrollment_leads(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'COP',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','paid','reconciled','cancelled')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_commission_payments_account ON commission_payments(account_id);
CREATE INDEX idx_commission_payments_agent ON commission_payments(agent_id);
CREATE INDEX idx_commission_payments_status ON commission_payments(status);
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY commission_payments_select ON commission_payments
  FOR SELECT USING (is_account_member(account_id, 'admin'));
CREATE POLICY commission_payments_insert ON commission_payments
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY commission_payments_update ON commission_payments
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
```

#### 1.5 `agent_targets` — Metas de matriculación

```sql
CREATE TABLE agent_targets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_enrollments INT NOT NULL DEFAULT 0,
  target_commissions NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(account_id, agent_id, period_start)
);

CREATE INDEX idx_agent_targets_account ON agent_targets(account_id);
ALTER TABLE agent_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_targets_select ON agent_targets
  FOR SELECT USING (is_account_member(account_id, 'admin'));
CREATE POLICY agent_targets_insert ON agent_targets
  FOR INSERT WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY agent_targets_update ON agent_targets
  FOR UPDATE USING (is_account_member(account_id, 'admin'));
```

---

### Fase 2 — Tipos TypeScript

**Archivo a modificar:** `src/lib/agent-analytics/types.ts`

```typescript
import type { AccountRole } from '@/lib/auth/roles';

// --- Dominio educativo ---

export interface University {
  id: string;
  accountId: string;
  name: string;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  status: string;
}

export interface Program {
  id: string;
  accountId: string;
  universityId: string;
  universityName?: string;
  name: string;
  level: 'pregrado' | 'posgrado' | 'diplomado' | 'curso' | 'otro';
  commissionType: 'fixed' | 'percentage';
  commissionValue: number;
  commissionCurrency: string;
  status: string;
}

export type EnrollmentStatus =
  | 'new'
  | 'contacted'
  | 'applied'
  | 'enrolled'
  | 'commission_paid'
  | 'lost';

export interface EnrollmentLead {
  id: string;
  contactId: string | null;
  assignedTo: string | null;
  programId: string | null;
  status: EnrollmentStatus;
  source: string | null;
  targetDate: string | null;
  appliedAt: string | null;
  enrolledAt: string | null;
  commissionEarned: number;
  commissionPaid: number;
}

export interface CommissionPayment {
  id: string;
  leadId: string;
  agentId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'paid' | 'reconciled' | 'cancelled';
  paidAt: string | null;
}

export interface AgentTarget {
  agentId: string;
  targetEnrollments: number;
  targetCommissions: number;
  periodStart: string;
  periodEnd: string;
}

// --- Estadísticas por agente ---

export interface AgentInfo {
  userId: string;
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  role: AccountRole;
}

export interface AgentConversationStats {
  agentId: string;
  totalAssigned: number;
  activeNow: number;
  closed: number;
  resolutionRate: number;
}

export interface AgentMessageStats {
  agentId: string;
  messagesSent: number;
}

export interface AgentResponseTime {
  agentId: string;
  avgMinutes: number | null;
  sampleCount: number;
}

export interface AgentDealStats {
  agentId: string;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  totalValueWon: number;
}

// NUEVO: Estadísticas de inscripción por agente
export interface AgentEnrollmentStats {
  agentId: string;
  leadsAssigned: number;
  leadsContacted: number;
  applications: number;
  enrollments: number;
  commissionsGenerated: number;
  commissionsPaid: number;
  conversionLeadToApplied: number;    // 0-1
  conversionAppliedToEnrolled: number; // 0-1
  conversionLeadToEnrolled: number;   // 0-1 (global)
  leadToEnrolledDaysAvg: number | null;
  targetEnrollments: number;
  percentTarget: number; // 0-1+ (>1 = exceeded)
}

// --- Fila de ranking ---

export interface AgentPerformanceRow {
  agent: AgentInfo;
  conversations: AgentConversationStats | null;
  messages: AgentMessageStats | null;
  responseTime: AgentResponseTime | null;
  deals: AgentDealStats | null;
  enrollments: AgentEnrollmentStats | null; // NUEVO
}

export interface AgentPerformanceData {
  agents: AgentInfo[];
  rows: AgentPerformanceRow[];
  totals: {
    totalConversations: number;
    totalMessages: number;
    totalDealsWon: number;
    totalValueWon: number;
    avgResponseMinutes: number | null;
    totalLeads: number;          // NUEVO
    totalEnrollments: number;    // NUEVO
    totalCommissions: number;    // NUEVO
    avgConversionRate: number;   // NUEVO
  };
}

export interface FlowHandoffStat {
  flowId: string;
  flowName: string;
  totalRuns: number;
  handoffRuns: number;
  handoffRate: number;
}
```

---

### Fase 3 — Queries de Analytics

**Archivo a modificar:** `src/lib/agent-analytics/queries.ts`

#### Nuevas funciones a crear:

**`loadUniversitiesAndPrograms(db)`**
```typescript
export async function loadUniversitiesAndPrograms(db: DB): Promise<{
  universities: University[];
  programs: Program[];
}> {
  const [uniRes, progRes] = await Promise.all([
    db.from('universities').select('id, name, country, status')
      .eq('status', 'active').order('name'),
    db.from('programs').select('id, university_id, name, level, commission_type, commission_value, commission_currency, status, universities(name)')
      .eq('status', 'active').order('name'),
  ]);
  // Mapear y retornar
}
```

**`loadEnrollmentStats(db, fromDate)`**
```typescript
export async function loadEnrollmentStats(
  db: DB,
  fromDate: string
): Promise<Map<string, AgentEnrollmentStats>> {
  // 1. Traer enrollment_leads asignados desde fromDate
  // 2. Agrupar por assigned_to
  // 3. Calcular por agente:
  //    - leadsAssigned: COUNT
  //    - leadsContacted: COUNT(status >= 'contacted')
  //    - applications: COUNT(status >= 'applied')
  //    - enrollments: COUNT(status >= 'enrolled')
  //    - commissionsGenerated: SUM(commission_earned)
  //    - commissionsPaid: SUM(commission_paid)
  //    - conversionLeadToApplied: applications / leadsAssigned
  //    - conversionAppliedToEnrolled: enrollments / applications
  //    - conversionLeadToEnrolled: enrollments / leadsAssigned
  //    - leadToEnrolledDaysAvg: AVG(enrolled_at - created_at)
  // 4. Retornar Map<string, AgentEnrollmentStats>
}
```

**`loadAgentTargets(db, periodStart, periodEnd)`**
```typescript
export async function loadAgentTargets(
  db: DB,
  periodStart: string,
  periodEnd: string
): Promise<Map<string, AgentTarget>> {
  // FROM agent_targets WHERE period_start <= periodEnd AND period_end >= periodStart
  // Mapear por agent_id
}
```

#### Modificar `loadAgentPerformance`:

```typescript
export async function loadAgentPerformance(
  db: DB,
  rangeDays: number
): Promise<{
  data: AgentPerformanceData;
  flowStats: FlowHandoffStat[];
}> {
  const fromDate = daysAgoStart(rangeDays - 1).toISOString();
  const now = new Date();
  const periodStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

  const [
    { agents, profileIdMap },
    convStats,
    msgStats,
    respTimes,
    dealStatsByProfile,
    flowStats,
    enrollmentStats,        // NUEVO
    targets,                // NUEVO
  ] = await Promise.all([
    loadAgentRoster(db),
    loadAgentConversationStats(db),
    loadAgentMessageStats(db, fromDate),
    loadAgentResponseTimes(db, fromDate),
    loadAgentDealStats(db),
    loadFlowHandoffStats(db),
    loadEnrollmentStats(db, fromDate),     // NUEVO
    loadAgentTargets(db, periodStart, now.toISOString()), // NUEVO
  ]);

  // Mapear enrollment stats por userId usando profileIdMap
  // Fusionar targets con enrollmentStats
  // Agregar a rows y calcular totals
}
```

---

### Fase 4 — API Route

**Archivo a modificar:** `src/app/api/agent-performance/route.ts`

Extender respuesta:
```typescript
// Nuevos campos en la respuesta:
{
  data: { agents, rows, totals },  // totals incluye totalLeads, totalEnrollments, totalCommissions
  flowStats,
  programs: [...],        // para dropdowns de filtro
  universities: [...],    // para dropdowns de filtro
}
```

---

### Fase 5 — Rediseño del Page

**Archivo:** `src/app/(dashboard)/dashboard/agent-performance/page.tsx`

#### 5.1 KPI Cards (4 → 6)

| # | Icon | Label | Fuente |
|---|------|-------|--------|
| 1 | Users | Estudiantes matriculados | totals.totalEnrollments |
| 2 | DollarSign | Comisiones generadas | totals.totalCommissions |
| 3 | Target | Leads activos | totals.totalLeads |
| 4 | Percent | Tasa de conversión global | totals.avgConversionRate |
| 5 | MessageSquare | Conversaciones totales | totals.totalConversations (existente) |
| 6 | Clock | Tiempo prom. respuesta | totals.avgResponseMinutes (existente) |

#### 5.2 Charts — Reemplazar completamente

| Sección actual | Reemplazo | Tipo | Color | Datos |
|---|---|---|---|---|
| **Carga de trabajo** (workload) | **Matriculados por agente** | Bar chart | `green` | enrollments per agent + target line |
| **Tiempo de respuesta** (responseTime) | **Comisiones por agente** | Bar chart | `blue` | commission value per agent |
| **Conversión de deals** (deals) | **Embudo de conversión** | Stacked bar o funnel | `['sky','violet','emerald']` | leads/contacted/applied per agent |
| **Ranking** (tabla existente) | **Ranking mejorado** | Sortable table | — | Ver 5.3 |
| **Handoff flows** | **ELIMINAR** | — | — | Irrelevante |

#### 5.3 Tabla de Ranking — Columnas nuevas

| Columna | Ordenable | Fuente |
|---------|-----------|--------|
| Agente | ✅ | agent.fullName |
| Leads | ✅ | enrollments.leadsAssigned |
| Contactados | ✅ | enrollments.leadsContacted |
| Aplicaciones | ✅ | enrollments.applications |
| **Matriculados** | ✅ | enrollments.enrollments |
| **Tasa Conversión** | ✅ | enrollments.conversionLeadToEnrolled |
| **Comisiones** | ✅ | enrollments.commissionsGenerated |
| **% Meta** | ✅ | enrollments.percentTarget |

#### 5.4 Filtros nuevos

Agregar debajo del selector de rango (7d/30d/90d):

| Filtro | Tipo | Fuente |
|--------|------|--------|
| Universidad | Select dropdown | programs.universityName |
| Programa | Select dropdown | programs.name |
| Fuente de lead | Select dropdown | enrollment_leads.source |

#### 5.5 RAG Status (Cumplimiento de metas)

En la columna `% Meta` de la tabla de ranking, mostrar badge:
- 🟢 Verde: percentTarget ≥ 1.0 (meta alcanzada o superada)
- 🟡 Ámbar: percentTarget ≥ 0.75 (cerca de la meta)
- 🔴 Rojo: percentTarget < 0.75 (por debajo de la meta)

---

### Fase 6 — i18n

#### `messages/es.json` — Nuevas claves en `agentPerformance`:

```json
{
  "totalEnrolled": "Estudiantes matriculados",
  "totalCommissions": "Comisiones generadas",
  "totalLeads": "Leads activos",
  "conversionRateGlobal": "Conversión global",
  "leadsTitle": "Embudo de conversión por agente",
  "leadsSubtitle": "Leads asignados, contactados y aplicaciones",
  "commissionsTitle": "Comisiones por agente",
  "commissionsSubtitle": "Valor total de comisiones generadas",
  "enrollmentsTitle": "Matriculados por agente",
  "enrollmentsSubtitle": "Estudiantes inscritos vs meta del período",
  "noEnrollments": "Sin inscripciones",
  "noEnrollmentsHint": "No hay datos de inscripciones en el período",
  "noCommissions": "Sin comisiones",
  "noCommissionsHint": "No hay comisiones generadas en el período",
  "colLeads": "Leads",
  "colContacted": "Contactados",
  "colApplications": "Aplicaciones",
  "colEnrollments": "Matriculados",
  "colConversion": "Conversión",
  "colCommission": "Comisiones",
  "colTarget": "% Meta",
  "filterProgram": "Programa",
  "filterUniversity": "Universidad",
  "filterAllPrograms": "Todos los programas",
  "filterAllUniversities": "Todas las universidades",
  "catLeads": "Leads",
  "catContacted": "Contactados",
  "catApplied": "Aplicaciones",
  "catEnrolled": "Matriculados",
  "catCommission": "Comisiones (COP)",
  "catTarget": "Meta"
}
```

#### `messages/en.json` — Equivalente en inglés:

```json
{
  "totalEnrolled": "Enrolled students",
  "totalCommissions": "Commissions generated",
  "totalLeads": "Active leads",
  "conversionRateGlobal": "Global conversion",
  "leadsTitle": "Conversion funnel by agent",
  "leadsSubtitle": "Leads assigned, contacted, and applications",
  "commissionsTitle": "Commissions by agent",
  "commissionsSubtitle": "Total commission value generated",
  "enrollmentsTitle": "Enrollments by agent",
  "enrollmentsSubtitle": "Enrolled students vs period target",
  "noEnrollments": "No enrollments",
  "noEnrollmentsHint": "No enrollment data in this period",
  "noCommissions": "No commissions",
  "noCommissionsHint": "No commissions generated in this period",
  "colLeads": "Leads",
  "colContacted": "Contacted",
  "colApplications": "Applications",
  "colEnrollments": "Enrolled",
  "colConversion": "Conversion",
  "colCommission": "Commissions",
  "colTarget": "% Target",
  "filterProgram": "Program",
  "filterUniversity": "University",
  "filterAllPrograms": "All programs",
  "filterAllUniversities": "All universities",
  "catLeads": "Leads",
  "catContacted": "Contacted",
  "catApplied": "Applications",
  "catEnrolled": "Enrolled",
  "catCommission": "Commissions",
  "catTarget": "Target"
}
```

---

### Fase 7 — Targets / Metas

La tabla `agent_targets` permite configurar metas mensuales de matriculación por agente. La UI debe:

1. Agregar sección en Settings para que admin/owner defina targets por agente y período
2. La página de rendimiento calcula `percentTarget = enrollments / targetEnrollments`
3. Mostrar RAG status en la columna de ranking

---

## 4. Archivos a crear/modificar

| # | Archivo | Acción | Prioridad |
|---|---------|--------|-----------|
| 1 | `supabase/migrations/033_universities_programs.sql` | Crear | Alta |
| 2 | `supabase/migrations/034_enrollment_leads.sql` | Crear | Alta |
| 3 | `supabase/migrations/035_commission_payments.sql` | Crear | Alta |
| 4 | `supabase/migrations/036_agent_targets.sql` | Crear | Media |
| 5 | `src/lib/agent-analytics/types.ts` | Modificar | Alta |
| 6 | `src/lib/agent-analytics/queries.ts` | Modificar | Alta |
| 7 | `src/app/api/agent-performance/route.ts` | Modificar | Alta |
| 8 | `src/app/(dashboard)/dashboard/agent-performance/page.tsx` | Reescribir parcial | Alta |
| 9 | `messages/es.json` | Modificar | Alta |
| 10 | `messages/en.json` | Modificar | Alta |
| 11 | `src/app/(dashboard)/settings/page.tsx` | Agregar sección targets | Media |

---

## 5. Orden de implementación recomendado

```
1. Migraciones SQL (todas juntas en una sola migración)
   → Crear tablas + RLS + índices
   → Ejecutar en Supabase

2. Tipos TypeScript
   → Actualizar types.ts con nuevas interfaces
   → Asegurar que existing types no rompan

3. Queries
   → Agregar loadEnrollmentStats, loadAgentTargets, loadUniversitiesAndPrograms
   → Modificar loadAgentPerformance para incluir datos nuevos

4. API Route
   → Extender respuesta con enrollment data + programs + universities

5. Page
   → Reemplazar KPI cards
   → Reemplazar charts
   → Agregar filtros (universidad, programa)
   → Agregar columna RAG en ranking

6. i18n
   → Agregar todas las nuevas claves

7. Targets (Settings)
   → UI para definir metas por agente
```

---

## 6. Verificación (Definition of Done)

- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm lint` pasa sin warnings
- [ ] `pnpm test` pasa
- [ ] Migraciones creadas y aplicadas en Supabase
- [ ] La página `/dashboard/agent-performance` muestra datos de inscripción
- [ ] Los charts muestran matriculados, comisiones y embudo por agente
- [ ] Los filtros de universidad/programa funcionan
- [ ] La columna % Meta muestra RAG status correcto
- [ ] Mensajes i18n en español e inglés completos
- [ ] Sin secrets expuestos en el diff
