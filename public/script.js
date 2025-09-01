// 全局变量
let currentUser = null;
let currentUserData = null;

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // 绑定事件监听器
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('taskForm').addEventListener('submit', handleCreateTask);
    document.getElementById('addUserForm').addEventListener('submit', handleAddUser);
    document.getElementById('editForm').addEventListener('submit', handleEditSubmit);
    
    // 设置默认日期
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('startDate').value = today;
    document.getElementById('endDate').value = today;
    document.getElementById('editDate').value = today;
});

// 更新日期时间显示
function updateDateTime() {
    const now = new Date();
    document.getElementById('currentDate').textContent = now.toLocaleDateString('zh-CN');
    document.getElementById('currentTime').textContent = now.toLocaleTimeString('zh-CN');
}

// 检查认证状态
function checkAuth() {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        showPage(currentUser.isAdmin ? 'adminPage' : 'userPage');
    } else {
        showPage('loginPage');
    }
}

// 显示指定页面
function showPage(pageId) {
    const pages = ['loginPage', 'userPage', 'adminPage'];
    pages.forEach(page => {
        document.getElementById(page).style.display = page === pageId ? 'block' : 'none';
    });
    
    if (pageId === 'userPage') {
        loadTodayTasks();
        loadUserCheckins();
    } else if (pageId === 'adminPage') {
        loadUsers();
        loadCheckins();
        loadTasks();
    }
}

// 处理登录
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
        // 更新API基础URL
        const API_BASE_URL = '/api';
        
        // 修改所有fetch调用，使用正确的路径
        // 在handleLogin函数中：
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: username, password: password })
        });
        
        // 在handleCreateTask函数中：
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title: title,
                description: description,
                task_date: taskDate
            })
        });
        
        // 在loadTasks函数中：
        const response = await fetch(`${API_BASE_URL}/tasks`);
        
        // 在loadTodayTasks函数中：
        const [tasksResponse, checkinsResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/tasks?date=${today}`),
            fetch(`${API_BASE_URL}/checkins?userId=${currentUser.id}`)
        ]);
        
        // 在handleCheckin函数中：
        const response = await fetch(`${API_BASE_URL}/checkins`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUser.id,
                task_id: taskId,
                checkin_date: new Date().toISOString().split('T')[0],
                checkin_time: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
                location: '默认位置',
                notes: notes || ''
            })
        });
        
        // 在loadUsers函数中：
        const response = await fetch(`${API_BASE_URL}/users`);
        
        // 在loadCheckins函数中：
        const response = await fetch(`${API_BASE_URL}/checkins`);
        const data = await response.json();
        
        const tbody = document.getElementById('checkinsTableBody');
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">暂无数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.user_name}</td>
                <td>${item.checkin_date}</td>
                <td>${item.checkin_time}</td>
                <td>${item.task_title || '-'}</td>
                <td>${item.notes || '-'}</td>
                <td>
                    <button class="btn-primary" onclick="editCheckin(${item.id})" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn-danger" onclick="deleteCheckin(${item.id})">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载打卡数据失败:', error);
    }
}

// 处理打卡
async function handleCheckin(taskId) {
    const notes = prompt('请输入备注信息（可选）：');
    
    try {
        const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                taskId: taskId,
                notes: notes || ''
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            loadTodayTasks();
            loadUserCheckins();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('打卡失败，请稍后重试', 'error');
    }
}

// 加载管理员发布的任务
async function loadTasks() {
    try {
        const response = await fetch('/api/tasks');
        const data = await response.json();
        
        const container = document.getElementById('tasksList');
        if (data.length === 0) {
            container.innerHTML = '<p class="no-data">暂无发布事项</p>';
            return;
        }
        
        container.innerHTML = data.map(task => `
            <div class="task-item">
                <h4>${task.title}</h4>
                <p><strong>日期：</strong>${task.task_date}</p>
                <p><strong>描述：</strong>${task.description || '无'}</p>
                <button class="btn-danger" onclick="deleteTask(${task.id})">
                    <i class="fas fa-trash"></i> 删除
                </button>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载任务失败:', error);
    }
}

// 加载今日任务
async function loadTodayTasks() {
    const today = new Date().toISOString().split('T')[0];
    
    try {
        const [tasksResponse, checkinsResponse] = await Promise.all([
            fetch(`/api/tasks?date=${today}`),
            fetch(`/api/checkins?userId=${currentUser.id}`)
        ]);
        
        const tasks = await tasksResponse.json();
        const checkins = await checkinsResponse.json();
        
        const container = document.getElementById('todayTasks');
        if (tasks.length === 0) {
            container.innerHTML = '<p class="no-data">今日暂无打卡事项</p>';
            return;
        }
        
        const completedTaskIds = checkins.map(c => c.task_id);
        
        container.innerHTML = tasks.map(task => `
            <div class="task-item ${completedTaskIds.includes(task.id) ? 'completed' : ''}">
                <h4>${task.title}</h4>
                <p><strong>描述：</strong>${task.description || '无'}</p>
                ${!completedTaskIds.includes(task.id) ? 
                    `<button class="btn-success" onclick="openCheckinModal(${task.id}, '${task.title}', '${task.description || ''}', '${task.task_date}')">
                        <i class="fas fa-edit"></i> 开始打卡
                    </button>` :
                    '<span class="completed-badge"><i class="fas fa-check-circle"></i> 已完成</span>'
                }
            </div>
        `).join('');
    } catch (error) {
        console.error('加载今日任务失败:', error);
    }
}

// 删除任务
async function deleteTask(taskId) {
    if (!confirm('确定要删除这个打卡事项吗？此操作将同时删除相关的打卡记录。')) return;
    
    try {
        const response = await fetch(`/api/tasks/${taskId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            loadTasks();
            loadTodayTasks();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('删除失败，请稍后重试', 'error');
    }
}

// 打开训练心得模态框
function openCheckinModal(taskId, title, description, date) {
    document.getElementById('checkinTaskId').value = taskId;
    document.getElementById('checkinTaskTitle').textContent = title;
    document.getElementById('checkinTaskDesc').textContent = description || '无';
    document.getElementById('checkinTaskDate').textContent = date;
    document.getElementById('trainingNotes').value = '';
    document.getElementById('checkinModal').style.display = 'block';
}

// 关闭训练心得模态框
function closeCheckinModal() {
    document.getElementById('checkinModal').style.display = 'none';
}

// 处理训练心得打卡提交
document.getElementById('checkinForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const taskId = document.getElementById('checkinTaskId').value;
    const notes = document.getElementById('trainingNotes').value;
    
    try {
        const response = await fetch('/api/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: currentUser.id,
                taskId: parseInt(taskId),
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage('打卡成功！', 'success');
            closeCheckinModal();
            loadTodayTasks();
            loadUserCheckins();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('打卡失败，请稍后重试', 'error');
    }
});

// 加载用户打卡记录
async function loadUserCheckins() {
    try {
        const response = await fetch(`/api/checkins?userId=${currentUser.id}`);
        const data = await response.json();
        
        const container = document.getElementById('userCheckins');
        if (data.length === 0) {
            container.innerHTML = '<p class="no-data">暂无打卡记录</p>';
            return;
        }
        
        container.innerHTML = data.slice(0, 10).map(item => `
            <div class="checkin-item">
                <p><strong>事项：</strong>${item.task_title}</p>
                <p><strong>日期：</strong>${item.checkin_date}</p>
                <p><strong>时间：</strong>${item.checkin_time}</p>
                <p><strong>训练心得：</strong>${item.notes || '无'}</p>
            </div>
        `).join('');
    } catch (error) {
        console.error('加载打卡记录失败:', error);
    }
}

// 加载所有用户
async function loadUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        
        // 填充用户选择下拉框
        const userSelect = document.getElementById('filterUser');
        userSelect.innerHTML = '<option value="">全部用户</option>';
        data.forEach(user => {
            userSelect.innerHTML += `<option value="${user.id}">${user.name}</option>`;
        });
        
        // 填充用户管理表格
        const tbody = document.getElementById('usersTableBody');
        tbody.innerHTML = data.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.name}</td>
                <td>
                    <button class="btn-danger" onclick="deleteUser(${user.id}, '${user.name}')">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载用户列表失败:', error);
    }
}

// 加载打卡数据
async function loadCheckins() {
    const userId = document.getElementById('filterUser').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    let url = '/api/checkins?';
    if (userId) url += `userId=${userId}&`;
    if (startDate) url += `startDate=${startDate}&`;
    if (endDate) url += `endDate=${endDate}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        const tbody = document.getElementById('checkinsTableBody');
        if (!Array.isArray(data) || data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">暂无数据</td></tr>';
            return;
        }
        
        tbody.innerHTML = data.map(item => `
            <tr>
                <td>${item.id}</td>
                <td>${item.user_name}</td>
                <td>${item.checkin_date}</td>
                <td>${item.checkin_time}</td>
                <td>${item.task_title || '-'}</td>
                <td>${item.notes || '-'}</td>
                <td>
                    <button class="btn-primary" onclick="editCheckin(${item.id})" style="margin-right: 5px;">
                        <i class="fas fa-edit"></i> 编辑
                    </button>
                    <button class="btn-danger" onclick="deleteCheckin(${item.id})">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('加载打卡数据失败:', error);
    }
}

// 处理添加用户
async function handleAddUser(e) {
    e.preventDefault();
    const username = document.getElementById('newUsername').value;
    const password = document.getElementById('newPassword').value;
    
    try {
        const response = await fetch('/api/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: username, password: password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            document.getElementById('addUserForm').reset();
            loadUsers();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('添加用户失败，请稍后重试', 'error');
    }
}

// 编辑打卡记录
function editCheckin(id) {
    fetch(`/api/checkins?startDate=2000-01-01`)
        .then(res => res.json())
        .then(data => {
            const record = data.find(item => item.id == id);
            if (record) {
                document.getElementById('editId').value = record.id;
                document.getElementById('editDate').value = record.checkin_date;
                document.getElementById('editTime').value = record.checkin_time;
                document.getElementById('editLocation').value = record.location || '';
                document.getElementById('editNotes').value = record.notes || '';
                document.getElementById('editModal').style.display = 'block';
            }
        });
}

// 处理编辑提交
async function handleEditSubmit(e) {
    e.preventDefault();
    const id = document.getElementById('editId').value;
    const date = document.getElementById('editDate').value;
    const time = document.getElementById('editTime').value;
    const location = document.getElementById('editLocation').value;
    const notes = document.getElementById('editNotes').value;
    
    try {
        const response = await fetch(`/api/checkins/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                checkin_date: date,
                checkin_time: time,
                location: location,
                notes: notes
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            closeEditModal();
            loadCheckins();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('更新失败，请稍后重试', 'error');
    }
}

// 删除打卡记录
async function deleteCheckin(id) {
    if (!confirm('确定要删除这条打卡记录吗？')) return;
    
    try {
        const response = await fetch(`/api/checkins/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            loadCheckins();
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('删除失败，请稍后重试', 'error');
    }
}

// 删除用户
async function deleteUser(id, name) {
    if (!confirm(`确定要删除用户 "${name}" 吗？此操作将同时删除该用户的所有打卡记录。`)) return;
    
    try {
        const response = await fetch(`/api/users/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showMessage(data.message, 'success');
            loadUsers();
            loadCheckins(); // 重新加载打卡数据以更新显示
        } else {
            showMessage(data.message, 'error');
        }
    } catch (error) {
        showMessage('删除失败，请稍后重试', 'error');
    }
}

// 显示/隐藏标签页
function showTab(tabId) {
    const tabs = ['tasksTab', 'dataTab', 'usersTab'];
    const buttons = document.querySelectorAll('.tab-btn');
    
    tabs.forEach(tab => {
        document.getElementById(tab).style.display = tab === tabId ? 'block' : 'none';
    });
    
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
}

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
}

// 导出数据
function exportData() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    if (!startDate || !endDate) {
        showMessage('请选择开始和结束日期', 'error');
        return;
    }
    
    fetch(`/api/checkins/matrix?startDate=${startDate}&endDate=${endDate}`)
        .then(res => res.json())
        .then(matrix => {
            if (matrix.length <= 1) {
                showMessage('暂无数据可导出', 'error');
                return;
            }
            
            const csvContent = "\uFEFF" + 
                matrix.map(row => 
                    row.map(cell => `"${cell}"`).join(',')
                ).join('\n');
            
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `打卡统计_${startDate}_to_${endDate}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showMessage('数据导出成功！', 'success');
        });
}

// 退出登录
function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showPage('loginPage');
}

// 显示消息提示
function showMessage(message, type) {
    const existing = document.querySelector('.message');
    if (existing) existing.remove();
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 3000);
}

// 点击模态框外部关闭
window.onclick = function(event) {
    const modal = document.getElementById('editModal');
    if (event.target === modal) {
        closeEditModal();
    }
}