/*
 * @Author: Lieyan
 * @Date: 2025-01-19 19:07:22
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-25 22:05:26
 * @FilePath: /FireStudyRoom/app.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const cookieParser = require('cookie-parser');
const app = express();
const fs = require('fs');
const path = require('path');
const setupWebSocket = require('./ws');

// 使用配置文件
const config = require('./config/config');
const apiRouter = require('./api');
const avatarRouter = require('./routes/avatar');
const crypto = require('crypto');

// 生成随机cookie secret
const cookieSecret = crypto.randomBytes(32).toString('hex');

// 中间件
app.use(bodyParser.json());
app.use(cookieParser(cookieSecret));

// 静态文件路由
app.use('/web/public', express.static('public'));

// 头像上传路由
app.use('/api/avatar', avatarRouter);

// 默认路由重定向
app.get('/', (req, res) => {
  res.redirect('/web/login');
});

// 自习室页面路由
app.get('/web/studyroom', (req, res) => {
  if (!req.signedCookies.authenticated) {
    logger.warn(`Unauthenticated access attempt from IP: ${req.ip}`);
    res.clearCookie('authenticated');
    return res.redirect('/web/login');
  }
  logger.info(`Successful studyroom access from IP: ${req.ip}`);
  res.sendFile(path.join(__dirname, 'public/studyroom.html'));
});

app.get('/web/login', (req, res) => {
  if (req.signedCookies.authenticated) {
    logger.info(`Authenticated user redirected from login to studyroom: ${req.ip}`);
    return res.redirect('/web/studyroom');
  }
  res.sendFile(path.join(__dirname, 'public/login.html'));
});

// 挂载API路由
app.use('/api', apiRouter);

// 请求日志中间件
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url} - IP: ${req.ip}`);
  next();
});

// 404处理
app.use((req, res, next) => {
  logger.warn(`404 Not Found - ${req.method} ${req.url} from IP: ${req.ip}`);
  res.status(404).json({ error: 'Not Found' });
});

// 全局错误处理
app.use((err, req, res, next) => {
  logger.error(`Error processing ${req.method} ${req.url}: ${err.stack}`);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal Server Error'
  });
});

// 创建HTTP服务器
const PORT = config.app.port || 3000;
const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.app.env}`);
});

// 初始化WebSocket
setupWebSocket(server);
