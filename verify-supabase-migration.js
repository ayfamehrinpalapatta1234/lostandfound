
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const supabase = require('./supabase');

const DATA_FILE = path.join(__dirname, 'data', 'traceback.json');

const TABLES = [
    'users',
    'user_phones',
    'found_items',
    'lost_items',
    'claims',
    'notifications'
];

async function main() {
    const local = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));

    console.log('\nTraceBack migration verification\n');

    let allMatch = true;

    for (const table of TABLES) {
        const expected = local[table].length;

        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (error) {
            console.log(`${table}: ERROR - ${error.message}`);
            allMatch = false;
            continue;
        }

        const matches = count === expected;

        console.log(
            `${table}: local=${expected}, Supabase=${count}, ` +
            `${matches ? 'MATCH' : 'MISMATCH'}`
        );

        if (!matches) allMatch = false;
    }

    console.log(
        '\nOverall result:',
        allMatch ? 'All record counts match.' : 'Some counts do not match.'
    );
}

main().catch(error => {
    console.error('Verification failed:', error.message);
    process.exitCode = 1;
});
