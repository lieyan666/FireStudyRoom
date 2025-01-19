const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');
const app = express();

// 使用配置文件
const config = require('./config/config');

// 中间件
app.use(bodyParser.json());
app.use(express.static('public'));

// 登录路由
app.post('/login', (req, res) => {
  const { secretKey } = req.body;
  
  // 记录登录尝试
  logger.info(`Login attempt from IP: ${req.ip}`);
  
  // 验证密钥
  if (secretKey === config.security.authKey) {
    // 生成token
    const token = jwt.sign(
      { authenticated: true },
      config.security.authKey,
      { expiresIn: config.security.tokenExpiration }
    );
    
    // 记录成功登录
    logger.info(`Successful login from IP: ${req.ip}`);
    res.json({ token });
  } else {
    // 记录失败登录
    logger.warn(`Failed login attempt from IP: ${req.ip}`);
    res.status(401).json({ error: 'Invalid secret key' });
  }
});

// 受保护的路由示例
app.get('/protected', (req, res) => {
  const token = req.headers['authorization'];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, config.security.authKey, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    res.json({ message: 'Access granted', userId: decoded.userId });
  });
});

// 启动服务器
const PORT = config.app.port || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.app.env}`);
});
