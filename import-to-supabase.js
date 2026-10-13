
require('dotenv').config();

const fs = require('fs');
const path = require('path');
const supabase = require('./supabase');

const DATA_FILE = path.join(__dirname, 'data', 'traceback.json');
const MAP_FILE = path.join(__dirname, 'data', 'supabase-id-map.json');

async function main() {
    
    function isUuid(value) {
        return typeof value === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    const db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const idMap = JSON.parse(fs.readFileSync(MAP_FILE, 'utf8'));

    // Validate the source and mapping files before any writes.
    for (const table of [
        'users', 'user_phones', 'found_items',
        'lost_items', 'claims', 'notifications'
    ]) {
        if (!Array.isArray(db[table]) || !idMap[table]) {
            throw new Error(`Missing source data or ID map: ${table}`);
        }
    }
    
    // Validate UUID mappings.
    function isUuid(value) {
        return typeof value === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    for (const user of db.users) {
        if (!isUuid(idMap.users[user.user_id])) {
            throw new Error('Invalid UUID mapping for a user.');
        }
    }

    for (const item of db.lost_items) {
        if (!isUuid(idMap.lost_items[item.lost_id]) ||
            !isUuid(idMap.users[item.user_id])) {
            throw new Error('Invalid UUID mapping for a lost item or its owner.');
        }
    }


    const userIds = new Set(db.users.map(u => u.user_id));

    for (const phone of db.user_phones) {
        if (!userIds.has(phone.user_id)) {
            throw new Error('A phone record references a missing user.');
        }
    }

    for (const item of db.lost_items) {
        if (!userIds.has(item.user_id)) {
            throw new Error('A lost-item record references a missing user.');
        }
    }

    // This initial version deliberately does not write to Supabase.
    // First we validate required fields and UUID mappings.
    for (const user of db.users) {
        if (!idMap.users[user.user_id] ||
            !user.fname || !user.lname ||
            !user.clg_email || !user.dept || !user.password) {
            throw new Error('A user has missing required data or UUID mapping.');
        }
    }

    for (const phone of db.user_phones) {
        if (!idMap.users[phone.user_id] || !phone.phoneno) {
            throw new Error('A phone record has missing data or UUID mapping.');
        }
    }

    for (const item of db.lost_items) {
        if (!idMap.lost_items[item.lost_id] ||
            !idMap.users[item.user_id] ||
            !item.item_name || !item.date_lost ||
            !item.location_lost || !item.description ||
            !item.category) {
            throw new Error('A lost-item record has missing data or UUID mapping.');
        }
    }

    console.log('Import pre-check successful.');
    console.log('Users:', db.users.length);
    console.log('Phone records:', db.user_phones.length);
    console.log('Lost items:', db.lost_items.length);
    console.log('No database records were written.');
    console.log('This file is a pre-check only, not the final importer.');
}

main().catch(error => {
    console.error('Import pre-check failed:', error.message);
    process.exitCode = 1;
});
