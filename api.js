// =====================================================================
// TraceBack - Client API Bridge & Local Fallback Engine
// Connects to Backend REST API (http://localhost:5000/api)
// Gracefully falls back to LocalStorage when running standalone on GitHub Pages
// =====================================================================

// Purge any mock/demo session so users must explicitly log in
if (typeof localStorage !== 'undefined' && localStorage.getItem('tb_token') === 'demo-token') {
    localStorage.removeItem('tb_token');
    localStorage.removeItem('tb_user');
}

const API_BASE = window.location.origin.includes('5000') 
    ? '/api' 
    : (window.location.protocol === 'file:' ? 'http://localhost:5000/api' : '/api');

const TraceBackAPI = {
    // -----------------------------------------------------------------
    // Storage helpers
    // -----------------------------------------------------------------
    getToken() {
        return localStorage.getItem('tb_token');
    },

    setSession(token, user) {
        localStorage.setItem('tb_token', token);
        localStorage.setItem('tb_user', JSON.stringify(user));
    },

    getCurrentUser() {
        const u = localStorage.getItem('tb_user');
        return u ? JSON.parse(u) : null;
    },

    logout() {
        localStorage.removeItem('tb_token');
        localStorage.removeItem('tb_user');
        window.location.href = 'login.html';
    },

    requireAuth(msg = '') {
        const user = this.getCurrentUser();
        if (!user) {
            const pageName = window.location.pathname.split('/').pop() || 'dashboard.html';
            const defaultMsg = 'You must create an account or sign in to report or claim items.';
            const message = msg || defaultMsg;
            window.location.href = `login.html?redirect=${encodeURIComponent(pageName)}&msg=${encodeURIComponent(message)}`;
            return false;
        }
        return true;
    },

    // -----------------------------------------------------------------
    // HTTP Fetch Wrapper with Auth Header
    // -----------------------------------------------------------------
    async request(endpoint, options = {}) {
        const token = this.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, {
                ...options,
                headers
            });
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || 'Request failed with status ' + res.status);
            }
            return data;
        } catch (err) {
            // Check if server is unreachable
            if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('404')) {
                console.warn('[TraceBack] Backend unreachable, falling back to local client engine:', err.message);
                return this.fallbackEngine(endpoint, options);
            }
            throw err;
        }
    },

    // -----------------------------------------------------------------
    // API Methods
    // -----------------------------------------------------------------
    async sendEmailVerification(email) {
        return this.request('/auth/send-verification', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
    },

    async verifyEmailCode(email, code) {
        return this.request('/auth/verify-code', {
            method: 'POST',
            body: JSON.stringify({ email, code })
        });
    },

    async register(userData) {
        const res = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify(userData)
        });
        if (res.token && res.user) {
            this.setSession(res.token, res.user);
        }
        return res;
    },

    async login(email, password) {
        const res = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        if (res.token && res.user) {
            this.setSession(res.token, res.user);
        }
        return res;
    },

    async getMe() {
        return this.request('/auth/me');
    },

    async updateProfile(profileData) {
        const res = await this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(profileData)
        });
        if (res.user) {
            localStorage.setItem('tb_user', JSON.stringify(res.user));
        }
        return res;
    },

    async changePassword(currentPassword, newPassword) {
        return this.request('/auth/change-password', {
            method: 'PUT',
            body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
        });
    },

    async getDashboardStats() {
        return this.request('/dashboard/stats');
    },

    async getDashboardActivity() {
        return this.request('/dashboard/activity');
    },

    async getRecentItems() {
        return this.request('/items/recent');
    },

    async searchItems(params = {}) {
        const queryStr = new URLSearchParams(params).toString();
        return this.request(`/items/search?${queryStr}`);
    },

    async getItemDetails(type, id) {
        return this.request(`/items/${type}/${id}`);
    },

    async reportFound(itemData) {
        if (!this.getCurrentUser()) {
            this.requireAuth('You must be logged in to report a found item.');
            throw new Error('Authentication required: Please sign in before reporting a found item.');
        }
        return this.request('/items/found', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    },

    async reportLost(itemData) {
        if (!this.getCurrentUser()) {
            this.requireAuth('You must be logged in to report a lost item.');
            throw new Error('Authentication required: Please sign in before reporting a lost item.');
        }
        return this.request('/items/lost', {
            method: 'POST',
            body: JSON.stringify(itemData)
        });
    },

    async deleteReport(type, id) {
        return this.request(`/items/${type}/${id}`, {
            method: 'DELETE'
        });
    },

    async getMyReports() {
        return this.request('/my-reports');
    },

    async submitClaim(claimData) {
        return this.request('/claims', {
            method: 'POST',
            body: JSON.stringify(claimData)
        });
    },

    async getMyClaims() {
        return this.request('/claims/my');
    },

    async getManageClaims() {
        return this.request('/claims/manage');
    },

    async updateClaimStatus(claimId, status, reviewMessage = '') {
        return this.request(`/claims/${claimId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status, review_message: reviewMessage })
        });
    },

    async getMatches() {
        return this.request('/matches');
    },

    async getNotifications() {
        return this.request('/notifications');
    },

    async markNotificationsRead() {
        return this.request('/notifications/read-all', { method: 'PUT' });
    },

    // -----------------------------------------------------------------
    // LOCAL CLIENT FALLBACK (For standalone/GitHub Pages deployment)
    // -----------------------------------------------------------------
    initLocalDb() {
        if (!localStorage.getItem('tb_local_db_init')) {
            const seedFound = [
                {
                    found_id: 'fnd-001',
                    item_name: 'MacBook Air M2',
                    date_found: '2026-07-22',
                    time_found: '14:30',
                    location_found: 'IT Block - Room 302',
                    storage_location: 'Campus Security Office',
                    description: 'Silver Apple MacBook Air with a small blue sticker on bottom right lid. Left behind after lab session.',
                    category: 'Electronics',
                    color: 'Silver',
                    brand: 'Apple',
                    identifying_features: 'Small blue astronaut sticker on outer casing',
                    image_url: 'laptop.png',
                    status: 'Available',
                    user_id: 'usr-admin-01',
                    created_at: new Date('2026-07-22T14:35:00Z').toISOString()
                },
                {
                    found_id: 'fnd-002',
                    item_name: 'Water Bottle',
                    date_found: '2026-07-21',
                    time_found: '11:15',
                    location_found: 'Library - 2nd Floor',
                    storage_location: 'Library Help Desk',
                    description: 'Matte black insulated water bottle with metal carabiner on cap.',
                    category: 'Other',
                    color: 'Black',
                    brand: 'Milton',
                    identifying_features: 'Engraved initials R.S near bottom base',
                    image_url: 'bottle.png',
                    status: 'Available',
                    user_id: 'usr-demo-01',
                    created_at: new Date('2026-07-21T11:20:00Z').toISOString()
                },
                {
                    found_id: 'fnd-003',
                    item_name: 'Backpack',
                    date_found: '2026-07-20',
                    time_found: '16:45',
                    location_found: 'Main Gate',
                    storage_location: 'Main Gate Security Post',
                    description: 'Grey and navy waterproof college backpack containing notebooks.',
                    category: 'Bags',
                    color: 'Grey/Navy',
                    brand: 'Wildcraft',
                    identifying_features: 'Keychain with guitar attached to main zip',
                    image_url: 'bag.png',
                    status: 'Available',
                    user_id: 'usr-admin-01',
                    created_at: new Date('2026-07-20T17:00:00Z').toISOString()
                },
                {
                    found_id: 'fnd-004',
                    item_name: 'Headphones',
                    date_found: '2026-07-20',
                    time_found: '18:00',
                    location_found: 'Auditorium',
                    storage_location: 'Campus Security Office',
                    description: 'Black wireless Bluetooth over-ear headphones inside a black case.',
                    category: 'Electronics',
                    color: 'Black',
                    brand: 'Sony',
                    identifying_features: 'Foam padding on headband slightly scuffed',
                    image_url: 'headphones.png',
                    status: 'Available',
                    user_id: 'usr-demo-02',
                    created_at: new Date('2026-07-20T18:15:00Z').toISOString()
                }
            ];

            const seedLost = [
                {
                    lost_id: 'lst-001',
                    item_name: 'MacBook Air',
                    date_lost: '2026-07-22',
                    time_lost: '14:00',
                    location_lost: 'IT Block',
                    description: 'Silver 13-inch MacBook Air forgotten after lab exam.',
                    category: 'Electronics',
                    color: 'Silver',
                    brand: 'Apple',
                    serial_number: 'C02G40Z...',
                    image_url: 'laptop.png',
                    status: 'Lost',
                    user_id: 'usr-demo-01',
                    created_at: new Date('2026-07-22T14:15:00Z').toISOString()
                },
                {
                    lost_id: 'lst-002',
                    item_name: 'Scientific Calculator',
                    date_lost: '2026-07-23',
                    time_lost: '09:30',
                    location_lost: 'Mechanical Workshop',
                    description: 'Casio FX-991EX ClassWiz calculator inside black protective sliding case.',
                    category: 'Electronics',
                    color: 'Black',
                    brand: 'Casio',
                    image_url: 'calculator.png',
                    status: 'Lost',
                    user_id: 'usr-demo-02',
                    created_at: new Date('2026-07-23T09:45:00Z').toISOString()
                }
            ];

            const seedClaims = [
                {
                    claims_id: 'clm-001',
                    foreign_id: 'fnd-002',
                    user_id: 'usr-demo-02',
                    status: 'Pending',
                    proof_of_ownership: 'Can state initials R.S engraved on base and receipt of purchase.',
                    claim_date: '2026-07-22',
                    explanation: 'This water bottle belongs to me; left it while studying for exam.',
                    review_message: 'Awaiting claimant student ID verification at the library desk.',
                    created_at: new Date('2026-07-22T12:00:00Z').toISOString()
                }
            ];

            const seedUsers = [
                {
                    user_id: 'usr-demo-01',
                    fname: 'Ayfa',
                    minit: 'M',
                    lname: 'Mehrin',
                    clg_email: 'ayfa@campus.edu',
                    dept: 'Computer Science',
                    role: 'Student',
                    phoneno: '+91 9123456789',
                    institution: 'College of Engineering'
                },
                {
                    user_id: 'usr-admin-01',
                    fname: 'Campus',
                    minit: '',
                    lname: 'Security',
                    clg_email: 'admin@traceback.edu',
                    dept: 'Security',
                    role: 'Admin',
                    phoneno: '+91 9876543210',
                    institution: 'Campus Security Office'
                }
            ];

            localStorage.setItem('tb_local_found', JSON.stringify(seedFound));
            localStorage.setItem('tb_local_lost', JSON.stringify(seedLost));
            localStorage.setItem('tb_local_claims', JSON.stringify(seedClaims));
            localStorage.setItem('tb_local_users', JSON.stringify(seedUsers));
            localStorage.setItem('tb_local_db_init', '1');
        }
    },

    fallbackEngine(endpoint, options) {
        this.initLocalDb();
        const foundItems = JSON.parse(localStorage.getItem('tb_local_found') || '[]');
        const lostItems = JSON.parse(localStorage.getItem('tb_local_lost') || '[]');
        const claims = JSON.parse(localStorage.getItem('tb_local_claims') || '[]');
        const currentUser = this.getCurrentUser();

        if (endpoint.startsWith('/dashboard/stats')) {
            return {
                success: true,
                stats: {
                    lost_reports: lostItems.filter(i => i.status === 'Lost').length,
                    found_reports: foundItems.filter(i => i.status === 'Available').length,
                    pending_claims: claims.filter(c => c.status === 'Pending').length,
                    user_stats: {
                        my_lost: currentUser ? lostItems.filter(i => i.user_id === currentUser.user_id).length : 0,
                        my_found: currentUser ? foundItems.filter(i => i.user_id === currentUser.user_id).length : 0,
                        my_claims: currentUser ? claims.filter(c => c.user_id === currentUser.user_id).length : 0
                    }
                }
            };
        }

        if (endpoint.startsWith('/dashboard/activity')) {
            const acts = [
                { id: '1', type: 'lost', text: 'Reported lost: MacBook Air (IT Block)', date: new Date().toISOString() },
                { id: '2', type: 'found', text: 'Found item submitted: Water Bottle at Library', date: new Date().toISOString() },
                { id: '3', type: 'claim', text: 'Claim filed for Water Bottle [Pending]', date: new Date().toISOString() }
            ];
            return { success: true, activities: acts };
        }

        if (endpoint.startsWith('/items/recent')) {
            return {
                success: true,
                items: foundItems.map(f => ({
                    id: f.found_id,
                    item_name: f.item_name,
                    category: f.category,
                    location: f.location_found,
                    date: f.date_found,
                    image_url: f.image_url || 'bottle.png',
                    type: 'Found',
                    status: f.status
                }))
            };
        }

        if (endpoint.startsWith('/items/search')) {
            const urlObj = new URL(`http://local${endpoint}`);
            const q = (urlObj.searchParams.get('q') || '').toLowerCase();
            const type = (urlObj.searchParams.get('type') || 'all').toLowerCase();
            const cat = (urlObj.searchParams.get('category') || '').toLowerCase();

            let results = [];
            if (type === 'all' || type === 'found') {
                foundItems.forEach(f => results.push({
                    id: f.found_id,
                    item_name: f.item_name,
                    type: 'Found',
                    category: f.category,
                    description: f.description,
                    location: f.location_found,
                    date: f.date_found,
                    color: f.color,
                    brand: f.brand,
                    image_url: f.image_url,
                    status: f.status,
                    created_at: f.created_at
                }));
            }
            if (type === 'all' || type === 'lost') {
                lostItems.forEach(l => results.push({
                    id: l.lost_id,
                    item_name: l.item_name,
                    type: 'Lost',
                    category: l.category,
                    description: l.description,
                    location: l.location_lost,
                    date: l.date_lost,
                    color: l.color,
                    brand: l.brand,
                    image_url: l.image_url,
                    status: l.status,
                    created_at: l.created_at
                }));
            }

            if (q) results = results.filter(i => i.item_name.toLowerCase().includes(q) || i.description.toLowerCase().includes(q));
            if (cat && cat !== 'all') results = results.filter(i => i.category.toLowerCase() === cat);

            return { success: true, results };
        }

        if (endpoint.startsWith('/items/found/')) {
            const id = endpoint.split('/')[3];
            const item = foundItems.find(f => f.found_id === id);
            return { success: true, item: item || foundItems[0], isOwner: true };
        }

        if (endpoint.startsWith('/items/lost/')) {
            const id = endpoint.split('/')[3];
            const item = lostItems.find(l => l.lost_id === id);
            return { success: true, item: item || lostItems[0], isOwner: true };
        }

        if (endpoint.startsWith('/items/found') && options.method === 'POST') {
            const activeUser = this.getCurrentUser();
            if (!activeUser) {
                throw new Error('Authentication required: You must create an account or log in to report a found item.');
            }
            const body = JSON.parse(options.body);
            body.found_id = 'fnd-' + Date.now();
            body.user_id = activeUser.user_id;
            body.status = 'Available';
            body.created_at = new Date().toISOString();
            foundItems.unshift(body);
            localStorage.setItem('tb_local_found', JSON.stringify(foundItems));
            return { success: true, message: 'Found item report saved!', item: body };
        }

        if (endpoint.startsWith('/items/lost') && options.method === 'POST') {
            const activeUser = this.getCurrentUser();
            if (!activeUser) {
                throw new Error('Authentication required: You must create an account or log in to report a lost item.');
            }
            const body = JSON.parse(options.body);
            body.lost_id = 'lst-' + Date.now();
            body.user_id = activeUser.user_id;
            body.status = 'Lost';
            body.created_at = new Date().toISOString();
            lostItems.unshift(body);
            localStorage.setItem('tb_local_lost', JSON.stringify(lostItems));
            return { success: true, message: 'Lost item report saved!', item: body };
        }

        if (endpoint.startsWith('/claims') && options.method === 'POST') {
            const activeUser = this.getCurrentUser();
            if (!activeUser) {
                throw new Error('Authentication required: You must create an account or log in to claim an item.');
            }
            const body = JSON.parse(options.body);
            const newClaim = {
                claims_id: 'clm-' + Date.now(),
                foreign_id: body.found_id,
                user_id: activeUser.user_id,
                status: 'Pending',
                proof_of_ownership: body.proof_of_ownership || '',
                claim_date: new Date().toISOString().split('T')[0],
                explanation: body.explanation,
                review_message: 'Claim submitted to campus administration.'
            };
            claims.unshift(newClaim);
            localStorage.setItem('tb_local_claims', JSON.stringify(claims));
            return { success: true, message: 'Claim request submitted!', claim: newClaim };
        }

        if (endpoint.startsWith('/claims/my')) {
            const userClaims = claims.map(c => {
                const item = foundItems.find(f => f.found_id === c.foreign_id);
                return {
                    ...c,
                    item_name: item ? item.item_name : 'Found Item',
                    location: item ? item.location_found : 'Campus',
                    image_url: item ? item.image_url : 'fina.png'
                };
            });
            return { success: true, claims: userClaims };
        }

        if (endpoint.startsWith('/my-reports')) {
            return {
                success: true,
                lost_reports: lostItems,
                found_reports: foundItems
            };
        }

        if (endpoint.startsWith('/matches')) {
            return {
                success: true,
                matches: [
                    {
                        score: 85,
                        reasons: ['Matching category: Electronics', 'Matching name keywords: "MacBook"', 'Matching color: Silver', 'Matching brand: Apple'],
                        lost_item: lostItems[0],
                        found_item: foundItems[0]
                    }
                ]
            };
        }

        return { success: true };
    }
};

window.TraceBackAPI = TraceBackAPI;
