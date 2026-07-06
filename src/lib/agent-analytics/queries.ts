import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { daysAgoStart } from '@/lib/dashboard/date-utils';
import { isAccountRole } from '@/lib/auth/roles';
import type {
  AgentDealStats,
  AgentInfo,
  AgentConversationStats,
  AgentMessageStats,
  AgentPerformanceData,
  AgentPerformanceRow,
  AgentQuadrantPoint,
  AgentResponseTime,
  DealDistributionSlice,
  DealTrendPoint,
} from './types';
import {
  aggregateAccountDeals,
  aggregateDealsByProfile,
  bucketDealTrend,
  buildDealDistribution,
  buildQuadrantPoints,
  computeTrend,
  computeWinRate,
  type DealRowInput,
} from './aggregate';

type DB = SupabaseClient;

// ============================================================
// Multi-tenancy: every loader receives `accountId` and filters
// by it. These queries run with the service-role admin client
// (RLS bypassed), so without this filter they would leak data
// across accounts.
// ============================================================

export async function loadAgentRoster(
  db: DB,
  accountId: string
): Promise<{
  agents: AgentInfo[];
  profileIdMap: Map<string, string>;
}> {
  const { data, error } = await db
    .from('profiles')
    .select('id, user_id, full_name, avatar_url, account_role')
    .eq('account_id', accountId)
    .in('account_role', ['owner', 'admin', 'agent'])
    .order('full_name', { ascending: true });

  if (error) throw error;

  const agents: AgentInfo[] = (data ?? []).map((p) => ({
    userId: p.user_id,
    profileId: p.id,
    fullName: p.full_name || 'Agente',
    avatarUrl: p.avatar_url,
    role: isAccountRole(p.account_role) ? p.account_role : 'agent',
  }));

  const profileIdMap = new Map<string, string>();
  for (const a of agents) {
    profileIdMap.set(a.profileId, a.userId);
  }

  return { agents, profileIdMap };
}

export async function loadAgentConversationStats(
  db: DB,
  accountId: string
): Promise<Map<string, AgentConversationStats>> {
  const { data, error } = await db
    .from('conversations')
    .select('assigned_agent_id, status')
    .eq('account_id', accountId)
    .not('assigned_agent_id', 'is', null);

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
    if (row.status === 'open') s.activeNow++;
    if (row.status === 'closed') s.closed++;
  }

  for (const s of map.values()) {
    s.resolutionRate = s.totalAssigned > 0 ? s.closed / s.totalAssigned : 0;
  }

  return map;
}

export async function loadAgentMessageStats(
  db: DB,
  accountId: string,
  fromDate: string
): Promise<Map<string, AgentMessageStats>> {
  const { data, error } = await db
    .from('messages')
    // `messages` has no account_id column; it inherits the account
    // via the conversation FK. Filter through an inner embed so rows
    // outside this account are excluded.
    .select('sender_id, conversation:conversations!inner(account_id)')
    .eq('sender_type', 'agent')
    .eq('conversation.account_id', accountId)
    .gte('created_at', fromDate);

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

export async function loadAgentResponseTimes(
  db: DB,
  accountId: string,
  fromDate: string
): Promise<Map<string, AgentResponseTime>> {
  const { data, error } = await db
    .from('messages')
    .select(
      'conversation_id, sender_type, sender_id, created_at, conversation:conversations!inner(account_id)'
    )
    .eq('conversation.account_id', accountId)
    .gte('created_at', fromDate)
    .order('conversation_id', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;

  const rows = (data ?? []) as {
    conversation_id: string;
    sender_type: string;
    sender_id: string | null;
    created_at: string;
  }[];

  interface Sample {
    agentId: string;
    minutes: number;
  }
  const samples: Sample[] = [];

  let currentConv = '';
  let pendingCustomer: Date | null = null;

  for (const row of rows) {
    if (row.conversation_id !== currentConv) {
      currentConv = row.conversation_id;
      pendingCustomer = null;
    }
    const ts = new Date(row.created_at);

    if (row.sender_type === 'customer') {
      if (!pendingCustomer) pendingCustomer = ts;
    } else if (
      row.sender_type === 'agent' &&
      row.sender_id &&
      pendingCustomer
    ) {
      const diffMin = (ts.getTime() - pendingCustomer.getTime()) / 60_000;
      if (diffMin >= 0) {
        samples.push({ agentId: row.sender_id, minutes: diffMin });
      }
      pendingCustomer = null;
    }
  }

  const byAgent = new Map<string, number[]>();
  for (const s of samples) {
    if (!byAgent.has(s.agentId)) byAgent.set(s.agentId, []);
    byAgent.get(s.agentId)!.push(s.minutes);
  }

  const result = new Map<string, AgentResponseTime>();
  for (const [agentId, mins] of byAgent) {
    const avg =
      mins.length > 0 ? mins.reduce((a, b) => a + b, 0) / mins.length : null;
    result.set(agentId, {
      agentId,
      avgMinutes: avg,
      sampleCount: mins.length,
    });
  }

  return result;
}

// ------------------------------------------------------------
// Deals — fetched once for the whole account window, then sliced
// by the pure helpers in aggregate.ts. One query powers the trend,
// quadrant, distribution and per-agent stats.
// ------------------------------------------------------------

async function fetchDealRowsInRange(
  db: DB,
  accountId: string,
  fromDate: string
): Promise<DealRowInput[]> {
  const { data, error } = await db
    .from('deals')
    .select('assigned_to, status, value, created_at')
    .eq('account_id', accountId)
    .gte('created_at', fromDate);
  if (error) throw error;
  return (data ?? []) as DealRowInput[];
}

async function fetchAllDealRows(
  db: DB,
  accountId: string
): Promise<DealRowInput[]> {
  const { data, error } = await db
    .from('deals')
    .select('assigned_to, status, value, created_at')
    .eq('account_id', accountId);
  if (error) throw error;
  return (data ?? []) as DealRowInput[];
}

/**
 * Build per-agent deal stats (with win-rate, avg value and trend)
 * from two windows of deal rows.
 */
function buildAgentDealStats(
  currentRows: readonly DealRowInput[],
  prevRows: readonly DealRowInput[],
  profileIdMap: Map<string, string>
): Map<string, AgentDealStats> {
  const curByAgent = aggregateDealsByProfile(currentRows);
  const prevByAgent = aggregateDealsByProfile(prevRows);

  const map = new Map<string, AgentDealStats>();
  for (const [profileId, agg] of curByAgent) {
    const userId = profileIdMap.get(profileId);
    if (!userId) continue;
    const prevWon = prevByAgent.get(profileId)?.dealsWon ?? 0;
    map.set(userId, {
      agentId: userId,
      totalDeals: agg.dealsOpen + agg.dealsWon + agg.dealsLost,
      dealsOpen: agg.dealsOpen,
      dealsWon: agg.dealsWon,
      dealsLost: agg.dealsLost,
      totalValueWon: agg.totalValueWon,
      winRate: computeWinRate(agg.dealsWon, agg.dealsLost),
      avgDealValue:
        agg.dealsWon > 0 ? agg.totalValueWon / agg.dealsWon : null,
      trend: computeTrend(agg.dealsWon, prevWon),
    });
  }

  return map;
}

// ------------------------------------------------------------
// Top-level composer.
// ------------------------------------------------------------

export async function loadAgentPerformance(
  db: DB,
  accountId: string,
  rangeDays: number
): Promise<{
  data: AgentPerformanceData;
  dealTrend: DealTrendPoint[];
  agentQuadrant: AgentQuadrantPoint[];
  dealDistribution: DealDistributionSlice[];
}> {
  const fromDate = daysAgoStart(rangeDays - 1).toISOString();
  // Previous window of equal length, for the trend (▲/▼) column.
  const prevFromIso = daysAgoStart(rangeDays * 2 - 1).toISOString();

  const { agents, profileIdMap } = await loadAgentRoster(db, accountId);

  // Fetch the deal windows once; everything below is pure math on
  // the in-memory rows, so we avoid re-querying for each chart.
  const [currentDealRows, prevDealRows, allDealRows] = await Promise.all([
    fetchDealRowsInRange(db, accountId, fromDate),
    fetchDealRowsInRange(db, accountId, prevFromIso),
    fetchAllDealRows(db, accountId),
  ]);

  // ------------------------------------------------------------
  // Virtual "Sin asignar" agent.
  // Deals without assigned_to (or whose assignee isn't in the
  // active roster) become invisible to per-agent stats. In a
  // single-tenant portal this is the common case — we create a
  // virtual agent row so those deals still appear in ranking,
  // quadrant and distribution charts.
  // ------------------------------------------------------------
  const hasOrphanDeals = allDealRows.some(
    r => !r.assigned_to || !profileIdMap.has(r.assigned_to)
  );
  let unassignedProfileId: string | undefined;
  if (hasOrphanDeals) {
    unassignedProfileId = randomUUID();
    const virtualAgent: AgentInfo = {
      userId: unassignedProfileId,
      profileId: unassignedProfileId,
      fullName: 'Sin asignar',
      avatarUrl: null,
      role: 'agent',
      isUnassigned: true,
    };
    agents.push(virtualAgent);
    profileIdMap.set(unassignedProfileId, unassignedProfileId);
  }

  const assignToProfile = (pid: string | null): string | null => {
    if (!pid) return unassignedProfileId ?? null;
    if (!profileIdMap.has(pid)) return unassignedProfileId ?? null;
    return pid;
  };

  // The conversation/message/response loaders still hit their own
  // tables; they're independent of the deal rows.
  const [convStats, msgStats, respTimes] = await Promise.all([
    loadAgentConversationStats(db, accountId),
    loadAgentMessageStats(db, accountId, fromDate),
    loadAgentResponseTimes(db, accountId, fromDate),
  ]);

  const dealStats = buildAgentDealStats(
    currentDealRows.map(r => ({ ...r, assigned_to: assignToProfile(r.assigned_to) })),
    prevDealRows.map(r => ({ ...r, assigned_to: assignToProfile(r.assigned_to) })),
    profileIdMap
  );

  const dealTrend = bucketDealTrend(currentDealRows, fromDate);

  const nameByUserId = new Map<string, string>();
  for (const a of agents) nameByUserId.set(a.userId, a.fullName);

  const normalizedAll = allDealRows.map(r => ({
    ...r,
    assigned_to: assignToProfile(r.assigned_to),
  }));
  const allByProfile = aggregateDealsByProfile(normalizedAll);
  const agentQuadrant = buildQuadrantPoints(
    allByProfile,
    profileIdMap,
    nameByUserId
  );

  const perAgentValue: { name: string; value: number }[] = [];
  for (const [profileId, agg] of allByProfile) {
    const userId = profileIdMap.get(profileId);
    if (!userId || agg.totalValueWon <= 0) continue;
    perAgentValue.push({
      name: nameByUserId.get(userId) ?? 'Agente',
      value: agg.totalValueWon,
    });
  }
  const dealDistribution = buildDealDistribution(perAgentValue);

  const rows: AgentPerformanceRow[] = agents.map((agent) => ({
    agent,
    conversations: convStats.get(agent.userId) ?? null,
    messages: msgStats.get(agent.userId) ?? null,
    responseTime: respTimes.get(agent.userId) ?? null,
    deals: dealStats.get(agent.userId) ?? null,
  }));

  const accountTotals = aggregateAccountDeals(allDealRows);
  const matriculados = rows.reduce(
    (s, r) => s + (r.deals?.dealsWon ?? 0),
    0
  );
  const perdidos = rows.reduce((s, r) => s + (r.deals?.dealsLost ?? 0), 0);

  const totals = {
    totalDealsCreated: accountTotals.totalCreated,
    matriculados,
    perdidos,
    comisiones: accountTotals.totalValueWon,
    pipelineValue: accountTotals.totalValueOpen,
    winRate: computeWinRate(matriculados, perdidos),
  };

  return {
    data: { agents, rows, totals },
    dealTrend,
    agentQuadrant,
    dealDistribution,
  };
}
