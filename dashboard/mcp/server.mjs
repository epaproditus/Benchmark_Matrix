#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';

const DEFAULT_API_BASE_URLS = [
  'http://localhost:3002',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];
const SUBJECTS = ['math', 'rla', 'campus'];
const VERSIONS = ['fall', 'spring', 'spring-algebra'];

function normalizeApiBaseUrl(value) {
  const url = new URL(value.trim());
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url;
}

function getApiBaseUrlCandidates() {
  const configured = process.env.BENCHMARK_API_BASE_URL?.trim();
  if (configured) {
    return [normalizeApiBaseUrl(configured)];
  }

  return DEFAULT_API_BASE_URLS.map((candidate) => normalizeApiBaseUrl(candidate));
}

const apiBaseUrls = getApiBaseUrlCandidates();

function normalizeFilterValue(value) {
  if (!value) return undefined;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'all') return undefined;
  return trimmed;
}

function buildUrl(baseUrl, path, query = undefined) {
  const url = new URL(path.replace(/^\//, ''), baseUrl);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function callApi(path, options = {}) {
  const { method = 'GET', query, body } = options;
  const attempts = [];

  for (let index = 0; index < apiBaseUrls.length; index += 1) {
    const baseUrl = apiBaseUrls[index];
    const url = buildUrl(baseUrl, path, query);

    let response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (error) {
      attempts.push({
        baseUrl: baseUrl.toString(),
        type: 'network_error',
        message: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    const responseText = await response.text();
    let responseBody;

    try {
      responseBody = responseText ? JSON.parse(responseText) : {};
    } catch {
      responseBody = { raw: responseText };
    }

    if (response.ok) {
      return responseBody;
    }

    attempts.push({
      baseUrl: baseUrl.toString(),
      type: 'http_error',
      status: response.status,
      payload: responseBody,
    });

    const isLastAttempt = index === apiBaseUrls.length - 1;
    const shouldRetry = [404, 405, 502, 503, 504].includes(response.status);

    if (!isLastAttempt && shouldRetry) {
      continue;
    }

    const error = new Error(`API request failed (${response.status}) for ${url.pathname}`);
    error.name = 'ApiError';
    error.status = response.status;
    error.payload = responseBody;
    error.attempts = attempts;
    throw error;
  }

  const error = new Error(`All API base URL attempts failed for ${path}`);
  error.name = 'ApiError';
  error.attempts = attempts;
  throw error;
}

function toolError(message, error) {
  const details = {
    message,
    error: error instanceof Error ? error.message : String(error),
    status: typeof error?.status === 'number' ? error.status : undefined,
    payload: error?.payload,
    attempts: error?.attempts,
  };

  return {
    isError: true,
    content: [
      {
        type: 'text',
        text: JSON.stringify(details, null, 2),
      },
    ],
  };
}

const server = new McpServer(
  {
    name: 'benchmark-matrix-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      logging: {},
    },
  },
);

server.registerTool(
  'get_growth_summary',
  {
    description:
      'Get matrix growth-level totals and scoring metrics (improved/maintained/declined, HB4545 bonus, top cells).',
    inputSchema: {
      subject: z.enum(SUBJECTS).optional().describe('math, rla, or campus'),
      version: z.enum(VERSIONS).optional().describe('fall, spring, or spring-algebra'),
      grade: z.string().optional().describe('Optional grade filter (7 or 8). Use empty/"all" for all grades.'),
      teacher: z.string().optional().describe('Optional teacher filter. Use empty/"all" for all teachers.'),
      topCells: z.number().int().min(1).max(36).optional().describe('How many highest-volume matrix cells to return.'),
      includeMatrix: z.boolean().optional().describe('Include all matrix cells in the response payload.'),
    },
  },
  async (args) => {
    try {
      const data = await callApi('/api/llm/growth-summary', {
        query: {
          subject: args.subject ?? 'math',
          version: args.version ?? 'spring',
          grade: normalizeFilterValue(args.grade),
          teacher: normalizeFilterValue(args.teacher),
          topCells: args.topCells,
          includeMatrix: args.includeMatrix,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      return toolError('Failed to fetch growth summary.', error);
    }
  },
);

server.registerTool(
  'get_cell_students',
  {
    description:
      'Get students in a specific growth cell (STAAR level x benchmark level) for the selected filters.',
    inputSchema: {
      staarLevel: z.string().min(1).describe('STAAR performance level label (for example: Meets).'),
      benchmarkLevel: z.string().min(1).describe('Benchmark performance level label (for example: Masters).'),
      groupNumber: z.number().int().min(1).max(36).optional().describe('Optional matrix group number if already known.'),
      subject: z.enum(SUBJECTS).optional().describe('math, rla, or campus'),
      version: z.enum(VERSIONS).optional().describe('fall, spring, or spring-algebra'),
      grade: z.string().optional().describe('Optional grade filter (7 or 8).'),
      teacher: z.string().optional().describe('Optional teacher filter.'),
      limit: z.number().int().min(1).max(1000).optional().describe('Max students to return.'),
    },
  },
  async (args) => {
    try {
      const data = await callApi('/api/llm/cell-students', {
        method: 'POST',
        body: {
          staarLevel: args.staarLevel,
          benchmarkLevel: args.benchmarkLevel,
          groupNumber: args.groupNumber,
          subject: args.subject ?? 'math',
          version: args.version ?? 'spring',
          grade: normalizeFilterValue(args.grade),
          teacher: normalizeFilterValue(args.teacher),
          limit: args.limit,
        },
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
        structuredContent: data,
      };
    } catch (error) {
      return toolError('Failed to fetch students for the specified cell.', error);
    }
  },
);

server.registerTool(
  'search_students',
  {
    description: 'Search students by name or Local ID within optional dashboard filters.',
    inputSchema: {
      query: z.string().min(2).describe('Student name or Local ID search text.'),
      subject: z.enum(SUBJECTS).optional().describe('math, rla, or campus'),
      version: z.enum(VERSIONS).optional().describe('fall, spring, or spring-algebra'),
      grade: z.string().optional().describe('Optional grade filter (7 or 8).'),
      teacher: z.string().optional().describe('Optional teacher filter.'),
      limit: z.number().int().min(1).max(1000).optional().describe('Max students to return.'),
    },
  },
  async (args) => {
    try {
      const payload = await callApi('/api/matrix', {
        method: 'POST',
        body: {
          search: args.query,
          subject: args.subject ?? 'math',
          version: args.version ?? 'spring',
          grade: normalizeFilterValue(args.grade),
          teacher: normalizeFilterValue(args.teacher),
        },
      });

      const students = Array.isArray(payload?.students) ? payload.students : [];
      const limit = Math.min(1000, Math.max(1, Math.floor(args.limit ?? 200)));

      const result = {
        generatedAt: new Date().toISOString(),
        filters: {
          subject: args.subject ?? 'math',
          version: args.version ?? 'spring',
          grade: normalizeFilterValue(args.grade) ?? null,
          teacher: normalizeFilterValue(args.teacher) ?? null,
          query: args.query,
        },
        totalMatches: students.length,
        returnedCount: Math.min(students.length, limit),
        truncated: students.length > limit,
        students: students.slice(0, limit),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    } catch (error) {
      return toolError('Failed to search students.', error);
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error(
    `Benchmark Matrix MCP server running on stdio (API base candidates: ${apiBaseUrls.map((url) => url.toString()).join(', ')})`,
  );
}

main().catch((error) => {
  console.error('MCP server failed to start:', error);
  process.exit(1);
});
