const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const config = require('./env');
const axios = require('axios');
const tenpay = require('tenpay');

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

// 生成微信支付参数
app.post('/registration/pay', async (req, res) => {
  const { batchId, fee, openid } = req.body;
  
  // 验证必要参数
  if (!batchId || !fee || !openid) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  try {
    // 微信支付配置
    const wxpayConfig = {
      appid: wxConfig.appId,
      mchid: '1721148054',
      partnerKey: '7fG9jKp2QwE5zX8LbR3yV6nD1cH4sM0t', // 微信支付安全密钥
      // pfx: null, // 如需使用退款等接口，请设置证书路径
      notify_url: 'https://activityregistration.weimeigu.com.cn/api/payment/notify',
      // spbill_create_ip: '47.117.173.54'
    };
    
    // 创建微信支付实例
    const api = new tenpay(wxpayConfig);
    
    // 生成订单号
    const orderId = 'ORDER' + Date.now().toString() + Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    // 转换金额为分
    const totalFee = Math.floor(parseFloat(fee) * 100);
    
    // 直接调用getPayParams方法，自动完成下单并获取支付参数
    const payParams = await api.getPayParams({
      out_trade_no: orderId,
      body: '活动报名费用',
      total_fee: totalFee,
      openid: openid
    });
    
    console.log('生成的支付参数:', payParams);
    
    // 记录支付信息到数据库
    await pool.query(
      'INSERT INTO payment (order_id, batch_id, openid, fee, status, create_time) VALUES (?, ?, ?, ?, ?, NOW())',
      [orderId, batchId, openid, fee, 'pending']
    );
    
    // 返回小程序调用支付API需要的参数
    res.json({
      timeStamp: payParams.timeStamp,
      nonceStr: payParams.nonceStr,
      package: payParams.package,
      signType: payParams.signType,
      paySign: payParams.paySign,
      orderId
    });
  } catch (err) {
    console.error('生成支付参数失败:', err);
    res.status(500).json({ error: '服务器错误', message: err.message });
  }
});

// 获取报名列表
app.get('/registration/list', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM user WHERE role != ?', ['admin']);
    res.json(rows);
  } catch (err) {
    console.error('获取报名列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 微信支付结果通知回调
app.post('/api/payment/notify', express.raw({ type: 'text/xml' }), async (req, res) => {
  console.log('收到微信支付通知');
  
  try {
    // 微信支付配置
    const wxpayConfig = {
      appid: wxConfig.appId,
      mchid: '1721148054',
      partnerKey: '7fG9jKp2QwE5zX8LbR3yV6nD1cH4sM0t', // 微信支付安全密钥
    };
    
    // 创建微信支付实例
    const api = new tenpay(wxpayConfig);
    
    // 获取原始XML数据
    const xmlData = req.body.toString('utf8');
    console.log('收到的XML数据:', xmlData);
    
    // 使用xml2js解析XML数据
    const xml2js = require('xml2js');
    const parser = new xml2js.Parser({ explicitArray: false });
    const parsedXml = await parser.parseStringPromise(xmlData);
    const result = parsedXml.xml;
    
    console.log('支付结果通知:', result);
    
    // 验证支付结果
    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      // 获取订单号和支付金额
      const orderId = result.out_trade_no;
      const totalFee = result.total_fee;
      const transactionId = result.transaction_id;
      
      console.log(`支付成功: 订单号=${orderId}, 金额=${totalFee}分, 微信交易号=${transactionId}`);
      
      // 更新payment表中的支付状态
      await pool.query(
        'UPDATE payment SET status = ?, transaction_id = ?, pay_time = NOW() WHERE order_id = ?',
        ['paid', transactionId, orderId]
      );
      
      // 获取payment表中对应订单的openid
      const [paymentRows] = await pool.query(
        'SELECT openid FROM payment WHERE order_id = ?',
        [orderId]
      );
      
      if (paymentRows.length > 0) {
        const { openid } = paymentRows[0];
        
        // 更新user表中对应用户的支付状态
        await pool.query(
          'UPDATE user SET pay_status = ? WHERE openid = ?',
          ['paid', openid]
        );
        
        console.log(`已更新用户(openid=${openid})的支付状态为已支付`);
      }
      
      // 返回成功通知
      res.type('xml');
      res.send('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    } else {
      console.error('支付失败:', result.return_msg || result.err_code_des);
      res.type('xml');
      res.send('<xml><return_code><![CDATA[FAIL]]></return_code><return_msg><![CDATA[支付结果验证失败]]></return_msg></xml>');
    }
  } catch (err) {
    console.error('处理支付通知失败:', err);
    res.status(500).send('处理支付通知失败');
  }
});

// 启动服务器
app.listen(PORT, async () => {
  await testDbConnection();
  console.log(`服务器运行在 http://localhost:${PORT}`);
}); 