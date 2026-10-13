
console.log('TEST DATABASE FILE STARTED');

const database = require('./database');

console.log('Database module loaded');

async function main() {
  try {
    const users = await database.getUsers();
    const lostItems = await database.getLostItems();
    const foundItems = await database.getFoundItems();

    console.log('Supabase database queries successful!');
    console.log('Users:', users.length);
    console.log('Lost items:', lostItems.length);
    console.log('Found items:', foundItems.length);
  } catch (error) {
    console.error('Database query failed:', error.message);
  }
}

main();
