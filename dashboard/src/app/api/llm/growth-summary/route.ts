import { NextResponse } from 'next/server';

type MatrixCellRaw = {
  staar_level?: unknown;
  benchmark_level?: unknown;
  student_count?: unknown;
  group_number?: unknown;
};

type StaarTotalRaw = {
  level?: unknown;
  total?: unknown;
};

type MatrixPayload = {
  matrixData?: unknown;
  staarTotals?: unknown;
};

type MatrixCell = {
  staarLevel: string;
  benchmarkLevel: string;
  studentCount: number;
  groupNumber: number;
};

const DEFAULT_LEVEL_ORDER = [
  'Did Not Meet',
  'Did Not Meet Low',
  'Did Not Meet High',
  'Approaches Low',
  'Approaches High',
  'Meets',
  'Masters',
];

const ALLOWED_SUBJECTS = new Set(['math', 'rla', 'campus']);
const ALLOWED_VERSIONS = new Set(['fall', 'spring', 'spring-algebra']);

function normalizeFilterValue(value: string | null): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
  return trimmed;
}

function parseTopCells(value: string | null): number {
  if (!value) return 10;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(36, Math.max(1, parsed));
}

function parseBoolean(value: string | null, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function percent(count: number, total: number): number {
  if (total <= 0) return 0;
  return Number(((count / total) * 100).toFixed(2));
}

function getLevelOrder(levels: string[]): string[] {
  const unique = Array.from(new Set(levels.filter(Boolean)));
  const known = DEFAULT_LEVEL_ORDER.filter((label) => unique.includes(label));
  const unknown = unique
    .filter((label) => !DEFAULT_LEVEL_ORDER.includes(label))
    .sort((a, b) => a.localeCompare(b));
  return [...known, ...unknown];
}

function isDidNotMeetLevel(level: string): boolean {
  return level.toLowerCase().includes('did not meet');
}

function isLowDidNotMeetLevel(level: string): boolean {
  const normalized = level.toLowerCase();
  return (
    normalized === 'did not meet' ||
    normalized.includes('did not meet low') ||
    normalized.includes('low did not meet')
  );
}

function isHighDidNotMeetLevel(level: string): boolean {
  const normalized = level.toLowerCase();
  return normalized.includes('did not meet high') || normalized.includes('high did not meet');
}

function getBaseCellMultiplier(cell: MatrixCell, staarOrder: string[], benchmarkOrder: string[]): number {
  const staarIndex = staarOrder.indexOf(cell.staarLevel);
  const benchmarkIndex = benchmarkOrder.indexOf(cell.benchmarkLevel);

  if (staarIndex === -1 || benchmarkIndex === -1 || cell.studentCount <= 0) {
    return 0;
  }

  if (benchmarkIndex > staarIndex) {
    return 1.0;
  }

  if (benchmarkIndex === staarIndex) {
    if (isLowDidNotMeetLevel(cell.staarLevel)) return 0;
    if (isHighDidNotMeetLevel(cell.staarLevel) || cell.staarLevel.toLowerCase().includes('approaches')) {
      return 0.5;
    }
    return 1.0;
  }

  return 0;
}

function normalizeMatrixCells(raw: unknown): MatrixCell[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row): MatrixCell | null => {
      const source = row as MatrixCellRaw;
      const staarLevel = String(source.staar_level ?? '').trim();
      const benchmarkLevel = String(source.benchmark_level ?? '').trim();
      if (!staarLevel || !benchmarkLevel) return null;

      return {
        staarLevel,
        benchmarkLevel,
        studentCount: toNumber(source.student_count),
        groupNumber: toNumber(source.group_number),
      };
    })
    .filter((row): row is MatrixCell => row !== null);
}

function normalizeStaarTotals(raw: unknown): Array<{ level: string; total: number }> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row): { level: string; total: number } | null => {
      const source = row as StaarTotalRaw;
      const level = String(source.level ?? '').trim();
      if (!level) return null;
      return { level, total: toNumber(source.total) };
    })
    .filter((row): row is { level: string; total: number } => row !== null);
}

function buildSummary(matrixCells: MatrixCell[], staarTotalsRaw: Array<{ level: string; total: number }>, topCellLimit: number) {
  const totalStudents = matrixCells.reduce((sum, cell) => sum + cell.studentCount, 0);

  const staarOrder = getLevelOrder(matrixCells.map((cell) => cell.staarLevel));
  const benchmarkOrder = getLevelOrder(matrixCells.map((cell) => cell.benchmarkLevel));

  const staarTotals =
    staarTotalsRaw.length > 0
      ? staarTotalsRaw
      : staarOrder.map((level) => ({
          level,
          total: matrixCells
            .filter((cell) => cell.staarLevel === level)
            .reduce((sum, cell) => sum + cell.studentCount, 0),
        }));

  const benchmarkTotalsMap = new Map<string, number>();
  for (const cell of matrixCells) {
    benchmarkTotalsMap.set(cell.benchmarkLevel, (benchmarkTotalsMap.get(cell.benchmarkLevel) ?? 0) + cell.studentCount);
  }

  const benchmarkTotals = benchmarkOrder.map((level) => ({
    level,
    total: benchmarkTotalsMap.get(level) ?? 0,
  }));

  let improvedCount = 0;
  let maintainedCount = 0;
  let declinedCount = 0;
  let didNotMeetGrowthCount = 0;
  let basePoints = 0;

  for (const cell of matrixCells) {
    const staarIndex = staarOrder.indexOf(cell.staarLevel);
    const benchmarkIndex = benchmarkOrder.indexOf(cell.benchmarkLevel);

    if (staarIndex !== -1 && benchmarkIndex !== -1) {
      if (benchmarkIndex > staarIndex) {
        improvedCount += cell.studentCount;
      } else if (benchmarkIndex === staarIndex) {
        maintainedCount += cell.studentCount;
      } else {
        declinedCount += cell.studentCount;
      }

      if (isDidNotMeetLevel(cell.staarLevel) && benchmarkIndex > staarIndex) {
        didNotMeetGrowthCount += cell.studentCount;
      }
    }

    basePoints += cell.studentCount * getBaseCellMultiplier(cell, staarOrder, benchmarkOrder);
  }

  const hb4545BonusPoints = didNotMeetGrowthCount * 0.25;
  const totalPoints = basePoints + hb4545BonusPoints;
  const academicGrowthScore = totalStudents > 0 ? Number(((totalPoints / totalStudents) * 100).toFixed(2)) : 0;

  const topCells = [...matrixCells]
    .sort((a, b) => {
      if (b.studentCount !== a.studentCount) return b.studentCount - a.studentCount;
      return a.groupNumber - b.groupNumber;
    })
    .slice(0, topCellLimit)
    .map((cell) => ({
      ...cell,
      percentOfStudents: percent(cell.studentCount, totalStudents),
    }));

  const matrixWithPercentages = matrixCells.map((cell) => ({
    ...cell,
    percentOfStudents: percent(cell.studentCount, totalStudents),
  }));

  return {
    totalStudents,
    staarTotals: staarTotals.map((item) => ({ ...item, percentOfStudents: percent(item.total, totalStudents) })),
    benchmarkTotals: benchmarkTotals.map((item) => ({ ...item, percentOfStudents: percent(item.total, totalStudents) })),
    growthBreakdown: {
      improved: {
        count: improvedCount,
        percent: percent(improvedCount, totalStudents),
      },
      maintained: {
        count: maintainedCount,
        percent: percent(maintainedCount, totalStudents),
      },
      declined: {
        count: declinedCount,
        percent: percent(declinedCount, totalStudents),
      },
      didNotMeetGrowthBonusEligible: {
        count: didNotMeetGrowthCount,
        percent: percent(didNotMeetGrowthCount, totalStudents),
      },
    },
    scoring: {
      basePoints: Number(basePoints.toFixed(2)),
      hb4545BonusPoints: Number(hb4545BonusPoints.toFixed(2)),
      totalPoints: Number(totalPoints.toFixed(2)),
      academicGrowthScore,
    },
    topCells,
    matrixWithPercentages,
  };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const subject = normalizeFilterValue(searchParams.get('subject')) ?? 'math';
  const version = normalizeFilterValue(searchParams.get('version')) ?? 'spring';

  if (!ALLOWED_SUBJECTS.has(subject)) {
    return NextResponse.json(
      { error: `Invalid subject: ${subject}. Allowed values are math, rla, campus.` },
      { status: 400 },
    );
  }

  if (!ALLOWED_VERSIONS.has(version)) {
    return NextResponse.json(
      { error: `Invalid version: ${version}. Allowed values are fall, spring, spring-algebra.` },
      { status: 400 },
    );
  }

  const grade = normalizeFilterValue(searchParams.get('grade'));
  const teacher = normalizeFilterValue(searchParams.get('teacher'));
  const topCells = parseTopCells(searchParams.get('topCells'));
  const includeMatrix = parseBoolean(searchParams.get('includeMatrix'), true);

  const matrixParams = new URLSearchParams();
  matrixParams.set('subject', subject);
  matrixParams.set('version', version);
  if (grade) matrixParams.set('grade', grade);
  if (teacher) matrixParams.set('teacher', teacher);

  let matrixResponse: Response;
  try {
    matrixResponse = await fetch(`${origin}/api/matrix?${matrixParams.toString()}`, {
      cache: 'no-store',
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to fetch matrix data from internal API.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }

  if (!matrixResponse.ok) {
    const message = await matrixResponse.text();
    return NextResponse.json(
      {
        error: 'Matrix API request failed.',
        status: matrixResponse.status,
        details: message,
      },
      { status: 502 },
    );
  }

  const payload = (await matrixResponse.json()) as MatrixPayload;
  const matrixCells = normalizeMatrixCells(payload.matrixData);
  const staarTotals = normalizeStaarTotals(payload.staarTotals);

  const summary = buildSummary(matrixCells, staarTotals, topCells);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    filters: {
      subject,
      version,
      grade: grade ?? null,
      teacher: teacher ?? null,
    },
    totals: {
      students: summary.totalStudents,
      staarLevels: summary.staarTotals,
      benchmarkLevels: summary.benchmarkTotals,
      growth: summary.growthBreakdown,
    },
    scoring: summary.scoring,
    topCells: summary.topCells,
    matrixData: includeMatrix ? summary.matrixWithPercentages : undefined,
  });
}
