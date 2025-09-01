const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 模拟数据存储
let users = [
  { id: 1, name: 'admin', password: 'admin123', is_admin: 1 },
  { id: 2, name: 'testuser', password: '123456', is_admin: 0 }
];

let tasks = [
  { id: 1, title: '晨跑训练', description: '5公里晨跑，记录配速和感受', task_date: '2025-09-01' },
  { id: 2, title: '力量训练', description: '核心力量训练30分钟', task_date: '2025-09-01' },
  { id: 3, title: '技术练习', description: '定向技术练习，找点训练', task_date: '2025-09-02' }
];

let checkins = [];

// API路由

// 用户登录
app.post('/login', (req, res) => {
  const { name, password } = req.body;
  const user = users.find(u => u.name === name && u.password === password);
  
  if (user) {
    res.json({ 
      success: true, 
      user: { id: user.id, name: user.name, isAdmin: user.is_admin === 1 } 
    });
  } else {
    res.json({ success: false, message: '用户名或密码错误' });
  }
});

// 获取所有普通用户
app.get('/users', (req, res) => {
  res.json(users.filter(u => u.is_admin === 0).map(u => ({ id: u.id, name: u.name })));
});

// 创建新用户
app.post('/users', (req, res) => {
  const { name, password } = req.body;
  
  if (users.find(u => u.name === name)) {
    res.json({ success: false, message: '用户名已存在' });
    return;
  }
  
  const newUser = {
    id: users.length + 1,
    name,
    password,
    is_admin: 0
  };
  
  users.push(newUser);
  res.json({ success: true, message: '用户创建成功', id: newUser.id });
});

// 获取所有任务
app.get('/tasks', (req, res) => {
  const date = req.query.date;
  let result = tasks;
  
  if (date) {
    result = tasks.filter(t => t.task_date === date);
  }
  
  res.json(result);
});

// 创建新任务
app.post('/tasks', (req, res) => {
  const { title, description, task_date } = req.body;
  
  const newTask = {
    id: tasks.length + 1,
    title,
    description: description || '',
    task_date
  };
  
  tasks.push(newTask);
  res.json({ success: true, message: '事项创建成功', id: newTask.id });
});

// 删除任务
app.delete('/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = tasks.findIndex(t => t.id === id);
  
  if (index !== -1) {
    tasks.splice(index, 1);
    // 同时删除相关打卡记录
    checkins = checkins.filter(c => c.task_id !== id);
    res.json({ success: true, message: '任务删除成功' });
  } else {
    res.json({ success: false, message: '任务不存在' });
  }
});

// 获取打卡记录
app.get('/checkins', (req, res) => {
  const userId = req.query.userId;
  let result = checkins;
  
  // 添加用户信息到打卡记录
  result = result.map(checkin => {
    const user = users.find(u => u.id === checkin.user_id);
    const task = tasks.find(t => t.id === checkin.task_id);
    return {
      ...checkin,
      user_name: user ? user.name : '未知用户',
      task_title: task ? task.title : '未知任务'
    };
  });
  
  if (userId) {
    result = result.filter(c => c.user_id === parseInt(userId));
  }
  
  res.json(result);
});

// 创建打卡记录
app.post('/checkins', (req, res) => {
  const { user_id, task_id, notes } = req.body;
  
  const newCheckin = {
    id: checkins.length + 1,
    user_id: parseInt(user_id),
    task_id: parseInt(task_id),
    checkin_date: new Date().toISOString().split('T')[0],
    checkin_time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
    location: '默认位置',
    notes: notes || ''
  };
  
  checkins.push(newCheckin);
  res.json({ success: true, message: '打卡成功' });
});

// 更新打卡记录
app.put('/checkins/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { checkin_date, checkin_time, location, notes } = req.body;
  
  const index = checkins.findIndex(c => c.id === id);
  if (index !== -1) {
    checkins[index] = {
      ...checkins[index],
      checkin_date,
      checkin_time,
      location: location || '默认位置',
      notes: notes || ''
    };
    res.json({ success: true, message: '更新成功' });
  } else {
    res.json({ success: false, message: '记录不存在' });
  }
});

// 删除打卡记录
app.delete('/checkins/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = checkins.findIndex(c => c.id === id);
  
  if (index !== -1) {
    checkins.splice(index, 1);
    res.json({ success: true, message: '删除成功' });
  } else {
    res.json({ success: false, message: '记录不存在' });
  }
});

// 删除用户
app.delete('/users/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = users.findIndex(u => u.id === id);
  
  if (index !== -1 && users[index].is_admin === 0) {
    users.splice(index, 1);
    // 同时删除该用户的打卡记录
    checkins = checkins.filter(c => c.user_id !== id);
    res.json({ success: true, message: '用户删除成功' });
  } else {
    res.json({ success: false, message: '用户不存在或无法删除管理员' });
  }
});

// 导出数据
app.get('/checkins/matrix', (req, res) => {
  const { startDate, endDate } = req.query;
  
  // 简单的矩阵数据导出
  const filteredCheckins = checkins.filter(c => {
    if (startDate && endDate) {
      return c.checkin_date >= startDate && c.checkin_date <= endDate;
    }
    return true;
  });
  
  const matrix = [
    ['用户', '日期', '时间', '任务', '训练心得']
  ];
  
  filteredCheckins.forEach(c => {
    const user = users.find(u => u.id === c.user_id);
    const task = tasks.find(t => t.id === c.task_id);
    matrix.push([
      user ? user.name : '未知',
      c.checkin_date,
      c.checkin_time,
      task ? task.title : '未知',
      c.notes
    ]);
  });
  
  res.json(matrix);
});

// 导出为Netlify函数
module.exports.handler = serverless(app);