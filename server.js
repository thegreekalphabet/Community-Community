require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { v4: uuidv4 } = require('uuid');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors({
  origin: true, // Allow all origins for development
  credentials: true // Allow cookies/sessions
}));
app.options('*', cors({ origin: true, credentials: true }));

app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use(session({
  secret: 'helpnet-secret',
  resave: false,
  saveUninitialized: true,
  cookie: {
    sameSite: 'lax',
    secure: false,
  }
}));

// ── MYSQL CONNECTION ──
let db;
async function initDB() {
  try {
    db = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'Transformers123@',
      database: process.env.DB_NAME || 'community_connect',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Create tables if they don't exist
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'user',
        karma INT DEFAULT 0,
        trust_score INT DEFAULT 40,
        verified BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id VARCHAR(36) PRIMARY KEY,
        author_id VARCHAR(36) NOT NULL,
        author_name VARCHAR(255) NOT NULL,
        author_handle VARCHAR(255) NOT NULL,
        author_verified BOOLEAN DEFAULT FALSE,
        author_trust_score INT DEFAULT 40,
        text TEXT NOT NULL,
        category VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        location VARCHAR(255),
        expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL 1 DAY),
        status VARCHAR(20) DEFAULT 'open',
        flag_count INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS post_responses (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_response (post_id, user_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS post_likes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_like (post_id, user_id)
      )
    `);

    await db.execute(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        token VARCHAR(255) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_token (user_id)
      )
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
}

// ── AUTH ──
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if email already exists
    const [existing] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email taken' });
    }

    const userId = uuidv4();
    await db.execute(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, password, role || 'user']
    );

    req.session.userId = userId;
    res.json({ success: true, user: { id: userId, name, role: role || 'user', karma: 0 } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await db.execute(
      'SELECT id, name, role, karma FROM users WHERE email = ? AND password = ?',
      [email, password]
    );

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    req.session.userId = user.id;
    res.json({ success: true, user: { id: user.id, name: user.name, role: user.role, karma: user.karma } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// ── AUTH STATUS ──
app.get('/api/auth/status', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const [users] = await db.execute(
      'SELECT id, name, email, role, karma FROM users WHERE id = ?',
      [req.session.userId]
    );

    if (users.length === 0) {
      req.session.destroy();
      return res.status(401).json({ error: 'User not found' });
    }

    const user = users[0];
    res.json({ success: true, user });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

app.post('/api/password-reset-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }

    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (users.length === 0) {
      return res.json({ success: true, message: 'If this account exists, a reset link has been generated.' });
    }

    const user = users[0];
    const token = uuidv4();
    const expiresAt = new Date(Date.now() + 3600000); // 1 hour

    await db.execute(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), created_at = CURRENT_TIMESTAMP',
      [user.id, token, expiresAt]
    );

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const resetLink = `${origin}/reset-password.html?token=${token}`;
    res.json({ success: true, resetLink });
  } catch (error) {
    console.error('Password reset request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/password-reset', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      return res.status(400).json({ error: 'Invalid token or password. Password must be at least 6 characters.' });
    }

    const [rows] = await db.execute(
      'SELECT user_id, expires_at FROM password_reset_tokens WHERE token = ?',
      [token]
    );
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }

    const reset = rows[0];
    if (new Date(reset.expires_at) < new Date()) {
      await db.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
      return res.status(400).json({ error: 'Reset token has expired. Please request a new link.' });
    }

    await db.execute('UPDATE users SET password = ? WHERE id = ?', [password, reset.user_id]);
    await db.execute('DELETE FROM password_reset_tokens WHERE token = ?', [token]);
    res.json({ success: true, message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POSTS ──
// ── POSTS ──
app.get('/api/posts', async (req, res) => {
  try {
    const { category, severity, lat, lng, radius = 50 } = req.query;

    let query = `
      SELECT
        p.id,
        p.author_id,
        COALESCE(p.author_name, 'Unknown') as author_name,
        COALESCE(p.author_handle, '@unknown') as author_handle,
        p.author_verified,
        p.author_trust_score,
        p.text,
        p.category,
        p.severity,
        p.location,
        p.expires_at,
        p.status,
        p.flag_count,
        p.created_at,
        COUNT(DISTINCT pr.user_id) as responders_count,
        COUNT(DISTINCT pl.user_id) as likes_count
      FROM posts p
      LEFT JOIN post_responses pr ON p.id = pr.post_id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      WHERE 1=1
    `;
    const params = [];

    if (category && category !== 'all') {
      query += ' AND p.category = ?';
      params.push(category);
    }

    if (severity) {
      query += ' AND p.severity = ?';
      params.push(severity);
    }

    query += ' GROUP BY p.id ORDER BY p.created_at DESC';

    const [posts] = await db.execute(query, params);

    // Calculate urgency scores
    const sevWeight = { critical: 3, urgent: 2, standard: 1 };
    const catWeight = { blood: 10, medical: 8, shelter: 6, food: 5, volunteer: 3, other: 2 };

    const result = posts.map(p => {
      const T = Math.max(0, (new Date(p.expires_at) - Date.now()) / 3600000);
      const Wc = catWeight[p.category] || 2;
      const Sev = sevWeight[p.severity] || 1;
      const K = (p.author_trust_score || 40) / 100;
      const urgencyScore = (Wc * Sev * K) / (Math.log(T + 1) + 1);

      return {
        ...p,
        responders: p.responders_count || 0,
        likes: p.likes_count || 0,
        urgencyScore
      };
    });

    result.sort((a, b) => b.urgencyScore - a.urgencyScore);
    res.json(result);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/posts', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const [users] = await db.execute(
      'SELECT name, verified, trust_score FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) return res.status(401).json({ error: 'User not found' });

    const user = users[0];
    const { text, category, severity, location, expiresAt } = req.body;

    // Validate user has a name
    if (!user.name || user.name.trim() === '') {
      return res.status(400).json({ error: 'User profile incomplete. Please update your name.' });
    }

    const postId = uuidv4();
    const authorHandle = '@' + user.name.toLowerCase().replace(/\s+/g, '_');

    await db.execute(
      `INSERT INTO posts (id, author_id, author_name, author_handle, author_verified, author_trust_score, text, category, severity, location, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [postId, userId, user.name, authorHandle, user.verified, user.trust_score, text, category, severity, location, expiresAt || null]
    );

    const post = {
      id: postId,
      authorId: userId,
      authorName: user.name,
      authorHandle,
      authorVerified: user.verified,
      authorTrustScore: user.trust_score,
      text,
      category,
      severity,
      location,
      expiresAt: expiresAt || new Date(Date.now() + 86400000),
      status: 'open',
      responders: 0,
      likes: 0,
      flagCount: 0,
      createdAt: new Date()
    };

    // TODO: broadcast via Socket.io if severity === 'critical'
    res.json({
      id: post.id,
      author_id: post.authorId,
      author_name: post.authorName,
      author_handle: post.authorHandle,
      author_verified: post.authorVerified,
      author_trust_score: post.authorTrustScore,
      text: post.text,
      category: post.category,
      severity: post.severity,
      location: post.location,
      expires_at: post.expiresAt,
      status: post.status,
      flag_count: post.flagCount,
      created_at: post.createdAt,
      responders: post.responders,
      likes: post.likes
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/posts/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const postId = req.params.id;

    const [posts] = await db.execute('SELECT author_id FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ error: 'Not found' });

    if (posts[0].author_id !== userId) return res.status(403).json({ error: 'Forbidden' });

    await db.execute('DELETE FROM posts WHERE id = ?', [postId]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── RESPONSES ──
// ── RESPONSES ──
app.post('/api/posts/:id/respond', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const postId = req.params.id;

    // Check if post exists
    const [posts] = await db.execute('SELECT id FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ error: 'Not found' });

    // Try to insert response (will fail if already exists due to UNIQUE constraint)
    try {
      await db.execute('INSERT INTO post_responses (post_id, user_id) VALUES (?, ?)', [postId, userId]);
    } catch (error) {
      if (error.code === 'ER_DUP_ENTRY') {
        // Already responded, just return current count
      } else {
        throw error;
      }
    }

    // Get updated count
    const [countResult] = await db.execute('SELECT COUNT(*) as count FROM post_responses WHERE post_id = ?', [postId]);
    const respondersCount = countResult[0].count;

    res.json({ success: true, responders: respondersCount });
  } catch (error) {
    console.error('Respond to post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/posts/:id/confirm', async (req, res) => {
  try {
    // Requester confirms help was received → award karma
    const userId = req.session.userId;
    const { responderId } = req.body;
    const postId = req.params.id;

    const [posts] = await db.execute('SELECT author_id, severity FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0 || posts[0].author_id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const post = posts[0];

    // Check if responder actually responded to this post
    const [responses] = await db.execute(
      'SELECT id FROM post_responses WHERE post_id = ? AND user_id = ?',
      [postId, responderId]
    );

    if (responses.length === 0) {
      return res.status(400).json({ error: 'Responder has not responded to this post' });
    }

    // Award karma to responder
    const karmaMap = { critical: 50, urgent: 30, standard: 10 };
    const karmaIncrease = (karmaMap[post.severity] || 10) + 20; // +20 completion bonus

    await db.execute('UPDATE users SET karma = karma + ? WHERE id = ?', [karmaIncrease, responderId]);

    // Mark post as fulfilled
    await db.execute('UPDATE posts SET status = ? WHERE id = ?', ['fulfilled', postId]);

    res.json({ success: true });
  } catch (error) {
    console.error('Confirm help error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── LIKES ──
// ── LIKES ──
app.post('/api/posts/:id/like', async (req, res) => {
  try {
    const userId = req.session.userId;
    if (!userId) return res.status(401).json({ error: 'Not logged in' });

    const postId = req.params.id;

    // Check if post exists
    const [posts] = await db.execute('SELECT id FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ error: 'Not found' });

    // Check if already liked
    const [existing] = await db.execute(
      'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
      [postId, userId]
    );

    let liked;
    if (existing.length > 0) {
      // Unlike
      await db.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
      liked = false;
    } else {
      // Like
      await db.execute('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
      liked = true;
    }

    // Get updated count
    const [countResult] = await db.execute('SELECT COUNT(*) as count FROM post_likes WHERE post_id = ?', [postId]);
    const likesCount = countResult[0].count;

    res.json({ liked, count: likesCount });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── FLAGS ──
// ── FLAGS ──
app.post('/api/posts/:id/flag', async (req, res) => {
  try {
    const postId = req.params.id;

    const [posts] = await db.execute('SELECT flag_count FROM posts WHERE id = ?', [postId]);
    if (posts.length === 0) return res.status(404).json({ error: 'Not found' });

    const newFlagCount = posts[0].flag_count + 1;
    let status = 'open';

    if (newFlagCount >= 3) {
      status = 'held'; // send to mod queue
    }

    await db.execute('UPDATE posts SET flag_count = ?, status = ? WHERE id = ?', [newFlagCount, status, postId]);

    res.json({ flagCount: newFlagCount, held: status === 'held' });
  } catch (error) {
    console.error('Flag post error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── KARMA ──
// ── KARMA ──
app.get('/api/users/:id/karma', async (req, res) => {
  try {
    const [users] = await db.execute('SELECT karma, trust_score FROM users WHERE id = ?', [req.params.id]);
    if (users.length === 0) return res.status(404).json({ error: 'Not found' });

    const user = users[0];
    const levels = [
      { name: 'Newcomer',  min: 0    },
      { name: 'Helper',    min: 100  },
      { name: 'Advocate',  min: 500  },
      { name: 'Guardian',  min: 1500 },
      { name: 'Legend',    min: 5000 },
    ];
    const level = [...levels].reverse().find(l => user.karma >= l.min);
    res.json({ karma: user.karma, level: level.name, trustScore: user.trust_score });
  } catch (error) {
    console.error('Get karma error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── START ──
const PORT = process.env.PORT || 3000;

async function startServer() {
  await initDB();
  app.listen(PORT, () => console.log(`HelpNet running on http://localhost:${PORT}`));
}

startServer().catch(console.error);