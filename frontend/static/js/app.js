// IoT Parking Management System - Frontend JavaScript

// API Configuration
const API_BASE = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws/realtime`;

// Global state
let authToken = localStorage.getItem('authToken');
let ws = null;
let charts = {};
let isLoading = false;

// Auth helper
async function fetchWithAuth(url, options = {}) {
    const headers = options.headers || {};
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    
    const response = await fetch(url, { ...options, headers });
    
    // Handle 401 Unauthorized
    if (response.status === 401) {
        localStorage.removeItem('authToken');
        authToken = null;
        
        // Store current page for redirect after login
        const currentPage = document.querySelector('.page-content:not([style*="display: none"])');
        if (currentPage && currentPage.id) {
            localStorage.setItem('redirectAfterLogin', currentPage.id);
        }
        
        showNotification('Session expired. Please login again.', 'warning');
        // Show login modal
        const modalEl = document.getElementById('loginModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const loginModal = new bootstrap.Modal(modalEl);
            loginModal.show();
        }
        return null;
    }
    
    return response;
}

// Error message formatter
function formatErrorMessage(error) {
    if (typeof error === 'string') return error;
    if (typeof error.detail === 'string') return error.detail;
    if (Array.isArray(error.detail)) {
        return error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
    }
    if (typeof error.detail === 'object') {
        return JSON.stringify(error.detail);
    }
    return error.message || 'An error occurred';
}

// Login functionality
async function performLogin() {
    console.log('🔐 Login attempt started...');
    
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const rememberMe = document.getElementById('remember-me')?.checked || false;
    const errorDiv = document.getElementById('login-error');
    const submitBtn = document.querySelector('button[form="login-form"]');
    
    console.log('Username:', username, 'Remember me:', rememberMe);
    
    // Client-side validation
    if (!username || username.length < 3) {
        errorDiv.textContent = 'Username must be at least 3 characters';
        errorDiv.classList.remove('d-none');
        return;
    }
    
    if (!password || password.length < 6) {
        errorDiv.textContent = 'Password must be at least 6 characters';
        errorDiv.classList.remove('d-none');
        return;
    }
    
    // Set loading state
    errorDiv.classList.add('d-none');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';
    }
    
    try {
        // Build form data
        const formData = new URLSearchParams();
        formData.append('username', username);
        formData.append('password', password);
        formData.append('remember_me', rememberMe);
        
        const response = await fetch(`${API_BASE}/api/auth/login`, {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: formData.toString()
        });
        
        if (response.ok) {
            const data = await response.json();
            authToken = data.access_token;
            localStorage.setItem('authToken', authToken);
            
            // Close modal
            const modalEl = document.getElementById('loginModal');
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            
            showNotification('✓ Login successful!', 'success');
            
            // Check for redirect after login
            const redirectPage = localStorage.getItem('redirectAfterLogin');
            if (redirectPage) {
                localStorage.removeItem('redirectAfterLogin');
                showPage(redirectPage.replace('-page', ''));
            } else {
                loadDashboard();
            }
            connectWebSocket();
            startAutoRefresh();
        } else if (response.status === 429) {
            errorDiv.textContent = 'Too many login attempts. Please wait a minute and try again.';
            errorDiv.classList.remove('d-none');
        } else {
            const error = await response.json();
            errorDiv.textContent = formatErrorMessage(error);
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Login error:', error);
        errorDiv.textContent = 'Network error. Please check your connection and try again.';
        errorDiv.classList.remove('d-none');
    } finally {
        // Reset button state
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }
}

// Check authentication on page load
function checkAuth() {
    if (!authToken) {
        // Show login modal
        const modalEl = document.getElementById('loginModal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
            const loginModal = new bootstrap.Modal(modalEl);
            loginModal.show();
        }
        return false;
    }
    return true;
}

// Loading state helpers
function showLoading() {
    isLoading = true;
    document.body.style.cursor = 'wait';
}

function hideLoading() {
    isLoading = false;
    document.body.style.cursor = 'default';
}

// Initialize application
document.addEventListener('DOMContentLoaded', async function() {
    initNavigation();
    
    // Check authentication - show login modal if not authenticated
    if (authToken) {
        // Verify token is still valid before loading dashboard
        try {
            const response = await fetchWithAuth(`${API_BASE}/api/health`);
            if (response && response.ok) {
                loadDashboard();
                connectWebSocket();
                startAutoRefresh();
                return;
            }
        } catch (e) {
            console.error('Token validation failed:', e);
            // Token invalid, will show login modal below
        }
    }
    
    // Show login modal if token is missing or invalid
    if (checkAuth()) {
        loadDashboard();
        connectWebSocket();
        startAutoRefresh();
    }
});

// Navigation
function initNavigation() {
    document.querySelectorAll('[data-page]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = e.currentTarget.dataset.page;
            showPage(page);
        });
    });
}

function showPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.page-content').forEach(page => {
        page.style.display = 'none';
    });
    
    // Show selected page
    document.getElementById(pageName + '-page').style.display = 'block';
    
    // Update nav active state with Tailwind classes
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active', 'text-accent-600', 'border-accent-600');
        link.classList.add('text-slate-600', 'border-transparent');
    });
    const activeLink = document.querySelector(`[data-page="${pageName}"]`);
    activeLink.classList.remove('text-slate-600', 'border-transparent');
    activeLink.classList.add('active', 'text-accent-600', 'border-accent-600');
    
    // Load page data
    switch(pageName) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'cards':
            loadCards();
            loadUnknownCards();
            break;
        case 'logs':
            loadLogs();
            break;
        case 'reports':
            loadReports();
            break;
        case 'settings':
            break;
    }
}

// Dashboard Functions
async function loadDashboard() {
    await loadStats();
    await loadSlots();
    await loadRecentActivity();
}

async function loadStats() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/stats`);
        if (!response) return;
        
        const data = await response.json();
        
        document.getElementById('total-slots').textContent = data.occupancy.total_slots;
        document.getElementById('available-slots').textContent = data.occupancy.available_slots;
        document.getElementById('occupied-slots').textContent = data.occupancy.occupied_slots;
        document.getElementById('today-revenue').textContent = `$${data.revenue.today.toFixed(2)}`;
        document.getElementById('active-cards').textContent = data.active_cards;
        document.getElementById('entries-today').textContent = data.total_entries_today;
        document.getElementById('exits-today').textContent = data.total_exits_today;
    } catch (error) {
        console.error('Error loading stats:', error);
        showNotification('Failed to load statistics. Please refresh.', 'danger');
    }
}

async function loadSlots() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/slots`);
        if (!response) return;
        
        const slots = await response.json();
        
        const grid = document.getElementById('parking-slots-grid');
        grid.innerHTML = '';
        
        slots.forEach(slot => {
            const slotDiv = document.createElement('div');
            const isAvailable = slot.status === 'available';
            
            slotDiv.className = `aspect-square rounded-xl border-2 flex flex-col justify-center items-center cursor-pointer transition-all ${
                isAvailable 
                    ? 'border-slate-200 bg-white hover:border-accent-500 hover:shadow-md' 
                    : 'border-accent-500 bg-accent-50 text-accent-700'
            }`;
            slotDiv.onclick = () => showSlotDetails(slot);
            
            const iconSvg = isAvailable 
                ? '<svg class="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
                : '<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>';
            
            slotDiv.innerHTML = `
                ${iconSvg}
                <div class="text-xl font-semibold mt-2">${slot.slot_id}</div>
                <div class="text-xs uppercase tracking-wide font-medium ${isAvailable ? 'text-slate-500' : 'text-accent-600'}">${isAvailable ? 'Free' : 'Occupied'}</div>
            `;
            
            grid.appendChild(slotDiv);
        });
    } catch (error) {
        console.error('Error loading slots:', error);
    }
}

function showSlotDetails(slot) {
    let message = `Slot #${slot.slot_id}\nStatus: ${slot.status}`;
    if (slot.current_card_uid) {
        message += `\nCard: ${slot.current_card_uid}`;
        if (slot.entry_time) {
            const duration = Math.floor((new Date() - new Date(slot.entry_time)) / 60000);
            message += `\nDuration: ${duration} minutes`;
        }
    }
    alert(message); // Safe: alert escapes content
}

async function loadRecentActivity() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/logs/recent?limit=20`);
        if (!response) return;
        const logs = await response.json();
        
        const feed = document.getElementById('activity-feed');
        feed.innerHTML = '';
        
        if (logs.length === 0) {
            feed.innerHTML = '<li class="text-sm text-slate-500">No recent activity</li>';
            return;
        }
        
        logs.forEach(log => {
            const li = document.createElement('li');
            const isEntry = log.action === 'entry';
            const isSuccess = log.status === 'success';
            
            const borderColor = isSuccess ? (isEntry ? 'border-green-500' : 'border-blue-500') : 'border-red-500';
            const iconColor = isSuccess ? (isEntry ? 'text-green-600' : 'text-blue-600') : 'text-red-600';
            const iconSvg = isEntry 
                ? '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"/></svg>'
                : '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>';
            
            li.className = `border-l-4 ${borderColor} pl-3 py-2 bg-white rounded-r`;
            
            const time = new Date(log.timestamp).toLocaleString();
            const statusBadge = isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
            
            li.innerHTML = `
                <div class="flex items-start space-x-2">
                    <div class="${iconColor} mt-0.5">${iconSvg}</div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between mb-1">
                            <span class="text-sm font-medium text-slate-900">${log.action.toUpperCase()}</span>
                            <span class="px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge}">${log.status}</span>
                        </div>
                        <div class="text-xs text-slate-600">
                            <span class="font-mono">${log.card_uid}</span>
                            ${log.slot_id ? ` • Slot ${log.slot_id}` : ''}
                        </div>
                        <div class="text-xs text-slate-400 mt-1">${time}</div>
                    </div>
                </div>
            `;
            
            feed.appendChild(li);
        });
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

// Cards Management
async function loadCards() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards`);
        if (!response) return;
        
        const cards = await response.json();
        
        const tbody = document.getElementById('cards-tbody');
        tbody.innerHTML = '';
        
        if (cards.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No cards found. Add your first card!</td></tr>';
            return;
        }
        
        cards.forEach(card => {
            const tr = document.createElement('tr');
            const statusBadge = card.is_active ? 'success' : 'secondary';
            const accessLevelNames = {0: 'Regular', 1: 'Admin', 2: 'Temporary'};
            
            // Safe: Create elements and use textContent to prevent XSS
            const cardUidCell = document.createElement('td');
            const cardUidCode = document.createElement('code');
            cardUidCode.textContent = card.card_uid;
            cardUidCell.appendChild(cardUidCode);
            
            const ownerCell = document.createElement('td');
            ownerCell.textContent = card.owner_name;
            
            const emailCell = document.createElement('td');
            emailCell.textContent = card.owner_email || '-';
            
            const plateCell = document.createElement('td');
            plateCell.textContent = card.vehicle_plate || '-';
            
            tr.appendChild(cardUidCell);
            tr.appendChild(ownerCell);
            tr.appendChild(emailCell);
            tr.appendChild(plateCell);
            
            // Safe: Only controlled values in innerHTML
            tr.innerHTML += `
                <td><span class="badge bg-info">${accessLevelNames[card.access_level] || 'Unknown'}</span></td>
                <td><span class="badge bg-${statusBadge}">${card.is_active ? 'Active' : 'Inactive'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary me-1" onclick='editCard(${JSON.stringify(card).replace(/'/g, "&apos;")})' title="Edit">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-${card.is_active ? 'warning' : 'success'} me-1" onclick="toggleCardStatus('${card.card_uid}', ${!card.is_active})" title="${card.is_active ? 'Deactivate' : 'Activate'}">
                        <i class="bi bi-${card.is_active ? 'pause' : 'play'}-fill"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteCard('${card.card_uid}')" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading cards:', error);
        showNotification('Failed to load cards. Please refresh.', 'danger');
        document.getElementById('cards-tbody').innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading cards</td></tr>';
    }
}

async function loadUnknownCards() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/recent-unknown`);
        if (!response) return;
        const unknownCards = await response.json();
        
        const container = document.getElementById('unknown-cards-container');
        if (!container) return; // Element doesn't exist yet
        
        if (unknownCards.length === 0) {
            container.innerHTML = '<p class="text-muted">No unknown cards detected recently.</p>';
            return;
        }
        
        container.innerHTML = '<div class="list-group">' + unknownCards.map((card, index) => {
            const isRecent = (new Date() - new Date(card.last_seen)) < 10000; // Last 10 seconds
            const pulseClass = isRecent ? 'border-warning border-2' : '';
            return `
            <div class="list-group-item d-flex justify-content-between align-items-center ${pulseClass}">
                <div>
                    <strong><code>${card.card_uid}</code></strong>
                    ${isRecent ? '<span class="badge bg-warning text-dark ms-2">NEW</span>' : ''}
                    <br>
                    <small class="text-muted">
                        Last seen: ${new Date(card.last_seen).toLocaleString()}
                        | Attempts: ${card.attempt_count}
                    </small>
                </div>
                <button class="btn btn-sm btn-success" onclick="addUnknownCard('${card.card_uid}')" title="Add this card">
                    <i class="bi bi-plus-circle"></i> Add Card
                </button>
            </div>
            `;
        }).join('') + '</div>';
    } catch (error) {
        console.error('Error loading unknown cards:', error);
    }
}

function addUnknownCard(cardUid) {
    // Pre-fill the add card form with the scanned UID
    document.getElementById('new-card-uid').value = cardUid;
    document.getElementById('new-card-uid').readOnly = true;
    
    // Focus on owner name field
    document.getElementById('new-owner-name').value = '';
    document.getElementById('new-email').value = '';
    document.getElementById('new-phone').value = '';
    document.getElementById('new-vehicle-plate').value = '';
    document.getElementById('new-access-level').value = '0';
    
    // Show the modal
    const modalEl = document.getElementById('addCardModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        new bootstrap.Modal(modalEl).show();
    } else {
        console.error('Bootstrap Modal not available');
    }
    
    // Reset readonly after modal closes
    if (modalEl) {
        modalEl.addEventListener('hidden.bs.modal', function() {
            document.getElementById('new-card-uid').readOnly = false;
        }, { once: true });
    }
}

async function submitNewCard() {
    if (isLoading) return;
    
    // Helper function to convert empty strings to null
    const getValueOrNull = (id) => {
        const value = document.getElementById(id).value.trim();
        return value === '' ? null : value;
    };
    
    // Map access level integer to enum string
    const accessLevelMap = {
        '0': 'regular',
        '1': 'admin',
        '2': 'temporary'
    };
    
    const accessLevelValue = document.getElementById('new-access-level').value;
    
    const cardData = {
        card_uid: document.getElementById('new-card-uid').value.toUpperCase().trim(),
        owner_name: document.getElementById('new-owner-name').value.trim(),
        owner_email: getValueOrNull('new-email'),
        phone: getValueOrNull('new-phone'),
        vehicle_plate: getValueOrNull('new-vehicle-plate'),
        access_level: accessLevelMap[accessLevelValue] || 'regular',
        is_active: true
    };
    
    // Reset readonly state on UID field
    document.getElementById('new-card-uid').readOnly = false;
    
    try {
        showLoading();
        const response = await fetchWithAuth(`${API_BASE}/api/cards`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(cardData)
        });
        
        if (!response) return;
        
        if (response.ok) {
            const result = await response.json();
            showNotification('✅ Card added successfully! Syncing to ESP32...', 'success');
            
            // Close modal and reset form
            const modalEl = document.getElementById('addCardModal');
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            document.getElementById('add-card-form').reset();
            
            // Refresh both cards and unknown cards lists
            loadCards();
            loadUnknownCards();
            
            // Show sync confirmation after delay
            setTimeout(() => {
                showNotification(`✓ Card ${result.card_uid} is now active on ESP32`, 'info');
            }, 1500);
        } else {
            const error = await response.json();
            showNotification('❌ Error: ' + formatErrorMessage(error), 'danger');
        }
    } catch (error) {
        console.error('Error adding card:', error);
        showNotification('❌ Failed to add card: ' + (error.message || 'Please try again.'), 'danger');
    } finally {
        hideLoading();
    }
}

function editCard(card) {
    document.getElementById('edit-card-uid').value = card.card_uid;
    document.getElementById('edit-card-uid-display').value = card.card_uid;
    document.getElementById('edit-owner-name').value = card.owner_name;
    document.getElementById('edit-email').value = card.owner_email || '';
    document.getElementById('edit-phone').value = card.phone || '';
    document.getElementById('edit-vehicle-plate').value = card.vehicle_plate || '';
    document.getElementById('edit-access-level').value = card.access_level;
    
    const modalEl = document.getElementById('editCardModal');
    if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        new bootstrap.Modal(modalEl).show();
    } else {
        console.error('Bootstrap Modal not available');
    }
}

async function submitEditCard() {
    const cardUid = document.getElementById('edit-card-uid').value;
    const cardData = {
        owner_name: document.getElementById('edit-owner-name').value,
        owner_email: document.getElementById('edit-email').value || null,
        phone: document.getElementById('edit-phone').value || null,
        vehicle_plate: document.getElementById('edit-vehicle-plate').value || null,
        access_level: parseInt(document.getElementById('edit-access-level').value)
    };
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/${cardUid}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(cardData)
        });
        
        if (!response) return;
        
        if (response.ok) {
            showNotification('✅ Card updated successfully! Auto-syncing to ESP32...', 'success');
            const modalEl = document.getElementById('editCardModal');
            if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }
            loadCards();
            loadUnknownCards();
        } else {
            const error = await response.json();
            showNotification('❌ Error: ' + formatErrorMessage(error), 'danger');
        }
    } catch (error) {
        console.error('Error updating card:', error);
        showNotification('❌ Failed to update card: ' + (error.message || 'Please try again.'), 'danger');
    }
}

async function deleteCard(cardUid) {
    // Get card details to check access level
    let isAdmin = false;
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/${cardUid}`);
        if (response) {
            const card = await response.json();
            isAdmin = card.access_level === 1; // 1 = admin
        }
    } catch (error) {
        console.error('Error checking card:', error);
    }
    
    const confirmMsg = isAdmin
        ? `⚠️ ADMIN CARD DEACTIVATION\n\nCard ${cardUid} has ADMIN access level.\nDeactivating this card will remove admin privileges.\n\nAre you absolutely sure?`
        : `⚠️ Are you sure you want to deactivate card ${cardUid}?\nThis will remove it from ESP32 whitelist.`;
    
    if (!confirm(confirmMsg)) {
        return;
    }
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/${cardUid}`, {
            method: 'DELETE'
        });
        
        if (!response) return;
        
        if (response.ok) {
            showNotification('✅ Card deactivated! Auto-syncing to ESP32...', 'success');
            loadCards();
            loadUnknownCards();
        } else {
            const error = await response.json();
            showNotification('❌ Error: ' + formatErrorMessage(error), 'danger');
        }
    } catch (error) {
        console.error('Error deleting card:', error);
        showNotification('❌ Failed to delete card: ' + (error.message || 'Please try again.'), 'danger');
    }
}

async function toggleCardStatus(cardUid, newStatus) {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/${cardUid}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({is_active: newStatus})
        });
        
        if (!response) return;
        
        if (response.ok) {
            showNotification(`✅ Card ${newStatus ? 'activated' : 'deactivated'}! Auto-syncing to ESP32...`, 'success');
            loadCards();
        }
    } catch (error) {
        console.error('Error updating card:', error);
        showNotification('❌ Failed to update card status', 'danger');
    }
}

async function syncCardsToESP32() {
    const btn = document.getElementById('sync-btn');
    const originalHTML = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span> Syncing...';
    
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/cards/sync-to-esp32`, {
            method: 'POST'
        });
        
        if (!response) return;
        
        if (response.ok) {
            const result = await response.json();
            showNotification('✅ ' + result.message + ' Check ESP32 serial monitor!', 'success');
        } else {
            const error = await response.json();
            showNotification('❌ Sync failed: ' + error.detail, 'danger');
        }
    } catch (error) {
        console.error('Error syncing cards:', error);
        showNotification('❌ Failed to sync cards to ESP32', 'danger');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalHTML;
    }
}

// Logs
async function loadLogs(filters = {}) {
    try {
        const params = new URLSearchParams(filters);
        const response = await fetchWithAuth(`${API_BASE}/api/logs?${params}`);
        if (!response) return;
        const logs = await response.json();
        
        const tbody = document.getElementById('logs-tbody');
        tbody.innerHTML = '';
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No logs found</td></tr>';
            return;
        }
        
        logs.forEach(log => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(log.timestamp).toLocaleString()}</td>
                <td>${log.card_uid}</td>
                <td><span class="badge bg-${log.action === 'entry' ? 'success' : 'danger'}">${log.action}</span></td>
                <td>${log.slot_id || '-'}</td>
                <td>${log.status}</td>
                <td>${log.duration_minutes ? log.duration_minutes + ' min' : '-'}</td>
                <td>${log.fee_amount ? '$' + log.fee_amount.toFixed(2) : '-'}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading logs:', error);
    }
}

function applyLogFilters() {
    const filters = {
        start_date: document.getElementById('filter-start-date').value,
        end_date: document.getElementById('filter-end-date').value,
        action: document.getElementById('filter-action').value
    };
    
    // Remove empty filters
    Object.keys(filters).forEach(key => {
        if (!filters[key]) delete filters[key];
    });
    
    loadLogs(filters);
}

function exportLogs() {
    const startDate = document.getElementById('filter-start-date').value;
    const endDate = document.getElementById('filter-end-date').value;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    
    window.open(`${API_BASE}/api/logs/export?${params}`, '_blank');
}

// Reports
async function loadReports() {
    await loadRevenueChart();
    await loadPeakHoursChart();
    await loadFrequentUsers();
}

async function loadRevenueChart() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/stats/revenue-by-day?days=7`);
        if (!response) return;
        const data = await response.json();
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded');
            return;
        }
        
        const ctx = document.getElementById('revenue-chart');
        if (!ctx) return;
        const context = ctx.getContext('2d');
        
        if (charts.revenue) charts.revenue.destroy();
        
        charts.revenue = new Chart(ctx, {
            type: 'line',
            data: {
                labels: Object.keys(data).reverse(),
                datasets: [{
                    label: 'Revenue ($)',
                    data: Object.values(data).reverse(),
                    borderColor: '#0d6efd',
                    backgroundColor: 'rgba(13, 110, 253, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {display: true}
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading revenue chart:', error);
    }
}

async function loadPeakHoursChart() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/stats/peak-hours?days=7`);
        if (!response) return;
        const data = await response.json();
        
        // Check if Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js library not loaded');
            return;
        }
        
        const ctx = document.getElementById('peak-hours-chart');
        if (!ctx) return;
        const context = ctx.getContext('2d');
        
        if (charts.peakHours) charts.peakHours.destroy();
        
        const hourLabels = Object.keys(data.hourly_distribution).map(h => h + ':00');
        const hourCounts = Object.values(data.hourly_distribution);
        
        charts.peakHours = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: hourLabels,
                datasets: [{
                    label: 'Entries',
                    data: hourCounts,
                    backgroundColor: '#198754'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {display: false}
                },
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error loading peak hours chart:', error);
    }
}

async function loadFrequentUsers() {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/stats/frequent-users?limit=10`);
        if (!response) return;
        const users = await response.json();
        
        const tbody = document.getElementById('frequent-users-tbody');
        tbody.innerHTML = '';
        
        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No data available</td></tr>';
            return;
        }
        
        users.forEach((user, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${index + 1}</td>
                <td>${user.owner_name}</td>
                <td>${user.card_uid}</td>
                <td>${user.vehicle_plate || '-'}</td>
                <td><span class="badge bg-primary">${user.visit_count}</span></td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error loading frequent users:', error);
    }
}

// Commands
async function openBarrier(gate) {
    try {
        const response = await fetchWithAuth(`${API_BASE}/api/commands/open-barrier`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({gate: gate})
        });
        
        if (!response) return;
        
        if (response.ok) {
            const result = await response.json();
            showNotification(`✓ ${gate.charAt(0).toUpperCase() + gate.slice(1)} barrier opening...`, 'success');
        } else {
            // Get detailed error message from backend
            try {
                const error = await response.json();
                showNotification(`Error: ${formatErrorMessage(error)}`, 'danger');
            } catch {
                showNotification(`Error: Failed to send command (HTTP ${response.status})`, 'danger');
            }
        }
    } catch (error) {
        console.error('Error sending command:', error);
        showNotification(`Error: ${error.message || 'Network error'}`, 'danger');
    }
}

// Notification helper
function showNotification(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3`;
    alertDiv.style.zIndex = '9999';
    alertDiv.style.minWidth = '400px';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

// Scan mode state
let scanModeActive = false;
let scanModeTimeout = null;

// Start card scan mode
async function startCardScan() {
    if (scanModeActive) {
        showNotification('Scan already in progress', 'warning');
        return;
    }
    
    const btn = document.getElementById('scan-card-btn');
    const statusDiv = document.getElementById('scan-status');
    const statusText = statusDiv.querySelector('small');
    
    try {
        // Send scan mode command to ESP32
        const response = await fetchWithAuth(`${API_BASE}/api/commands/scan-mode`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({enable: true, gate: 'entrance'})
        });
        
        if (!response || !response.ok) {
            throw new Error('Failed to activate scan mode');
        }
        
        scanModeActive = true;
        
        // Update UI
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Waiting for card...';
        statusDiv.style.display = 'block';
        statusText.className = 'text-info';
        statusText.innerHTML = '<i class="bi bi-wifi"></i> Place card on entrance reader now...';
        
        // Auto-cancel after 30 seconds
        scanModeTimeout = setTimeout(() => {
            cancelCardScan('Scan timeout - please try again');
        }, 30000);
        
        showNotification('📡 Scan mode activated. Place card on entrance reader.', 'info');
        
    } catch (error) {
        console.error('Error starting scan mode:', error);
        showNotification('❌ Failed to start scan mode: ' + error.message, 'danger');
        resetScanUI();
    }
}

// Cancel card scan mode
function cancelCardScan(message) {
    if (!scanModeActive) return;
    
    scanModeActive = false;
    
    if (scanModeTimeout) {
        clearTimeout(scanModeTimeout);
        scanModeTimeout = null;
    }
    
    // Deactivate scan mode on ESP32
    fetchWithAuth(`${API_BASE}/api/commands/scan-mode`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enable: false})
    }).catch(err => console.error('Error deactivating scan mode:', err));
    
    if (message) {
        const statusDiv = document.getElementById('scan-status');
        const statusText = statusDiv.querySelector('small');
        statusText.className = 'text-warning';
        statusText.textContent = message;
        
        setTimeout(() => {
            resetScanUI();
        }, 3000);
    } else {
        resetScanUI();
    }
}

// Reset scan UI elements
function resetScanUI() {
    const btn = document.getElementById('scan-card-btn');
    const statusDiv = document.getElementById('scan-status');
    
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-wifi"></i> Scan Card';
    statusDiv.style.display = 'none';
}

// Handle scanned card from WebSocket
async function handleScannedCard(cardUid) {
    if (!scanModeActive) return;
    
    // Cancel scan mode
    if (scanModeTimeout) {
        clearTimeout(scanModeTimeout);
        scanModeTimeout = null;
    }
    scanModeActive = false;
    
    const statusDiv = document.getElementById('scan-status');
    const statusText = statusDiv.querySelector('small');
    const uidInput = document.getElementById('new-card-uid');
    
    try {
        // Check if card already exists
        const checkResponse = await fetchWithAuth(`${API_BASE}/api/cards/${cardUid}`);
        
        if (checkResponse && checkResponse.ok) {
            // Card already exists
            const existingCard = await checkResponse.json();
            statusText.className = 'text-danger';
            statusText.innerHTML = `<i class="bi bi-exclamation-triangle"></i> Card already registered to ${existingCard.owner_name}`;
            showNotification(`❌ Card ${cardUid} already exists in database`, 'danger');
            
            // Reset after 5 seconds
            setTimeout(() => {
                resetScanUI();
            }, 5000);
            
        } else if (checkResponse && checkResponse.status === 404) {
            // Card not found - OK to add
            uidInput.value = cardUid;
            uidInput.readOnly = true;
            statusText.className = 'text-success';
            statusText.innerHTML = `<i class="bi bi-check-circle"></i> Card scanned: ${cardUid} - Ready to add!`;
            showNotification(`✅ Card ${cardUid} scanned successfully!`, 'success');
            
            // Reset UI but keep the UID
            const btn = document.getElementById('scan-card-btn');
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-wifi"></i> Scan Card';
            
            // Focus on owner name field
            document.getElementById('new-owner-name').focus();
            
        } else {
            throw new Error('Failed to check card status');
        }
        
    } catch (error) {
        console.error('Error checking card:', error);
        statusText.className = 'text-danger';
        statusText.textContent = 'Error checking card status';
        showNotification('❌ Error checking if card exists', 'danger');
        resetScanUI();
    }
    
    // Deactivate scan mode on ESP32
    fetchWithAuth(`${API_BASE}/api/commands/scan-mode`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({enable: false})
    }).catch(err => console.error('Error deactivating scan mode:', err));
}

document.getElementById('emergency-btn').addEventListener('click', async function() {
    const confirmed = confirm(
        '🚨 EMERGENCY MODE ACTIVATION\n\n' +
        'This will immediately open ALL barriers and keep them open.\n' +
        'Use only in case of fire, evacuation, or other emergencies.\n\n' +
        'Are you absolutely sure you want to continue?'
    );
    if (confirmed) {
        try {
            const response = await fetchWithAuth(`${API_BASE}/api/commands/emergency`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({enable: true})
            });
            
            if (!response) return;
            
            if (response.ok) {
                showNotification('🚨 Emergency mode activated!', 'warning');
                setTimeout(() => {
                    if (confirm('Deactivate emergency mode?')) {
                        fetchWithAuth(`${API_BASE}/api/commands/emergency`, {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({enable: false})
                        }).then(res => {
                            if (res && res.ok) {
                                showNotification('✓ Emergency mode deactivated', 'success');
                            }
                        });
                    }
                }, 5000);
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Error activating emergency mode', 'danger');
        }
    }
});

function refreshSystemStatus() {
    fetchWithAuth(`${API_BASE}/api/commands/refresh-status`, {method: 'POST'})
        .then(response => {
            if (response && response.ok) {
                showNotification('Status refresh requested from ESP32', 'info');
                setTimeout(() => loadDashboard(), 2000);
            }
        })
        .catch(err => {
            console.error(err);
            showNotification('Error requesting status refresh', 'danger');
        });
}

// Offline detection
let isOnline = navigator.onLine;

window.addEventListener('online', () => {
    isOnline = true;
    showNotification('✅ Connection restored', 'success');
    // Refresh data
    const activePage = document.querySelector('.page-content:not([style*="display: none"])');
    if (activePage && activePage.id === 'dashboard-page') {
        loadDashboard();
    }
});

window.addEventListener('offline', () => {
    isOnline = false;
    showNotification('⚠️ No internet connection. Some features may not work.', 'warning');
});

// WebSocket for Real-time Updates
let wsReconnectTimeout = null;

function connectWebSocket() {
    if (!isOnline) {
        console.log('Offline - skipping WebSocket connection');
        return;
    }
    
    // Clear any pending reconnection
    if (wsReconnectTimeout) {
        clearTimeout(wsReconnectTimeout);
        wsReconnectTimeout = null;
    }
    
    // Close existing connection if any
    if (ws && ws.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
    }
    
    ws = new WebSocket(WS_URL);
    
    ws.onopen = () => {
        console.log('✓ WebSocket connected');
        const statusEl = document.getElementById('mqtt-status');
        if (statusEl) {
            statusEl.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span><span class="text-slate-600 font-medium">Connected</span>';
        }
    };
    
    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleRealtimeUpdate(message);
    };
    
    ws.onclose = () => {
        console.log('✗ WebSocket disconnected');
        const statusEl = document.getElementById('mqtt-status');
        if (statusEl) {
            statusEl.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full"></span><span class="text-slate-600 font-medium">Disconnected</span>';
        }
        
        // Reconnect after 5 seconds (prevent multiple reconnection attempts)
        if (!wsReconnectTimeout) {
            wsReconnectTimeout = setTimeout(() => {
                wsReconnectTimeout = null;
                connectWebSocket();
            }, 5000);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
}

function handleRealtimeUpdate(message) {
    console.log('Real-time update:', message);
    
    // Check for MQTT messages
    if (message.type === 'mqtt_message' && message.data) {
        const topic = message.data.topic;
        const data = message.data.data;  // ← Get the actual MQTT payload
        
        // Handle card scanned in scan mode
        if (data.type === 'card_scanned' && data.card_uid) {
            console.log('Card scanned event received:', data.card_uid);
            handleScannedCard(data.card_uid);
            return;
        }
        
        // Check for denied card scans
        if ((data.action === 'entry' || data.action === 'exit') && 
            data.status && data.status.startsWith('denied_')) {
            // Show toast notification
            showNotification(`🔒 Unknown card detected: ${data.card_uid}`, 'warning');
            
            // Refresh unknown cards if on cards page
            if (document.getElementById('cards-page').style.display !== 'none') {
                loadUnknownCards();
            }
        }
    }
    
    // Refresh dashboard if visible
    if (document.getElementById('dashboard-page').style.display !== 'none') {
        loadStats();
        loadSlots();
        loadRecentActivity();
    }
}

// Logout functionality
function logout() {
    // Clear auth token
    localStorage.removeItem('authToken');
    authToken = null;
    
    // Close WebSocket
    if (ws) {
        ws.close();
        ws = null;
    }
    
    // Show notification and reload
    showNotification('Logged out successfully', 'info');
    
    // Redirect to login or reload page
    setTimeout(() => {
        window.location.reload();
    }, 1000);
}

// Attach logout handler
document.addEventListener('DOMContentLoaded', function() {
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
});

// Auto refresh every 30 seconds
function startAutoRefresh() {
    setInterval(() => {
        const activePage = document.querySelector('.page-content:not([style*="display: none"])');
        if (activePage && activePage.id === 'dashboard-page') {
            loadStats();
        } else if (activePage && activePage.id === 'cards-page') {
            // Refresh unknown cards as fallback if WebSocket missed events
            loadUnknownCards();
        }
    }, 30000);
}
