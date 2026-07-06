'use client';

import { useMemo } from 'react';
import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { AgentQuadrantPoint } from '@/lib/agent-analytics/types';
import { formatCurrencyShort } from '@/lib/currency';

interface QuadrantChartProps {
  points: AgentQuadrantPoint[];
  currency: string;
  /** Labels for the four quadrant tooltips (i18n). */
  labels: {
    axisX: string;
    axisY: string;
    deals: string;
    won: string;
    winRate: string;
    commission: string;
    star: string;
    coach: string;
    underutilized: string;
    novice: string;
  };
}

// Tailwind-friendly hex colors per quadrant. Picked to read well on
// the card surface and stay distinguishable for color-blind users.
const QUADRANT_COLORS = {
  star: '#10b981', // emerald
  coach: '#f59e0b', // amber
  underutilized: '#3b82f6', // blue
  novice: '#94a3b8', // slate
};

/**
 * Classify a point into one of four management quadrants based on
 * its position relative to the median volume (X) and median win
 * rate (Y). The medians are computed from the visible points so the
 * split always balances the team rather than using an arbitrary
 * threshold.
 */
function quadrantOf(
  point: AgentQuadrantPoint,
  medX: number,
  medY: number
): keyof typeof QUADRANT_COLORS {
  const highVol = point.totalDeals >= medX;
  const highEff = point.winRate >= medY;
  if (highVol && highEff) return 'star';
  if (highVol && !highEff) return 'coach';
  if (!highVol && highEff) return 'underutilized';
  return 'novice';
}

export function QuadrantChart({ points, currency, labels }: QuadrantChartProps) {
  const { medX, medY, data } = useMemo(() => {
    const sortedX = [...points].sort((a, b) => a.totalDeals - b.totalDeals);
    const sortedY = [...points].sort((a, b) => a.winRate - b.winRate);
    const mid = Math.floor(points.length / 2);
    const mx =
      points.length > 0
        ? sortedX[mid]?.totalDeals ?? 0
        : 0;
    const my =
      points.length > 0
        ? sortedY[mid]?.winRate ?? 0
        : 0;
    const enriched = points.map((p) => ({
      ...p,
      quadrant: quadrantOf(p, mx, my),
    }));
    return { medX: mx, medY: my, data: enriched };
  }, [points]);

  if (points.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <ScatterChart margin={{ top: 16, right: 24, bottom: 28, left: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          type="number"
          dataKey="totalDeals"
          name={labels.axisX}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          label={{
            value: labels.axisX,
            position: 'insideBottom',
            offset: -14,
            fontSize: 11,
            fill: 'var(--muted-foreground)',
          }}
          allowDecimals={false}
        />
        <YAxis
          type="number"
          dataKey="winRate"
          name={labels.axisY}
          domain={[0, 1]}
          ticks={[0, 0.25, 0.5, 0.75, 1]}
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          stroke="var(--muted-foreground)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <ZAxis type="number" dataKey="totalValue" range={[60, 320]} />
        {/* Median dividers split the field into the four quadrants. */}
        <ReferenceLine
          x={medX}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <ReferenceLine
          y={medY}
          stroke="var(--border)"
          strokeDasharray="4 4"
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3', stroke: 'var(--muted-foreground)' }}
          content={<QuadrantTooltip currency={currency} labels={labels} />}
        />
        {/* One scatter series per quadrant so each gets its own color. */}
        <Scatter
          data={data.filter((d) => d.quadrant === 'star')}
          fill={QUADRANT_COLORS.star}
          fillOpacity={0.8}
          name={labels.star}
        />
        <Scatter
          data={data.filter((d) => d.quadrant === 'coach')}
          fill={QUADRANT_COLORS.coach}
          fillOpacity={0.8}
          name={labels.coach}
        />
        <Scatter
          data={data.filter((d) => d.quadrant === 'underutilized')}
          fill={QUADRANT_COLORS.underutilized}
          fillOpacity={0.8}
          name={labels.underutilized}
        />
        <Scatter
          data={data.filter((d) => d.quadrant === 'novice')}
          fill={QUADRANT_COLORS.novice}
          fillOpacity={0.8}
          name={labels.novice}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

interface TooltipPayload {
  payload: AgentQuadrantPoint & { quadrant: keyof typeof QUADRANT_COLORS };
}

function QuadrantTooltip({
  active,
  payload,
  currency,
  labels,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  currency: string;
  labels: QuadrantChartProps['labels'];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  const tagMap: Record<keyof typeof QUADRANT_COLORS, string> = {
    star: labels.star,
    coach: labels.coach,
    underutilized: labels.underutilized,
    novice: labels.novice,
  };
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-foreground">{p.agentName}</p>
      <p className="mt-0.5 font-medium" style={{ color: QUADRANT_COLORS[p.quadrant] }}>
        {tagMap[p.quadrant]}
      </p>
      <dl className="mt-1.5 space-y-0.5 text-muted-foreground">
        <div className="flex justify-between gap-4">
          <dt>{labels.deals}</dt>
          <dd className="tabular-nums text-foreground">{p.totalDeals}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{labels.won}</dt>
          <dd className="tabular-nums text-foreground">{p.dealsWon}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{labels.winRate}</dt>
          <dd className="tabular-nums text-foreground">
            {Math.round(p.winRate * 100)}%
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt>{labels.commission}</dt>
          <dd className="tabular-nums text-foreground">
            {formatCurrencyShort(p.totalValue, currency)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
