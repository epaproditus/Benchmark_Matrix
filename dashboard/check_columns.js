
const mysql = require('mysql2/promise');
const fs = require('fs');

function loadEnv() {
    try {
        const envConfig = fs.readFileSync('.env.local', 'utf8');
        envConfig.split('\n').forEach(line => {
            const [key, value] = line.split('=');
            if (key && value) {
                process.env[key.trim()] = value.trim();
            }
        });
    } catch (e) {
        console.error('Error loading .env.local', e);
    }
}

loadEnv();

async function check() {
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    const tables = ['spring7_matrix_view', 'spring_matrix_data', 'rla_data7', 'rla_data8'];

    for (const table of tables) {
        console.log(`--- ${table} ---`);
        try {
            const [rows] = await connection.execute(`SELECT * FROM ${table} LIMIT 1`);
            if (rows.length > 0) {
                console.log(Object.keys(rows[0]).join(', '));
            } else {
                console.log('No data');
            }
        } catch (e) {
            console.log(`Error: ${e.message}`);
        }
    }

    await connection.end();
}

check();
