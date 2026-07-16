import type { AccountRole } from '@/lib/auth/roles';

// ============================================================
// Agent analytics — deals-centric performance for enrollment
// commission teams.
//
// Design (see docs/planes/plan_mejora_ui_rendimiento.md):
//   - `deals` is the source of truth. won = matriculado,
//     value = comisión. Conversations/messages are secondary
//     activity signals, not headline KPIs.
//   - All aggregates are scoped to one account (multi-tenancy):
//     queries receive `accountId` and filter every table by it.
// ============================================================

export interface AgentInfo {
  userId: string;
  profileId: string;
  fullName: string;
  avatarUrl: string | null;
  role: AccountRole;
  isUnassigned?: boolean;
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
  /** Total deals assigned, any status. */
  totalDeals: number;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  totalValueWon: number;
  /** won / (won + lost). Null when no closed deals. */
  winRate: number | null;
  /** totalValueWon / dealsWon. Null when no won deals. */
  avgDealValue: number | null;
  /** Whether matriculaciones improved vs the previous period. */
  trend: 'up' | 'down' | 'flat' | 'unknown';
}

export interface AgentPerformanceRow {
  agent: AgentInfo;
  conversations: AgentConversationStats | null;
  messages: AgentMessageStats | null;
  responseTime: AgentResponseTime | null;
  deals: AgentDealStats | null;
}

export interface AgentPerformanceData {
  agents: AgentInfo[];
  rows: AgentPerformanceRow[];
  totals: {
    totalDealsCreated: number;
    matriculados: number;
    perdidos: number;
    comisiones: number;
    pipelineValue: number;
    winRate: number | null;
  };
}

// ------------------------------------------------------------
// New chart payloads (returned alongside AgentPerformanceData).
// ------------------------------------------------------------

/** Weekly bucket of deal creation vs won. */
export interface DealTrendPoint {
  /** ISO date of the bucket start (week). */
  date: string;
  /** Deals created that week (all statuses = applications). */
  created: number;
  /** Deals closed as won that week (matriculaciones). */
  won: number;
}

/** One agent on the efficiency-vs-volume scatter. */
export interface AgentQuadrantPoint {
  agentId: string;
  agentName: string;
  /** Total deals assigned — X axis (volume of activity). */
  totalDeals: number;
  /** Won deals (bubble size hint). */
  dealsWon: number;
  /** Win rate 0..1 — Y axis (efficiency). */
  winRate: number;
  /** Comisiones generated — tooltip + bubble size. */
  totalValue: number;
}

/** One slice of the commission distribution donut. */
export interface DealDistributionSlice {
  name: string;
  value: number;
  /** Share of total, 0..1. */
  percentage: number;
  /** True for the aggregated "Otros" bucket. */
  isOther: boolean;
}
