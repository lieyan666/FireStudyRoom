/*
 * @Author: Lieyan
 * @Date: 2025-01-19 19:07:22
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-19 20:19:54
 * @FilePath: /FireStudyRoom/app.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const logger = require('./utils/logger');
const cookieParser = require('cookie-parser');
const app = express();
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// 使用配置文件
const config = require('./config/config');

// 中间件
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static('public'));

// 登录路由
app.post('/login', (req, res) => {
  const { secretKey } = req.body;
  
  // 记录登录尝试
  logger.info(`Login attempt from IP: ${req.ip}`);
  
  // 验证密钥
  if (secretKey === config.security.authKey) {
    // 将token过期时间转换为秒
    const expiresIn = config.security.tokenExpiration;
    const expiresSeconds = {
      '12h': 12 * 60 * 60,
      '1d': 24 * 60 * 60,
      '7d': 7 * 24 * 60 * 60
    }[expiresIn] || 12 * 60 * 60; // 默认12小时

    const maxAge = expiresSeconds * 1000; // 转换为毫秒

    // 生成token
    const token = jwt.sign(
      { authenticated: true },
      config.security.authKey,
      { expiresIn: expiresSeconds }
    );
    
    // 记录成功登录
    logger.info(`Successful login from IP: ${req.ip}`);
    res.cookie('token', token, {
      httpOnly: true,
      secure: false, // 开发环境下强制关闭secure
      maxAge
    });
    res.json({ message: 'Login successful' });
  } else {
    // 记录失败登录
    logger.warn(`Failed login attempt from IP: ${req.ip}`);
    res.status(401).json({ error: 'Invalid secret key' });
  }
});

// 受保护的路由示例
app.get('/protected', (req, res) => {
  const token = req.cookies.token;
  
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

// 自习室
app.get('/studyroom', (req, res) => {
  const token = req.cookies.token;
  
  if (!token) {
    return res.redirect('/login.html');
  }

  jwt.verify(token, config.security.authKey, (err, decoded) => {
    if (err) {
      logger.warn(`Invalid token from IP: ${req.ip} - ${err.message}`);
      res.clearCookie('token');
      return res.redirect('/login.html');
    }
    
    if (!decoded || !decoded.authenticated) {
      logger.warn(`Invalid token payload from IP: ${req.ip}`);
      res.clearCookie('token');
      return res.redirect('/login.html');
    }
    
    logger.info(`Successful studyroom access from IP: ${req.ip}`);
    res.sendFile(path.join(__dirname, 'public/studyroom.html'));
  });
});

// 创建HTTP服务器
const PORT = config.app.port || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.app.env}`);
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ server });

// 确保数据目录存在
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// WebSocket连接处理
wss.on('connection', (ws, req) => {
  // 从cookie中获取token
  const cookies = req.headers.cookie;
  if (!cookies) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  const token = cookies.split('; ')
    .find(c => c.startsWith('token='))
    ?.split('=')[1];

  if (!token) {
    ws.close(1008, 'Unauthorized');
    return;
  }

  // 验证token
  jwt.verify(token, config.security.authKey, (err, decoded) => {
    if (err || !decoded?.authenticated) {
      ws.close(1008, 'Invalid token');
      return;
    }

    logger.info('New WebSocket connection from authenticated user');
    
    // 发送当前todolist数据
    const todoFilePath = path.join(dataDir, 'todolist.json');
    if (fs.existsSync(todoFilePath)) {
      const data = fs.readFileSync(todoFilePath, 'utf8');
      ws.send(JSON.stringify({
        type: 'INIT',
        data: JSON.parse(data)
      }));
    }
  });

  ws.on('message', (message) => {
    try {
      const { type, data } = JSON.parse(message);
      
      switch (type) {
        case 'ADD_TODO':
        case 'UPDATE_TODO':
        case 'DELETE_TODO':
          // 更新文件并广播给所有客户端
          fs.writeFileSync(todoFilePath, JSON.stringify(data, null, 2));
          broadcast({ type, data });
          break;
      }
    } catch (err) {
      logger.error('WebSocket message error:', err);
    }
  });
});

// 广播消息给所有客户端
function broadcast(message) {
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}
