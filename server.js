const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 用户登录
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
                user: {
                    id: row.id,
                    name: row.name,
                    isAdmin: row.is_admin === 1
                }
            });
        } else {
            res.json({ success: false, message: '用户名或密码错误' });
        }
    });
});

// 创建打卡事项
app.post('/api/tasks', (req, res) => {
    const { title, description, task_date } = req.body;
    const created_by = req.body.created_by || 1; // 默认管理员创建
    
    db.run("INSERT INTO tasks (title, description, task_date, created_by) VALUES (?, ?, ?, ?)",
        [title, description, task_date, created_by],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: '事项创建成功', id: this.lastID });
        }
    );
});

// 获取打卡事项
app.get('/api/tasks', (req, res) => {
    const { date } = req.query;
    
    let query = "SELECT * FROM tasks WHERE 1=1";
    let params = [];
    
    if (date) {
        query += " AND task_date = ?";
        params.push(date);
    }
    
    query += " ORDER BY task_date DESC, created_at DESC";
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 用户打卡
app.post('/api/checkin', (req, res) => {
    const { userId, taskId, notes } = req.body;
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    
    // 检查是否已对该事项打卡
    db.get("SELECT * FROM checkins WHERE user_id = ? AND task_id = ?", [userId, taskId], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        if (row) {
            res.json({ success: false, message: '您已完成该事项的打卡' });
            return;
        }
        
        db.run("INSERT INTO checkins (user_id, task_id, checkin_date, checkin_time, notes) VALUES (?, ?, ?, ?, ?)",
            [userId, taskId, today, now, notes || ''],
            function(err) {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json({ success: true, message: '打卡成功' });
            }
        );
    });
});

// 获取打卡数据
app.get('/api/checkins', (req, res) => {
    const { startDate, endDate, userId } = req.query;
    
    let query = `
        SELECT c.*, u.name as user_name, t.title as task_title, t.task_date
        FROM checkins c 
        JOIN users u ON c.user_id = u.id 
        JOIN tasks t ON c.task_id = t.id
        WHERE 1=1
    `;
    let params = [];
    
    if (startDate) {
        query += " AND c.checkin_date >= ?";
        params.push(startDate);
    }
    
    if (endDate) {
        query += " AND c.checkin_date <= ?";
        params.push(endDate);
    }
    
    if (userId) {
        query += " AND c.user_id = ?";
        params.push(userId);
    }
    
    query += " ORDER BY c.checkin_date DESC, c.checkin_time DESC";
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 获取表格格式的打卡数据（用于导出）
app.get('/api/checkins/matrix', (req, res) => {
    const { startDate, endDate } = req.query;
    
    let dateFilter = '';
    let params = [];
    
    if (startDate && endDate) {
        dateFilter = 'WHERE t.task_date BETWEEN ? AND ?';
        params = [startDate, endDate];
    }
    
    const query = `
        SELECT 
            u.name as user_name,
            t.title as task_title,
            t.task_date,
            CASE WHEN c.id IS NOT NULL THEN '✓' ELSE '' END as status,
            c.checkin_time,
            c.notes
        FROM users u
        CROSS JOIN tasks t
        LEFT JOIN checkins c ON u.id = c.user_id AND t.id = c.task_id
        ${dateFilter}
        AND u.is_admin = 0
        ORDER BY u.name, t.task_date
    `;
    
    db.all(query, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 转换为矩阵格式
        const users = [...new Set(rows.map(r => r.user_name))];
        const tasks = [...new Set(rows.map(r => `${r.task_title} (${r.task_date})`))];
        
        const matrix = [];
        
        // 创建表头
        const header = ['用户姓名', ...tasks];
        matrix.push(header);
        
        // 创建数据行
        users.forEach(user => {
            const row = [user];
            tasks.forEach(task => {
                const taskInfo = task.match(/^(.*?) \((\d{4}-\d{2}-\d{2})\)$/);
                if (taskInfo) {
                    const taskTitle = taskInfo[1];
                    const taskDate = taskInfo[2];
                    const record = rows.find(r => 
                        r.user_name === user && 
                        r.task_title === taskTitle && 
                        r.task_date === taskDate
                    );
                    row.push(record && record.status === '✓' ? '✓' : '');
                } else {
                    row.push('');
                }
            });
            matrix.push(row);
        });
        
        res.json(matrix);
    });
});

// 获取所有用户
app.get('/api/users', (req, res) => {
    db.all("SELECT id, name FROM users WHERE is_admin = 0 ORDER BY name", (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// 更新打卡记录
app.put('/api/checkins/:id', (req, res) => {
    const { id } = req.params;
    const { checkin_date, checkin_time, location, notes } = req.body;
    
    db.run("UPDATE checkins SET checkin_date = ?, checkin_time = ?, location = ?, notes = ? WHERE id = ?",
        [checkin_date, checkin_time, location, notes, id],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: '更新成功' });
        }
    );
});

// 删除打卡记录
app.delete('/api/checkins/:id', (req, res) => {
    const { id } = req.params;
    
    db.run("DELETE FROM checkins WHERE id = ?", id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, message: '删除成功' });
    });
});

// 删除打卡事项（同时删除相关的打卡记录）
app.delete('/api/tasks/:id', (req, res) => {
    const { id } = req.params;
    
    // 先删除相关的打卡记录
    db.run("DELETE FROM checkins WHERE task_id = ?", id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 再删除任务
        db.run("DELETE FROM tasks WHERE id = ?", id, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ success: true, message: '事项删除成功' });
        });
    });
});

// 删除用户（同时删除用户的打卡记录）
app.delete('/api/users/:id', (req, res) => {
    const { id } = req.params;
    
    // 先删除用户的打卡记录
    db.run("DELETE FROM checkins WHERE user_id = ?", id, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // 再删除用户
        db.run("DELETE FROM users WHERE id = ? AND is_admin = 0", id, function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            
            if (this.changes === 0) {
                res.json({ success: false, message: '无法删除管理员用户或用户不存在' });
                return;
            }
            
            res.json({ success: true, message: '用户删除成功' });
        });
    });
});

// 添加新用户
app.post('/api/users', (req, res) => {
    const { name, password } = req.body;
    
    db.run("INSERT INTO users (name, password, is_admin) VALUES (?, ?, 0)", [name, password], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                res.json({ success: false, message: '用户名已存在' });
            } else {
                res.status(500).json({ error: err.message });
            }
            return;
        }
        res.json({ success: true, message: '用户添加成功' });
    });
});

app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
});