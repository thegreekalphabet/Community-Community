// ═══════════════════════════════════════════════════════
//  AUTH GUARD & INITIALIZATION
// ═══════════════════════════════════════════════════════
const API_BASE = (() => {
  if (window.location.protocol.startsWith('http')) {
    if (window.location.port === '3000') return window.location.origin;
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }
  return 'http://localhost:3000';
})();

let currentUser = null;

async function checkAuthStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/auth/status`, {
      credentials: 'include'
    });
    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        // Sync localStorage with server session
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        return data.user;
      }
    }
  } catch (error) {
    console.error('Auth check failed:', error);
  }

  localStorage.removeItem('currentUser');
  return null;
}

function getUserHandle(user) {
  if (!user) return '@user';
  const name = user.name || user.email || 'user';
  return '@' + name.split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '_');
}

function updateUserProfileElements(user) {
  if (!user) return;

  const handle = getUserHandle(user);
  const avatarLetter = user.name ? user.name.charAt(0).toUpperCase() : (user.email || 'U').charAt(0).toUpperCase();

  document.querySelectorAll('.nav-profile-name').forEach(el => el.textContent = user.name || user.email);
  document.querySelectorAll('.nav-profile-handle').forEach(el => el.textContent = handle);
  document.querySelectorAll('.nav-profile .avatar').forEach(el => el.textContent = avatarLetter);
  document.querySelectorAll('[data-user-name]').forEach(el => el.textContent = user.name || user.email);
  document.querySelectorAll('[data-user-handle]').forEach(el => el.textContent = handle);
  document.querySelectorAll('[data-user-karma]').forEach(el => el.textContent = user.karma || 0);
  document.querySelectorAll('[data-user-role]').forEach(el => el.textContent = user.role || 'Volunteer');
  document.querySelectorAll('[data-user-email]').forEach(el => el.textContent = user.email || '');
}

function renderProfilePage() {
  const page = document.getElementById('profile-page');
  if (!page || !currentUser) return;

  const handle = getUserHandle(currentUser);
  const nameEl = page.querySelector('#profile-full-name');
  const handleEl = page.querySelector('#profile-handle');
  const karmaEl = page.querySelector('#profile-karma');
  const roleEl = page.querySelector('#profile-role');
  const emailEl = page.querySelector('#profile-email');
  const bioEl = page.querySelector('#profile-bio');

  if (nameEl) nameEl.textContent = currentUser.name || currentUser.email;
  if (handleEl) handleEl.textContent = handle;
  if (karmaEl) karmaEl.textContent = currentUser.karma || 0;
  if (roleEl) roleEl.textContent = currentUser.role || 'Volunteer';
  if (emailEl) emailEl.textContent = currentUser.email || '';
  if (bioEl) bioEl.textContent = `Active contributor from Mumbai, helping the community through urgent assistance and volunteer coordination.`;
}

(async function initAuth() {
  if (window.location.protocol === 'file:') {
    const currentPage = window.location.pathname.split('/').pop();
    window.location.href = `http://localhost:3000/${currentPage}`;
    return;
  }

  const user = await checkAuthStatus();
  currentUser = user;

  if (!user && !window.location.pathname.includes('login') && !window.location.pathname.includes('signup')) {
    window.location.href = 'login.html';
    return;
  }

  updateUserProfileElements(user);
  renderProfilePage();
})();

let posts = [];

// Load posts on page load
document.addEventListener('DOMContentLoaded', function() {
  if (document.getElementById('feed-posts')) {
    loadPosts();
  }
});
async function apiRequest(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options
  };

  console.log('Making API request to:', endpoint, config);

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, config);
    console.log('API request URL:', `${API_BASE}${endpoint}`);
    console.log('Response status:', response.status, response.statusText);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));

    // Check if response has content before trying to parse JSON
    const contentType = response.headers.get('content-type');
    let data = null;

    if (contentType && contentType.includes('application/json')) {
      try {
        const text = await response.text();
        console.log('Response text:', text);
        if (text) {
          data = JSON.parse(text);
        }
      } catch (error) {
        console.error('Failed to parse JSON response:', error);
        throw new Error('Invalid JSON response from server');
      }
    } else {
      console.warn('Response is not JSON, content-type:', contentType);
    }

    if (!response.ok) {
      const errorMessage = data && data.error ? data.error : `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

async function loadPosts() {
  try {
    const data = await apiRequest('/api/posts');
    posts = data;
    renderFeed();
  } catch (error) {
    console.error('Failed to load posts:', error);
    // Fallback to empty array
    posts = [];
    renderFeed();
  }
}

async function createPost(postData) {
  try {
    const newPost = await apiRequest('/api/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });

    const normalizedPost = {
      id: newPost.id,
      author_id: newPost.author_id || newPost.authorId,
      author_name: newPost.author_name || newPost.authorName,
      author_handle: newPost.author_handle || newPost.authorHandle,
      author_verified: newPost.author_verified || newPost.authorVerified,
      author_trust_score: newPost.author_trust_score || newPost.authorTrustScore || 0,
      text: newPost.text,
      category: newPost.category,
      severity: newPost.severity,
      location: newPost.location,
      expires_at: newPost.expires_at || newPost.expiresAt,
      status: newPost.status,
      flag_count: newPost.flag_count || newPost.flagCount,
      created_at: newPost.created_at || newPost.createdAt,
      responders: newPost.responders || 0,
      likes: newPost.likes || 0
    };

    posts.unshift(normalizedPost);
    renderFeed();
    return normalizedPost;
  } catch (error) {
    console.error('Failed to create post:', error);
    throw error;
  }
}

async function respondToPost(postId) {
  try {
    const result = await apiRequest(`/api/posts/${postId}/respond`, { method: 'POST' });
    // Update local post data
    const post = posts.find(p => p.id === postId);
    if (post) {
      post.responders = result.responders;
      renderFeed();
    }
    return result;
  } catch (error) {
    console.error('Failed to respond to post:', error);
    throw error;
  }
}

async function likePost(postId) {
  try {
    const result = await apiRequest(`/api/posts/${postId}/like`, { method: 'POST' });
    // Update local post data
    const post = posts.find(p => p.id === postId);
    if (post) {
      post.likes = result.count;
      post.liked = result.liked;
      renderFeed();
    }
    return result;
  } catch (error) {
    console.error('Failed to like post:', error);
    throw error;
  }
}

async function registerUser(userData) {
  try {
    const result = await apiRequest('/api/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    localStorage.setItem('currentUser', JSON.stringify(result.user));
    window.location.href = 'helpnet.html';
    return result;
  } catch (error) {
    console.error('Failed to register:', error);
    throw error;
  }
}

async function loginUser(credentials) {
  try {
    const result = await apiRequest('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials)
    });
    localStorage.setItem('currentUser', JSON.stringify(result.user));
    window.location.href = 'helpnet.html';
    return result;
  } catch (error) {
    console.error('Failed to login:', error);
    throw error;
  }
}

async function logoutUser() {
  try {
    await apiRequest('/api/logout', { method: 'POST' });
  } catch (error) {
    console.error('Server logout failed:', error);
    // Continue with client-side logout even if server logout fails
  }

  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

const CAT_ICONS = { blood:'🩸', medical:'💊', food:'🍱', shelter:'🏠', volunteer:'🤝', other:'📦' };
const SEV_LABELS = { critical:'Critical', urgent:'Urgent', standard:'Standard' };

let currentFilter = 'all';
let currentFeedTab = 'for-you';
let selectedSeverity = 'standard';
let selectedModalSeverity = 'standard';

// Helper functions
function formatTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

function formatTimeLeft(expiresAt) {
  const now = new Date();
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return 'expired';

  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffHours / 24);

  if (diffHours < 1) return '<1h left';
  if (diffHours < 24) return `${diffHours}h left`;
  return `${diffDays}d left`;
}

// ════════════════════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════════════════════
function renderFeed() {
  const container = document.getElementById('feed-posts');
  if (!container) return; // Not all pages have the feed

  let visible = [...posts];

  if (currentFilter !== 'all') visible = visible.filter(p => p.category === currentFilter);
  if (currentFeedTab === 'critical') visible = visible.filter(p => p.severity === 'critical');

  // Sort by urgency score (already calculated by server)
  visible.sort((a,b) => b.urgencyScore - a.urgencyScore);

  if (visible.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">No requests found</div><p style="color:var(--muted)">Try a different filter or be the first to post!</p></div>`;
    return;
  }

  container.innerHTML = visible.map(post => {
    // Map API fields to frontend expected fields
    const name = post.author_name || 'Unknown';
    const handle = post.author_handle || '@unknown';
    const verified = post.author_verified;
    const trustScore = post.author_trust_score || 0;
    const createdAt = new Date(post.created_at);
    const expiresAt = new Date(post.expires_at);
    const timeAgo = !isNaN(createdAt) ? formatTimeAgo(createdAt) : 'just now';
    const timeLeft = !isNaN(expiresAt) ? formatTimeLeft(expiresAt) : 'unknown';
    const avatarLetter = name.charAt(0).toUpperCase();

    return `
    <div class="post" id="post-${post.id}">
      <div class="post-left">
        <div class="avatar" style="background: linear-gradient(135deg,#e5e7eb,#f3f4f6)">${avatarLetter}</div>
      </div>
      <div class="post-content">
        <div class="post-header">
          <span class="post-name">${name}</span>
          ${verified ? '<span class="verified-badge" title="Verified">✓</span>' : ''}
          <span class="post-handle">${handle}</span>
          <span class="post-time">${timeAgo}</span>
          <span class="sev-tag ${post.severity}">
            <span class="sev-dot ${post.severity}"></span>
            ${SEV_LABELS[post.severity]}
          </span>
        </div>
        <span class="post-category">${CAT_ICONS[post.category]} ${post.category.charAt(0).toUpperCase()+post.category.slice(1)}</span>
        <div class="post-text">${post.text.replace(/\n/g, '<br>')}</div>
        <div class="post-meta">
          <span class="post-meta-tag">📍 ${post.location || 'Location not specified'}</span>
          <span class="post-meta-tag">⏰ ${timeLeft}</span>
          <span class="post-meta-tag" style="color:var(--purple);background:#f3e8ff;">🌟 +${trustScore} karma</span>
          <span class="post-meta-tag">👥 ${post.responders || 0} helping</span>
        </div>
        <div class="post-actions">
          <button class="action-btn help" onclick="toggleHelp('${post.id}')">
            <span class="action-icon">🤝</span>
            <span>I Can Help</span>
          </button>
          <button class="action-btn like" onclick="toggleLike('${post.id}')">
            <span class="action-icon">🤍</span>
            <span>${post.likes || 0}</span>
          </button>
          <button class="action-btn share" onclick="sharePost('${post.id}')">
            <span class="action-icon">🔁</span>
            <span>0</span>
          </button>
          <button class="action-btn karma" onclick="toastMsg('🌟 +${trustScore} karma will be awarded when help is confirmed!')">
            <span class="action-icon">📤</span>
          </button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
//  ACTIONS
// ════════════════════════════════════════════════════════
async function toggleHelp(id) {
  try {
    await respondToPost(id);
    toastMsg('🤝 You committed to help! Karma will be awarded when help is confirmed.');
  } catch (error) {
    toastMsg('❌ Failed to respond to post. Please try again.');
  }
}

async function toggleLike(id) {
  try {
    await likePost(id);
  } catch (error) {
    toastMsg('❌ Failed to like post. Please try again.');
  }
}

function sharePost(id) {
  toastMsg('🔁 Post shared to your followers!');
  const post = posts.find(p => p.id === id);
  if (post) {
    post.shares++;
    savePosts();
  }
  renderFeed();
}

function filterCat(btn) {
  document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.cat;
  renderFeed();
}

function switchFeedTab(tab, btn) {
  document.querySelectorAll('.feed-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFeedTab = tab;
  renderFeed();
}

function setSeverity(btn) {
  document.querySelectorAll('#compose-severity .sev-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedSeverity = btn.dataset.sev;
}

function setModalSeverity(btn) {
  const parent = btn.closest('.modal') || document;
  parent.querySelectorAll('.sev-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedModalSeverity = btn.dataset.sev;
}

function updatePostBtn() {
  const text = document.getElementById('compose-text').value;
  const btn = document.getElementById('post-btn');
  const counter = document.getElementById('char-count');
  const remaining = 280 - text.length;
  counter.textContent = remaining;
  counter.style.color = remaining < 20 ? '#ef4444' : 'var(--muted)';
  btn.disabled = text.trim().length === 0 || remaining < 0;
}

async function submitPost() {
  const text = document.getElementById('compose-text').value.trim();
  if (!text) return;

  try {
    await createPost({
      text,
      category: 'other',
      severity: selectedSeverity,
      location: 'Your location'
    });

    document.getElementById('compose-text').value = '';
    document.getElementById('post-btn').disabled = true;
    document.getElementById('char-count').textContent = '280';
    toastMsg('POST POSTED SUCCESSFULLY');
    updateStats();
  } catch (error) {
    toastMsg(`❌ Failed to post request: ${error.message}`);
  }
}

async function submitModal() {
  const text = document.getElementById('modal-text').value.trim();
  const category = document.getElementById('modal-category').value;
  const location = document.getElementById('modal-location').value || 'Frankfurt';
  if (!text) { toastMsg('⚠️ Please describe your request.'); return; }

  try {
    await createPost({
      text,
      category,
      severity: selectedModalSeverity,
      location
    });

    closeModal();
    toastMsg('POST POSTED SUCCESSFULLY');
    updateStats();
  } catch (error) {
    toastMsg(`❌ Failed to post request: ${error.message}`);
  }
}

function searchPosts(query) {
  if (!query.trim()) { currentFilter = 'all'; renderFeed(); return; }
  const q = query.toLowerCase();
  const container = document.getElementById('feed-posts');
  const visible = posts.filter(p =>
    p.text.toLowerCase().includes(q) ||
    p.name.toLowerCase().includes(q) ||
    p.category.toLowerCase().includes(q) ||
    p.location.toLowerCase().includes(q)
  );
  if (visible.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div><div class="empty-title">No results for "${query}"</div></div>`;
    return;
  }
  const tempFilter = currentFilter;
  posts = visible;
  renderFeed();
  posts = [...posts]; // restore
}

function updateStats() {
  const critCount = posts.filter(p => p.severity === 'critical').length;
  document.getElementById('stat-critical').textContent = critCount;
}

// ════════════════════════════════════════════════════════
//  MODAL
// ════════════════════════════════════════════════════════
function openModal() {
  document.getElementById('modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeModal(e) {
  if (e && e.target !== document.getElementById('modal')) return;
  document.getElementById('modal').style.display = 'none';
  document.body.style.overflow = '';
}

// ════════════════════════════════════════════════════════
//  TOAST
// ════════════════════════════════════════════════════════
let toastTimer;
function toastMsg(msg) {
  let t = document.querySelector('.toast');
  if (t) t.remove();
  t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t && t.remove(), 3500);
}

// ════════════════════════════════════════════════════════
//  NAVIGATION (Replaced with multi-page actual links)
// ════════════════════════════════════════════════════════


// ════════════════════════════════════════════════════════
//  SIMULATE LIVE UPDATES
// ════════════════════════════════════════════════════════
setInterval(() => {
  // Randomly bump a like count to simulate live activity
  if (posts.length > 0) {
    const idx = Math.floor(Math.random() * posts.length);
    posts[idx].likes++;
    savePosts();
    // Only re-render if not disruptive
    const el = document.getElementById('feed-posts');
    if (el && document.getElementById('modal').style.display === 'none') {
      renderFeed();
    }
  }
  // Update live stat counters
  const h = document.getElementById('stat-helpers');
  const f = document.getElementById('stat-fulfilled');
  if (h) h.textContent = (parseInt(h.textContent.replace(',','')) + Math.floor(Math.random()*3)).toLocaleString();
  if (f) f.textContent = parseInt(f.textContent) + (Math.random() > 0.7 ? 1 : 0);
}, 8000);

// ════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════
renderFeed();