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
  AgentResponseTime,
  FlowHandoffStat,
} from './types';

type DB = SupabaseClient;

export async function loadAgentRoster(db: DB): Promise<{
  agents: AgentInfo[];
  profileIdMap: Map<string, string>;
}> {
  const { data, error } = await db
    .from('profiles')
    .select('id, user_id, full_name, avatar_url, account_role')
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
  db: DB
): Promise<Map<string, AgentConversationStats>> {
  const { data, error } = await db
    .from('conversations')
    .select('assigned_agent_id, status')
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
  fromDate: string
): Promise<Map<string, AgentMessageStats>> {
  const { data, error } = await db
    .from('messages')
    .select('sender_id')
    .eq('sender_type', 'agent')
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
  fromDate: string
): Promise<Map<string, AgentResponseTime>> {
  const { data, error } = await db
    .from('messages')
    .select('conversation_id, sender_type, sender_id, created_at')
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

export async function loadAgentDealStats(
  db: DB
): Promise<Map<string, AgentDealStats>> {
  const { data, error } = await db
    .from('deals')
    .select('assigned_to, status, value')
    .not('assigned_to', 'is', null);

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
    if (row.status === 'open') s.dealsOpen++;
    if (row.status === 'won') {
      s.dealsWon++;
      s.totalValueWon += Number(row.value) || 0;
    }
    if (row.status === 'lost') s.dealsLost++;
  }

  return map;
}

export async function loadFlowHandoffStats(db: DB): Promise<FlowHandoffStat[]> {
  const { data: flows, error: flowsErr } = await db
    .from('flows')
    .select('id, name')
    .order('name', { ascending: true });
  if (flowsErr) throw flowsErr;

  const { data: runs, error: runsErr } = await db
    .from('flow_runs')
    .select('flow_id, status');
  if (runsErr) throw runsErr;

  const flowNames = new Map<string, string>();
  for (const f of flows ?? []) flowNames.set(f.id, f.name);

  const stats = new Map<string, { total: number; handoff: number }>();

  for (const r of runs ?? []) {
    if (!stats.has(r.flow_id)) {
      stats.set(r.flow_id, { total: 0, handoff: 0 });
    }
    const s = stats.get(r.flow_id)!;
    s.total++;
    if (r.status === 'handed_off') s.handoff++;
  }

  const result: FlowHandoffStat[] = [];
  for (const [flowId, s] of stats) {
    result.push({
      flowId,
      flowName: flowNames.get(flowId) ?? 'Flow sin nombre',
      totalRuns: s.total,
      handoffRuns: s.handoff,
      handoffRate: s.total > 0 ? s.handoff / s.total : 0,
    });
  }

  result.sort((a, b) => b.handoffRate - a.handoffRate);

  return result;
}

export async function loadAgentPerformance(
  db: DB,
  rangeDays: number
): Promise<{
  data: AgentPerformanceData;
  flowStats: FlowHandoffStat[];
}> {
  const fromDate = daysAgoStart(rangeDays - 1).toISOString();

  const [
    { agents, profileIdMap },
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

  const dealStats = new Map<string, AgentDealStats>();
  for (const [profileId, stats] of dealStatsByProfile) {
    const userId = profileIdMap.get(profileId);
    if (userId) {
      dealStats.set(userId, { ...stats, agentId: userId });
    }
  }

  const rows: AgentPerformanceRow[] = agents.map((agent) => ({
    agent,
    conversations: convStats.get(agent.userId) ?? null,
    messages: msgStats.get(agent.userId) ?? null,
    responseTime: respTimes.get(agent.userId) ?? null,
    deals: dealStats.get(agent.userId) ?? null,
  }));

  const allRespTimes = Array.from(respTimes.values());
  const totalSamples = allRespTimes.reduce((sum, r) => sum + r.sampleCount, 0);
  const weightedRespSum = allRespTimes.reduce(
    (sum, r) => sum + (r.avgMinutes ?? 0) * r.sampleCount,
    0
  );

  const totals = {
    totalConversations: rows.reduce(
      (s, r) => s + (r.conversations?.totalAssigned ?? 0),
      0
    ),
    totalMessages: rows.reduce(
      (s, r) => s + (r.messages?.messagesSent ?? 0),
      0
    ),
    totalDealsWon: rows.reduce((s, r) => s + (r.deals?.dealsWon ?? 0), 0),
    totalValueWon: rows.reduce((s, r) => s + (r.deals?.totalValueWon ?? 0), 0),
    avgResponseMinutes:
      totalSamples > 0 ? weightedRespSum / totalSamples : null,
  };

  return {
    data: { agents, rows, totals },
    flowStats,
  };
}
