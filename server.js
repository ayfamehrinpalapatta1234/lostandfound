// =====================================================================
// TraceBack - College Lost & Found Management System Backend Server
// Zero-dependency pure Node.js server with native HTTP and SQLite / persistent store
// Supports all REST API endpoints, Auth, Schema matching ER diagram, and static files
// =====================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const url = require('url');
const supabase = require('./supabase');

const PORT = process.env.PORT || 5000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'traceback.json');

// Ensure data & upload directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Salt for password hashing
const HASH_SALT = 'traceback_college_secret_salt_2026';
function hashPassword(password) {
    return crypto.createHmac('sha256', HASH_SALT).update(password).digest('hex');
}

function generateId(prefix = 'id') {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
}

// =====================================================================
// In-Memory & Persistent Database Engine (matching relational schema)
// Tables: users, user_phones, found_items, lost_items, claims, notifications
// =====================================================================
let db = {
    users: [],
    user_phones: [],
    found_items: [],
    lost_items: [],
    claims: [],
    notifications: []
};

function loadDatabase() {
    if (fs.existsSync(DB_FILE)) {
        try {
            let data = fs.readFileSync(DB_FILE, 'utf8');
            if (data.charCodeAt(0) === 0xFEFF) {
                data = data.slice(1);
            }
            db = JSON.parse(data);
            console.log('Database loaded successfully from', DB_FILE);
            return;
        } catch (e) {
            console.error('Error reading db file, re-initializing seed data', e);
        }
    }
    seedInitialData();
    saveDatabase();
}

function saveDatabase() {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save database:', e);
    }
}
function seedInitialData()
 {
    const defaultPasswordHash = hashPassword('password123');
    
    db.users = [
        {
            user_id: 'usr-admin-01',
            fname: 'Security',
            minit: 'A',
            lname: 'Admin',
            clg_email: 'admin@traceback.edu',
            dept: 'Campus Security',
            role: 'Admin',
            password: defaultPasswordHash,
            institution: 'Campus College of Engineering',
            created_at: new Date('2026-07-01T08:00:00Z').toISOString()
        },
        {
            user_id: 'usr-demo-01',
            fname: 'Ayfa',
            minit: 'M',
            lname: 'Mehrin',
            clg_email: 'ayfa@campus.edu',
            dept: 'Computer Science',
            role: 'Student',
            password: defaultPasswordHash,
            institution: 'Campus College of Engineering',
            created_at: new Date('2026-07-10T10:00:00Z').toISOString()
        },
        {
            user_id: 'usr-demo-02',
            fname: 'Rahul',
            minit: 'K',
            lname: 'Sharma',
            clg_email: 'rahul.k@campus.edu',
            dept: 'Electronics & Comm',
            role: 'Student',
            password: defaultPasswordHash,
            institution: 'Campus College of Engineering',
            created_at: new Date('2026-07-12T11:00:00Z').toISOString()
        }
    ];

    db.user_phones = [
        { user_id: 'usr-admin-01', phoneno: '+91 9876543210' },
        { user_id: 'usr-demo-01', phoneno: '+91 9123456789' },
        { user_id: 'usr-demo-02', phoneno: '+91 9898989898' }
    ];

    // Start with empty lost and found reports as requested
    db.found_items = [];
    db.lost_items = [];
    db.claims = [];
    db.notifications = [];

    console.log('Database initialized with zero reports (ready for new reports).');
}

loadDatabase();

// Temporary store for email verification codes
const verificationCodes = new Map();


// =====================================================================
// JWT / Token Helper
// =====================================================================
const JWT_SECRET = 'traceback_jwt_secret_token_key_2026';
function createToken(payload) {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 3600 * 1000 })).toString('base64url');
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
    return `${header}.${body}.${signature}`;
}

function verifyToken(token) {
    if (!token) return null;
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const [header, body, signature] = parts;
        const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
        if (signature !== expectedSig) return null;
        const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
        if (payload.exp && Date.now() > payload.exp) return null;
        return payload;
    } catch (e) {
        return null;
    }
}

function getAuthUser(req) {
    const authHeader = req.headers['authorization'] || '';
    let token = '';
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        const cookies = req.headers['cookie'] || '';
        const match = cookies.match(/tb_token=([^;]+)/);
        if (match) token = match[1];
    }
    const payload = verifyToken(token);
    if (!payload || !payload.user_id) return null;
    return db.users.find(u => u.user_id === payload.user_id) || null;
}

// =====================================================================
// Possible Matches Scoring Algorithm
// Compares compatible Lost and Found reports with explainable scoring
// =====================================================================
function calculateMatchScore(lostItem, foundItem) {
    let score = 0;
    const reasons = [];

    // 1. Category Match (35%)
    if (lostItem.category && foundItem.category && 
        lostItem.category.toLowerCase().trim() === foundItem.category.toLowerCase().trim()) {
        score += 35;
        reasons.push(`Matching category: ${lostItem.category}`);
    } else {
        return { score: 0, reasons: ['Different item categories'] };
    }

    // 2. Item Name Keywords Match (up to 30%)
    const lostWords = (lostItem.item_name || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2);
    const foundWords = (foundItem.item_name || '').toLowerCase().split(/[\s,.-]+/).filter(w => w.length > 2);
    const commonNameWords = lostWords.filter(w => foundWords.includes(w));
    if (commonNameWords.length > 0) {
        const nameScore = Math.min(30, commonNameWords.length * 15);
        score += nameScore;
        reasons.push(`Matching name keywords: "${commonNameWords.join(', ')}"`);
    }

    // 3. Color & Brand Match (10% + 10%)
    if (lostItem.color && foundItem.color && lostItem.color.toLowerCase() === foundItem.color.toLowerCase()) {
        score += 10;
        reasons.push(`Matching color: ${lostItem.color}`);
    }
    if (lostItem.brand && foundItem.brand && lostItem.brand.toLowerCase() === foundItem.brand.toLowerCase()) {
        score += 10;
        reasons.push(`Matching brand: ${lostItem.brand}`);
    }

    // 4. Location Proximity (up to 10%)
    if (lostItem.location_lost && foundItem.location_found) {
        const locLost = lostItem.location_lost.toLowerCase();
        const locFound = foundItem.location_found.toLowerCase();
        if (locLost.includes(locFound) || locFound.includes(locLost)) {
            score += 10;
            reasons.push('High location proximity');
        }
    }

    // 5. Date Proximity (up to 5%)
    if (lostItem.date_lost && foundItem.date_found) {
        const diffDays = Math.abs((new Date(lostItem.date_lost) - new Date(foundItem.date_found)) / (1000 * 3600 * 24));
        if (diffDays <= 3) {
            score += 5;
            reasons.push('Reported dates within 3 days');
        }
    }

    return {
        score: Math.min(100, score),
        reasons
    };
}

// =====================================================================
// HTTP Request Helper Functions
// =====================================================================
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 10 * 1024 * 1024) { // 10MB limit
                reject(new Error('Payload too large'));
            }
        });
        req.on('end', () => {
            try {
                if (!body) return resolve({});
                if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
                    resolve(JSON.parse(body));
                } else {
                    resolve(body);
                }
            } catch (err) {
                reject(err);
            }
        });
        req.on('error', reject);
    });
}

function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message, details = null) {
    sendJson(res, statusCode, {
        success: false,
        error: message,
        details: details
    });
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webp': 'image/webp'
};

// =====================================================================
// HTTP Server & Router
// =====================================================================
const server = http.createServer(async (req, res) => {
    // Enable CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization'
        });
        return res.end();
    }

    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const query = parsedUrl.query;

    try {
        // 0. AUTH: SEND EMAIL VERIFICATION CODE
        if (req.method === 'POST' && pathname === '/api/auth/send-verification') {
            const body = await parseBody(req);
            const { email } = body;
            if (!email) return sendError(res, 400, 'College email is required for authentication.');

            const emailNormalized = email.toLowerCase().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailNormalized)) {
                return sendError(res, 400, 'Please enter a valid email address format (e.g. student@campus.edu).');
            }

            const code = Math.floor(100000 + Math.random() * 900000).toString();
            verificationCodes.set(emailNormalized, {
                code,
                expiresAt: Date.now() + 15 * 60 * 1000
            });

            console.log(`[TraceBack Auth] Verification code for ${emailNormalized}: ${code}`);

            return sendJson(res, 200, {
                success: true,
                message: `Authentication code sent to ${emailNormalized}`,
                code: code
            });
        }

        // 0.1 AUTH: VERIFY EMAIL CODE
        if (req.method === 'POST' && pathname === '/api/auth/verify-code') {
            const body = await parseBody(req);
            const { email, code } = body;

            if (!email || !code) {
                return sendError(res, 400, 'Both email and verification code are required.');
            }

            const emailNormalized = email.toLowerCase().trim();
            const record = verificationCodes.get(emailNormalized);

            if (!record) {
                return sendError(res, 400, 'No verification code was requested or code has expired.');
            }

            if (Date.now() > record.expiresAt) {
                verificationCodes.delete(emailNormalized);
                return sendError(res, 400, 'Verification code has expired. Please request a new code.');
            }

            if (record.code !== code.toString().trim()) {
                return sendError(res, 400, 'Invalid verification code. Please check and try again.');
            }

            verificationCodes.delete(emailNormalized);
            return sendJson(res, 200, {
                success: true,
                message: 'Email successfully verified and authenticated!'
            });
        }

        // 1. AUTH: REGISTER
        if (req.method === 'POST' && pathname === '/api/auth/register') {
            const body = await parseBody(req);
            const { fname, minit = '', lname, clg_email, dept, role = 'Student', password, phoneno, institution } = body;

            if (!fname || !lname || !clg_email || !dept || !password) {
                return sendError(res, 400, 'Missing required fields: first name, last name, college email, department, and password are required.');
            }

            const emailNormalized = clg_email.toLowerCase().trim();
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(emailNormalized)) {
                return sendError(res, 400, 'Please enter a valid email address format (e.g. student@campus.edu).');
            }

            const existing = db.users.find(u => u.clg_email.toLowerCase() === emailNormalized);
            if (existing) {
                return sendError(res, 409, 'An account with this college email address already exists. Please login instead.');
            }

            const userId = generateId('usr');
            const newUser = {
                user_id: userId,
                fname: fname.trim(),
                minit: (minit || '').trim(),
                lname: lname.trim(),
                clg_email: emailNormalized,
                dept: dept.trim(),
                role: role || 'Student',
                password: hashPassword(password),
                institution: institution || 'Campus College of Engineering',
                email_verified: true,
                created_at: new Date().toISOString()
            };


            db.users.push(newUser);

            if (phoneno) {
                db.user_phones.push({ user_id: userId, phoneno: phoneno.trim() });
            }

            saveDatabase();

            const token = createToken({ user_id: userId, email: emailNormalized, role: newUser.role });
            const { password: _, ...userSafe } = newUser;
            userSafe.phoneno = phoneno || '';

            return sendJson(res, 201, {
                success: true,
                message: 'Account registered successfully!',
                token,
                user: userSafe
            });
        }

        // 2. AUTH: LOGIN
        if (req.method === 'POST' && pathname === '/api/auth/login') {
            const body = await parseBody(req);
            const { email, password } = body;

            if (!email || !password) {
                return sendError(res, 400, 'Please provide both college email and password.');
            }

            const emailNormalized = email.toLowerCase().trim();
            const user = db.users.find(u => u.clg_email.toLowerCase() === emailNormalized);
            if (!user) {
                return sendError(res, 401, 'Invalid email or password.');
            }

            const hashed = hashPassword(password);
            if (user.password !== hashed) {
                return sendError(res, 401, 'Invalid email or password.');
            }

            const token = createToken({ user_id: user.user_id, email: user.clg_email, role: user.role });
            const phoneRecord = db.user_phones.find(p => p.user_id === user.user_id);
            const { password: _, ...userSafe } = user;
            userSafe.phoneno = phoneRecord ? phoneRecord.phoneno : '';

            return sendJson(res, 200, {
                success: true,
                message: 'Login successful!',
                token,
                user: userSafe
            });
        }

        // 3. AUTH: GET CURRENT USER
        if (req.method === 'GET' && pathname === '/api/auth/me') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized or session expired. Please sign in.');

            const phoneRecord = db.user_phones.find(p => p.user_id === user.user_id);
            const { password: _, ...userSafe } = user;
            userSafe.phoneno = phoneRecord ? phoneRecord.phoneno : '';

            return sendJson(res, 200, { success: true, user: userSafe });
        }

        // 4. AUTH: UPDATE PROFILE
        if (req.method === 'PUT' && pathname === '/api/auth/profile') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const body = await parseBody(req);
            const { fname, minit, lname, dept, institution, phoneno } = body;

            if (fname) user.fname = fname.trim();
            if (minit !== undefined) user.minit = minit.trim();
            if (lname) user.lname = lname.trim();
            if (dept) user.dept = dept.trim();
            if (institution) user.institution = institution.trim();

            if (phoneno) {
                const existingPhone = db.user_phones.find(p => p.user_id === user.user_id);
                if (existingPhone) {
                    existingPhone.phoneno = phoneno.trim();
                } else {
                    db.user_phones.push({ user_id: user.user_id, phoneno: phoneno.trim() });
                }
            }

            saveDatabase();
            const { password: _, ...userSafe } = user;
            userSafe.phoneno = phoneno || (db.user_phones.find(p => p.user_id === user.user_id) || {}).phoneno || '';

            return sendJson(res, 200, {
                success: true,
                message: 'Profile updated successfully!',
                user: userSafe
            });
        }

        // 5. AUTH: CHANGE PASSWORD
        if (req.method === 'PUT' && pathname === '/api/auth/change-password') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const body = await parseBody(req);
            const { current_password, new_password } = body;

            if (!current_password || !new_password) {
                return sendError(res, 400, 'Both current and new password are required.');
            }

            if (user.password !== hashPassword(current_password)) {
                return sendError(res, 400, 'Current password does not match.');
            }

            if (new_password.length < 6) {
                return sendError(res, 400, 'New password must be at least 6 characters.');
            }

            user.password = hashPassword(new_password);
            saveDatabase();

            return sendJson(res, 200, { success: true, message: 'Password changed successfully!' });
        }

        // 6. DASHBOARD STATS
        if (req.method === 'GET' && pathname === '/api/dashboard/stats') {
            const user = getAuthUser(req);
            const lostCount = db.lost_items.filter(i => i.status === 'Lost').length;
            const foundCount = db.found_items.filter(i => i.status === 'Available').length;
            const pendingClaimsCount = db.claims.filter(c => c.status === 'Pending').length;

            let userStats = { my_lost: 0, my_found: 0, my_claims: 0 };
            if (user) {
                userStats.my_lost = db.lost_items.filter(i => i.user_id === user.user_id).length;
                userStats.my_found = db.found_items.filter(i => i.user_id === user.user_id).length;
                userStats.my_claims = db.claims.filter(c => c.user_id === user.user_id).length;
            }

            return sendJson(res, 200, {
                success: true,
                stats: {
                    lost_reports: lostCount,
                    found_reports: foundCount,
                    pending_claims: pendingClaimsCount,
                    user_stats: userStats
                }
            });
        }

        // 7. DASHBOARD ACTIVITY
        if (req.method === 'GET' && pathname === '/api/dashboard/activity') {
            const user = getAuthUser(req);
            const activities = [];

            // Add recent lost reports
            db.lost_items.slice(-5).forEach(item => {
                activities.push({
                    id: item.lost_id,
                    type: 'lost',
                    text: `Reported lost: ${item.item_name} (${item.location_lost})`,
                    date: item.created_at,
                    is_user: user ? item.user_id === user.user_id : false
                });
            });

            // Add recent found reports
            db.found_items.slice(-5).forEach(item => {
                activities.push({
                    id: item.found_id,
                    type: 'found',
                    text: `Found item submitted: ${item.item_name} at ${item.location_found}`,
                    date: item.created_at,
                    is_user: user ? item.user_id === user.user_id : false
                });
            });

            // Add recent claims
            db.claims.slice(-5).forEach(claim => {
                const foundItem = db.found_items.find(f => f.found_id === claim.foreign_id);
                activities.push({
                    id: claim.claims_id,
                    type: 'claim',
                    text: `Claim filed for ${foundItem ? foundItem.item_name : 'item'} [${claim.status}]`,
                    date: claim.created_at,
                    is_user: user ? claim.user_id === user.user_id : false
                });
            });

            activities.sort((a, b) => new Date(b.date) - new Date(a.date));

            return sendJson(res, 200, {
                success: true,
                activities: activities.slice(0, 10)
            });
        }

        // 8. RECENT ITEMS (FOR LANDING PAGE SLIDER)
        if (req.method === 'GET' && pathname === '/api/items/recent') {
            const items = db.found_items.map(item => ({
                id: item.found_id,
                item_name: item.item_name,
                category: item.category,
                location: item.location_found,
                date: item.date_found,
                image_url: item.image_url || 'bottle.png',
                type: 'Found',
                status: item.status
            })).slice(0, 8);

            return sendJson(res, 200, { success: true, items });
        }

        // 9. SEARCH ITEMS (PUBLIC SAFE SEARCH)
        if (req.method === 'GET' && pathname === '/api/items/search') {
            const q = (query.q || '').toLowerCase().trim();
            const category = (query.category || '').toLowerCase().trim();
            const type = (query.type || 'all').toLowerCase().trim();
            const location = (query.location || '').toLowerCase().trim();
            const status = (query.status || '').toLowerCase().trim();

            let results = [];

            // Search in found items
            if (type === 'all' || type === 'found') {
                db.found_items.forEach(f => {
                    results.push({
                        id: f.found_id,
                        item_name: f.item_name,
                        type: 'Found',
                        category: f.category,
                        description: f.description,
                        location: f.location_found,
                        storage_location: f.storage_location,
                        date: f.date_found,
                        time: f.time_found,
                        color: f.color,
                        brand: f.brand,
                        image_url: f.image_url,
                        status: f.status,
                        created_at: f.created_at
                    });
                });
            }

            // Search in lost items
            if (type === 'all' || type === 'lost') {
                db.lost_items.forEach(l => {
                    results.push({
                        id: l.lost_id,
                        item_name: l.item_name,
                        type: 'Lost',
                        category: l.category,
                        description: l.description,
                        location: l.location_lost,
                        date: l.date_lost,
                        time: l.time_lost,
                        color: l.color,
                        brand: l.brand,
                        image_url: l.image_url,
                        status: l.status,
                        created_at: l.created_at
                    });
                });
            }

            // Apply filters
            if (q) {
                results = results.filter(item => 
                    item.item_name.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    (item.brand && item.brand.toLowerCase().includes(q)) ||
                    (item.location && item.location.toLowerCase().includes(q))
                );
            }

            if (category && category !== 'all' && category !== 'select category') {
                results = results.filter(item => item.category.toLowerCase() === category);
            }

            if (location) {
                results = results.filter(item => item.location.toLowerCase().includes(location));
            }

            if (status && status !== 'all') {
                results = results.filter(item => item.status.toLowerCase() === status);
            }

            // Sort newest first
            results.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return sendJson(res, 200, {
                success: true,
                count: results.length,
                results
            });
        }

        // 10. GET SINGLE ITEM DETAILS
        if (req.method === 'GET' && pathname.startsWith('/api/items/')) {
            const parts = pathname.split('/');
            // /api/items/:type/:id
            if (parts.length >= 5) {
                const itemType = parts[3].toLowerCase();
                const itemId = parts[4];
                const currentUser = getAuthUser(req);

                if (itemType === 'found') {
                    const item = db.found_items.find(f => f.found_id === itemId);
                    if (!item) return sendError(res, 404, 'Found item report not found.');
                    
                    const isOwner = currentUser && (currentUser.user_id === item.user_id || currentUser.role === 'Admin');
                    const safeItem = { ...item };
                    if (!isOwner) {
                        delete safeItem.contact_number; // keep finder contact private
                    }
                    return sendJson(res, 200, { success: true, item: safeItem, isOwner });
                }

                if (itemType === 'lost') {
                    const item = db.lost_items.find(l => l.lost_id === itemId);
                    if (!item) return sendError(res, 404, 'Lost item report not found.');

                    const isOwner = currentUser && (currentUser.user_id === item.user_id || currentUser.role === 'Admin');
                    const safeItem = { ...item };
                    if (!isOwner) {
                        delete safeItem.contact_number;
                        delete safeItem.serial_number;
                    }
                    return sendJson(res, 200, { success: true, item: safeItem, isOwner });
                }
            }
        }

        // 11. REPORT FOUND ITEM
        if (req.method === 'POST' && pathname === '/api/items/found') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'You must be logged in to report a found item.');

            const body = await parseBody(req);
            const {
                item_name, date_found, time_found, location_found, storage_location,
                description, category, color, brand, identifying_features,
                image_url, contact_number, additional_notes
            } = body;

            if (!item_name || !date_found || !location_found || !description || !category) {
                return sendError(res, 400, 'Please fill in all required fields: Item Name, Category, Description, Date Found, and Location Found.');
            }

            const foundId = generateId('fnd');
            const newItem = {
                found_id: foundId,
                item_name: item_name.trim(),
                date_found,
                time_found: time_found || '',
                location_found: location_found.trim(),
                storage_location: storage_location ? storage_location.trim() : 'Campus Security Office',
                description: description.trim(),
                category: category.trim(),
                color: (color || '').trim(),
                brand: (brand || '').trim(),
                identifying_features: (identifying_features || '').trim(),
                image_url: image_url || 'bag.png',
                status: 'Available',
                user_id: user.user_id,
                contact_number: contact_number || '',
                additional_notes: (additional_notes || '').trim(),
                created_at: new Date().toISOString()
            };

            db.found_items.unshift(newItem);

            // Check for potential matches among lost items and notify owners
            db.lost_items.forEach(lost => {
                if (lost.status === 'Lost') {
                    const match = calculateMatchScore(lost, newItem);
                    if (match.score >= 40) {
                        db.notifications.push({
                            notification_id: generateId('notif'),
                            user_id: lost.user_id,
                            title: 'Possible Match Found!',
                            message: `A found item "${newItem.item_name}" matches your lost "${lost.item_name}" (${match.score}% match similarity).`,
                            related_item_id: foundId,
                            is_read: 0,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            });

            saveDatabase();

            return sendJson(res, 201, {
                success: true,
                message: 'Found item report submitted successfully! Thank you for helping reunite an item.',
                item: newItem
            });
        }

        // 12. REPORT LOST ITEM
        if (req.method === 'POST' && pathname === '/api/items/lost') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'You must be logged in to report a lost item.');

            const body = await parseBody(req);
            const {
                item_name, date_lost, time_lost, location_lost,
                description, category, color, brand, serial_number,
                image_url, contact_number
            } = body;

            if (!item_name || !date_lost || !location_lost || !description || !category) {
                return sendError(res, 400, 'Please fill in all required fields: Item Name, Category, Description, Date Lost, and Last Seen Location.');
            }

            const lostId = generateId('lst');
            const newItem = {
                lost_id: lostId,
                item_name: item_name.trim(),
                date_lost,
                time_lost: time_lost || '',
                location_lost: location_lost.trim(),
                description: description.trim(),
                category: category.trim(),
                color: (color || '').trim(),
                brand: (brand || '').trim(),
                serial_number: (serial_number || '').trim(),
                image_url: image_url || 'fina.png',
                status: 'Lost',
                user_id: user.user_id,
                contact_number: contact_number || '',
                created_at: new Date().toISOString()
            };

            db.lost_items.unshift(newItem);

            // Check for potential matches in existing found items
            let matchedFoundItem = null;
            db.found_items.forEach(found => {
                if (found.status === 'Available') {
                    const match = calculateMatchScore(newItem, found);
                    if (match.score >= 40) {
                        matchedFoundItem = found;
                        db.notifications.push({
                            notification_id: generateId('notif'),
                            user_id: user.user_id,
                            title: 'Possible Match Alert!',
                            message: `We found an existing item "${found.item_name}" at ${found.location_found} that may match your report!`,
                            related_item_id: found.found_id,
                            is_read: 0,
                            created_at: new Date().toISOString()
                        });
                    }
                }
            });

            saveDatabase();

            return sendJson(res, 201, {
                success: true,
                message: 'Lost item report submitted successfully. We will notify you if a matching item is found!',
                item: newItem,
                possible_match: matchedFoundItem ? matchedFoundItem.item_name : null
            });
        }

        // 13. EDIT & DELETE ITEMS
        if (req.method === 'DELETE' && pathname.startsWith('/api/items/')) {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const parts = pathname.split('/');
            const itemType = parts[3].toLowerCase();
            const itemId = parts[4];

            if (itemType === 'found') {
                const idx = db.found_items.findIndex(f => f.found_id === itemId);
                if (idx === -1) return sendError(res, 404, 'Report not found.');
                if (db.found_items[idx].user_id !== user.user_id && user.role !== 'Admin') {
                    return sendError(res, 403, 'You do not have permission to delete this report.');
                }
                db.found_items.splice(idx, 1);
                saveDatabase();
                return sendJson(res, 200, { success: true, message: 'Report deleted successfully.' });
            }

            if (itemType === 'lost') {
                const idx = db.lost_items.findIndex(l => l.lost_id === itemId);
                if (idx === -1) return sendError(res, 404, 'Report not found.');
                if (db.lost_items[idx].user_id !== user.user_id && user.role !== 'Admin') {
                    return sendError(res, 403, 'You do not have permission to delete this report.');
                }
                db.lost_items.splice(idx, 1);
                saveDatabase();
                return sendJson(res, 200, { success: true, message: 'Report deleted successfully.' });
            }
        }

        // 14. USER'S OWN REPORTS (MY REPORTS)
        if (req.method === 'GET' && pathname === '/api/my-reports') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized. Please log in.');

            const userLost = db.lost_items.filter(l => l.user_id === user.user_id);
            const userFound = db.found_items.filter(f => f.user_id === user.user_id);

            return sendJson(res, 200, {
                success: true,
                lost_reports: userLost,
                found_reports: userFound
            });
        }

        // 15. SUBMIT CLAIM
        if (req.method === 'POST' && pathname === '/api/claims') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'You must be logged in to claim an item.');

            const body = await parseBody(req);
            const { found_id, explanation, proof_of_ownership } = body;

            if (!found_id || !explanation) {
                return sendError(res, 400, 'Found item ID and an explanation of ownership are required.');
            }

            const foundItem = db.found_items.find(f => f.found_id === found_id);
            if (!foundItem) return sendError(res, 404, 'Found item not found.');

            if (foundItem.user_id === user.user_id) {
                return sendError(res, 400, 'You cannot claim an item that you reported finding.');
            }

            // Prevent duplicate active claims
            const existingClaim = db.claims.find(c => 
                c.foreign_id === found_id && 
                c.user_id === user.user_id && 
                (c.status === 'Pending' || c.status === 'Under Review')
            );
            if (existingClaim) {
                return sendError(res, 409, 'You already have an active claim pending for this item. Please wait for administrator verification.');
            }

            const claimId = generateId('clm');
            const newClaim = {
                claims_id: claimId,
                foreign_id: found_id,
                user_id: user.user_id,
                status: 'Pending',
                proof_of_ownership: proof_of_ownership || '',
                claim_date: new Date().toISOString().split('T')[0],
                explanation: explanation.trim(),
                review_message: 'Your claim has been submitted to Campus Security for review.',
                verified_by: null,
                created_at: new Date().toISOString()
            };

            db.claims.unshift(newClaim);

            // Notify finder or admin
            db.notifications.push({
                notification_id: generateId('notif'),
                user_id: foundItem.user_id,
                title: 'New Claim Submitted',
                message: `A new claim was filed for "${foundItem.item_name}". It is under review.`,
                related_item_id: found_id,
                is_read: 0,
                created_at: new Date().toISOString()
            });

            saveDatabase();

            return sendJson(res, 201, {
                success: true,
                message: 'Your claim request has been submitted successfully! Campus Security will verify your ownership details.',
                claim: newClaim
            });
        }

        // 16. GET CURRENT USER'S CLAIMS
        if (req.method === 'GET' && pathname === '/api/claims/my') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const userClaims = db.claims.filter(c => c.user_id === user.user_id).map(c => {
                const item = db.found_items.find(f => f.found_id === c.foreign_id);
                return {
                    ...c,
                    item_name: item ? item.item_name : 'Item Removed',
                    location: item ? item.location_found : '',
                    category: item ? item.category : '',
                    image_url: item ? item.image_url : 'fina.png'
                };
            });

            return sendJson(res, 200, { success: true, claims: userClaims });
        }

        // 17. ADMIN / FINDER: GET ALL CLAIMS (FOR REVIEW)
        if (req.method === 'GET' && pathname === '/api/claims/manage') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            let claimsList = [];
            if (user.role === 'Admin' || user.role === 'Staff') {
                claimsList = db.claims;
            } else {
                // Find claims for items this user reported
                const userFoundIds = db.found_items.filter(f => f.user_id === user.user_id).map(f => f.found_id);
                claimsList = db.claims.filter(c => userFoundIds.includes(c.foreign_id));
            }

            const enriched = claimsList.map(c => {
                const item = db.found_items.find(f => f.found_id === c.foreign_id);
                const claimant = db.users.find(u => u.user_id === c.user_id);
                const phone = db.user_phones.find(p => p.user_id === c.user_id);
                return {
                    ...c,
                    item_name: item ? item.item_name : 'Unknown Item',
                    claimant_name: claimant ? `${claimant.fname} ${claimant.lname}` : 'Unknown User',
                    claimant_email: claimant ? claimant.clg_email : '',
                    claimant_phone: phone ? phone.phoneno : '',
                    item_image: item ? item.image_url : 'fina.png'
                };
            });

            return sendJson(res, 200, { success: true, claims: enriched });
        }

        // 18. VERIFY / UPDATE CLAIM STATUS (ADMIN / FINDER)
        if (req.method === 'PUT' && pathname.startsWith('/api/claims/') && pathname.endsWith('/status')) {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const parts = pathname.split('/');
            const claimId = parts[3];
            const claim = db.claims.find(c => c.claims_id === claimId);
            if (!claim) return sendError(res, 404, 'Claim not found.');

            const body = await parseBody(req);
            const { status, review_message } = body;

            if (!status || !['Pending', 'Under Review', 'Approved', 'Rejected', 'Resolved'].includes(status)) {
                return sendError(res, 400, 'Invalid claim status.');
            }

            claim.status = status;
            if (review_message) claim.review_message = review_message;
            claim.verified_by = user.user_id;

            // If approved, update item status to Claimed
            const foundItem = db.found_items.find(f => f.found_id === claim.foreign_id);
            if (foundItem && status === 'Approved') {
                foundItem.status = 'Claimed';
            }

            // Notify claimant
            db.notifications.push({
                notification_id: generateId('notif'),
                user_id: claim.user_id,
                title: `Claim ${status}`,
                message: `Your claim for "${foundItem ? foundItem.item_name : 'item'}" has been updated to ${status}. ${review_message || ''}`,
                related_item_id: claim.foreign_id,
                is_read: 0,
                created_at: new Date().toISOString()
            });

            saveDatabase();

            return sendJson(res, 200, {
                success: true,
                message: `Claim status updated to ${status}.`,
                claim
            });
        }

        // 19. POSSIBLE MATCHES ENGINE
        if (req.method === 'GET' && pathname === '/api/matches') {
            const matches = [];

            db.lost_items.forEach(lost => {
                if (lost.status === 'Lost') {
                    db.found_items.forEach(found => {
                        if (found.status === 'Available') {
                            const resMatch = calculateMatchScore(lost, found);
                            if (resMatch.score >= 35) {
                                matches.push({
                                    score: resMatch.score,
                                    reasons: resMatch.reasons,
                                    lost_item: {
                                        id: lost.lost_id,
                                        name: lost.item_name,
                                        category: lost.category,
                                        location: lost.location_lost,
                                        date: lost.date_lost,
                                        image_url: lost.image_url
                                    },
                                    found_item: {
                                        id: found.found_id,
                                        name: found.item_name,
                                        category: found.category,
                                        location: found.location_found,
                                        date: found.date_found,
                                        image_url: found.image_url
                                    }
                                });
                            }
                        }
                    });
                }
            });

            matches.sort((a, b) => b.score - a.score);

            return sendJson(res, 200, { success: true, count: matches.length, matches });
        }

        // 20. NOTIFICATIONS
        if (req.method === 'GET' && pathname === '/api/notifications') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            const userNotifs = db.notifications
                .filter(n => n.user_id === user.user_id)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            return sendJson(res, 200, {
                success: true,
                unread_count: userNotifs.filter(n => !n.is_read).length,
                notifications: userNotifs
            });
        }

        if (req.method === 'PUT' && pathname === '/api/notifications/read-all') {
            const user = getAuthUser(req);
            if (!user) return sendError(res, 401, 'Unauthorized.');

            db.notifications.forEach(n => {
                if (n.user_id === user.user_id) n.is_read = 1;
            });
            saveDatabase();
            return sendJson(res, 200, { success: true, message: 'All notifications marked as read.' });
        }

        // 21. IMAGE UPLOAD HANDLER
        if (req.method === 'POST' && pathname === '/api/upload') {
            const body = await parseBody(req);
            const { image_data, filename = 'image.png' } = body;

            if (!image_data) return sendError(res, 400, 'No image data provided.');

            const matches = image_data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (!matches || matches.length !== 3) {
                return sendError(res, 400, 'Invalid base64 image data.');
            }

            const ext = matches[1].includes('jpeg') ? '.jpg' : matches[1].includes('png') ? '.png' : '.webp';
            const base64Data = matches[2];
            const buffer = Buffer.from(base64Data, 'base64');

            if (buffer.length > 5 * 1024 * 1024) {
                return sendError(res, 400, 'Image exceeds maximum 5MB limit.');
            }

            const savedFilename = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 6)}${ext}`;
            const targetPath = path.join(UPLOADS_DIR, savedFilename);
            fs.writeFileSync(targetPath, buffer);

            return sendJson(res, 200, {
                success: true,
                image_url: `/uploads/${savedFilename}`
            });
        }

        // =================================================================
        // STATIC FILE SERVING
        // Serves HTML, CSS, JS, images, uploads
        // =================================================================
        let filePath = '';
        if (pathname === '/' || pathname === '') {
            filePath = path.join(__dirname, 'index.html');
        } else if (pathname.startsWith('/uploads/')) {
            filePath = path.join(UPLOADS_DIR, pathname.replace('/uploads/', ''));
        } else {
            filePath = path.join(__dirname, pathname);
        }

        // Fallback checks (e.g. /report-lost.html -> /reportlost.html)
        if (!fs.existsSync(filePath)) {
            if (pathname === '/report-lost.html' || pathname === '/report-lost') {
                filePath = path.join(__dirname, 'reportlost.html');
            } else if (pathname === '/report-found.html' || pathname === '/report-found') {
                filePath = path.join(__dirname, 'reportfound.html');
            } else if (pathname === '/my-reports.html' || pathname === '/myreports') {
                filePath = path.join(__dirname, 'myreports.html');
            } else if (pathname === '/my-claims.html' || pathname === '/myclaims') {
                filePath = path.join(__dirname, 'myclaims.html');
            }
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';
            const fileStream = fs.createReadStream(filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            return fileStream.pipe(res);
        }

        // 404 for unhandled routes
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('404 Not Found - TraceBack Lost & Found Management System');

    } catch (err) {
        console.error('Server error:', err);
        sendError(res, 500, 'Internal Server Error: ' + err.message);
    }
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` TraceBack Server is LIVE on http://localhost:${PORT}`);
    console.log(` Database: Persistent JSON & Schema configured at ${DB_FILE}`);
    console.log(` Static & API endpoints ready!`);
    console.log(`======================================================\n`);
});
