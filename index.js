const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const config = require('./env');
const axios = require('axios');

// 创建Express应用
const app = express();
const PORT = config.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据库连接池
const pool = mysql.createPool({
  host: config.DB_HOST || 'localhost',
  user: config.DB_USER || 'root',
  password: config.DB_PASSWORD || '',
  database: config.DB_NAME || 'activity_registration',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// 测试数据库连接
async function testDbConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('数据库连接成功');
    connection.release();
  } catch (err) {
    console.error('数据库连接失败:', err);
    process.exit(1);
  }
}

// 微信配置
const wxConfig = {
  appId: 'wxc3a0ba6d05fa17c0',
  appSecret: '62dd1f85508830b5f496671e0976912f'
};

// 基础路由
app.get('/', (req, res) => {
  res.json({ message: '活动报名系统API服务运行中' });
});

// 获取 openid
app.post('/getOpenid', async (req, res) => {
  const { code } = req.body;
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${wxConfig.appId}&secret=${wxConfig.appSecret}&js_code=${code}&grant_type=authorization_code`;

  try {
    const response = await axios.get(url);
    console.log('getOpenid_response.data', response.data);
    const { openid, session_key } = response.data;
    res.json({ openid, session_key });
  } catch (err) {
    res.status(500).json({ error: '获取 openid 失败' });
  }
});

// 获取用户信息
app.get('/getUserInfo', async (req, res) => {
  const { openid } = req.query;
  
  if (!openid) {
    return res.status(400).json({ error: '缺少openid参数' });
  }

  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE openid = ?', [openid]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到该用户' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取所有批次信息
app.get('/batches', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM batch');
    res.json(rows);
  } catch (err) {
    console.error('获取批次信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 获取特定批次信息
app.get('/batch/:batchId', async (req, res) => {
  const { batchId } = req.params;
  
  try {
    const [rows] = await pool.query('SELECT * FROM batch WHERE id = ?', [batchId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ error: '未找到该批次' });
    }
    
    res.json(rows[0]);
  } catch (err) {
    console.error('获取批次信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 提交报名信息
app.post('/registration/submit', async (req, res) => {
  const { 
    batchId, 
    name, 
    gender, 
    contact, 
    idNumber, 
    helper, 
    selectedDates, 
    fee,
    openid 
  } = req.body;
  
  // 验证必要参数
  if (!batchId || !name || !gender || !contact || !idNumber || !helper || !selectedDates || !fee || !openid) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    // 插入数据到user表
    const [result] = await pool.query(
      'INSERT INTO user (batch_id, name, gender, contact, id_card_number, copy_helper, participation_date, registration_fee, openid, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [batchId, name, gender, contact, idNumber, helper, selectedDates, fee, openid, 'user']
    );
    
    res.status(201).json({ 
      success: true, 
      message: '报名成功', 
      userId: result.insertId 
    });
  } catch (err) {
    console.error('报名提交失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 启动服务器
app.listen(PORT, async () => {
  await testDbConnection();
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 