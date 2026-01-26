'use client';

import { TamboProvider, defineTool, currentPageContextHelper, currentTimeContextHelper } from "@tambo-ai/react";
import { z } from "zod";
import { TamboChatPopup } from "./TamboChatPopup";

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
                    updatedConfig.thresholds = {
                        ...updatedConfig.thresholds,
                        ...newConfig.thresholds
                    };
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
                    // Reload page to reflect changes since matrix logic is server-side/complex
                    window.location.reload();
                    return { success: true, message: "Configuration updated successfully. Reloading..." };
                } else {
                    return { success: false, message: "Failed to save configuration" };
                }
            } catch (error) {
                return { success: false, message: `Error: ${error}` };
            }
        },
        inputSchema: z.object({
            thresholds: z.object({
                math: z.array(z.object({
                    label: z.string(),
                    min: z.number(),
                    max: z.number(),
                    color: z.string().optional()
                })).optional(),
                rla: z.array(z.object({
                    label: z.string(),
                    min: z.number(),
                    max: z.number(),
                    color: z.string().optional()
                })).optional(),
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
];

export default function TamboWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <TamboProvider
            apiKey={process.env.NEXT_PUBLIC_TAMBO_API_KEY || ''}
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
