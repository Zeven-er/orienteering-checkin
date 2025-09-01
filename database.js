const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'orienteering.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    // 创建用户表
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        is_admin BOOLEAN DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // 创建打卡事项表
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        task_date DATE NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users (id)
    )`);

    // 创建打卡记录表
    db.run(`CREATE TABLE IF NOT EXISTS checkins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        task_id INTEGER NOT NULL,
        checkin_date DATE NOT NULL,
        checkin_time TIME NOT NULL,
        status TEXT DEFAULT '已完成',
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id),
        FOREIGN KEY (task_id) REFERENCES tasks (id)
    )`);

    // 插入默认管理员用户
    const adminPassword = 'admin123'; // 默认管理员密码
    
    // 检查是否已存在管理员
    db.get("SELECT * FROM users WHERE is_admin = 1", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (name, password, is_admin) VALUES (?, ?, ?)", 
                ['管理员', adminPassword, 1], 
                (err) => {
                    if (err) {
                        console.log('管理员已存在或创建失败:', err.message);
                    } else {
                        console.log('默认管理员用户创建成功');
                    }
                }
            );
        }
    });

    // 插入测试用户
    db.get("SELECT * FROM users WHERE name = '测试用户'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO users (name, password, is_admin) VALUES (?, ?, ?)", 
                ['测试用户', '123456', 0]);
        }
    });
});

module.exports = db;