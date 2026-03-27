const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcryptjs');
const fs = require('fs');

const dbPath = path.join(__dirname, '../database/database.sqlite');
const db = new sqlite3.Database(dbPath);

// Создание папок для загрузок
const createUploadFolders = () => {
    const folders = [
        path.join(__dirname, '../public/uploads'),
        path.join(__dirname, '../public/uploads/beats'),
        path.join(__dirname, '../public/uploads/photos'),
        path.join(__dirname, '../public/uploads/images')
    ];
    folders.forEach(folder => {
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
    });
};

// Функция для добавления колонок если их нет
const addColumnIfNotExists = (table, column, type, callback) => {
    db.all(`PRAGMA table_info(${table})`, (err, columns) => {
        if (err) {
            if (callback) callback();
            return;
        }
        
        const columnExists = columns.some(col => col.name === column);
        if (!columnExists) {
            db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`, (err) => {
                if (err) {
                    console.error(`Error adding column ${column}:`, err.message);
                } else {
                    console.log(`✅ Added column ${column} to ${table}`);
                }
                if (callback) callback();
            });
        } else {
            if (callback) callback();
        }
    });
};

// Функция для создания администратора (вызывается после создания таблиц)
const createAdminUser = (callback) => {
    const adminEmail = process.env.ADMIN_EMAIL || 'kohanovski80@gmail.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Leprikon4ik';
    
    db.get('SELECT * FROM users WHERE email = ?', [adminEmail], async (err, user) => {
        if (err) {
            console.error('Error checking admin:', err.message);
            if (callback) callback();
            return;
        }
        
        if (!user) {
            const hashedPassword = await bcrypt.hash(adminPassword, 10);
            db.run(
                `INSERT INTO users (username, email, password, role, bio) 
                 VALUES (?, ?, ?, ?, ?)`,
                ['Admin', adminEmail, hashedPassword, 'creator', 'System Administrator'],
                function(err) {
                    if (err) console.error('Error creating admin:', err.message);
                    else console.log('✅ Admin user created successfully');
                    if (callback) callback();
                }
            );
        } else if (user.role !== 'creator') {
            db.run('UPDATE users SET role = ? WHERE email = ?', ['creator', adminEmail], (err) => {
                if (err) console.error('Error updating admin role:', err.message);
                else console.log('✅ Admin role updated to creator');
                if (callback) callback();
            });
        } else {
            console.log('✅ Admin user already exists');
            if (callback) callback();
        }
    });
};

// Инициализация базы данных - последовательное создание таблиц
const initDatabase = () => {
    createUploadFolders();
    
    // Создаём таблицы последовательно, дожидаясь каждой
    db.serialize(() => {
        // Таблица пользователей
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
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
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                console.log('✅ Users table ready');
                // Добавляем недостающие колонки
                addColumnIfNotExists('users', 'bio', 'TEXT DEFAULT ""');
                addColumnIfNotExists('users', 'location', 'TEXT DEFAULT ""');
                addColumnIfNotExists('users', 'website', 'TEXT DEFAULT ""');
                addColumnIfNotExists('users', 'last_login', 'DATETIME');
                addColumnIfNotExists('users', 'is_active', 'BOOLEAN DEFAULT 1');
            }
        });

        // Таблица битов
        db.run(`
            CREATE TABLE IF NOT EXISTS beats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                description TEXT DEFAULT '',
                price INTEGER NOT NULL,
                audio_url TEXT NOT NULL,
                cover_url TEXT DEFAULT '/uploads/images/default-cover.jpg',
                user_id INTEGER,
                purchased BOOLEAN DEFAULT 0,
                play_count INTEGER DEFAULT 0,
                download_count INTEGER DEFAULT 0,
                tags TEXT DEFAULT '',
                bpm INTEGER,
                key TEXT,
                duration INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating beats table:', err.message);
            } else {
                console.log('✅ Beats table ready');
                addColumnIfNotExists('beats', 'description', 'TEXT DEFAULT ""');
                addColumnIfNotExists('beats', 'cover_url', 'TEXT DEFAULT "/uploads/images/default-cover.jpg"');
                addColumnIfNotExists('beats', 'play_count', 'INTEGER DEFAULT 0');
                addColumnIfNotExists('beats', 'download_count', 'INTEGER DEFAULT 0');
                addColumnIfNotExists('beats', 'tags', 'TEXT DEFAULT ""');
                addColumnIfNotExists('beats', 'bpm', 'INTEGER');
                addColumnIfNotExists('beats', 'key', 'TEXT');
                addColumnIfNotExists('beats', 'duration', 'INTEGER');
            }
        });

        // Таблица покупок
        db.run(`
            CREATE TABLE IF NOT EXISTS purchases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                price INTEGER NOT NULL,
                payment_method TEXT DEFAULT 'card',
                transaction_id TEXT,
                status TEXT DEFAULT 'completed',
                purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating purchases table:', err.message);
            } else {
                console.log('✅ Purchases table ready');
                addColumnIfNotExists('purchases', 'payment_method', 'TEXT DEFAULT "card"');
                addColumnIfNotExists('purchases', 'transaction_id', 'TEXT');
                addColumnIfNotExists('purchases', 'status', 'TEXT DEFAULT "completed"');
            }
        });

        // Таблица корзины
        db.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id),
                UNIQUE(user_id, beat_id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating cart table:', err.message);
            } else {
                console.log('✅ Cart table ready');
            }
        });

        // Таблица избранного
        db.run(`
            CREATE TABLE IF NOT EXISTS favorites (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id),
                UNIQUE(user_id, beat_id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating favorites table:', err.message);
            } else {
                console.log('✅ Favorites table ready');
            }
        });

        // Таблица отзывов
        db.run(`
            CREATE TABLE IF NOT EXISTS reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                beat_id INTEGER NOT NULL,
                rating INTEGER DEFAULT 5,
                comment TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (beat_id) REFERENCES beats(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating reviews table:', err.message);
            } else {
                console.log('✅ Reviews table ready');
            }
        });

        // Таблица активности
        db.run(`
            CREATE TABLE IF NOT EXISTS activity_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                details TEXT,
                ip_address TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating activity_log table:', err.message);
            } else {
                console.log('✅ Activity log table ready');
            }
        });

        // После создания всех таблиц, создаём администратора
        // Используем setTimeout чтобы дать время на создание таблиц
        setTimeout(() => {
            createAdminUser(() => {
                console.log('✅ Database initialization complete');
            });
        }, 500);
    });
};

module.exports = { db, initDatabase };