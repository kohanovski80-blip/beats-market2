// ============================================
// BEATS MARKET - COMPLETE SERVER WITH SECURITY
// ============================================

const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const session = require('express-session');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const http = require('http');
const WebSocket = require('ws');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy (для Render)
app.set('trust proxy', 1);

// ============================================
// DATABASE SETUP
// ============================================

const sqlite3 = require('sqlite3').verbose();

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database', 'database.sqlite');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

function initDatabase() {
    return new Promise((resolve, reject) => {
        const uploadDirs = [
            path.join(__dirname, 'public', 'uploads'),
            path.join(__dirname, 'public', 'uploads', 'beats'),
            path.join(__dirname, 'public', 'uploads', 'photos'),
            path.join(__dirname, 'public', 'uploads', 'images'),
            path.join(__dirname, 'public', 'uploads', 'covers')
        ];
        uploadDirs.forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });

        // Создаём default-avatar если нет
        const defaultAvatarPath = path.join(__dirname, 'public', 'uploads', 'photos', 'default-avatar.png');
        if (!fs.existsSync(defaultAvatarPath)) {
            fs.writeFileSync(defaultAvatarPath, '');
            console.log('✅ Created default-avatar.png placeholder');
        }

        db.serialize(() => {
            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                photo_url TEXT DEFAULT '/uploads/photos/default-avatar.png',
                role TEXT DEFAULT 'user',
                bio TEXT DEFAULT '',
                location TEXT DEFAULT '',
                website TEXT DEFAULT '',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_login DATETIME,
                is_active BOOLEAN DEFAULT 1
            )`);

            // Password resets table
            db.run(`CREATE TABLE IF NOT EXISTS password_resets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT NOT NULL,
                token TEXT NOT NULL,
                expires DATETIME NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Beats table
            db.run(`CREATE TABLE IF NOT EXISTS beats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT,
                price INTEGER NOT NULL,
                audio_url TEXT NOT NULL,
                cover_url TEXT DEFAULT '/uploads/images/default-cover.jpg',
                user_id INTEGER,
                purchased BOOLEAN DEFAULT 0,
                play_count INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                tags TEXT,
                bpm INTEGER,
                key TEXT,
                duration INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Purchases table
            db.run(`CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                price INTEGER NOT NULL,
                payment_method TEXT,
                transaction_id TEXT,
                status TEXT DEFAULT 'completed',
                purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id)
            )`);

            // Cart table
            db.run(`CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id),
                UNIQUE(user_id, beat_id)
            )`);

            // Favorites table
            db.run(`CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id),
                UNIQUE(user_id, beat_id)
            )`);

            // Reviews table
            db.run(`CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                rating INTEGER DEFAULT 5,
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id)
            )`);

            // Activity log table
            db.run(`CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )`);

            // Проверяем, что таблицы созданы
            db.get('SELECT COUNT(*) as count FROM users', (err) => {
                if (err) {
                    console.error('❌ Database initialization error:', err);
                    reject(err);
                } else {
                    console.log('✅ Database tables created');
                    
                    // Создаём админа из .env
                    const adminEmail = process.env.ADMIN_EMAIL;
                    const adminPassword = process.env.ADMIN_PASSWORD;

                    if (!adminEmail || !adminPassword) {
                        console.error('❌ ADMIN_EMAIL or ADMIN_PASSWORD not set in .env');
                        console.log('⚠️ Admin user will NOT be created automatically');
                        resolve();
                        return;
                    }

                    db.get('SELECT * FROM users WHERE email = ?', [adminEmail], async (err, user) => {
                        if (err) {
                            console.error('Database error:', err);
                            resolve();
                            return;
                        }
                        
                        if (!user) {
                            const hashedPassword = await bcrypt.hash(adminPassword, 10);
                            db.run(`INSERT INTO users (username, email, password, role, bio) VALUES (?, ?, ?, ?, ?)`,
                                ['Admin', adminEmail, hashedPassword, 'creator', 'System Administrator'],
                                function(err) {
                                    if (err) console.error('Error creating admin:', err);
                                    else console.log('✅ Admin user created with password from .env');
                                    resolve();
                                }
                            );
                        } else if (user.role !== 'creator') {
                            db.run('UPDATE users SET role = ? WHERE email = ?', ['creator', adminEmail], (err) => {
                                if (err) console.error('Error updating admin role:', err);
                                else console.log('✅ Admin role updated to creator');
                                resolve();
                            });
                        } else {
                            console.log('✅ Admin user already exists');
                            resolve();
                        }
                    });
                }
            });
        });
    });
}

// ============================================
// MIDDLEWARE
// ============================================
const isProd = process.env.NODE_ENV === 'production';

app.use(cors({
    origin: function(origin, callback) {
        const allowedOrigins = [
            'http://localhost:3000',
            process.env.CLIENT_URL
        ];
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));

// Настройка helmet
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "'unsafe-hashes'", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'unsafe-inline'", "'unsafe-hashes'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
            imgSrc: ["'self'", "data:", "https:", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "blob:", "data:"],
            formAction: ["'self'"],
            baseUri: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginResourcePolicy: false,
    dnsPrefetchControl: false,
    frameguard: { action: 'deny' },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    ieNoOpen: true,
    noSniff: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    xssFilter: true
}));

app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// СЕССИЯ
// ============================================

app.use(session({
    name: 'beats_market_session',
    secret: process.env.SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
    proxy: true,
    cookie: {
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000
    }
}));

// ============================================
// ЗАЩИТА АУДИОФАЙЛОВ (доступ только для админа)
// ============================================

app.use('/uploads/beats', (req, res, next) => {
    console.log('\n🔍 ========== ЗАПРОС К АУДИО ==========');
    console.log('🔍 Путь:', req.path);
    console.log('🔍 Сессия есть?', !!req.session);
    console.log('🔍 userId:', req.session?.userId);
    
    if (!req.session || !req.session.userId) {
        console.log('🔒 403: Не залогинен');
        return res.status(403).json({ error: 'Login required' });
    }
    
    db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) {
            console.error('❌ Ошибка БД:', err.message);
            return res.status(500).json({ error: 'Database error' });
        }
        
        if (!user) {
            console.log('❌ Пользователь не найден');
            return res.status(403).json({ error: 'User not found' });
        }
        
        console.log('👤 Роль пользователя:', user.role);
        
        if (user.role === 'admin' || user.role === 'creator') {
            console.log('✅ Доступ разрешён для', user.role);
            next();
        } else {
            console.log('🔒 Доступ ЗАПРЕЩЁН для', user.role);
            return res.status(403).json({ error: 'Access denied. Admin only.' });
        }
    });
});

// Статическая раздача (после защиты) - ТОЛЬКО ОДИН РАЗ
app.use('/uploads/beats', express.static(path.join(__dirname, 'public', 'uploads', 'beats'), {
    maxAge: '30d',
    etag: true,
    lastModified: true
}));

// ============================================
// СТАТИЧЕСКАЯ РАЗДАЧА CSS, JS, ИЗОБРАЖЕНИЙ
// ============================================

app.use('/css', express.static(path.join(__dirname, 'public', 'css'), {
    maxAge: '7d',
    etag: true
}));

app.use('/js', express.static(path.join(__dirname, 'public', 'js'), {
    maxAge: '7d',
    etag: true
}));

app.use('/uploads/images', express.static(path.join(__dirname, 'public', 'uploads', 'images'), {
    maxAge: '30d',
    etag: true,
    lastModified: true
}));

app.use('/uploads/photos', express.static(path.join(__dirname, 'public', 'uploads', 'photos'), {
    maxAge: '30d',
    etag: true,
    lastModified: true
}));

app.use('/uploads/covers', express.static(path.join(__dirname, 'public', 'uploads', 'covers'), {
    maxAge: '30d',
    etag: true,
    lastModified: true
}));

// ============================================
// RATE LIMITING
// ============================================

const apiLimiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 1000,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: { error: 'Too many login attempts, please try again later.' },
    skipSuccessfulRequests: false
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/auth/forgot-password', authLimiter);
app.use('/api/', apiLimiter);

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// XSS protection
app.use((req, res, next) => {
    if (req.body) {
        for (let key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/[&<>]/g, function(m) {
                        if (m === '&') return '&amp;';
                        if (m === '<') return '&lt;';
                        if (m === '>') return '&gt;';
                        return m;
                    })
                    .trim();
            }
        }
    }
    next();
});

// ============================================
// HELPER FUNCTIONS
// ============================================

function checkAuth(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
    }
    next();
}

function checkRole(requiredRole) {
    return (req, res, next) => {
        if (!req.session.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        
        db.get('SELECT role FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (err || !user) {
                return res.status(401).json({ error: 'User not found' });
            }
            
            if (requiredRole === 'admin' && user.role !== 'admin' && user.role !== 'creator') {
                return res.status(403).json({ error: 'Access denied. Admin role required.' });
            }
            
            if (requiredRole === 'creator' && user.role !== 'creator') {
                return res.status(403).json({ error: 'Access denied. Creator role required.' });
            }
            
            next();
        });
    };
}

function logActivity(userId, action, details, req) {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    db.run(
        'INSERT INTO activity_log (user_id, action, details, ip_address) VALUES (?, ?, ?, ?)',
        [userId, action, details, ip],
        (err) => {
            if (err) console.error('Error logging activity:', err);
        }
    );
}

function sanitizeInput(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

function fixPhotoUrl(photoUrl) {
    if (!photoUrl || photoUrl === '') {
        return '/uploads/photos/default-avatar.png';
    }
    return photoUrl;
}

// ============================================
// MULTER CONFIGURATION
// ============================================

const audioStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads', 'beats');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const uploadAudio = multer({
    storage: audioStorage,
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/m4a', 'audio/aac'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only MP3, WAV, M4A, AAC files are allowed'), false);
        }
    }
});

const coverStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads', 'covers');
        console.log('📁 COVER DESTINATION:', dir);
        if (!fs.existsSync(dir)) {
            console.log('⚠️ Creating directory:', dir);
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `cover-${Date.now()}${ext}`;
        console.log('🖼️ COVER FILENAME:', filename);
        cb(null, filename);
    }
});

const uploadCover = multer({
    storage: coverStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        console.log('📸 COVER FILE RECEIVED:', file.originalname, 'MIME:', file.mimetype);
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.log('❌ Invalid cover format:', file.mimetype);
            cb(new Error('Only images (JPG, PNG, GIF, WEBP) are allowed'), false);
        }
    }
});

// ============================================
// AUTH ROUTES
// ============================================

app.post('/api/auth/register', async (req, res) => {
    let { username, email, password } = req.body;
    
    username = sanitizeInput(username);
    email = sanitizeInput(email).toLowerCase();
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers and underscore' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            `INSERT INTO users (username, email, password, created_at) 
             VALUES (?, ?, ?, datetime('now'))`,
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already registered' });
                    }
                    console.error('Registration error:', err);
                    return res.status(500).json({ error: 'Registration failed' });
                }
                
                req.session.userId = this.lastID;
                req.session.userRole = 'user';
                
                res.json({
                    success: true,
                    user: {
                        id: this.lastID,
                        username,
                        email,
                        role: 'user',
                        photo_url: '/uploads/photos/default-avatar.png'
                    }
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/auth/login', (req, res) => {
    let { email, password } = req.body;
    
    email = sanitizeInput(email).toLowerCase();
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err) {
            console.error('Login error:', err);
            return res.status(500).json({ error: 'Server error' });
        }
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);
        logActivity(user.id, 'login', 'User logged in', req);
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        console.log('✅ Login successful! User ID:', req.session.userId);
        console.log('✅ Session ID:', req.session.id);
        
        // Принудительное сохранение сессии
        req.session.save((err) => {
            if (err) {
                console.error('❌ Session save error:', err);
                return res.status(500).json({ error: 'Session save failed' });
            }
            
            res.json({
                success: true,
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    photo_url: fixPhotoUrl(user.photo_url),
                    role: user.role,
                    bio: user.bio || '',
                    location: user.location || '',
                    website: user.website || ''
                }
            });
        });
    });
});

// ============================================
// LEGACY AUTH ENDPOINTS
// ============================================

app.post('/api/login', (req, res) => {
    let { email, password } = req.body;
    email = sanitizeInput(email).toLowerCase();
    
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password required' });
    }
    
    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
        if (err || !user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        
        db.run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);
        logActivity(user.id, 'login', 'User logged in', req);
        
        req.session.userId = user.id;
        req.session.userRole = user.role;
        
        res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                photo_url: fixPhotoUrl(user.photo_url),
                role: user.role,
                bio: user.bio || '',
                location: user.location || '',
                website: user.website || ''
            }
        });
    });
});

app.post('/api/register', async (req, res) => {
    let { username, email, password } = req.body;
    
    username = sanitizeInput(username);
    email = sanitizeInput(email).toLowerCase();
    
    if (!username || !email || !password) {
        return res.status(400).json({ error: 'All fields are required' });
    }
    
    if (username.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers and underscore' });
    }
    
    if (password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    if (!/^[^\s@]+@([^\s@]+\.)+[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Invalid email format' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        db.run(
            `INSERT INTO users (username, email, password, created_at) 
             VALUES (?, ?, ?, datetime('now'))`,
            [username, email, hashedPassword],
            function(err) {
                if (err) {
                    if (err.message.includes('UNIQUE')) {
                        return res.status(400).json({ error: 'Email already registered' });
                    }
                    console.error('Registration error:', err);
                    return res.status(500).json({ error: 'Registration failed' });
                }
                
                req.session.userId = this.lastID;
                req.session.userRole = 'user';
                
                res.json({
                    success: true,
                    user: {
                        id: this.lastID,
                        username,
                        email,
                        role: 'user',
                        photo_url: '/uploads/photos/default-avatar.png'
                    }
                });
            }
        );
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/check', (req, res) => {
    if (!req.session.userId) return res.json({ success: false });
    
    db.get('SELECT id, username, email, photo_url, role, bio, location, website FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            req.session.destroy();
            return res.json({ success: false });
        }
        res.json({ success: true, user: { ...user, photo_url: fixPhotoUrl(user.photo_url) } });
    });
});

app.get('/api/auth/me', (req, res) => {
    if (!req.session.userId) {
        return res.json({ user: null });
    }
    
    db.get(
        'SELECT id, username, email, photo_url, role, bio, location, website FROM users WHERE id = ?',
        [req.session.userId],
        (err, user) => {
            if (err || !user) {
                return res.json({ user: null });
            }
            res.json({ user: { ...user, photo_url: fixPhotoUrl(user.photo_url) } });
        }
    );
});

app.post('/api/auth/logout', (req, res) => {
    if (req.session.userId) {
        logActivity(req.session.userId, 'logout', 'User logged out', req);
    }
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ error: 'Logout failed' });
        res.json({ success: true });
    });
});

app.post('/api/auth/forgot-password', (req, res) => {
    let { email } = req.body;
    email = sanitizeInput(email).toLowerCase();
    
    db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
        if (err || !user) {
            return res.json({ success: true, message: 'If email exists, reset link sent' });
        }
        
        const token = crypto.randomBytes(32).toString('hex');
        const expires = new Date(Date.now() + 3600000).toISOString();
        
        db.run('INSERT INTO password_resets (email, token, expires) VALUES (?, ?, ?)', [email, token, expires], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to create reset token' });
            console.log(`Password reset token for ${email}: ${token}`);
            res.json({ success: true, message: 'Reset link sent to email' });
        });
    });
});

app.post('/api/auth/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    db.get('SELECT * FROM password_resets WHERE token = ? AND expires > datetime("now")', [token], async (err, reset) => {
        if (err || !reset) return res.status(400).json({ error: 'Invalid or expired token' });
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE email = ?', [hashedPassword, reset.email], (err) => {
            if (err) return res.status(500).json({ error: 'Failed to reset password' });
            db.run('DELETE FROM password_resets WHERE token = ?', [token]);
            res.json({ success: true, message: 'Password reset successfully' });
        });
    });
});

app.post('/api/auth/change-password', checkAuth, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: 'Current password and new password are required' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    db.get('SELECT * FROM users WHERE id = ?', [req.session.userId], async (err, user) => {
        if (err || !user) return res.status(401).json({ error: 'User not found' });
        
        const isValid = await bcrypt.compare(currentPassword, user.password);
        if (!isValid) return res.status(401).json({ error: 'Current password is incorrect' });
        
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.session.userId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to change password' });
            logActivity(req.session.userId, 'password_change', 'Password changed', req);
            res.json({ success: true, message: 'Password changed successfully' });
        });
    });
});

app.get('/api/auth/check', (req, res) => {
    if (!req.session.userId) return res.json({ success: false });
    
    db.get('SELECT id, username, email, photo_url, role, bio, location, website FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            req.session.destroy();
            return res.json({ success: false });
        }
        res.json({ success: true, user: { ...user, photo_url: fixPhotoUrl(user.photo_url) } });
    });
});

// ============================================
// USER ROUTES
// ============================================

app.get('/api/users', checkAuth, checkRole('creator'), (req, res) => {
    db.all('SELECT id, username, email, photo_url, role, bio, location, website, created_at, last_login, is_active FROM users ORDER BY created_at DESC', [], (err, users) => {
        if (err) return res.status(500).json({ error: 'Failed to load users' });
        users.forEach(u => { u.photo_url = fixPhotoUrl(u.photo_url); });
        res.json(users);
    });
});

app.get('/api/users/:id', checkAuth, (req, res) => {
    const userId = parseInt(req.params.id);
    if (isNaN(userId) || userId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    
    db.get('SELECT id, username, email, photo_url, role, bio, location, website, created_at FROM users WHERE id = ?', [userId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        user.photo_url = fixPhotoUrl(user.photo_url);
        
        if (userId != req.session.userId && user.role !== 'admin' && user.role !== 'creator') {
            return res.json({ id: user.id, username: user.username, photo_url: user.photo_url, role: user.role, bio: user.bio, created_at: user.created_at });
        }
        res.json(user);
    });
});

app.put('/api/users/profile', checkAuth, (req, res) => {
    let { username, email, bio, location, website } = req.body;
    
    username = sanitizeInput(username);
    email = sanitizeInput(email).toLowerCase();
    bio = sanitizeInput(bio);
    location = sanitizeInput(location);
    website = sanitizeInput(website);
    
    if (!username || !email) {
        return res.status(400).json({ error: 'Username and email are required' });
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.status(400).json({ error: 'Username can only contain letters, numbers and underscore' });
    }
    
    db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.session.userId], (err, existing) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (existing) return res.status(400).json({ error: 'Email already in use' });
        
        db.run('UPDATE users SET username = ?, email = ?, bio = ?, location = ?, website = ? WHERE id = ?',
            [username, email, bio || '', location || '', website || '', req.session.userId],
            function(err) {
                if (err) return res.status(500).json({ error: 'Failed to update profile' });
                logActivity(req.session.userId, 'profile_update', 'Profile updated', req);
                res.json({ success: true, message: 'Profile updated successfully' });
            });
    });
});

// Upload profile photo
const photoStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public', 'uploads', 'photos');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const filename = `user-${req.session.userId}-${Date.now()}${ext}`;
        cb(null, filename);
    }
});

const uploadPhoto = multer({
    storage: photoStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only images (JPG, PNG, GIF, WEBP) are allowed'), false);
        }
    }
});

app.post('/api/users/profile/photo', checkAuth, (req, res) => {
    uploadPhoto.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: err.message });
        }
        
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const photoUrl = '/uploads/photos/' + req.file.filename;
        
        db.get('SELECT photo_url FROM users WHERE id = ?', [req.session.userId], (err, user) => {
            if (!err && user && user.photo_url && user.photo_url !== '/uploads/photos/default-avatar.png' && user.photo_url !== '') {
                const oldPath = path.join(__dirname, 'public', user.photo_url);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            
            db.run('UPDATE users SET photo_url = ? WHERE id = ?', [photoUrl, req.session.userId], function(err) {
                if (err) {
                    console.error('Ошибка обновления БД:', err);
                    return res.status(500).json({ error: 'Failed to update photo' });
                }
                logActivity(req.session.userId, 'photo_update', 'Profile photo updated', req);
                res.json({ success: true, photo_url: photoUrl });
            });
        });
    });
});

app.put('/api/users/:id/role', checkAuth, checkRole('creator'), (req, res) => {
    const targetUserId = parseInt(req.params.id);
    const { role } = req.body;
    
    if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    if (!role || !['user', 'admin', 'creator'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' });
    }
    if (targetUserId == req.session.userId) {
        return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    db.run('UPDATE users SET role = ? WHERE id = ?', [role, targetUserId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to change role' });
        if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
        logActivity(req.session.userId, 'role_change', `Changed role of user ${targetUserId} to ${role}`, req);
        res.json({ success: true, message: `Role changed to ${role}` });
    });
});

app.delete('/api/users/:id', checkAuth, checkRole('creator'), (req, res) => {
    const targetUserId = parseInt(req.params.id);
    if (isNaN(targetUserId) || targetUserId <= 0) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }
    if (targetUserId == req.session.userId) {
        return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.get('SELECT photo_url FROM users WHERE id = ?', [targetUserId], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'User not found' });
        if (user.photo_url && user.photo_url !== '/uploads/photos/default-avatar.png' && user.photo_url !== '') {
            const photoPath = path.join(__dirname, 'public', user.photo_url);
            if (fs.existsSync(photoPath)) fs.unlinkSync(photoPath);
        }
        
        db.run('DELETE FROM cart WHERE user_id = ?', [targetUserId]);
        db.run('DELETE FROM favorites WHERE user_id = ?', [targetUserId]);
        db.run('DELETE FROM reviews WHERE user_id = ?', [targetUserId]);
        db.run('DELETE FROM purchases WHERE user_id = ?', [targetUserId]);
        db.run('DELETE FROM activity_log WHERE user_id = ?', [targetUserId]);
        db.run('DELETE FROM users WHERE id = ?', [targetUserId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to delete user' });
            logActivity(req.session.userId, 'user_delete', `Deleted user ${targetUserId}`, req);
            res.json({ success: true, message: 'User deleted successfully' });
        });
    });
});

// ============================================
// BEATS ROUTES
// ============================================

app.get('/api/beats', (req, res) => {
    const { search, tag, minPrice, maxPrice, sort, page = 1, limit = 12 } = req.query;
    
    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(limit);
    const offset = (currentPage - 1) * itemsPerPage;
    
    let whereClause = ' WHERE b.purchased = 0';
    const params = [];
    
    if (search) {
        whereClause += ` AND (b.title LIKE ? OR b.description LIKE ?)`;
        params.push(`%${search}%`, `%${search}%`);
    }
    if (tag) {
        whereClause += ` AND b.tags LIKE ?`;
        params.push(`%${tag}%`);
    }
    if (minPrice) {
        whereClause += ` AND b.price >= ?`;
        params.push(minPrice);
    }
    if (maxPrice) {
        whereClause += ` AND b.price <= ?`;
        params.push(maxPrice);
    }
    
    const countQuery = `SELECT COUNT(*) as total FROM beats b${whereClause}`;
    
    let orderBy = ' ORDER BY b.created_at DESC';
    if (sort === 'price_asc') orderBy = ' ORDER BY b.price ASC';
    else if (sort === 'price_desc') orderBy = ' ORDER BY b.price DESC';
    else if (sort === 'popular') orderBy = ' ORDER BY b.play_count DESC';
    
    const dataQuery = `
        SELECT b.*, u.username as author, u.photo_url as author_photo,
               (SELECT COUNT(*) FROM reviews WHERE beat_id = b.id) as review_count,
               (SELECT AVG(rating) FROM reviews WHERE beat_id = b.id) as avg_rating
        FROM beats b 
        LEFT JOIN users u ON b.user_id = u.id 
        ${whereClause}
        ${orderBy}
        LIMIT ? OFFSET ?
    `;
    
    const dataParams = [...params, itemsPerPage, offset];
    
    db.get(countQuery, params, (err, countResult) => {
        if (err) {
            console.error('Error counting beats:', err);
            return res.status(500).json({ error: 'Failed to load beats' });
        }
        
        const total = countResult?.total || 0;
        const totalPages = Math.ceil(total / itemsPerPage);
        
        db.all(dataQuery, dataParams, (err, beats) => {
            if (err) {
                console.error('Error loading beats:', err);
                return res.status(500).json({ error: 'Failed to load beats' });
            }
            
            res.json({
                data: beats || [],
                pagination: {
                    currentPage: currentPage,
                    itemsPerPage: itemsPerPage,
                    totalItems: total,
                    totalPages: totalPages,
                    hasNextPage: currentPage < totalPages,
                    hasPrevPage: currentPage > 1
                }
            });
        });
    });
});

app.get('/api/beats/all', checkAuth, checkRole('admin'), (req, res) => {
    db.all(`SELECT b.*, u.username as author, u.email as author_email,
            (SELECT COUNT(*) FROM purchases WHERE beat_id = b.id) as sales_count
            FROM beats b LEFT JOIN users u ON b.user_id = u.id ORDER BY b.created_at DESC`,
        [], (err, beats) => {
            if (err) return res.status(500).json({ error: 'Failed to load beats' });
            res.json(beats || []);
        });
});

app.get('/api/beats/:id', (req, res) => {
    const beatId = parseInt(req.params.id);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    db.get(`SELECT b.*, u.username as author, u.photo_url as author_photo FROM beats b LEFT JOIN users u ON b.user_id = u.id WHERE b.id = ?`, [beatId], (err, beat) => {
        if (err || !beat) return res.status(404).json({ error: 'Beat not found' });
        db.run('UPDATE beats SET play_count = play_count + 1 WHERE id = ?', [beatId]);
        res.json(beat);
    });
});

app.post('/api/beats', checkAuth, checkRole('admin'), (req, res, next) => {
    const upload = multer({
        storage: multer.diskStorage({
            destination: (req, file, cb) => {
                if (file.fieldname === 'audio') {
                    const dir = path.join(__dirname, 'public', 'uploads', 'beats');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    cb(null, dir);
                } else if (file.fieldname === 'cover') {
                    const dir = path.join(__dirname, 'public', 'uploads', 'covers');
                    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
                    cb(null, dir);
                } else {
                    cb(new Error('Unexpected field'));
                }
            },
            filename: (req, file, cb) => {
                if (file.fieldname === 'audio') {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                    cb(null, uniqueSuffix + path.extname(file.originalname));
                } else if (file.fieldname === 'cover') {
                    const ext = path.extname(file.originalname);
                    const filename = `cover-${Date.now()}${ext}`;
                    cb(null, filename);
                } else {
                    cb(new Error('Unexpected field'));
                }
            }
        }),
        limits: { fileSize: 20 * 1024 * 1024 }
    }).fields([
        { name: 'audio', maxCount: 1 },
        { name: 'cover', maxCount: 1 }
    ]);
    
    upload(req, res, async (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ error: err.message });
        }
        
        let { title, description, price, tags, bpm, key } = req.body;
        
        title = sanitizeInput(title);
        description = sanitizeInput(description);
        tags = sanitizeInput(tags);
        
        if (!title || !price || !req.files?.audio) {
            return res.status(400).json({ error: 'Title, price, and audio file are required' });
        }
        
        const priceNum = parseInt(price);
        if (isNaN(priceNum) || priceNum <= 0) {
            return res.status(400).json({ error: 'Price must be a positive number' });
        }
        
        const audioFile = req.files.audio[0];
        const coverFile = req.files.cover?.[0];
        
        const audioUrl = '/uploads/beats/' + audioFile.filename;
        let coverUrl = '/uploads/images/default-cover.jpg';
        
        if (coverFile) {
            coverUrl = '/uploads/covers/' + coverFile.filename;
        }
        
        db.run(
            `INSERT INTO beats (title, description, price, audio_url, cover_url, user_id, tags, bpm, key) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description || '', priceNum, audioUrl, coverUrl, req.session.userId, tags || '', bpm || null, key || null],
            function(err) {
                if (err) {
                    console.error('Error adding beat:', err);
                    const audioPath = path.join(__dirname, 'public', audioUrl);
                    if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
                    if (coverUrl !== '/uploads/images/default-cover.jpg') {
                        const coverPath = path.join(__dirname, 'public', coverUrl);
                        if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
                    }
                    return res.status(500).json({ error: 'Failed to add beat' });
                }
                
                logActivity(req.session.userId, 'beat_upload', `Uploaded beat: ${title}`, req);
                res.json({
                    success: true,
                    beat: {
                        id: this.lastID,
                        title,
                        description,
                        price: priceNum,
                        audio_url: audioUrl,
                        cover_url: coverUrl
                    }
                });
            }
        );
    });
});

app.put('/api/beats/:id', checkAuth, checkRole('admin'), (req, res) => {
    const beatId = parseInt(req.params.id);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    let { title, description, price, tags, bpm, key } = req.body;
    title = sanitizeInput(title);
    description = sanitizeInput(description);
    tags = sanitizeInput(tags);
    
    if (!title || !price) {
        return res.status(400).json({ error: 'Title and price are required' });
    }
    
    db.run(`UPDATE beats SET title = ?, description = ?, price = ?, tags = ?, bpm = ?, key = ? WHERE id = ?`,
        [title, description || '', price, tags || '', bpm || null, key || null, beatId],
        function(err) {
            if (err) return res.status(500).json({ error: 'Failed to update beat' });
            if (this.changes === 0) return res.status(404).json({ error: 'Beat not found' });
            logActivity(req.session.userId, 'beat_update', `Updated beat: ${beatId}`, req);
            res.json({ success: true, message: 'Beat updated successfully' });
        });
});

app.delete('/api/beats/:id', checkAuth, checkRole('admin'), (req, res) => {
    const beatId = parseInt(req.params.id);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    db.get('SELECT audio_url, cover_url FROM beats WHERE id = ?', [beatId], (err, beat) => {
        if (err || !beat) return res.status(404).json({ error: 'Beat not found' });
        
        const audioPath = path.join(__dirname, 'public', beat.audio_url);
        if (fs.existsSync(audioPath)) fs.unlinkSync(audioPath);
        
        if (beat.cover_url && beat.cover_url !== '/uploads/images/default-cover.jpg') {
            const coverPath = path.join(__dirname, 'public', beat.cover_url);
            if (fs.existsSync(coverPath)) fs.unlinkSync(coverPath);
        }
        
        db.run('DELETE FROM cart WHERE beat_id = ?', [beatId]);
        db.run('DELETE FROM favorites WHERE beat_id = ?', [beatId]);
        db.run('DELETE FROM reviews WHERE beat_id = ?', [beatId]);
        db.run('DELETE FROM purchases WHERE beat_id = ?', [beatId]);
        db.run('DELETE FROM beats WHERE id = ?', [beatId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to delete beat' });
            logActivity(req.session.userId, 'beat_delete', `Deleted beat: ${beatId}`, req);
            res.json({ success: true, message: 'Beat deleted successfully' });
        });
    });
});

// ============================================
// CART ROUTES
// ============================================

app.get('/api/cart', checkAuth, (req, res) => {
    db.all(`SELECT c.id as cart_id, c.added_at, b.* FROM cart c JOIN beats b ON c.beat_id = b.id WHERE c.user_id = ? AND b.purchased = 0 ORDER BY c.added_at DESC`,
        [req.session.userId], (err, cartItems) => {
            if (err) return res.status(500).json({ error: 'Failed to load cart' });
            res.json(cartItems || []);
        });
});

app.post('/api/cart', checkAuth, (req, res) => {
    const { beatId } = req.body;
    if (!beatId) return res.status(400).json({ error: 'Beat ID required' });
    
    db.get('SELECT * FROM beats WHERE id = ? AND purchased = 0', [beatId], (err, beat) => {
        if (err || !beat) return res.status(404).json({ error: 'Beat not available' });
        db.run('INSERT OR IGNORE INTO cart (user_id, beat_id) VALUES (?, ?)', [req.session.userId, beatId], function(err) {
            if (err) return res.status(500).json({ error: 'Failed to add to cart' });
            if (this.changes === 0) return res.status(400).json({ error: 'Item already in cart' });
            res.json({ success: true, message: 'Added to cart' });
        });
    });
});

app.delete('/api/cart/:cartId', checkAuth, (req, res) => {
    const cartId = parseInt(req.params.cartId);
    if (isNaN(cartId) || cartId <= 0) {
        return res.status(400).json({ error: 'Invalid cart ID' });
    }
    
    db.run('DELETE FROM cart WHERE id = ? AND user_id = ?', [cartId, req.session.userId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to remove from cart' });
        if (this.changes === 0) return res.status(404).json({ error: 'Item not found in cart' });
        res.json({ success: true, message: 'Removed from cart' });
    });
});

app.delete('/api/cart', checkAuth, (req, res) => {
    db.run('DELETE FROM cart WHERE user_id = ?', [req.session.userId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to clear cart' });
        res.json({ success: true, message: 'Cart cleared' });
    });
});

// ============================================
// PURCHASE ROUTES
// ============================================

app.post('/api/purchase', checkAuth, (req, res) => {
    const { beatIds, paymentMethod, transactionId } = req.body;
    
    if (!beatIds || !Array.isArray(beatIds) || beatIds.length === 0) {
        return res.status(400).json({ error: 'No items to purchase' });
    }
    
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        let completed = 0;
        let hasError = false;
        let totalPrice = 0;
        const purchasedBeats = [];
        
        beatIds.forEach(beatId => {
            db.get('SELECT price, title FROM beats WHERE id = ? AND purchased = 0', [beatId], (err, beat) => {
                if (err || !beat) {
                    hasError = true;
                    completed++;
                    return;
                }
                
                totalPrice += beat.price;
                purchasedBeats.push({ id: beatId, title: beat.title, price: beat.price });
                
                db.run(`INSERT INTO purchases (user_id, beat_id, price, payment_method, transaction_id) VALUES (?, ?, ?, ?, ?)`,
                    [req.session.userId, beatId, beat.price, paymentMethod || 'card', transactionId || null]);
                db.run('UPDATE beats SET purchased = 1 WHERE id = ?', [beatId]);
                db.run('DELETE FROM cart WHERE user_id = ? AND beat_id = ?', [req.session.userId, beatId]);
                
                completed++;
                if (completed === beatIds.length) {
                    if (hasError) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: 'Purchase failed' });
                    } else {
                        db.run('COMMIT');
                        logActivity(req.session.userId, 'purchase', `Purchased ${purchasedBeats.length} beats for $${totalPrice}`, req);
                        res.json({ success: true, message: 'Purchase successful', total: totalPrice, beats: purchasedBeats });
                    }
                }
            });
        });
    });
});

app.get('/api/purchase/history', checkAuth, (req, res) => {
    db.all(`SELECT p.*, b.title, b.audio_url, b.cover_url, u.username as seller FROM purchases p JOIN beats b ON p.beat_id = b.id LEFT JOIN users u ON b.user_id = u.id WHERE p.user_id = ? ORDER BY p.purchased_at DESC`,
        [req.session.userId], (err, purchases) => {
            if (err) return res.status(500).json({ error: 'Failed to load purchase history' });
            res.json(purchases || []);
        });
});

app.get('/api/purchase/stats', checkAuth, checkRole('admin'), (req, res) => {
    db.get(`SELECT COUNT(*) as total_purchases, SUM(price) as total_revenue, COUNT(DISTINCT user_id) as unique_customers,
            COUNT(DISTINCT beat_id) as unique_beats_sold, DATE(MIN(purchased_at)) as first_purchase, DATE(MAX(purchased_at)) as last_purchase FROM purchases`,
        [], (err, stats) => {
            if (err) return res.status(500).json({ error: 'Failed to load statistics' });
            db.all(`SELECT DATE(purchased_at) as date, COUNT(*) as count, SUM(price) as revenue FROM purchases WHERE purchased_at >= DATE('now', '-30 days') GROUP BY DATE(purchased_at) ORDER BY date DESC`,
                [], (err, dailySales) => {
                    res.json({ ...stats, daily_sales: dailySales || [] });
                });
        });
});

// ============================================
// FAVORITES ROUTES
// ============================================

app.get('/api/favorites', checkAuth, (req, res) => {
    db.all(`SELECT f.*, b.title, b.price, b.audio_url, b.cover_url, u.username as author FROM favorites f JOIN beats b ON f.beat_id = b.id LEFT JOIN users u ON b.user_id = u.id WHERE f.user_id = ? AND b.purchased = 0 ORDER BY f.created_at DESC`,
        [req.session.userId], (err, favorites) => {
            if (err) return res.status(500).json({ error: 'Failed to load favorites' });
            res.json(favorites || []);
        });
});

app.post('/api/favorites', checkAuth, (req, res) => {
    const { beatId } = req.body;
    if (!beatId) return res.status(400).json({ error: 'Beat ID required' });
    db.run('INSERT OR IGNORE INTO favorites (user_id, beat_id) VALUES (?, ?)', [req.session.userId, beatId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to add to favorites' });
        res.json({ success: true, message: 'Added to favorites' });
    });
});

app.delete('/api/favorites/:beatId', checkAuth, (req, res) => {
    const beatId = parseInt(req.params.beatId);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    db.run('DELETE FROM favorites WHERE user_id = ? AND beat_id = ?', [req.session.userId, beatId], function(err) {
        if (err) return res.status(500).json({ error: 'Failed to remove from favorites' });
        res.json({ success: true, message: 'Removed from favorites' });
    });
});

// ============================================
// REVIEWS ROUTES
// ============================================

app.get('/api/beats/:beatId/reviews', (req, res) => {
    const beatId = parseInt(req.params.beatId);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    db.all(`SELECT r.*, u.username, u.photo_url FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.beat_id = ? ORDER BY r.created_at DESC`,
        [beatId], (err, reviews) => {
            if (err) return res.status(500).json({ error: 'Failed to load reviews' });
            res.json(reviews || []);
        });
});

app.post('/api/beats/:beatId/reviews', checkAuth, (req, res) => {
    const beatId = parseInt(req.params.beatId);
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    let { rating, comment } = req.body;
    comment = sanitizeInput(comment);
    
    if (!rating || rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }
    
    db.get('SELECT * FROM purchases WHERE user_id = ? AND beat_id = ?', [req.session.userId, beatId], (err, purchase) => {
        if (err || !purchase) return res.status(403).json({ error: 'You can only review beats you purchased' });
        
        db.get('SELECT * FROM reviews WHERE user_id = ? AND beat_id = ?', [req.session.userId, beatId], (err, existing) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (existing) return res.status(400).json({ error: 'You already reviewed this beat' });
            
            db.run(`INSERT INTO reviews (user_id, beat_id, rating, comment) VALUES (?, ?, ?, ?)`,
                [req.session.userId, beatId, rating, comment || ''],
                function(err) {
                    if (err) return res.status(500).json({ error: 'Failed to add review' });
                    logActivity(req.session.userId, 'review', `Reviewed beat ${beatId} with rating ${rating}`, req);
                    res.json({ success: true, message: 'Review added' });
                });
        });
    });
});

// ============================================
// ACTIVITY LOG ROUTES (admin only)
// ============================================

app.get('/api/activity', checkAuth, checkRole('admin'), (req, res) => {
    const { limit = 100, offset = 0 } = req.query;
    db.all(`SELECT a.*, u.username FROM activity_log a LEFT JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
        [limit, offset], (err, activities) => {
            if (err) return res.status(500).json({ error: 'Failed to load activity log' });
            res.json(activities || []);
        });
});

// ============================================
// DASHBOARD STATS (admin only)
// ============================================

app.get('/api/admin/dashboard', checkAuth, checkRole('admin'), (req, res) => {
    const stats = {};
    
    db.get('SELECT COUNT(*) as count FROM users', [], (err, r) => {
        stats.totalUsers = r?.count || 0;
        
        db.get('SELECT COUNT(*) as count FROM beats', [], (err, r) => {
            stats.totalBeats = r?.count || 0;
            
            db.get('SELECT COUNT(*) as count FROM beats WHERE purchased = 1', [], (err, r) => {
                stats.soldBeats = r?.count || 0;
                
                db.get('SELECT SUM(price) as total FROM purchases', [], (err, r) => {
                    stats.totalRevenue = r?.total || 0;
                    
                    db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin" OR role = "creator"', [], (err, r) => {
                        stats.admins = r?.count || 0;
                        
                        db.get('SELECT COUNT(*) as count FROM users WHERE created_at >= date("now", "-7 days")', [], (err, r) => {
                            stats.newUsersThisWeek = r?.count || 0;
                            
                            db.get('SELECT COUNT(*) as count FROM purchases WHERE purchased_at >= date("now", "-7 days")', [], (err, r) => {
                                stats.salesThisWeek = r?.count || 0;
                                stats.totalPurchases = stats.salesThisWeek;
                                
                                res.json(stats);
                            });
                        });
                    });
                });
            });
        });
    });
});

// ============================================
// RESET STATISTICS (admin/creator only)
// ============================================

app.post('/api/admin/reset-stats', checkAuth, checkRole('creator'), (req, res) => {
    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        let hasError = false;
        
        db.run('DELETE FROM purchases', (err) => { if (err) hasError = true; });
        db.run('DELETE FROM activity_log', (err) => { if (err) hasError = true; });
        db.run('UPDATE beats SET play_count = 0', (err) => { if (err) hasError = true; });
        db.run('UPDATE beats SET download_count = 0', (err) => { if (err) hasError = true; });
        db.run('DELETE FROM cart', (err) => { if (err) hasError = true; });
        
        logActivity(req.session.userId, 'reset_statistics', 'All statistics were reset', req);
        
        if (hasError) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Failed to reset statistics' });
        } else {
            db.run('COMMIT');
            res.json({ success: true, message: 'Statistics reset successfully' });
        }
    });
});

// ============================================
// STATIC PAGES
// ============================================

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/shop', (req, res) => res.sendFile(path.join(__dirname, 'public', 'shop.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/cart', (req, res) => res.sendFile(path.join(__dirname, 'public', 'cart.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.get('/license', (req, res) => res.sendFile(path.join(__dirname, 'public', 'license.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));

// ============================================
// ПРЕВЬЮ БИТА (30 секунд, бесплатно)
// ============================================

app.get('/api/beats/:id/preview', (req, res) => {
    const beatId = parseInt(req.params.id);
    
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    db.get('SELECT audio_url FROM beats WHERE id = ?', [beatId], (err, beat) => {
        if (err || !beat) {
            return res.status(404).json({ error: 'Beat not found' });
        }
        
        // 🔥 ИЗМЕНИ ЭТУ СТРОКУ
        // Было: const audioPath = path.join(__dirname, 'public', beat.audio_url);
        // Стало:
        const audioPath = path.join(__dirname, beat.audio_url);
        
        if (!fs.existsSync(audioPath)) {
            return res.status(404).json({ error: 'Audio file not found' });
        }
        
        const stat = fs.statSync(audioPath);
        const fileSize = stat.size;
        const previewBytes = Math.min(fileSize, 1.5 * 1024 * 1024);
        
        console.log(`📊 Preview: total=${(fileSize / 1024 / 1024).toFixed(2)}MB, preview=${(previewBytes / 1024 / 1024).toFixed(2)}MB`);
        
        res.writeHead(200, {
            'Content-Type': 'audio/mpeg',
            'Content-Length': previewBytes,
            'Cache-Control': 'no-cache',
            'Accept-Ranges': 'bytes'
        });
        
        const stream = fs.createReadStream(audioPath, { end: previewBytes });
        stream.pipe(res);
        
        stream.on('error', (err) => {
            console.error('Preview stream error:', err);
            res.end();
        });
    });
});

// ============================================
// СКАЧИВАНИЕ БИТА (только после оплаты)
// ============================================

app.get('/api/beats/:id/download', checkAuth, (req, res) => {
    const beatId = parseInt(req.params.id);
    
    if (isNaN(beatId) || beatId <= 0) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    // Проверяем, купил ли пользователь этот бит
    db.get(
        'SELECT * FROM purchases WHERE user_id = ? AND beat_id = ?',
        [req.session.userId, beatId],
        (err, purchase) => {
            if (err) {
                console.error('Purchase check error:', err);
                return res.status(500).json({ error: 'Server error' });
            }
            
            if (!purchase) {
                return res.status(403).json({ error: 'You must purchase this beat to download it' });
            }
            
            // Получаем путь к файлу
            db.get('SELECT audio_url, title FROM beats WHERE id = ?', [beatId], (err, beat) => {
                if (err || !beat) {
                    return res.status(404).json({ error: 'Beat not found' });
                }
                
                const audioPath = path.join(__dirname, 'public', beat.audio_url);
                
                if (!fs.existsSync(audioPath)) {
                    return res.status(404).json({ error: 'Audio file not found' });
                }
                
                // Увеличиваем счётчик скачиваний
                db.run('UPDATE beats SET download_count = download_count + 1 WHERE id = ?', [beatId]);
                logActivity(req.session.userId, 'download', `Downloaded beat: ${beat.title}`, req);
                
                // Отправляем файл для скачивания
                const filename = `${beat.title.replace(/[^a-z0-9]/gi, '_')}.mp3`;
                res.download(audioPath, filename, (err) => {
                    if (err) {
                        console.error('Download error:', err);
                    } else {
                        console.log(`📥 User ${req.session.userId} downloaded: ${beat.title}`);
                    }
                });
            });
        }
    );
});

// ============================================
// ТЕСТОВАЯ ПОКУПКА (только для разработки)
// ============================================

app.post('/api/test-purchase/:beatId', checkAuth, (req, res) => {
    const beatId = parseInt(req.params.beatId);
    
    if (isNaN(beatId)) {
        return res.status(400).json({ error: 'Invalid beat ID' });
    }
    
    // Проверяем, не куплен ли уже
    db.get(
        'SELECT * FROM purchases WHERE user_id = ? AND beat_id = ?',
        [req.session.userId, beatId],
        (err, existing) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (existing) {
                return res.json({ success: true, message: 'Already purchased' });
            }
            
            // Добавляем тестовую покупку
            db.run(
                'INSERT INTO purchases (user_id, beat_id, price, payment_method) VALUES (?, ?, ?, ?)',
                [req.session.userId, beatId, 0, 'test'],
                function(err) {
                    if (err) {
                        console.error('Test purchase error:', err);
                        return res.status(500).json({ error: 'Purchase failed' });
                    }
                    
                    // Обновляем статус бита
                    db.run('UPDATE beats SET purchased = 1 WHERE id = ?', [beatId]);
                    
                    logActivity(req.session.userId, 'test_purchase', `Test purchased beat ${beatId}`, req);
                    res.json({ success: true, message: 'Test purchase successful! You can now download this beat.' });
                }
            );
        }
    );
});

// ============================================
// WEBSOCKET SETUP
// ============================================

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('🔌 New WebSocket connection');
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            if (message.type === 'message') {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify({ type: 'message', message: message.message, sender: message.sender || 'user', timestamp: new Date().toISOString() }));
                    }
                });
            } else if (message.type === 'typing') {
                wss.clients.forEach(client => {
                    if (client.readyState === WebSocket.OPEN && client !== ws) {
                        client.send(JSON.stringify({ type: 'typing', isTyping: message.isTyping }));
                    }
                });
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    });
    ws.on('close', () => console.log('🔌 WebSocket disconnected'));
});

// ============================================
// ERROR HANDLING
// ============================================

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

// ============================================
// START SERVER
// ============================================

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Запускаем сервер ТОЛЬКО после инициализации БД
initDatabase().then(() => {
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║   🎵 BEATS MARKET - MUSIC MARKETPLACE                    ║
║                                                          ║
║   Server: http://localhost:${PORT}                         ║
║   WebSocket: ws://localhost:${PORT}                       ║
║   Admin:  ${process.env.ADMIN_EMAIL || 'kohanovski80@gmail.com'}   ║
║   Password: ${process.env.ADMIN_PASSWORD || 'B34t$M4rk3t_Adm1n!2025'}             ║
║                                                          ║
║   ✅ Database initialized                                ║
║   ✅ Upload directories created                          ║
║   ✅ Security middleware enabled                         ║
║   ✅ File validation enabled                             ║
║   ✅ WebSocket server ready                              ║
║   ✅ Ready for connections                               ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
        `);
    });
}).catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
});