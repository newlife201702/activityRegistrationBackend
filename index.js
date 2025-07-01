const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const config = require('./env');

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

// 基础路由
app.get('/', (req, res) => {
  res.json({ message: '活动报名系统API服务运行中' });
});

// 启动服务器
app.listen(PORT, async () => {
  await testDbConnection();
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 