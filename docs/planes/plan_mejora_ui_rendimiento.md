# Plan Estratégico: Mejora de la UI de Rendimiento

> **Fecha:** 06 de julio de 2026
> **Contexto:** CRM para empresa aliada de universidades que cobra comisiones por inscribir estudiantes.
> **Restricción:** Usar SOLO tablas existentes (`deals`, `profiles`, `conversations`, `messages`, `contacts`, `accounts`). No crear tablas nuevas.
> **Problema principal:** Las gráficas actuales (una barra por agente) quedan obsoletas al crecer el equipo. Con ≥10 agentes son ilegibles.

---

## 1. Investigación — Métricas de rendimiento para comerciales de inscripción universitaria

### 1.1 Fuentes consultadas

| Fuente | Enfoque |
|--------|---------|
| LeadSquared Education | KPIs de counselors educativos: tasas de conversión, SLA compliance, pipeline hygiene |
| EducationDynamics | Benchmarks educación 2026: cost per application, cost per enrollment |
| QuotaPath / Everstage | Compensación variable y scorecards para equipos de ventas comisionistas |
| Salesforce Education Cloud | Dashboards de admisiones: yield rate, melt rate, retention por agente origen |
| SmartX CRM | CRM educativo con commission tracking, agent performance, lead scoring |
| Rework.com | Diseño de dashboards para managers con equipos grandes (>10 personas) |

### 1.2 Principios de diseño para dashboards de equipo grande

1. **Regla de 3 — no más de 4 gráficas y 3 flujos de datos por vista.** El gerente no debe sufrir sobrecarga cognitiva.
2. **Divulgación progresiva — resumen arriba, detalle abajo, cada tile linkea a detalle.**
3. **Gráficas temporales agregadas (no per-agent).** Las líneas de tendencia escalan a cualquier número de agentes. Las barras per-agent no.
4. **Ranking + Cuadrante para comparar agentes.** El ranking (tabla) escala con scroll. El cuadrante (scatter) escala visualmente porque los puntos se superponen sin perder información.
5. **Top K + "Otros"** para distribuciones. Siempre mostrar los mejores K agentes y agrupar el resto.
6. **Cada métrica de cantidad debe tener su contraparte de calidad.** Mostrar "matriculados" junto con "tasa de cierre" para evitar gaming.

### 1.3 Métricas relevantes para el negocio (mapeo a DB existente)

| Métrica de negocio | Mapeo a DB | Cálculo |
|---|---|---|
| Matriculaciones (enrollments) | `deals WHERE status = 'won'` | `COUNT(*)` |
| Comisiones generadas | `deals.value WHERE status = 'won'` | `SUM(value)` |
| Solicitudes recibidas (applications) | `deals WHERE status IN ('won','lost')` (cerrados) | `COUNT(*)` |
| Pipeline activo (oportunidades abiertas) | `deals WHERE status = 'open'` | `SUM(value)` |
| Tasa de cierre (win rate) | `deals.status` | `won / NULLIF(won+lost, 0)` |
| Valor promedio por matrícula | `deals.value WHERE status = 'won'` | `AVG(value)` |
| Velocidad de respuesta | `messages` + `conversations` | Tiempo entre msg customer → respuesta agent (ya existe) |
| Actividad del agente | `messages WHERE sender_type = 'agent'` | `COUNT(*)` en período |

### 1.4 Métricas actuales que NO sirven y por qué

| Métrica actual | Problema |
|---|---|
| Conversaciones activas (workload) | Mide volumen de chat, no pipeline de inscripciones. Irrelevante para comisiones. |
| Mensajes enviados | Vanity metric. No correlaciona con matriculaciones. |
| Deals genéricos (sin estado) | El estado (open/won/lost) ya existe pero no se aprovecha con métricas de conversión. |
| Handoff de flows | Específico de automatizaciones, irrelevante para comerciales de admisiones. |
| Resolución de conversaciones | Métrica de soporte post-venta, no aplica para prospección. |

---

## 2. Análisis de la página actual

### 2.1 Estado actual

**Archivo:** `src/app/(dashboard)/dashboard/agent-performance/page.tsx` (580 líneas)

| Sección | Tipo | Problema de escalabilidad |
|---|---|---|
| 4 KPI Cards | `MetricCard` | Métricas genéricas de chat, no de negocio |
| Carga de trabajo | `BarChart` azul — una barra por agente | **Ilegible con >10 agentes** |
| Tiempo de respuesta | `BarChart` violeta — una barra por agente | **Ilegible con >10 agentes** |
| Conversión de deals | `BarChart` verde/rosa — barras apiladas por agente | **Ilegible con >10 agentes** |
| Ranking | Tabla sortable 7 cols | Escala bien (el scroll funciona) |
| Flow handoff | `BarChart` ámbar | Irrelevante para el negocio |

### 2.2 Problemas estructurales

1. **Sin métricas de negocio.** Conversaciones y mensajes no miden matriculaciones ni comisiones.
2. **Sin tendencias temporales.** No hay forma de ver si el equipo mejora o empeora mes a mes.
3. **Sin distribución.** No se ve quién carga al equipo (concentración de comisiones).
4. **Sin ranking de eficiencia.** No se compara win rate entre agentes.
5. **Sin cuadrante de gestión.** Un gerente no puede identificar rápidamente a quién coachar, a quién dar más leads, o quién es estrella.

---

## 3. Estrategia de rediseño

### 3.1 Principios rectores

1. **Las gráficas per-agent se reemplazan por gráficas que escalan.** Tendencias temporales, distribuciones, top K, cuadrantes.
2. **Solo tablas existentes.** `deals` es la tabla fuente principal (cada deal = oportunidad de inscripción; won = matriculado, value = comisión).
3. **El gerente debe poder tomar decisiones en 5 segundos.** ¿A quién felicito? ¿A quién coacho? ¿Vamos bien o mal?
4. **La tabla de ranking es el detalle.** Los charts son el resumen visual.

### 3.2 Nuevos KPIs (reemplazan los 4 actuales)

| # | Icon | Label | Cálculo | Lo que revela |
|---|---|---|---|---|
| 1 | `Trophy` | Matriculados | `COUNT(deals) WHERE status='won'` en el período | Volumen de cierres |
| 2 | `DollarSign` | Comisiones | `SUM(deals.value) WHERE status='won'` en el período | Ingreso generado |
| 3 | `TrendingUp` | Tasa de cierre | `won / (won+lost)` global en el período | ¿Estamos siendo efectivos? |
| 4 | `Target` | Pipeline activo | `SUM(deals.value) WHERE status='open'` | Proyección de ingreso futuro |

### 3.3 Nuevos charts (reemplazan los 4 per-agent bars + handoff)

**Chart 1 — Tendencia de inscripciones (Área/Línea)**
- **Tipo:** Time series chart
- **Eje X:** Semanas del período
- **Eje Y:** Cantidad
- **Series:** "Solicitudes recibidas" (deals creados por semana) | "Matriculados" (deals won por semana)
- **Utilidad gerencial:** ¿Vamos acelerando o frenando? ¿Hay estacionalidad?
- **Escala:** Independiente del número de agentes

**Chart 2 — Cuadrante eficiencia vs volumen (Scatter)**
- **Tipo:** Scatter plot con 4 cuadrantes
- **Eje X:** Total deals asignados al agente (volumen de actividad)
- **Eje Y:** Win rate (deals won / deals closed — eficiencia)
- **Cada punto = un agente.** Tooltip con nombre, comisiones, volumen.
- **Cuadrantes:**
  - 🟢 **Estrella** (alto volumen, alta eficiencia) → Felicitar, replicar su método
  - 🟡 **Coach** (alto volumen, baja eficiencia) → Capacitar en cierre
  - 🔵 **Subutilizado** (bajo volumen, alta eficiencia) → Asignarle más leads
  - ⚪ **Novato/Riesgo** (bajo volumen, baja eficiencia) → Revisar si necesita más training o reasignación
- **Utilidad gerencial:** En un vistazo identifica problemas de gestión de talento
- **Escala:** Los puntos pueden ser 5 o 50, el cuadrante mantiene su legibilidad

**Chart 3 — Top K por comisiones (Barra horizontal)**
- **Tipo:** Horizontal bar chart
- **Siempre Top 10** (o Top 5, configurable) por comisiones generadas
- **Tooltip:** Nombre, comisiones, matriculaciones
- **Utilidad gerencial:** ¿Quiénes son los mejores del mes?
- **Escala:** Siempre 10 barras, independiente del total de agentes

**Chart 4 — Distribución de comisiones (Donut)**
- **Tipo:** Donut/gráfico de anillo
- **Slices:** Top 5 agentes + "Otros N"
- **Utilidad gerencial:** ¿Depende el negocio de 1-2 agentes? ¿Hay concentración de riesgo?
- **Escala:** Siempre 6 slices máximo

### 3.4 Nueva tabla de ranking

| Columna | Ordenable | Cálculo | Señal para el gerente |
|---|---|---|---|
| Agente | ✅ | `profiles.full_name` | — |
| Solicitudes | ✅ | `COUNT(deals)` en período | ¿Cuánta actividad genera? |
| Matriculados | ✅ | `COUNT(deals) WHERE status='won'` | ¿Cuántos cierra? |
| Perdidos | ✅ | `COUNT(deals) WHERE status='lost'` | ¿Muchos rechazos? |
| % Cierre | ✅ | `won / NULLIF(won+lost, 0)` | ¿Es eficiente cerrando? |
| Comisiones | ✅ | `SUM(value) WHERE status='won'` | ¿Cuánto ingreso genera? |
| Prom. comisión | ✅ | `AVG(value) WHERE status='won'` | ¿Calidad alta o baja de matrícula? |
| Tendencia | — | ▲/▼ comparando período anterior | ¿Mejoró o empeoró? |

### 3.5 Secciones a eliminar

| Sección actual | Motivo |
|---|---|
| Carga de trabajo (workload chart) | Reemplazado por Top K y cuadrante |
| Tiempo de respuesta | Reemplazado por cuadrante (no es métrica crítica de negocio) |
| Deals conversion (won/lost per agent) | Reemplazado por cuadrante + tabla |
| Flow handoff chart | Irrelevante para el negocio |

### 3.6 Secciones a mantener

| Sección actual | Motivo |
|---|---|
| Range selector (7d/30d/90d) | Sigue siendo útil para filtrar períodos |
| Ranking table | Sigue siendo el detalle táctico |

---

## 4. Layout final propuesto

```
┌──────────────────────────────────────────────────────────────┐
│ [ 7d | 30d | 90d ]                          Filtro: [Agente] │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│ │ 🏆 47    │ │ 💰 $12.4M│ │ 📈 38%   │ │ 🎯 $8.1M │         │
│ │Matricul. │ │Comisiones│ │Tasa cierre│ │Pipeline  │         │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘         │
├────────────────────────┬─────────────────────────────────────┤
│ Tendencia semanal      │ Cuadrante Eficiencia vs Volumen     │
│ (Área/Línea)           │ (Scatter — un punto por agente)    │
│                        │                                     │
│  Solicitudes ──        │   ●  ●      ★                      │
│  Matriculados ──       │      ●  ●       ●  ●               │
│                        │          ●  ●                       │
│                        │     ●          ●                    │
│                        │   ●     ●                           │
├────────────────────────┴─────────────────────────────────────┤
│ ┌──────────────────────────┐ ┌──────────────────────────────┐│
│ │ Top 10 por comisiones     │ │ Distribución de comisiones  ││
│ │ (Barras horizontales)    │ │ (Donut: Top 5 + Otros)      ││
│ │                          │ │                              ││
│ │ María R.   ██████████   │ │          ┌─────┐             ││
│ │ Juan P.    ████████     │ │         ╱       ╲            ││
│ │ Ana L.     ██████       │ │        │         │           ││
│ │ Carlos G.  █████        │ │         ╲       ╱            ││
│ │ ...        ███          │ │          └─────┘             ││
│ └──────────────────────────┘ └──────────────────────────────┘│
├──────────────────────────────────────────────────────────────┤
│ Ranking detallado de agentes (tabla sortable)                │
│ Agente │ Solic. │ Matric. │ Perd. │ % Cierre │ Comis. │ ↑ │ │
│ ───────┼────────┼─────────┼───────┼──────────┼─────────┤   │
│ María  │  42    │   18    │   8   │  69%  ▲  │ $4.2M  │   │
│ Juan   │  55    │   12    │  15   │  44%  ▼  │ $3.1M  │   │
│ Ana    │  30    │   10    │   5   │  67%  ▲  │ $2.8M  │   │
│ Carlos │  20    │    4    │   6   │  40%     │ $1.1M  │   │
│ ...    │        │         │       │          │         │   │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Plan de implementación técnica

### 5.1 Resumen de archivos a tocar

| # | Archivo | Acción | Cambio |
|---|---|---|---|
| 1 | `src/lib/agent-analytics/types.ts` | Modificar | Agregar tipos para trend data, quadrant data. Eliminar `FlowHandoffStat`. Actualizar `AgentPerformanceData.totals` |
| 2 | `src/lib/agent-analytics/queries.ts` | Modificar | Agregar `loadDealTrend()`, `loadAgentQuadrant()`, `loadDealDistribution()`. Mejorar `loadAgentDealStats()` con win rate y avg value. Eliminar `loadFlowHandoffStats()`. |
| 3 | `src/app/api/agent-performance/route.ts` | Modificar | Extender respuesta con `dealTrend`, `agentQuadrants`, `dealDistribution` |
| 4 | `src/app/(dashboard)/dashboard/agent-performance/page.tsx` | Reescribir | Reemplazar KPI cards, reemplazar charts, actualizar tabla ranking |
| 5 | `src/components/dashboard/quadrant-chart.tsx` | **Nuevo** | Scatter plot cuadrante con SVG puro (inspirado en ConversationsChart) |
| 6 | `messages/es.json` | Modificar | Actualizar claves `agentPerformance` |
| 7 | `messages/en.json` | Modificar | Actualizar claves `agentPerformance` |

### 5.2 Nuevas consultas a implementar

**`loadDealTrend(db, fromDate)`**
- Agrupa `deals.created_at` por semana
- Dos agregaciones: `COUNT(*)` como "solicitudes", `COUNT(*) FILTER(WHERE status='won')` como "matriculados"
- Retorna array de `{ date: string, created: number, won: number }`

**`loadAgentQuadrant(db)`**
- Por cada agente con deals: total deals, won, lost, win rate, total value won
- Retorna array de `{ agentId, agentName, totalDeals, dealsWon, winRate, totalValue }`

**`loadDealDistribution(db)`**
- Top 5 agentes por `SUM(deals.value) WHERE status='won'` + resto como "Otros"
- Retorna array de `{ name: string, value: number, percentage: number }`

### 5.3 Mejoras a queries existentes

**`loadAgentDealStats`** actual incluirá:
- `winRate`: `won / NULLIF(won+lost, 0)`
- `avgDealValue`: `totalValueWon / NULLIF(dealsWon, 0)`
- `trend`: comparación con período anterior (hacia arriba/abajo/estable)

### 5.4 Orden de implementación recomendado

```
1. Tipos (types.ts) — definir interfaces sin romper las existentes
2. Queries (queries.ts) — implementar loadDealTrend, loadAgentQuadrant, loadDealDistribution
3. API route (route.ts) — extender respuesta
4. QuadrantChart componente nuevo — scatter plot SVG
5. Page (page.tsx) — reescribir layout completo
6. i18n (es.json, en.json) — actualizar traducciones
7. Pruebas — pnpm typecheck + pnpm lint + pnpm test
```

---

## 6. Catálogo de gráficas posibles con las librerías existentes

El proyecto ya tiene **recharts ^3.8.1** como dependencia, un componente **Tremor BarChart** (vendored), y **tres componentes SVG hechos a mano** (ConversationsChart, PipelineDonut, ResponseTimeChart). A continuación el inventario completo de lo que se puede generar sin instalar nuevas librerías:

### 6.1 A través del Tremor BarChart (vendored)

El componente `src/components/tremor/bar-chart.tsx` expone el prop `type` que permite:

| Variante | Cómo se logra | Para qué sirve |
|---|---|---|
| **Barras agrupadas** | `type="default"` (omitiendo) | Comparar una métrica entre agentes (top K) |
| **Barras apiladas** | `type="stacked"` | Mostrar composición (won vs lost por agente) |
| **Barras 100%** | `type="percent"` | Mostrar proporciones (share de mercado entre agentes) |
| **Barras verticales** | `layout="vertical"` (default) | Comparación vertical estándar |
| **Barras horizontales** | `layout="horizontal"` | Ranking horizontal tipo leaderboard (mejor para top K con nombres largos) |

**Configuraciones adicionales:**
- `colors`: 9 colores disponibles: `blue`, `emerald`, `violet`, `amber`, `gray`, `cyan`, `pink`, `lime`, `fuchsia`
- `valueFormatter`: formatear valores como moneda, porcentaje, tiempo
- `customTooltip`: tooltip completamente personalizable con React
- `showLegend`, `enableLegendSlider`: control de leyenda
- `onValueChange`: detectar clics en barras para hacer drill-down
- `barCategoryGap`: controlar separación entre barras
- `yAxisWidth`: ancho del eje Y (útil para etiquetas largas)

**Limitaciones del Tremor BarChart:**
- Solo barras — no soporta líneas, áreas, dispersión, ni tortas
- No tiene animaciones configurables
- El layout horizontal intercambia ejes pero es la misma representación

### 6.2 A través de componentes SVG personalizados (patrón existente)

El proyecto ya construyó dos componentes desde cero con SVG puro. Este patrón se puede reutilizar para:

| Tipo de gráfica | Componente de referencia | Líneas para construir una nueva |
|---|---|---|
| **Gráfica de líneas (multi-serie)** | `ConversationsChart` (345 líneas) | Ya existe como plantilla. Usa `<polyline>`, `<path>`, ejes `<text>`, crosshair con tooltip. Reutilizable para tendencias temporales con modificaciones. |
| **Gráfica de donut / anillo** | `PipelineDonut` (143 líneas) | Ya existe como plantilla. Usa `<path>` con comandos de arco SVG (`A`), círculo de fondo, texto centrado. Reutilizable para distribuciones con modificaciones. |
| **Gráfica de dispersión (scatter)** | `ConversationsChart` (estructura base) | No existe. Requiere construir: `<circle>` por punto, ejes X/Y, tooltip hover. El ViewBox y sistema de coordenadas ya está resuelto en los otros charts. |
| **Gráfica de funnel / embudo** | No existe | Se puede construir con `<polygon>` o `<path>` escalonados. No existe referencia directa pero el patrón SVG es el mismo. |
| **Gráfica de barras simple** | `ResponseTimeChart` (wrapper de Tremor) | Usar Tremor BarChart directamente, no hace falta SVG. |

**Ventajas del SVG personalizado:**
- Control total sobre la experiencia (animaciones, hover states, custom rendering)
- Sin dependencias adicionales
- Se puede hacer responsivo con `viewBox` + `preserveAspectRatio`
- Más ligero que recharts para charts simples

**Desventajas:**
- Más líneas de código para charts complejos (escalas, ejes, tooltips)
- Responsive requiere manejo manual de resize (ver `use-on-window-resize.ts`)
- Accesibilidad (aria) requiere implementación manual

### 6.3 A través de recharts directamente (importación directa)

Dado que `recharts@^3.8.1` ya es dependencia del proyecto, se puede importar directamente **sin agregar nada a package.json**:

```typescript
import {
  AreaChart, Area,
  PieChart, Pie, Cell,
  ScatterChart, Scatter,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
```

Esto habilita:

| Tipo de gráfica | Componente recharts | Para qué usarlo en rendimiento |
|---|---|---|
| **Área** | `<AreaChart>` + `<Area>` | Tendencia de inscripciones semanales (solicitudes vs matriculados) |
| **Línea** | `<LineChart>` + `<Line>` | Evolución de tasa de cierre en el tiempo |
| **Torta/Donut** | `<PieChart>` + `<Pie>` + `<Cell>` | Distribución de comisiones por agente |
| **Dispersión** | `<ScatterChart>` + `<Scatter>` | Cuadrante eficiencia vs volumen (cada punto = agente) |
| **Composed** | `<ComposedChart>` | Barras + líneas combinadas (ej: barras de matriculados + línea de tasa de cierre) |
| **RadialBar** | no aplica | No se recomienda para este contexto |

**Ventajas de recharts directo vs Tremor:**
- Acceso a todos los tipos de chart (AreaChart, PieChart, ScatterChart, ComposedChart)
- `ResponsiveContainer` maneja el responsive automáticamente
- Tooltips y leyendas vienen incluidas
- Animaciones por defecto

**Desventajas:**
- API más verbosa que Tremor
- Los estilos no están pre-configurados (hay que importar o copiar colores de Tremor)
- Posible duplicación de estilos si ya se usa Tremor BarChart

### 6.4 Matriz de decisión: qué librería usar para cada gráfica propuesta

| Gráfica propuesta | Librería recomendada | Justificación |
|---|---|---|
| **Tendencia semanal** (ÁreaChart) | **recharts directo** (`<AreaChart>`) | Tremor no tiene AreaChart. Patrón existente ConversationsChart podría adaptarse pero recharts da menos código. |
| **Cuadrante scatter** (ScatterChart) | **SVG personalizado** o **recharts directo** | No existe en Tremor. SVG da control sobre los 4 cuadrantes con líneas divisorias pintadas. recharts ScatterChart tiene tooltip nativo. Decisión: si se quiere tooltip rico → recharts; si se quiere control visual → SVG. |
| **Top K barras** (HorizontalBarChart) | **Tremor BarChart** `layout="horizontal"` | Ya está vendored, es la variante más simple. Solo configurar `categories`, `colors`, `valueFormatter`. |
| **Donut distribución** (PieChart) | **SVG personalizado** (reutilizar PipelineDonut) | Ya existe el patrón PipelineDonut (143 líneas). Adaptarlo es más rápido que integrar recharts PieChart. |
| **Ranking table** | **HTML Table** (ya existe) | No requiere librería de gráficas. |

### 6.5 Resumen visual del ecosistema de gráficas

```
recharts ^3.8.1 (dependencia directa)
├── Tremor BarChart (vendored wrapper)
│   ├── Barras agrupadas (default)
│   ├── Barras apiladas (stacked)
│   ├── Barras 100% (percent)
│   └── Layout horizontal
│
├── [Disponible] recharts directo (sin wrapper)
│   ├── AreaChart / LineChart
│   ├── PieChart / Donut
│   ├── ScatterChart
│   └── ComposedChart
│
└── SVG personalizado (patrones existentes)
    ├── ConversationsChart → Líneas multi-serie
    ├── PipelineDonut → Donut/Anillo
    └── [Nuevo] Quadrant → Scatter con cuadrantes
```

### 6.6 Tabla de tipos de gráficos y su estado de implementación

| # | Tipo de gráfico | ¿Ya existe? | Dónde / Cómo crearlo | Líneas estimadas |
|---|---|---|---|---|
| 1 | Barra agrupada vertical | ✅ Tremor `BarChart` | Usar componente existente | 0 (ya existe) |
| 2 | Barra apilada vertical | ✅ Tremor `type="stacked"` | Config prop | 0 (ya existe) |
| 3 | Barra 100% vertical | ✅ Tremor `type="percent"` | Config prop | 0 (ya existe) |
| 4 | Barra horizontal | ✅ Tremor `layout="horizontal"` | Config prop | 0 (ya existe) |
| 5 | Línea multi-serie | ✅ `ConversationsChart` (SVG) | Reutilizar / modificar | ~350 |
| 6 | Donut / Anillo | ✅ `PipelineDonut` (SVG) | Reutilizar / modificar | ~140 |
| 7 | Área (time series) | ❌ No existe | recharts `<AreaChart>` directo | ~60 |
| 8 | Scatter (dispersión) | ❌ No existe | SVG personalizado o recharts directo | ~150-200 |
| 9 | Compuesto (barra + línea) | ❌ No existe | recharts `<ComposedChart>` directo | ~80 |
| 10 | Torta (pie) | ❌ (donut sí existe como SVG) | recharts `<PieChart>` directo o adaptar PipelineDonut | ~50-80 |
| 11 | Funnel / Embudo | ❌ No existe | SVG personalizado | ~120 |

---

## 7. Definition of Done

- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm lint` pasa sin warnings
- [ ] `pnpm test` pasa
- [ ] No se crearon tablas nuevas en Supabase
- [ ] La página `/dashboard/agent-performance` muestra datos de `deals` como métrica principal
- [ ] Las gráficas actuales (workload, response time, handoff) fueron reemplazadas
- [ ] La página escala visualmente con cualquier número de agentes
- [ ] El cuadrante eficiencia vs volumen permite identificar estrellas, coaches, subutilizados y novatos
- [ ] La tendencia semanal muestra solicitudes vs matriculados en el tiempo
- [ ] Mensajes i18n en español e inglés actualizados
- [ ] Sin secrets expuestos en el diff
