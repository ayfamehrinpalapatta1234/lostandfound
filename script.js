// =====================================================================
// TraceBack - Global Frontend Scripts & UI Interactions
// =====================================================================

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initCurrentUserUI();
    initMobileDrawer();
    initImageUploadPreview();
    setupLogoutButtons();
});

// Toast notification helper
window.showToast = function(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-box';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast-msg ${type}`;
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        toast.style.transition = '0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Highlight current page in sidebar
function initNavigation() {
    const currentPath = window.location.pathname.split('/').pop() || 'dashboard.html';
    const sidebarLinks = document.querySelectorAll('.sidebar li a');
    
    sidebarLinks.forEach(link => {
        const href = link.getAttribute('href');
        const parentLi = link.closest('li');
        if (parentLi) {
            parentLi.classList.remove('active');
            if (href === currentPath || 
               (currentPath === '' && href === 'dashboard.html') ||
               (currentPath.includes('reportlost') && href.includes('report-lost')) ||
               (currentPath.includes('reportfound') && href.includes('report-found')) ||
               (currentPath.includes('myreports') && href.includes('myreports')) ||
               (currentPath.includes('myclaims') && href.includes('myclaims'))) {
                parentLi.classList.add('active');
            }
        }
    });
}

// Display authenticated user information in sidebar
function initCurrentUserUI() {
    if (!window.TraceBackAPI) return;
    const user = TraceBackAPI.getCurrentUser();
    
    const sidebar = document.querySelector('.sidebar');
    if (sidebar && user) {
        let userBlock = document.querySelector('.sidebar-user');
        if (!userBlock) {
            userBlock = document.createElement('div');
            userBlock.className = 'sidebar-user';
            sidebar.appendChild(userBlock);
        }
        const initials = `${(user.fname || 'U')[0]}${(user.lname || '')[0] || ''}`.toUpperCase();
        userBlock.innerHTML = `
            <div class="sidebar-user-avatar">${initials}</div>
            <div class="sidebar-user-info">
                <div class="sidebar-user-name">${user.fname} ${user.lname}</div>
                <div class="sidebar-user-role">${user.role || 'Student'} • ${user.dept || 'Campus'}</div>
            </div>
        `;
    }

    // Update welcome message if present
    const welcomeHeader = document.querySelector('.welcome-card h2');
    if (welcomeHeader && user) {
        welcomeHeader.textContent = `Welcome Back, ${user.fname} 👋`;
    }
}

// Mobile sidebar drawer
function initMobileDrawer() {
    const toggleBtn = document.querySelector('.menu-toggle');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Close on link click
        sidebar.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                sidebar.classList.remove('open');
            });
        });
    }
}

// Universal image upload & preview handler
function initImageUploadPreview() {
    const fileInputs = document.querySelectorAll('input[type="file"]#imageUpload');
    fileInputs.forEach(input => {
        const preview = document.getElementById('previewImage');
        if (!preview) return;

        input.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validate file size (< 5MB)
            if (file.size > 5 * 1024 * 1024) {
                showToast('Image file size must be less than 5MB', 'error');
                input.value = '';
                return;
            }

            // Validate file type
            if (!file.type.startsWith('image/')) {
                showToast('Please select a valid image file (PNG, JPG, JPEG, WebP)', 'error');
                input.value = '';
                return;
            }

            const reader = new FileReader();
            reader.onload = function(evt) {
                preview.src = evt.target.result;
                preview.style.display = 'block';
                showToast('Image selected successfully', 'success');
            };
            reader.readAsDataURL(file);
        });
    });
}

// Setup logout buttons
function setupLogoutButtons() {
    const logoutLinks = document.querySelectorAll('a[href*="logout"], a[href="login.html"].logout-btn, #logoutBtn');
    logoutLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            if (confirm('Are you sure you want to log out of TraceBack?')) {
                if (window.TraceBackAPI) {
                    TraceBackAPI.logout();
                } else {
                    localStorage.removeItem('tb_token');
                    localStorage.removeItem('tb_user');
                    window.location.href = 'login.html';
                }
            }
        });
    });
}
