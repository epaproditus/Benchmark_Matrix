'use client';

import { TamboProvider, defineTool, currentPageContextHelper, currentTimeContextHelper } from "@tambo-ai/react";
import { z } from "zod";
import { TamboChatPopup } from "./TamboChatPopup";
import { db, Student, DEFAULT_THRESHOLDS } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";

export default function TamboWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    // We prioritize the BYOK key, fallback to env var (which might be empty in static export)
    // Note: TamboProvider typically expects a Tambo Platform Key or specific config. 
    // If the user means OpenAI/Anthropic keys for a direct client, adaptation might be needed depending on the SDK version.
    // Assuming standard Tambo behavior where apiKey is the Tambo Project Key.
    const apiKey = process.env.NEXT_PUBLIC_TAMBO_API_KEY || '';

    // Define tools inside the component to access 'db' context if needed (though db is global)
    // We recreate the tool array, or memoize it.
    const tools = [
        defineTool({
            name: "updateStudentScore",
            description: "Update benchmark or STAAR scores for a specific student using their Local ID.",
            tool: async ({ localId, benchmarkScore, staarScore }) => {
                try {
                    const student = await db.students.where('LocalId').equals(localId).first();
                    if (!student || !student.id) {
                        return { success: false, message: `Student with ID ${localId} not found.` };
                    }

                    const updates: Partial<Student> = {};
                    if (benchmarkScore !== undefined) {
                        updates.SpringScore = benchmarkScore; // Assuming Spring as default benchmark context
                        // Could update levels here too if we imported the logic
                    }
                    if (staarScore !== undefined) {
                        updates.StaarScore = staarScore;
                    }

                    await db.students.update(student.id, updates);
                    return { success: true, message: `Successfully updated scores for student ${localId}` };
                } catch (error) {
                    return { success: false, message: `Error updating scores: ${error}` };
                }
            },
            inputSchema: z.object({
                localId: z.string(),
                benchmarkScore: z.number().optional(),
                staarScore: z.number().optional(),
            }),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
        }),
        defineTool({
            name: "manipulateTable",
            description: "Control sorting, filtering, and grouping in the Missing Data tables.",
            tool: async ({ sortBy, sortOrder, filters, groupBy }) => {
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
                sortBy: z.string().optional(),
                sortOrder: z.enum(['asc', 'desc']).optional(),
                filters: z.array(z.object({ column: z.string(), value: z.string() })).optional(),
                groupBy: z.string().optional(),
            }),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
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
                subject: z.enum(['math', 'rla', 'campus']).optional(),
                version: z.enum(['fall', 'spring', 'spring-algebra']).optional(),
                grade: z.string().optional(),
                teacher: z.string().optional(),
            }),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
        }),
        defineTool({
            name: "updateThresholds",
            description: "Update the score limits or axis labels.",
            tool: async (newConfig) => {
                try {
                    await db.transaction('rw', db.settings, async () => {
                        const currentLabels = (await db.settings.get('labels'))?.value || {};
                        const currentThresholds = (await db.settings.get('thresholds'))?.value || DEFAULT_THRESHOLDS;

                        if (newConfig.labels) {
                            await db.settings.put({ id: 'labels', value: { ...currentLabels, ...newConfig.labels } });
                        }
                        if (newConfig.thresholds) {
                            // Deep merge logic simplified for brevity - usually full object replace is safer for tools
                            // But let's assume partial
                            const mergedThresholds = { ...currentThresholds, ...newConfig.thresholds };
                            await db.settings.put({ id: 'thresholds', value: mergedThresholds });
                        }
                    });

                    window.dispatchEvent(new CustomEvent('tambo-action', { detail: { action: 'refresh' } }));
                    return { success: true, message: "Configuration updated successfully." };
                } catch (error) {
                    return { success: false, message: `Error: ${error}` };
                }
            },
            inputSchema: z.object({
                thresholds: z.any().optional(),
                labels: z.object({ xAxis: z.string().optional(), yAxis: z.string().optional() }).optional()
            }),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
        }),
        defineTool({
            name: "bulkImportStudents",
            description: "Import or update multiple student records at once.",
            tool: async ({ students }) => {
                try {
                    let count = 0;
                    await db.transaction('rw', db.students, async () => {
                        for (let s of students) {
                            // Defensive parsing: LLM sometimes sends double-encoded JSON strings
                            if (typeof s === 'string') {
                                try {
                                    s = JSON.parse(s);
                                } catch (e) {
                                    console.error("Failed to parse student record:", s);
                                    continue;
                                }
                            }

                            if (!s || !s.LocalId) {
                                console.warn("Skipping invalid student record (missing LocalId):", s);
                                continue;
                            }

                            const existing = await db.students.where('LocalId').equals(s.LocalId).first();
                            if (existing?.id) {
                                await db.students.update(existing.id, s);
                            } else {
                                await db.students.add(s as Student);
                            }
                            count++;
                        }
                    });

                    window.dispatchEvent(new CustomEvent('tambo-action', { detail: { action: 'refresh' } }));
                    return { success: true, message: `Successfully imported ${count} students.` };
                } catch (error) {
                    return { success: false, message: `Error importing: ${error}` };
                }
            },
            inputSchema: z.object({
                students: z.array(z.object({
                    LocalId: z.string(),
                    FirstName: z.string().optional(),
                    LastName: z.string().optional(),
                    Grade: z.string().optional(),
                    Teacher: z.string().optional(),
                    StaarScore: z.number().optional(),
                    SpringScore: z.number().optional(),
                    FallScore: z.number().optional()
                }))
            }),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
        }),
        defineTool({
            name: "clearStudentData",
            description: "Wipe all student data from the database.",
            tool: async () => {
                try {
                    await db.students.clear();
                    window.dispatchEvent(new CustomEvent('tambo-action', { detail: { action: 'refresh' } }));
                    return { success: true, message: "All student data cleared." };
                } catch (error) {
                    return { success: false, message: `Error: ${error}` };
                }
            },
            inputSchema: z.object({}),
            outputSchema: z.object({ success: z.boolean(), message: z.string() }),
        }),
    ];

    return (
        <TamboProvider
            apiKey={apiKey}
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
