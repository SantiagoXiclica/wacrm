'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useTranslations } from 'next-intl';
import { formatCurrency, formatCurrencyShort } from '@/lib/currency';
import {
  Trophy,
  DollarSign,
  TrendingUp,
  Target,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Minus,
  ArrowUpDown,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart as RechartsBarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type {
  AgentPerformanceData,
  AgentPerformanceRow,
  AgentQuadrantPoint,
  DealDistributionSlice,
  DealTrendPoint,
} from '@/lib/agent-analytics/types';

import { QuadrantChart } from '@/components/dashboard/quadrant-chart';
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
  | 'solicitudes'
  | 'matriculados'
  | 'perdidos'
  | 'winRate'
  | 'comisiones'
  | 'avgCommission';

type SortDir = 'asc' | 'desc';

// Pie slice palette — distinct, accessible, readable on card bg.
const DONUT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#94a3b8', // slate (Otros)
];

interface ApiResponse {
  data: AgentPerformanceData;
  dealTrend: DealTrendPoint[];
  agentQuadrant: AgentQuadrantPoint[];
  dealDistribution: DealDistributionSlice[];
}

export default function AgentPerformancePage() {
  const t = useTranslations('agentPerformance');
  const { isAdmin, isOwner, defaultCurrency } = useAuth();

  const [result, setResult] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<RangeDays>(30);
  const [sortKey, setSortKey] = useState<SortKey>('comisiones');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    let cancelled = false;
    const loadAll = async () => {
      setLoading(true);
      setError(false);
      try {
        const res = await fetch(`/api/agent-performance?range=${range}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error ?? `HTTP ${res.status}`);
        }
        const json: ApiResponse = await res.json();
        if (cancelled) return;
        setResult(json);
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

  // Sorted ranking. Computed before the role-gate early return so the
  // hook order stays stable across renders (rules-of-hooks). Null
  // win-rate always sorts last in descending order — "no closed
  // deals" should never jump to the top.
  const sortedRows = useMemo<AgentPerformanceRow[]>(() => {
    if (!result) return [];
    const rows = [...result.data.rows];
    const dir = sortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      const ad = a.deals;
      const bd = b.deals;
      switch (sortKey) {
        case 'agent':
          return a.agent.fullName.localeCompare(b.agent.fullName) * dir;
        case 'solicitudes':
          return ((ad?.totalDeals ?? 0) - (bd?.totalDeals ?? 0)) * dir;
        case 'matriculados':
          return ((ad?.dealsWon ?? 0) - (bd?.dealsWon ?? 0)) * dir;
        case 'perdidos':
          return ((ad?.dealsLost ?? 0) - (bd?.dealsLost ?? 0)) * dir;
        case 'winRate': {
          const av = ad?.winRate;
          const bv = bd?.winRate;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av - bv) * dir;
        }
        case 'comisiones':
          return (
            ((ad?.totalValueWon ?? 0) - (bd?.totalValueWon ?? 0)) * dir
          );
        case 'avgCommission': {
          const av = ad?.avgDealValue;
          const bv = bd?.avgDealValue;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return (av - bv) * dir;
        }
        default:
          return 0;
      }
    });
    return rows;
  }, [result, sortKey, sortDir]);

  // Top-K commission chart data. Computed before the role-gate early
  // return so the hook order stays stable (rules-of-hooks).
  const catCommission = t('catCommission');
  const topChartData = useMemo(
    () =>
      [...(result?.dealDistribution ?? [])]
        .filter((s) => !s.isOther)
        .map((s) => ({ name: s.name, [catCommission]: s.value }))
        .sort((a, b) => (b[catCommission] as number) - (a[catCommission] as number))
        .slice(0, 10),
    [result?.dealDistribution, catCommission]
  );

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

  const data = result?.data;
  const totals = data?.totals;

  const fmtPercent = (rate: number | null | undefined): string => {
    if (rate == null) return '—';
    return `${(rate * 100).toFixed(0)}%`;
  };

  // i18n category labels — used as chart series keys so legends and
  // tooltips render in the active locale.
  const catSolicitudes = t('catSolicitudes');
  const catMatriculados = t('catMatriculados');

  const trendChartData =
    result?.dealTrend.map((p) => ({
      name: fmtWeek(p.date),
      [catSolicitudes]: p.created,
      [catMatriculados]: p.won,
    })) ?? [];

  const hasAnyDeals =
    totals != null && (totals.totalDealsCreated > 0 || totals.matriculados > 0 || totals.perdidos > 0 || totals.pipelineValue > 0);

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
      ) : !result || !hasAnyDeals ? (
        <EmptyState
          icon={TrendingUp}
          title={t('noData')}
          hint={t('noDataHint')}
        />
      ) : (
        <>
          {/* KPI cards — business metrics, not chat volume. */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={Trophy}
              label={t('kpiMatriculados')}
              value={String(totals!.matriculados)}
            />
            <KpiCard
              icon={DollarSign}
              label={t('kpiComisiones')}
              value={formatCurrency(totals!.comisiones, defaultCurrency)}
            />
            <KpiCard
              icon={TrendingUp}
              label={t('kpiWinRate')}
              value={fmtPercent(totals!.winRate)}
            />
            <KpiCard
              icon={Target}
              label={t('kpiPipeline')}
              value={formatCurrencyShort(totals!.pipelineValue, defaultCurrency)}
            />
          </div>

          {/* Trend + quadrant — side by side on large screens. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={t('trendTitle')} subtitle={t('trendSubtitle')}>
              {trendChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={trendChartData}
                    margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="gSolicitudes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gMatriculados" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={32}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      labelStyle={{ color: 'var(--foreground)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey={catSolicitudes}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      fill="url(#gSolicitudes)"
                    />
                    <Area
                      type="monotone"
                      dataKey={catMatriculados}
                      stroke="#10b981"
                      strokeWidth={2}
                      fill="url(#gMatriculados)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={TrendingUp}
                  title={t('noTrend')}
                  hint={t('noTrendHint')}
                />
              )}
            </ChartCard>

            <ChartCard
              title={t('quadrantTitle')}
              subtitle={t('quadrantSubtitle')}
            >
              {result.agentQuadrant.length > 0 ? (
                <QuadrantChart
                  points={result.agentQuadrant}
                  currency={defaultCurrency}
                  labels={{
                    axisX: t('qAxisX'),
                    axisY: t('qAxisY'),
                    deals: t('qDeals'),
                    won: t('qWon'),
                    winRate: t('qWinRate'),
                    commission: t('qCommission'),
                    star: t('qStar'),
                    coach: t('qCoach'),
                    underutilized: t('qUnderutilized'),
                    novice: t('qNovice'),
                  }}
                />
              ) : (
                <EmptyState
                  icon={Target}
                  title={t('noQuadrant')}
                  hint={t('noQuadrantHint')}
                />
              )}
            </ChartCard>
          </div>

          {/* Top K + distribution donut. */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={t('topTitle')} subtitle={t('topSubtitle')}>
              {topChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBarChart
                    data={topChartData}
                    layout="vertical"
                    margin={{ top: 0, right: 24, bottom: 0, left: 8 }}
                  >
                    <XAxis
                      type="number"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v: number) =>
                        formatCurrencyShort(v, defaultCurrency)
                      }
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="var(--muted-foreground)"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                      width={96}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(v) =>
                        formatCurrency(Number(v), defaultCurrency)
                      }
                    />
                    <Bar
                      dataKey={catCommission}
                      fill="#3b82f6"
                      radius={[0, 4, 4, 0]}
                    />
                  </RechartsBarChart>
                </ResponsiveContainer>
              ) : (
                <EmptyState
                  icon={DollarSign}
                  title={t('noTop')}
                  hint={t('noTopHint')}
                />
              )}
            </ChartCard>

            <ChartCard
              title={t('distTitle')}
              subtitle={t('distSubtitle')}
            >
              {result.dealDistribution.length > 0 ? (
                <DonutDistribution
                  slices={result.dealDistribution}
                  total={totals!.comisiones}
                  currency={defaultCurrency}
                  totalLabel={t('distTotal')}
                />
              ) : (
                <EmptyState
                  icon={DollarSign}
                  title={t('noDist')}
                  hint={t('noDistHint')}
                />
              )}
            </ChartCard>
          </div>

          {/* Ranking table — the tactical detail. */}
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
                      label={t('colSolicitudes')}
                      keyName="solicitudes"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colMatriculados')}
                      keyName="matriculados"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colPerdidos')}
                      keyName="perdidos"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colWinRate')}
                      keyName="winRate"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colComisiones')}
                      keyName="comisiones"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <SortableHead
                      label={t('colAvgCommission')}
                      keyName="avgCommission"
                      activeKey={sortKey}
                      dir={sortDir}
                      onToggle={toggleSort}
                      hint={t('sortHint')}
                    />
                    <TableHead className="text-right text-xs font-medium">
                      {t('colTrend')}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRows.map((row) => (
                    <TableRow key={row.agent.userId}>
                      <TableCell className="font-medium">
                        {row.agent.isUnassigned ? t('unassigned') : row.agent.fullName}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deals?.totalDeals ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deals?.dealsWon ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deals?.dealsLost ?? 0}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtPercent(row.deals?.winRate)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          row.deals?.totalValueWon ?? 0,
                          defaultCurrency
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {row.deals?.avgDealValue != null
                          ? formatCurrency(row.deals.avgDealValue, defaultCurrency)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <TrendIndicator trend={row.deals?.trend ?? 'unknown'} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  fontSize: '12px',
  color: 'var(--foreground)',
} as const;

/** Format an ISO week-start date as a short label: "Sem. 14 jul". */
function fmtWeek(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
  });
}

function TrendIndicator({
  trend,
}: {
  trend: 'up' | 'down' | 'flat' | 'unknown';
}) {
  if (trend === 'unknown') return <span className="text-muted-foreground">—</span>;
  if (trend === 'up')
    return <ArrowUp className="ml-auto h-4 w-4 text-emerald-500" aria-label="up" />;
  if (trend === 'down')
    return <ArrowDown className="ml-auto h-4 w-4 text-pink-500" aria-label="down" />;
  return <Minus className="ml-auto h-4 w-4 text-muted-foreground" aria-label="flat" />;
}

function DonutDistribution({
  slices,
  total,
  currency,
  totalLabel,
}: {
  slices: DealDistributionSlice[];
  total: number;
  currency: string;
  totalLabel: string;
}) {
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div className="relative">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={slices}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={56}
              outerRadius={80}
              paddingAngle={2}
              stroke="none"
            >
              {slices.map((s, i) => (
                <Cell
                  key={s.name}
                  fill={s.isOther ? DONUT_COLORS[5] : DONUT_COLORS[i % 5]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={tooltipStyle}
              formatter={(v) => formatCurrency(Number(v), currency)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-muted-foreground text-[10px]">{totalLabel}</span>
          <span className="text-foreground text-base font-semibold tabular-nums">
            {formatCurrencyShort(total, currency)}
          </span>
        </div>
      </div>
      <ul className="w-full flex-1 space-y-2">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{
                background: s.isOther ? DONUT_COLORS[5] : DONUT_COLORS[i % 5],
              }}
              aria-hidden
            />
            <span className="text-muted-foreground flex-1 truncate">{s.name}</span>
            <span className="text-muted-foreground tabular-nums">
              {Math.round(s.percentage * 100)}%
            </span>
            <span className="w-20 text-right text-muted-foreground tabular-nums">
              {formatCurrencyShort(s.value, currency)}
            </span>
          </li>
        ))}
      </ul>
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
  icon: typeof Trophy;
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
