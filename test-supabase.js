const supabase = require('./supabase');

async function testConnection() {
  const { data, error } = await supabase
    .from('users')
    .select('user_id')
    .limit(1);

  if (error) {
    console.error('Connection failed:', error.message);
    return;
  }

  console.log('Supabase connection successful!');
  console.log('Connection test completed.');
}

testConnection();