# LLM + MCP Integration

This project now exposes growth matrix data in two LLM-friendly ways:

1. HTTP API (`/api/llm/*`)
2. MCP server over stdio (`dashboard/mcp/server.mjs`)

## 1) LLM API Endpoints

### `GET /api/llm/growth-summary`
Returns matrix growth-level totals, scoring metrics, and top matrix cells.

Query parameters:
- `subject`: `math` | `rla` | `campus` (default: `math`)
- `version`: `fall` | `spring` | `spring-algebra` (default: `spring`)
- `grade`: optional (`7` or `8`)
- `teacher`: optional (teacher name)
- `topCells`: optional `1-36` (default: `10`)
- `includeMatrix`: optional boolean (default: `true`)

Example:
```bash
curl "http://localhost:3002/api/llm/growth-summary?subject=math&version=spring&grade=7"
```

### `POST /api/llm/cell-students`
Returns students for one matrix cell (STAAR level x benchmark level).

JSON body:
- `staarLevel` (required)
- `benchmarkLevel` (required)
- `groupNumber` (optional)
- `subject`, `version`, `grade`, `teacher` (optional filters)
- `limit` (optional, max 1000)

If `groupNumber` is omitted, the API infers it from current matrix data.

Example:
```bash
curl -X POST "http://localhost:3002/api/llm/cell-students" \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "math",
    "version": "spring",
    "grade": "7",
    "staarLevel": "Meets",
    "benchmarkLevel": "Masters"
  }'
```

## 2) MCP Server

Run the MCP server:
```bash
cd dashboard
npm run mcp
```

Optional environment variable:
- `BENCHMARK_API_BASE_URL` (default: `http://localhost:3002`)

Example:
```bash
BENCHMARK_API_BASE_URL=http://localhost:3002 npm run mcp
```

### MCP Tools Exposed
- `get_growth_summary`
- `get_cell_students`
- `search_students`

## Typical Startup Flow

1. Start dashboard API/app:
```bash
cd dashboard
npm run dev
```
2. Start MCP server in another terminal:
```bash
cd dashboard
npm run mcp
```
3. Connect your MCP-compatible LLM client to the command above.

## Ready-To-Paste Client Configs

Use this exact server definition in clients that support MCP JSON config.

```json
{
  "mcpServers": {
    "benchmark-matrix": {
      "command": "node",
      "args": [
        "/Users/abe/projects/Benchmark_Matrix/dashboard/mcp/server.mjs"
      ],
      "env": {
        "BENCHMARK_API_BASE_URL": "http://localhost:3002"
      }
    }
  }
}
```

### Claude Desktop (macOS)
Add the `benchmark-matrix` entry to:

`~/Library/Application Support/Claude/claude_desktop_config.json`

### Cursor
Add the same `benchmark-matrix` entry to your Cursor MCP config (the JSON file Cursor opens from its MCP settings).

### Important
- Keep the dashboard running (`cd dashboard && npm run dev`) while using MCP tools.
- If you run the app on a different port/host, update `BENCHMARK_API_BASE_URL`.
