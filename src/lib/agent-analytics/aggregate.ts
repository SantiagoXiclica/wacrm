// ============================================================
// Pure aggregation helpers for agent analytics.
//
// All functions here are pure (no I/O) so they can be unit-tested
// directly. `queries.ts` owns the Supabase fetch; this module owns
// the math. Keeping them split means a change to win-rate logic or
// the "Otros" bucketing never touches DB code.
// ============================================================

import type {
  AgentQuadrantPoint,
  DealDistributionSlice,
} from './types';

/** Raw projection of a deal row, shared by every aggregator. */
export interface DealRowInput {
  assigned_to: string | null;
  status: string;
  value: number | string | null;
  created_at: string;
}

/** Per-agent deal counts + value rollups. */
export interface AgentDealAggregate {
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  totalValueWon: number;
  totalValueOpen: number;
}

/** Account-wide rollup (same shape, no agent key). */
export interface AccountDealTotals {
  totalCreated: number;
  dealsOpen: number;
  dealsWon: number;
  dealsLost: number;
  totalValueWon: number;
  totalValueOpen: number;
}

/**
 * Win rate as a 0..1 fraction. Null when there are no closed deals
 * (won + lost = 0) so the UI can render "—" instead of a misleading
 * 0%.
 */
export function computeWinRate(
  won: number,
  lost: number
): number | null {
  const closed = won + lost;
  if (closed <= 0) return null;
  return won / closed;
}

/**
 * Compare current-period matriculaciones against the previous
 * period to drive the ▲/▼ indicator. `unknown` covers the case
 * where neither period had any wins (no signal either way).
 */
export function computeTrend(
  currentWon: number,
  previousWon: number
): 'up' | 'down' | 'flat' | 'unknown' {
  if (currentWon === 0 && previousWon === 0) return 'unknown';
  if (currentWon > previousWon) return 'up';
  if (currentWon < previousWon) return 'down';
  return 'flat';
}

const EMPTY_AGG: AgentDealAggregate = {
  dealsOpen: 0,
  dealsWon: 0,
  dealsLost: 0,
  totalValueWon: 0,
  totalValueOpen: 0,
};

/** Group raw deal rows by `assigned_to` (profile id). */
export function aggregateDealsByProfile(
  rows: readonly DealRowInput[]
): Map<string, AgentDealAggregate> {
  const map = new Map<string, AgentDealAggregate>();
  for (const row of rows) {
    if (!row.assigned_to) continue;
    const profileId = row.assigned_to;
    const s = map.get(profileId) ?? { ...EMPTY_AGG };
    if (row.status === 'open') {
      s.dealsOpen++;
      s.totalValueOpen += Number(row.value) || 0;
    } else if (row.status === 'won') {
      s.dealsWon++;
      s.totalValueWon += Number(row.value) || 0;
    } else if (row.status === 'lost') {
      s.dealsLost++;
    }
    map.set(profileId, s);
  }
  return map;
}

/** Roll up all deal rows for an account into a single totals object. */
export function aggregateAccountDeals(
  rows: readonly DealRowInput[]
): AccountDealTotals {
  const totals: AccountDealTotals = {
    totalCreated: rows.length,
    dealsOpen: 0,
    dealsWon: 0,
    dealsLost: 0,
    totalValueWon: 0,
    totalValueOpen: 0,
  };
  for (const row of rows) {
    if (row.status === 'open') {
      totals.dealsOpen++;
      totals.totalValueOpen += Number(row.value) || 0;
    } else if (row.status === 'won') {
      totals.dealsWon++;
      totals.totalValueWon += Number(row.value) || 0;
    } else if (row.status === 'lost') {
      totals.dealsLost++;
    }
  }
  return totals;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Bucket deal rows into weekly trend points aligned to `fromDate`.
 * Returns points sorted chronologically. The "won" count uses
 * `created_at` (no closed-date column exists on `deals`).
 */
export function bucketDealTrend(
  rows: readonly DealRowInput[],
  fromDate: string
): { date: string; created: number; won: number }[] {
  if (rows.length === 0) return [];
  const fromMs = new Date(fromDate).getTime();

  const buckets = new Map<string, { created: number; won: number }>();
  for (const row of rows) {
    const ts = new Date(row.created_at).getTime();
    if (!Number.isFinite(ts)) continue;
    const idx = Math.floor((ts - fromMs) / WEEK_MS);
    if (idx < 0) continue;
    const start = new Date(fromMs + idx * WEEK_MS).toISOString();
    const b = buckets.get(start) ?? { created: 0, won: 0 };
    b.created++;
    if (row.status === 'won') b.won++;
    buckets.set(start, b);
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, created: v.created, won: v.won }));
}

/**
 * Build scatter points (one per agent with deals) for the
 * efficiency-vs-volume quadrant.
 */
export function buildQuadrantPoints(
  byProfile: Map<string, AgentDealAggregate>,
  profileIdToUserId: Map<string, string>,
  nameByUserId: Map<string, string>
): AgentQuadrantPoint[] {
  const points: AgentQuadrantPoint[] = [];
  for (const [profileId, agg] of byProfile) {
    const userId = profileIdToUserId.get(profileId);
    if (!userId) continue;
    const totalDeals = agg.dealsOpen + agg.dealsWon + agg.dealsLost;
    const closed = agg.dealsWon + agg.dealsLost;
    points.push({
      agentId: userId,
      agentName: nameByUserId.get(userId) ?? 'Agente',
      totalDeals,
      dealsWon: agg.dealsWon,
      winRate: closed > 0 ? agg.dealsWon / closed : 0,
      totalValue: agg.totalValueWon,
    });
  }
  return points;
}

const TOP_N = 5;

/**
 * Commission distribution: top `TOP_N` agents by won value, plus
 * one aggregated "Otros" slice for the remainder. Returns an empty
 * array when no agent has won-value.
 */
export function buildDealDistribution(
  perAgent: ReadonlyArray<{ name: string; value: number }>
): DealDistributionSlice[] {
  const ranked = [...perAgent]
    .filter((a) => a.value > 0)
    .sort((a, b) => b.value - a.value);

  if (ranked.length === 0) return [];

  const total = ranked.reduce((s, a) => s + a.value, 0);
  if (total <= 0) return [];

  const top = ranked.slice(0, TOP_N);
  const rest = ranked.slice(TOP_N);
  const restValue = rest.reduce((s, a) => s + a.value, 0);

  const slices: DealDistributionSlice[] = top.map((a) => ({
    name: a.name,
    value: a.value,
    percentage: a.value / total,
    isOther: false,
  }));

  if (rest.length > 0) {
    slices.push({
      name: `Otros (${rest.length})`,
      value: restValue,
      percentage: restValue / total,
      isOther: true,
    });
  }

  return slices;
}
