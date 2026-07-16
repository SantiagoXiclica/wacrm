import { describe, expect, it } from 'vitest';
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

const row = (
  assignedTo: string | null,
  status: string,
  value: number,
  createdAt: string
): DealRowInput => ({ assigned_to: assignedTo, status, value, created_at: createdAt });

describe('computeWinRate', () => {
  it('returns the fraction won / (won + lost)', () => {
    expect(computeWinRate(3, 1)).toBe(0.75);
    expect(computeWinRate(0, 5)).toBe(0);
    expect(computeWinRate(5, 0)).toBe(1);
  });
  it('returns null when no deals are closed', () => {
    expect(computeWinRate(0, 0)).toBeNull();
  });
});

describe('computeTrend', () => {
  it('returns up when current > previous', () => {
    expect(computeTrend(5, 3)).toBe('up');
  });
  it('returns down when current < previous', () => {
    expect(computeTrend(1, 4)).toBe('down');
  });
  it('returns flat when equal and non-zero', () => {
    expect(computeTrend(2, 2)).toBe('flat');
  });
  it('returns unknown when both periods are zero', () => {
    expect(computeTrend(0, 0)).toBe('unknown');
  });
});

describe('aggregateDealsByProfile', () => {
  it('groups rows by profile id and sums value per status', () => {
    const rows = [
      row('p1', 'won', 100, '2026-01-01'),
      row('p1', 'won', 200, '2026-01-02'),
      row('p1', 'lost', 0, '2026-01-03'),
      row('p1', 'open', 50, '2026-01-04'),
      row('p2', 'won', 500, '2026-01-01'),
    ];
    const map = aggregateDealsByProfile(rows);
    expect(map.get('p1')).toEqual({
      dealsOpen: 1,
      dealsWon: 2,
      dealsLost: 1,
      totalValueWon: 300,
      totalValueOpen: 50,
    });
    expect(map.get('p2')?.totalValueWon).toBe(500);
  });
  it('skips rows with no assigned_to', () => {
    const map = aggregateDealsByProfile([row(null, 'won', 100, '2026-01-01')]);
    expect(map.size).toBe(0);
  });
  it('coerces string values to numbers', () => {
    const map = aggregateDealsByProfile([
      row('p1', 'won', '150' as unknown as number, '2026-01-01'),
    ]);
    expect(map.get('p1')?.totalValueWon).toBe(150);
  });
});

describe('aggregateAccountDeals', () => {
  it('rolls up all rows into a single totals object', () => {
    const rows = [
      row('p1', 'won', 100, '2026-01-01'),
      row('p2', 'won', 200, '2026-01-01'),
      row('p1', 'open', 50, '2026-01-01'),
      row('p1', 'lost', 0, '2026-01-01'),
    ];
    expect(aggregateAccountDeals(rows)).toEqual({
      totalCreated: 4,
      dealsOpen: 1,
      dealsWon: 2,
      dealsLost: 1,
      totalValueWon: 300,
      totalValueOpen: 50,
    });
  });
});

describe('bucketDealTrend', () => {
  const from = '2026-01-01T00:00:00.000Z';
  it('returns empty for no rows', () => {
    expect(bucketDealTrend([], from)).toEqual([]);
  });
  it('groups rows into weekly buckets aligned to fromDate', () => {
    const rows = [
      row('p1', 'won', 100, from),
      row('p1', 'open', 0, '2026-01-03T00:00:00.000Z'),
      row('p2', 'won', 200, '2026-01-09T00:00:00.000Z'),
    ];
    const trend = bucketDealTrend(rows, from);
    expect(trend).toHaveLength(2);
    expect(trend[0]).toEqual({ date: from, created: 2, won: 1 });
    // Second bucket starts 7 days later.
    expect(trend[1].created).toBe(1);
    expect(trend[1].won).toBe(1);
  });
  it('drops rows before fromDate', () => {
    const rows = [row('p1', 'won', 100, '2025-12-01T00:00:00.000Z')];
    expect(bucketDealTrend(rows, from)).toEqual([]);
  });
  it('sorts buckets chronologically', () => {
    const rows = [
      row('p1', 'won', 100, '2026-01-15T00:00:00.000Z'),
      row('p1', 'won', 100, from),
    ];
    const trend = bucketDealTrend(rows, from);
    expect(trend[0].date).toBe(from);
  });
});

describe('buildDealDistribution', () => {
  it('returns empty when no agent has positive value', () => {
    expect(buildDealDistribution([{ name: 'A', value: 0 }])).toEqual([]);
  });
  it('returns top 5 plus an Otros slice when more than 5', () => {
    const perAgent = [
      { name: 'A', value: 100 },
      { name: 'B', value: 90 },
      { name: 'C', value: 80 },
      { name: 'D', value: 70 },
      { name: 'E', value: 60 },
      { name: 'F', value: 50 },
      { name: 'G', value: 40 },
    ];
    const slices = buildDealDistribution(perAgent);
    expect(slices).toHaveLength(6);
    expect(slices[0].name).toBe('A');
    expect(slices[5].isOther).toBe(true);
    expect(slices[5].name).toContain('Otros');
  });
  it('sums percentages to 1', () => {
    const slices = buildDealDistribution([
      { name: 'A', value: 30 },
      { name: 'B', value: 70 },
    ]);
    const total = slices.reduce((s, x) => s + x.percentage, 0);
    expect(total).toBeCloseTo(1, 6);
  });
  it('does not add Otros when there are 5 or fewer', () => {
    const slices = buildDealDistribution([{ name: 'A', value: 100 }]);
    expect(slices.every((s) => !s.isOther)).toBe(true);
  });
});

describe('buildQuadrantPoints', () => {
  it('maps aggregates to scatter points with win rate', () => {
    const byProfile = new Map([
      ['p1', { dealsOpen: 1, dealsWon: 3, dealsLost: 1, totalValueWon: 300, totalValueOpen: 50 }],
    ]);
    const profileIdToUserId = new Map([['p1', 'u1']]);
    const nameByUserId = new Map([['u1', 'María']]);
    const points = buildQuadrantPoints(byProfile, profileIdToUserId, nameByUserId);
    expect(points).toHaveLength(1);
    expect(points[0]).toEqual({
      agentId: 'u1',
      agentName: 'María',
      totalDeals: 5,
      dealsWon: 3,
      winRate: 0.75,
      totalValue: 300,
    });
  });
  it('skips profiles with no matching user id', () => {
    const byProfile = new Map([
      ['pX', { dealsOpen: 0, dealsWon: 1, dealsLost: 0, totalValueWon: 10, totalValueOpen: 0 }],
    ]);
    const points = buildQuadrantPoints(byProfile, new Map(), new Map());
    expect(points).toHaveLength(0);
  });
  it('win rate is 0 when only lost deals', () => {
    const byProfile = new Map([
      ['p1', { dealsOpen: 0, dealsWon: 0, dealsLost: 4, totalValueWon: 0, totalValueOpen: 0 }],
    ]);
    const idMap = new Map([['p1', 'u1']]);
    const nameMap = new Map([['u1', 'A']]);
    const points = buildQuadrantPoints(byProfile, idMap, nameMap);
    expect(points[0].winRate).toBe(0);
  });
});
