import type { AccountRole } from '@/lib/auth/roles';

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
    totalConversations: number;
    totalMessages: number;
    totalDealsWon: number;
    totalValueWon: number;
    avgResponseMinutes: number | null;
  };
}

export interface FlowHandoffStat {
  flowId: string;
  flowName: string;
  totalRuns: number;
  handoffRuns: number;
  handoffRate: number;
}
