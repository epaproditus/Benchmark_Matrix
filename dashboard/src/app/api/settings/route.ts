import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'src', 'data', 'thresholds.json');

export async function GET() {
    try {
        const data = await fs.readFile(CONFIG_PATH, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (error) {
        console.error('Error reading config:', error);
        return NextResponse.json({ error: 'Failed to load configuration' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const newConfig = await request.json();

        // Basic validation
        if (!newConfig.labels || !newConfig.thresholds) {
            return NextResponse.json({ error: 'Invalid configuration format' }, { status: 400 });
        }

        await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig, null, 2));

        return NextResponse.json({ success: true, message: 'Configuration saved' });
    } catch (error) {
        console.error('Error saving config:', error);
        return NextResponse.json({ error: 'Failed to save configuration' }, { status: 500 });
    }
}
