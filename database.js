const supabase = require('./supabase');

async function getUsers() {
    const { data, error } = await supabase
        .from('users')
        .select('*');

    if (error) throw error;
    return data;
}

async function getLostItems() {
    const { data, error } = await supabase
        .from('lost_items')
        .select('*');

    if (error) throw error;
    return data;
}

async function getFoundItems() {
    const { data, error } = await supabase
        .from('found_items')
        .select('*');

    if (error) throw error;
    return data;
}

module.exports = {
    getUsers,
    getLostItems,
    getFoundItems
};