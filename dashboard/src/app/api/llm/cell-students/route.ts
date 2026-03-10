import { NextResponse } from 'next/server';

type MatrixCellRaw = {
  staar_level?: unknown;
  benchmark_level?: unknown;
  group_number?: unknown;
  student_count?: unknown;
};

type MatrixPayload = {
  matrixData?: unknown;
};

type StudentPayload = {
  students?: unknown;
};

const ALLOWED_SUBJECTS = new Set(['math', 'rla', 'campus']);
const ALLOWED_VERSIONS = new Set(['fall', 'spring', 'spring-algebra']);

function normalizeFilterValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
  return trimmed;
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function parseLimit(value: unknown): number {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 200;
  return Math.min(1000, Math.floor(parsed));
}

function parseMatrixCells(raw: unknown): Array<{ staarLevel: string; benchmarkLevel: string; groupNumber: number; studentCount: number }> {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((row): { staarLevel: string; benchmarkLevel: string; groupNumber: number; studentCount: number } | null => {
      const source = row as MatrixCellRaw;
      const staarLevel = String(source.staar_level ?? '').trim();
      const benchmarkLevel = String(source.benchmark_level ?? '').trim();
      if (!staarLevel || !benchmarkLevel) return null;

      return {
        staarLevel,
        benchmarkLevel,
        groupNumber: toNumber(source.group_number),
        studentCount: toNumber(source.student_count),
      };
    })
    .filter((row): row is { staarLevel: string; benchmarkLevel: string; groupNumber: number; studentCount: number } => row !== null);
}

async function readJsonSafely(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const body = (await request.json()) as Record<string, unknown>;

  const subject = normalizeFilterValue(body.subject) ?? 'math';
  const version = normalizeFilterValue(body.version) ?? 'spring';
  const grade = normalizeFilterValue(body.grade);
  const teacher = normalizeFilterValue(body.teacher);

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

  const staarLevel = normalizeFilterValue(body.staarLevel);
  const benchmarkLevel = normalizeFilterValue(body.benchmarkLevel);
  const limit = parseLimit(body.limit);

  if (!staarLevel || !benchmarkLevel) {
    return NextResponse.json(
      { error: 'staarLevel and benchmarkLevel are required.' },
      { status: 400 },
    );
  }

  let groupNumber = toNumber(body.groupNumber);
  let inferredGroupNumber = false;

  if (!groupNumber) {
    const params = new URLSearchParams();
    params.set('subject', subject);
    params.set('version', version);
    if (grade) params.set('grade', grade);
    if (teacher) params.set('teacher', teacher);

    const matrixResponse = await fetch(`${origin}/api/matrix?${params.toString()}`, {
      cache: 'no-store',
    });

    if (!matrixResponse.ok) {
      const details = await matrixResponse.text();
      return NextResponse.json(
        {
          error: 'Failed to resolve matrix cell metadata.',
          status: matrixResponse.status,
          details,
        },
        { status: 502 },
      );
    }

    const matrixJson = (await readJsonSafely(matrixResponse)) as MatrixPayload;
    const matrixCells = parseMatrixCells(matrixJson.matrixData);

    const matchingCell = matrixCells
      .filter((cell) => cell.staarLevel === staarLevel && cell.benchmarkLevel === benchmarkLevel)
      .sort((a, b) => b.studentCount - a.studentCount)[0];

    if (!matchingCell) {
      return NextResponse.json(
        {
          error: 'No matrix cell found for the provided staarLevel and benchmarkLevel under current filters.',
        },
        { status: 404 },
      );
    }

    groupNumber = matchingCell.groupNumber;
    inferredGroupNumber = true;
  }

  if (!groupNumber) {
    return NextResponse.json(
      {
        error: 'Unable to determine groupNumber for this cell. Please provide groupNumber explicitly.',
      },
      { status: 400 },
    );
  }

  const detailRequestBody: Record<string, unknown> = {
    subject,
    version,
    staar_level: staarLevel,
    benchmark_level: benchmarkLevel,
    group_number: groupNumber,
  };

  if (grade) detailRequestBody.grade = grade;
  if (teacher) detailRequestBody.teacher = teacher;

  const studentResponse = await fetch(`${origin}/api/matrix`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify(detailRequestBody),
  });

  if (!studentResponse.ok) {
    const details = await studentResponse.text();
    return NextResponse.json(
      {
        error: 'Failed to fetch students for matrix cell.',
        status: studentResponse.status,
        details,
      },
      { status: 502 },
    );
  }

  const studentJson = (await readJsonSafely(studentResponse)) as StudentPayload;
  const students = Array.isArray(studentJson.students) ? studentJson.students : [];

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    filters: {
      subject,
      version,
      grade: grade ?? null,
      teacher: teacher ?? null,
    },
    cell: {
      staarLevel,
      benchmarkLevel,
      groupNumber,
      inferredGroupNumber,
    },
    studentCount: students.length,
    returnedCount: Math.min(students.length, limit),
    truncated: students.length > limit,
    students: students.slice(0, limit),
  });
}
