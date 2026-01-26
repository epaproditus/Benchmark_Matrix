import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function POST() {
    try {
        const connection = await connectToDatabase();

        // Tables to clear
        const tables = [
            'spring_matrix_data',
            'rla_data7',
            'rla_data8',
            'spralg1'
        ];

        for (const table of tables) {
            await connection.execute(`DELETE FROM ${table}`);
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            message: 'All student data tables cleared successfully.'
        });

    } catch (error) {
        console.error('Error clearing data:', error);
        return NextResponse.json({
            success: false,
            message: error instanceof Error ? error.message : 'Internal Server Error'
        }, { status: 500 });
    }
}
