
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error('Missing Supabase URL or secret key in .env');
}

const supabase = createClient(url, secretKey);

module.exports = supabase;