const express = require('express');
const serverless = require('serverless-http');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// 配置中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 数据库配置（使用内存数据库，生产环境建议用外部数据库）
let db;

// 初始化数据库
function initDatabase() {
  return new Promise((resolve, reject) => {
    // 使用内存数据库，每次重启数据会丢失
    db = new sqlite3.Database(':memory:', (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      
      // 创建表
      const createTables = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE,
          password TEXT NOT NULL,
          is_admin INTEGER DEFAULT 0
        );
        
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          description TEXT,
          task_date DATE NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS checkins (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER,
          task_id INTEGER,
          checkin_date DATE,
          checkin_time TIME,
          location TEXT,
          notes TEXT,
          FOREIGN KEY(user_id) REFERENCES users(id),
          FOREIGN KEY(task_id) REFERENCES tasks(id)
        );
      `;
      
      db.exec(createTables, (err) => {
        if (err) {
          console.error('Error creating tables:', err);
          reject(err);
          return;
        }
        
        // 插入初始数据
        const initData = `
          INSERT INTO users (name, password, is_admin) VALUES 
          ('admin', 'admin123', 1),
          ('testuser', '123456', 0);
          
          INSERT INTO tasks (title, description, task_date) VALUES 
          ('晨跑训练', '5公里晨跑，记录配速和感受', '2025-09-01'),
          ('力量训练', '核心力量训练30分钟', '2025-09-01'),
          ('技术练习', '定向技术练习，找点训练', '2025-09-02');
        `;
        
        db.exec(initData, (err) => {
          if (err) {
            console.error('Error inserting initial data:', err);
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  });
}

// API路由
app.get('/api/users', (req, res) => {
  db.all("SELECT id, name FROM users WHERE is_admin = 0 ORDER BY name", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  
  db.get("SELECT * FROM users WHERE name = ? AND password = ?", [name, password], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (row) {
      res.json({ 
        success: true, 
        user: { id: row.id, name: row.name, isAdmin: row.is_admin === 1 } 
      });
    } else {
      res.json({ success: false, message: '用户名或密码错误' });
    }
  });
});

// 其他API路由...（简化版本）
app.get('/api/tasks', (req, res) => {
  db.all("SELECT * FROM tasks ORDER BY task_date DESC", (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/tasks', (req, res) => {
  const { title, description, task_date } = req.body;
  
  db.run("INSERT INTO tasks (title, description, task_date) VALUES (?, ?, ?)", 
    [title, description, task_date], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ success: true, message: '事项创建成功', id: this.lastID });
  });
});

// 初始化数据库并开始监听
initDatabase().then(() => {
  console.log('Database initialized');
}).catch(err => {
  console.error('Failed to initialize database:', err);
});

// 导出为Netlify函数
module.exports.handler = serverless(app);