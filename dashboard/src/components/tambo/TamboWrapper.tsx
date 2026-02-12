'use client';

import { TamboProvider, defineTool, currentPageContextHelper, currentTimeContextHelper } from "@tambo-ai/react";
import { z } from "zod";
import { TamboChatPopup } from "./TamboChatPopup";

function ensureCryptoRandomUUID() {
    if (typeof globalThis === 'undefined') return;

    const cryptoObj = globalThis.crypto as (Crypto & { randomUUID?: () => string }) | undefined;
    if (!cryptoObj) return;
    if (typeof cryptoObj.randomUUID === 'function') return;

    const createUuidFromBytes = (bytes: Uint8Array): `${string}-${string}-${string}-${string}-${string}` => {
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    };

    (cryptoObj as { randomUUID: () => `${string}-${string}-${string}-${string}-${string}` }).randomUUID = () => {
        if (typeof cryptoObj.getRandomValues === 'function') {
            const bytes = new Uint8Array(16);
            cryptoObj.getRandomValues(bytes);
            return createUuidFromBytes(bytes);
        }

        const fallbackBytes = new Uint8Array(16);
        for (let i = 0; i < fallbackBytes.length; i += 1) {
            fallbackBytes[i] = Math.floor(Math.random() * 256);
        }
        return createUuidFromBytes(fallbackBytes);
    };
}

ensureCryptoRandomUUID();

const tools = [
    defineTool({
        name: "updateStudentScore",
        description: "Update benchmark or STAAR scores for a specific student using their Local ID.",
        tool: async ({ localId, benchmarkScore, staarScore }) => {
            try {
                const response = await fetch('/api/missing-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        localId,
                        benchmarkScore,
                        staarScore
                    })
                });

                const data = await response.json();

                if (data.success) {
                    return { success: true, message: `Successfully updated scores for student ${localId}` };
                } else {
                    return { success: false, message: `Failed to update scores: ${data.message || 'Unknown error'}` };
                }
            } catch (error) {
                return { success: false, message: `Error updating scores: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        inputSchema: z.object({
            localId: z.string().describe("The Local ID of the student (e.g., '423390')"),
            benchmarkScore: z.number().optional().describe("The new benchmark score (0-100)"),
            staarScore: z.number().optional().describe("The new STAAR score (0-100)"),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "manipulateTable",
        description: "Control sorting, filtering, and grouping in the Missing Data tables.",
        tool: async ({ sortBy, sortOrder, filters, groupBy }) => {
            // Convert array of filter objects back to a record for the component
            const filtersRecord = filters?.reduce((acc, { column, value }) => {
                acc[column] = value;
                return acc;
            }, {} as Record<string, string>);

            window.dispatchEvent(new CustomEvent('tambo-action', {
                detail: {
                    component: 'MissingData',
                    action: 'update',
                    config: { sortBy, sortOrder, filters: filtersRecord, groupBy }
                }
            }));
            return { success: true, message: "Table updated successfully" };
        },
        inputSchema: z.object({
            sortBy: z.string().optional().describe("Column to sort by (e.g., 'Last Name', 'First Name', 'Grade', 'teacher', 'Local Id'). Use this for ordering within a view."),
            sortOrder: z.enum(['asc', 'desc']).optional().describe("Sort direction"),
            filters: z.array(z.object({
                column: z.string().describe("Column name to filter (e.g., 'Grade', 'teacher')"),
                value: z.string().describe("Value to filter for (case-insensitive contains)")
            })).optional().describe("List of filters to apply"),
            groupBy: z.string().optional().describe("Column to group by (e.g., 'teacher', 'Grade'). Use this when the user wants to 'see students by' a certain category, as it creates separate visual sections."),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "updateDashboardFilters",
        description: "Update the main dashboard matrix filters (Subject, Grade, Teacher, Assessment).",
        tool: async (config) => {
            window.dispatchEvent(new CustomEvent('tambo-action', {
                detail: { component: 'PerformanceMatrix', action: 'update', config }
            }));
            return { success: true, message: "Dashboard filters updated successfully" };
        },
        inputSchema: z.object({
            subject: z.enum(['math', 'rla', 'campus']).optional().describe("The subject to view"),
            version: z.enum(['fall', 'spring', 'spring-algebra']).optional().describe("The assessment version"),
            grade: z.string().optional().describe("Grade level (e.g., '7', '8') or 'all'"),
            teacher: z.string().optional().describe("Teacher name or 'all'"),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "updateThresholds",
        description: "Update the score limits (min/max) for performance levels (Did Not Meet, Meets, Masters, etc) or axis labels.",
        tool: async (newConfig) => {
            try {
                // First get current config to merge
                const currentRes = await fetch('/api/settings');
                const currentConfig = await currentRes.json();

                const updatedConfig = { ...currentConfig };

                // Update thresholds if provided
                if (newConfig.thresholds) {
                    if (newConfig.thresholds.math) {
                        updatedConfig.thresholds.math = {
                            ...updatedConfig.thresholds.math,
                            ...newConfig.thresholds.math
                        };
                    }
                    if (newConfig.thresholds.rla) {
                        updatedConfig.thresholds.rla = {
                            ...updatedConfig.thresholds.rla,
                            ...newConfig.thresholds.rla
                        };
                    }
                }

                // Update labels if provided
                if (newConfig.labels) {
                    updatedConfig.labels = {
                        ...updatedConfig.labels,
                        ...newConfig.labels
                    };
                }

                const response = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedConfig)
                });

                if (response.ok) {
                    // Trigger a refresh event instead of a hard reload
                    window.dispatchEvent(new CustomEvent('tambo-action', {
                        detail: { action: 'refresh' }
                    }));
                    return { success: true, message: "Configuration updated successfully. Dashboard refreshing..." };
                } else {
                    return { success: false, message: "Failed to save configuration" };
                }
            } catch (error) {
                return { success: false, message: `Error: ${error}` };
            }
        },
        inputSchema: z.object({
            thresholds: z.object({
                math: z.object({
                    previous: z.array(z.object({
                        label: z.string(),
                        min: z.number(),
                        max: z.number(),
                        color: z.string().optional()
                    })).optional(),
                    current: z.array(z.object({
                        label: z.string(),
                        min: z.number(),
                        max: z.number(),
                        color: z.string().optional()
                    })).optional()
                }).optional(),
                rla: z.object({
                    previous: z.array(z.object({
                        label: z.string(),
                        min: z.number(),
                        max: z.number(),
                        color: z.string().optional()
                    })).optional(),
                    current: z.array(z.object({
                        label: z.string(),
                        min: z.number(),
                        max: z.number(),
                        color: z.string().optional()
                    })).optional()
                }).optional(),
            }).optional(),
            labels: z.object({
                xAxis: z.string().optional(),
                yAxis: z.string().optional()
            }).optional()
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "resetView",
        description: "Reset all table and dashboard filters to their default states.",
        tool: async () => {
            window.dispatchEvent(new CustomEvent('tambo-action', {
                detail: { component: 'MissingData', action: 'reset' }
            }));
            window.dispatchEvent(new CustomEvent('tambo-action', {
                detail: { component: 'PerformanceMatrix', action: 'update', config: { subject: 'campus', version: 'spring-algebra', grade: 'all', teacher: 'all' } }
            }));
            return { success: true, message: "View reset successfully" };
        },
        inputSchema: z.object({}),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "navigateTo",
        description: "Navigate to a different page. Use '/missing' for the Missing Scorse/Student List, and '/' for the main Dashboard.",
        tool: async ({ path }) => {
            window.location.href = path;
            return { success: true, message: `Navigating to ${path}` };
        },
        inputSchema: z.object({
            path: z.string().describe("The path to navigate to (e.g., '/', '/missing')"),
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "importPreviousPerformance",
        description: "Import 'Previous Performance' scores for a list of students. Use this when the user pastes data like '[ID] [First Name] [Last Name] [Score]' or just '[ID] [Score]'. This writes to a dedicated table.",
        tool: async ({ students }) => {
            try {
                const response = await fetch('/api/bulk-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'previous_performance',
                        students
                    })
                });

                const data = await response.json();

                if (data.success) {
                    window.dispatchEvent(new CustomEvent('tambo-action', {
                        detail: { action: 'refresh' }
                    }));
                    return { success: true, message: data.message };
                } else {
                    return { success: false, message: data.message || 'Failed to import scores' };
                }
            } catch (error) {
                return { success: false, message: `Error importing scores: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        inputSchema: z.object({
            students: z.array(z.object({
                localId: z.string().describe("Local ID of student"),
                firstName: z.string().optional().describe("First Name"),
                lastName: z.string().optional().describe("Last Name"),
                score: z.number().describe("The previous performance score (0-100)"),
                subject: z.enum(['math', 'rla']).optional().describe("Subject if known"),
            }))
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "importFallPerformance",
        description: "Import 'Fall' scores for a list of students. Use this when the user pastes data like '[ID] [First Name] [Last Name] [Score]' or just '[ID] [Score]' and mentions 'Fall'. This writes to a dedicated table.",
        tool: async ({ students }) => {
            try {
                const response = await fetch('/api/bulk-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        type: 'fall_performance',
                        students
                    })
                });

                const data = await response.json();

                if (data.success) {
                    window.dispatchEvent(new CustomEvent('tambo-action', {
                        detail: { action: 'refresh' }
                    }));
                    return { success: true, message: data.message };
                } else {
                    return { success: false, message: data.message || 'Failed to import scores' };
                }
            } catch (error) {
                return { success: false, message: `Error importing scores: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        inputSchema: z.object({
            students: z.array(z.object({
                localId: z.string().describe("Local ID of student"),
                firstName: z.string().optional().describe("First Name"),
                lastName: z.string().optional().describe("Last Name"),
                score: z.number().describe("The fall performance score (0-100)"),
                subject: z.enum(['math', 'rla']).optional().describe("Subject if known"),
            }))
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "bulkImportStudents",
        description: "Import or update multiple student records at once. IMPORTANT: You must parse the user's data into an array of OBJECTS matching the schema. DO NOT send comma-separated strings. Missing fields should be omitted or set to null.",
        tool: async ({ subject, students }) => {
            try {
                const response = await fetch('/api/bulk-import', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ subject, students })
                });

                const data = await response.json();

                if (data.success) {
                    window.dispatchEvent(new CustomEvent('tambo-action', {
                        detail: { action: 'refresh' }
                    }));
                    return { success: true, message: data.message };
                } else {
                    return { success: false, message: data.message || 'Failed to bulk import students' };
                }
            } catch (error) {
                return { success: false, message: `Error importing students: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        inputSchema: z.object({
            subject: z.enum(['math', 'rla']).describe("The subject of the data being imported"),
            students: z.array(z.object({
                localId: z.string().describe("Local ID of student"),
                firstName: z.string().optional(),
                lastName: z.string().optional(),
                grade: z.string().optional(),
                campus: z.string().optional(),
                teacher: z.string().optional(),
                staarScore: z.number().optional().describe("Previous performance score (0-100)"),
                benchmarkScore: z.number().optional().describe("Current benchmark score (0-100)")
            }))
        }),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
    defineTool({
        name: "clearStudentData",
        description: "Wipe all placeholder student data from the dashboard to prepare for real data import. WARNING: This action is destructive and will remove all student scores and details.",
        tool: async () => {
            try {
                const response = await fetch('/api/clear-data', {
                    method: 'POST',
                });

                const data = await response.json();

                if (data.success) {
                    window.dispatchEvent(new CustomEvent('tambo-action', {
                        detail: { action: 'refresh' }
                    }));
                    return { success: true, message: data.message };
                } else {
                    return { success: false, message: data.message || 'Failed to clear data' };
                }
            } catch (error) {
                return { success: false, message: `Error clearing data: ${error instanceof Error ? error.message : String(error)}` };
            }
        },
        inputSchema: z.object({}),
        outputSchema: z.object({
            success: z.boolean(),
            message: z.string(),
        }),
    }),
];

const tamboApiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY || '';
const tamboEnvironment = process.env.NEXT_PUBLIC_TAMBO_ENV === 'staging' ? 'staging' : 'production';
const tamboUrl = process.env.NEXT_PUBLIC_TAMBO_URL;

export default function TamboWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <TamboProvider
            apiKey={tamboApiKey}
            environment={tamboEnvironment}
            tamboUrl={tamboUrl}
            tools={tools}
            contextHelpers={{
                currentPage: currentPageContextHelper,
                currentTime: currentTimeContextHelper,
            }}
        >
            {children}
            <TamboChatPopup />
        </TamboProvider>
    );
}
