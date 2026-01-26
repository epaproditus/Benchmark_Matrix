
import { NextResponse } from 'next/server';
import { connectToDatabase } from '../../../lib/db';

export async function GET() {
    let connection;
    try {
        connection = await connectToDatabase();

        const [data] = await connection.execute('SELECT * FROM previous_performance');

        return NextResponse.json({
            data,
            count: Array.isArray(data) ? data.length : 0
        });
    } catch (error) {
        console.error('Error fetching previous performance:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    } finally {
        if (connection) await connection.release();
    }
}

