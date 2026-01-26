import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function POST(request: Request) {
    try {
        const { subject, students, type } = await request.json();

        if (!students || !Array.isArray(students)) {
            return NextResponse.json({ success: false, message: 'Invalid students data' }, { status: 400 });
        }

        const connection = await connectToDatabase();

        if (type === 'previous_performance' || type === 'fall_performance') {
            const tableName = type === 'fall_performance' ? 'fall_performance' : 'previous_performance';

            // Pre-fetch existing students to auto-fill names and normalize IDs
            const [existingRows]: any[] = await connection.execute(
                'SELECT LocalId, FirstName, LastName FROM previous_performance'
            );

            const studentMap = new Map<number, { id: string, first: string, last: string }>();
            existingRows.forEach((row: any) => {
                const numericId = parseInt(row.LocalId, 10);
                if (!isNaN(numericId)) {
                    studentMap.set(numericId, {
                        id: row.LocalId, // Keep the canonical ID (e.g., "006547")
                        first: row.FirstName,
                        last: row.LastName
                    });
                }
            });

            for (const item of students) {
                let localId: string | null = null;
                let score: number | null = null;
                let subj: string | null = null;
                let firstName: string | null = null;
                let lastName: string | null = null;

                // Handle string input (e.g., "006547 Itzhak Aguilar 86")
                if (typeof item === 'string') {
                    const match = item.trim().match(/^(\d+)\s+(.+)\s+(\d+)$/);
                    const matchIdScore = item.trim().match(/^(\d+)\s+(\d+)$/);

                    if (match) {
                        localId = match[1];
                        const nameParts = match[2].trim().split(' ');
                        score = Number(match[3]);

                        if (nameParts.length > 1) {
                            lastName = nameParts.pop() || null;
                            firstName = nameParts.join(' ');
                        } else {
                            firstName = nameParts[0];
                        }
                    } else if (matchIdScore) {
                        // Handle "ID Score" format (e.g., "6547 56")
                        localId = matchIdScore[1];
                        score = Number(matchIdScore[2]);
                    }
                } else if (typeof item === 'object' && item !== null) {
                    // Handle object input
                    localId = item.localId ? String(item.localId).trim() : null;
                    score = item.score !== undefined && item.score !== null ? Number(item.score) : null;
                    subj = item.subject || subject || null;
                    firstName = item.firstName ? String(item.firstName).trim() : null;
                    lastName = item.lastName ? String(item.lastName).trim() : null;
                }

                if (!localId) continue;

                // SMART MATCHING: If Name is missing, or to ensure ID format matches (e.g. 6547 -> 006547)
                const numericInputId = parseInt(localId, 10);
                const existing = studentMap.get(numericInputId);

                if (existing) {
                    // Use the canonical ID from the database (e.g. "006547" instead of "6547")
                    localId = existing.id;

                    // Auto-fill name if missing
                    if (!firstName) firstName = existing.first;
                    if (!lastName) lastName = existing.last;
                }

                const query = `
                    INSERT INTO ${tableName} (LocalId, FirstName, LastName, Score, Subject)
                    VALUES (?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        Score = VALUES(Score),
                        Subject = IF(VALUES(Subject) IS NOT NULL, VALUES(Subject), Subject),
                        FirstName = IF(VALUES(FirstName) IS NOT NULL, VALUES(FirstName), FirstName),
                        LastName = IF(VALUES(LastName) IS NOT NULL, VALUES(LastName), LastName)
                `;

                await connection.execute(query, [localId, firstName, lastName, score, subj]);
            }

            await connection.end();
            return NextResponse.json({
                success: true,
                message: `Successfully updated ${type === 'fall_performance' ? 'fall' : 'previous'} performance scores for ${students.length} students.`
            });
        }

        // Standard Bulk Import Logic
        for (const student of students) {
            // Normalize record to handle potential AI formatting errors
            const s = typeof student === 'object' && student !== null ? student : {};

            // localId is mandatory
            if (!s.localId) continue;

            const localId = String(s.localId).trim();
            const firstName = s.firstName ? String(s.firstName).trim() : null;
            const lastName = s.lastName ? String(s.lastName).trim() : null;

            // Normalize grade: '07', '7', 7 -> '7'
            let grade = s.grade ? String(s.grade).trim() : null;
            if (grade && (grade === '07' || grade === '7th')) {
                grade = '7';
            } else if (grade && (grade === '08' || grade === '8th')) {
                grade = '8';
            }

            const campus = s.campus || null;
            const teacher = s.teacher || null;

            // Ensure scores are numbers or null, never undefined
            const staarScore = (s.staarScore !== undefined && s.staarScore !== null) ? Number(s.staarScore) : null;
            const benchmarkScore = (s.benchmarkScore !== undefined && s.benchmarkScore !== null) ? Number(s.benchmarkScore) : null;

            if (subject === 'math') {
                const query = `
                    INSERT INTO spring_matrix_data (
                        \`First Name\`, \`Last Name\`, \`Local Id\`, \`Grade\`, \`Campus\`, \`Benchmark Teacher\`, 
                        \`STAAR MA07 Percent Score\`, \`Benchmark PercentScore\`
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        \`First Name\` = VALUES(\`First Name\`),
                        \`Last Name\` = VALUES(\`Last Name\`),
                        \`Grade\` = VALUES(\`Grade\`),
                        \`Campus\` = VALUES(\`Campus\`),
                        \`Benchmark Teacher\` = VALUES(\`Benchmark Teacher\`),
                        \`STAAR MA07 Percent Score\` = IF(VALUES(\`STAAR MA07 Percent Score\`) IS NOT NULL, VALUES(\`STAAR MA07 Percent Score\`), \`STAAR MA07 Percent Score\`),
                        \`Benchmark PercentScore\` = IF(VALUES(\`Benchmark PercentScore\`) IS NOT NULL, VALUES(\`Benchmark PercentScore\`), \`Benchmark PercentScore\`)
                `;
                const params = [firstName, lastName, localId, grade, campus, teacher, staarScore, benchmarkScore];
                await connection.execute(query, params);
            } else if (subject === 'rla') {
                const table = grade === '7' ? 'rla_data7' : 'rla_data8';
                const query = `
                    INSERT INTO ${table} (
                        FirstName, LastName, LocalId, Grade, Campus, Teacher, 
                        STAAR_Score, Benchmark_Score
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                        FirstName = VALUES(FirstName),
                        LastName = VALUES(LastName),
                        Grade = VALUES(Grade),
                        Campus = VALUES(Campus),
                        Teacher = VALUES(Teacher),
                        STAAR_Score = IF(VALUES(STAAR_Score) IS NOT NULL, VALUES(STAAR_Score), STAAR_Score),
                        Benchmark_Score = IF(VALUES(Benchmark_Score) IS NOT NULL, VALUES(Benchmark_Score), Benchmark_Score)
                `;
                const params = [firstName, lastName, localId, grade, campus, teacher, staarScore, benchmarkScore];
                await connection.execute(query, params);
            }
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            message: `Successfully processed ${students.length} student records for ${subject ? subject.toUpperCase() : 'students'}.`
        });

    } catch (error) {
        console.error('Bulk import error:', error);
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
