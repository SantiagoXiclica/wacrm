'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { formatCurrency } from '@/lib/currency';
import {
  MessageSquare,
  Timer,
  Trophy,
  DollarSign,
  TrendingUp,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
} from 'lucide-react';

import { loadAgentPerformance } from '@/lib/agent-analytics/queries';
import type {
  AgentPerformanceData,
  AgentPerformanceRow,
  FlowHandoffStat,
} from '@/lib/agent-analytics/types';

import { BarChart } from '@/components/tremor/bar-chart';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/dashboard/skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { cn } from '@/lib/utils';

type RangeDays = 7 | 30 | 90;

type SortKey =
  | 'agent'
  | 'conversations'
  | 'messages'
  | 'responseTime'
  | 'resolution'
  | 'dealsWon'
  | 'valueWon';

type SortDir = 'asc' | 'desc';

export default function AgentPerformancePage() {
  const t = useTranslations('agentPerformance');
  const { isAdmin, isOwner, defaultCurrency } = useAuth();

  const [data, setData] = useState<AgentPerformanceData | null>(null);
  const [flowStats, setFlowStats] = useState<FlowHandoffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<RangeDays>(30);
  const [sortKey, setSortKey] = useState<SortKey>('conversations');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      setLoading(true);
      setError(false);
      const db = createClient();
      try {
        const result = await loadAgentPerformance(db, range);
        if (cancelled) return;
        setData(result.data);
        setFlowStats(result.flowStats);
      } catch (err) {
        if (cancelled) return;
        console.error('[agent-performance] load failed:', err);
        setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    loadAll();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // Sorted ranking rows. Computed before the role-gate early return so
  // the hook order stays stable across renders (rules-of-hooks).
  // Null avgMinutes always sorts last regardless of direction —
  // "no data" should never jump to the top of a descending list.
  const sortedRows = useMemo<AgentPerformanceRow[]>(() => {
    if (!data) return [];
    const rows = [...data.rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      switch (sortKey) {
        case 'agent':
          return a.agent.fullName.localeCompare(b.agent.fullName) * dir;
        case 'conversations':
          return (
            ((a.conversations?.totalAssigned ?? 0) -
              (b.conversations?.totalAssigned ?? 0)) *
            dir
          );
        case 'messages':
          return (
            ((a.messages?.messagesSent ?? 0) -
              (b.messages?.messagesSent ?? 0)) *
            dir
          );
        case 'responseTime': {
          const av = a.responseTime?.avgMinutes;
          const bv = b.responseTime?.avgMinutes;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av - bv) * dir;
        }
        case 'resolution':
          return (
            ((a.conversations?.resolutionRate ?? 0) -
              (b.conversations?.resolutionRate ?? 0)) *
            dir
          );
        case 'dealsWon':
          return ((a.deals?.dealsWon ?? 0) - (b.deals?.dealsWon ?? 0)) * dir;
        case 'valueWon':
          return (
            ((a.deals?.totalValueWon ?? 0) - (b.deals?.totalValueWon ?? 0)) *
            dir
          );
        default:
          return 0;
      }
    });
    return rows;
  }, [data, sortKey, sortDir]);

  if (!isAdmin && !isOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={AlertCircle}
          title={t('accessDenied')}
          hint={t('accessDeniedHint')}
        />
      </div>
    );
  }

  const fmtMinutes = (mins: number | null | undefined): string => {
    if (mins == null) return '—';
    if (mins < 1) return `${Math.max(1, Math.round(mins * 60))}s`;
    if (mins < 60) return `${mins.toFixed(1)}m`;
    return `${(mins / 60).toFixed(1)}h`;
  };

  const fmtPercent = (rate: number | undefined): string => {
    if (rate == null) return '—';
    return `${(rate * 100).toFixed(0)}%`;
  };

  // i18n labels used as BarChart data keys + categories so legends and
  // tooltips render in the active locale instead of hardcoded Spanish.
  const catWorkload = t('catWorkload');
  const catResponseTime = t('catResponseTime');
  const catWon = t('catWon');
  const catLost = t('catLost');
  const catHandoff = t('catHandoff');

  const workloadChartData =
    data?.rows.map((r) => ({
      name: r.agent.fullName,
      [catWorkload]: r.conversations?.activeNow ?? 0,
    })) ?? [];

  const responseTimeChartData =
    data?.rows
      .filter((r) => r.responseTime?.avgMinutes != null)
      .map((r) => ({
        name: r.agent.fullName,
        [catResponseTime]: r.responseTime?.avgMinutes ?? 0,
      })) ?? [];

  const dealsChartData =
    data?.rows
      .filter((r) => r.deals && (r.deals.dealsWon > 0 || r.deals.dealsLost > 0))
      .map((r) => ({
        name: r.agent.fullName,
        [catWon]: r.deals?.dealsWon ?? 0,
        [catLost]: r.deals?.dealsLost ?? 0,
      })) ?? [];

  const hasAnyData =
    data != null &&
    data.rows.some(
      (r) => r.conversations != null || r.messages != null || r.deals != null
    );

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <div className="border-border flex gap-1 rounded-lg border p-1">
          {([7, 30, 90] as RangeDays[]).map((d) => (
            <button
              key={d}
              onClick={() => setRange(d)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === d
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
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
          title={t('errorTitle')}
          hint={t('errorHint')}
        />
      ) : !data || !hasAnyData ? (
        <EmptyState
          icon={TrendingUp}
          title={t('noData')}
          hint={t('noDataHint')}
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={MessageSquare}
              label={t('totalConversations')}
              value={String(data.totals.totalConversations)}
            />
            <KpiCard
              icon={MessageSquare}
              label={t('totalMessages')}
              value={String(data.totals.totalMessages)}
            />
            <KpiCard
              icon={Trophy}
              label={t('totalDealsWon')}
              value={String(data.totals.totalDealsWon)}
            />
            <KpiCard
              icon={DollarSign}
              label={t('totalValueWon')}
              value={formatCurrency(data.totals.totalValueWon, defaultCurrency)}
            />
          </div>

          <ChartCard
            title={t('workloadTitle')}
            subtitle={t('workloadSubtitle')}
          >
            {workloadChartData.length > 0 ? (
              <BarChart
                data={workloadChartData}
                index="name"
                categories={[catWorkload]}
                colors={['blue']}
                showLegend={false}
                yAxisWidth={48}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={MessageSquare}
                title={t('noWorkload')}
                hint={t('noWorkloadHint')}
              />
            )}
          </ChartCard>

          <ChartCard
            title={t('responseTimeTitle')}
            subtitle={t('responseTimeSubtitle')}
          >
            {responseTimeChartData.length > 0 ? (
              <BarChart
                data={responseTimeChartData}
                index="name"
                categories={[catResponseTime]}
                colors={['violet']}
                showLegend={false}
                yAxisWidth={48}
                valueFormatter={(v) => fmtMinutes(v as number)}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={Timer}
                title={t('noResponseTime')}
                hint={t('noResponseTimeHint')}
              />
            )}
          </ChartCard>

          <ChartCard title={t('dealsTitle')} subtitle={t('dealsSubtitle')}>
            {dealsChartData.length > 0 ? (
              <BarChart
                data={dealsChartData}
                index="name"
                categories={[catWon, catLost]}
                colors={['emerald', 'pink']}
                showLegend={true}
                yAxisWidth={48}
                className="h-[260px]"
              />
            ) : (
              <EmptyState
                icon={Trophy}
                title={t('noDeals')}
                hint={t('noDealsHint')}
              />
            )}
          </ChartCard>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">{t('rankingTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHead
                      label={t('colAgent')}
                      keyName="agent"
                      align="left"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colConversations')}
                      keyName="conversations"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colMessages')}
                      keyName="messages"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colResponseTime')}
                      keyName="responseTime"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colResolution')}
                      keyName="resolution"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colDealsWon')}
                      keyName="dealsWon"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colValueWon')}
                      keyName="valueWon"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
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
                          defaultCurrency
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {flowStats.length > 0 && (
            <ChartCard
              title={t('handoffTitle')}
              subtitle={t('handoffSubtitle')}
            >
              <BarChart
                data={flowStats.slice(0, 10).map((f) => ({
                  name: f.flowName,
                  [catHandoff]: Math.round(f.handoffRate * 100),
                }))}
                index="name"
                categories={[catHandoff]}
                colors={['amber']}
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

function SortIndicator({
  keyName,
  activeKey,
  dir,
}: {
  keyName: SortKey;
  activeKey: SortKey;
  dir: SortDir;
}) {
  if (activeKey !== keyName) {
    return (
      <ArrowUpDown
        className="text-muted-foreground/50 ml-1 inline h-3 w-3"
        aria-hidden="true"
      />
    );
  }
  return dir === 'asc' ? (
    <ArrowUp className="text-primary ml-1 inline h-3 w-3" aria-hidden="true" />
  ) : (
    <ArrowDown
      className="text-primary ml-1 inline h-3 w-3"
      aria-hidden="true"
    />
  );
}

function SortableHead({
  label,
  keyName,
  align = 'right',
  activeKey,
  dir,
  onToggle,
  hint,
}: {
  label: string;
  keyName: SortKey;
  align?: 'left' | 'right';
  activeKey: SortKey;
  dir: SortDir;
  onToggle: (key: SortKey) => void;
  hint: string;
}) {
  return (
    <TableHead className={align === 'right' ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onToggle(keyName)}
        title={hint}
        className={cn(
          'hover:text-foreground inline-flex items-center gap-0.5 text-xs font-medium transition-colors',
          align === 'right' && 'flex-row-reverse',
          activeKey === keyName && 'text-primary'
        )}
      >
        <span>{label}</span>
        <SortIndicator keyName={keyName} activeKey={activeKey} dir={dir} />
      </button>
    </TableHead>
  );
}

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
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Icon className="text-primary h-5 w-5" />
        </div>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
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
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
