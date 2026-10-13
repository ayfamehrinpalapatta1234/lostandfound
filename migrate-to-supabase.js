

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, 'data', 'traceback.json');
const MAP_FILE = path.join(__dirname, 'data', 'supabase-id-map.json');

function check(condition, message) {
    if (!condition) throw new Error(message);
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function main() {
    check(fs.existsSync(DATA_FILE), 'traceback.json not found.');
    check(fs.existsSync(MAP_FILE), 'UUID mapping file not found.');

    const db = readJson(DATA_FILE);
    const idMap = readJson(MAP_FILE);

    const tables = [
        'users', 'user_phones', 'found_items',
        'lost_items', 'claims', 'notifications'
    ];

    for (const table of tables) {
        check(Array.isArray(db[table]), `Invalid or missing table: ${table}`);
        if (!idMap[table]) idMap[table] = {};
    }

    function ensureMapping(table, oldId) {
        check(oldId, `Missing old ID in ${table}`);

        if (!idMap[table][oldId]) {
            idMap[table][oldId] = crypto.randomUUID();
        }

        check(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
                .test(idMap[table][oldId]),
            `Invalid UUID mapping in ${table}`
        );

        return idMap[table][oldId];
    }

    // Preserve existing UUIDs and fill only missing mappings.
    for (const user of db.users) {
        ensureMapping('users', user.user_id);
    }

    for (const item of db.found_items) {
        ensureMapping('found_items', item.found_id);
    }

    for (const item of db.lost_items) {
        ensureMapping('lost_items', item.lost_id);
    }

    for (const claim of db.claims) {
        ensureMapping('claims', claim.claims_id);
    }

    for (const notification of db.notifications) {
        ensureMapping('notifications', notification.notification_id);
    }

    const userIds = new Set(db.users.map(user => user.user_id));

    for (const phone of db.user_phones) {
        check(
            userIds.has(phone.user_id),
            'A phone record references a missing user.'
        );
        ensureMapping('users', phone.user_id);
    }

    // Write the completed mapping only after all checks pass.
    fs.writeFileSync(
        MAP_FILE,
        JSON.stringify(idMap, null, 2) + '\n',
        'utf8'
    );

    console.log('Mapping preparation successful.');
    for (const table of tables) {
        console.log(`${table}: ${Object.keys(idMap[table]).length}`);
    }
    console.log('No Supabase connection or database writes were made.');
}

try {
    main();
} catch (error) {
    console.error('Mapping preparation failed:', error.message);
    process.exitCode = 1;
}
