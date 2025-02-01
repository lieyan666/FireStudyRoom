/*
 * @Author: Lieyan
 * @Date: 2025-01-19 19:07:22
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 01:04:15
 * @FilePath: /FireStudyRoom/app.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const express = require('express');
const bodyParser = require('body-parser');
const logger = require('./utils/logger');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const app = express();
const fs = require('fs');
const path = require('path');
const setupWebSocket = require('./ws');
const { performAutoUpdate } = require('./utils/autoUpdate');

// 使用配置文件
const config = require('./config/config');

// 在生产环境下执行自动更新
async function initializeServer() {
  if (process.env.NODE_ENV === 'production' && config.app.autoUpdate) {
    logger.info('正在执行自动更新检查...');
    await performAutoUpdate();
  }
}
const apiRouter = require('./api');
const avatarRouter = require('./routes/avatar');
const crypto = require('crypto');
const compressionMiddleware = require('./utils/compression');

// 生成随机cookie secret
const cookieSecret = crypto.randomBytes(32).toString('hex');

// 生产环境配置
const isProd = process.env.NODE_ENV === 'production';

// 中间件
app.use(compression()); // 启用 GZIP 压缩
app.use(bodyParser.json());
app.use(cookieParser(cookieSecret));

// 在生产环境中使用资源压缩中间件
app.use(compressionMiddleware(__dirname));

// 静态文件路由
app.use('/web/public', express.static('public', {
    maxAge: isProd ? '1h' : 0,
    etag: true,
    lastModified: true
}));

// 头像上传路由
app.use('/api/avatar', avatarRouter);

// 默认路由重定向
app.get('/', (req, res) => {
  res.redirect('/web/login');
});

// HTML页面发送函数
async function sendHtmlFile(res, filepath, statusCode = 200) {
  try {
    const fullPath = path.join(__dirname, filepath);
    if (process.env.NODE_ENV === 'production') {
      const content = await fs.promises.readFile(fullPath, 'utf8');
      const { minify } = require('html-minifier-terser');
      const minified = await minify(content, {
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true
      });
      res.status(statusCode).type('html').send(minified);
    } else {
      res.status(statusCode).sendFile(fullPath);
    }
  } catch (err) {
    logger.error(`Error sending HTML file: ${err.message}`);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}

// 自习室页面路由
app.get('/web/studyroom', (req, res) => {
  if (!req.signedCookies.authenticated) {
    logger.warn(`Unauthenticated access attempt from IP: ${req.ip}`);
    res.clearCookie('authenticated');
    return res.redirect('/web/login');
  }
  logger.info(`Successful studyroom access from IP: ${req.ip}`);
  sendHtmlFile(res, 'public/studyroom.html');
});

app.get('/web/login', (req, res) => {
  if (req.signedCookies.authenticated) {
    logger.info(`Authenticated user redirected from login to studyroom: ${req.ip}`);
    return res.redirect('/web/studyroom');
  }
  sendHtmlFile(res, 'public/login.html');
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

// 创建并启动HTTP服务器
const PORT = config.app.port || 3000;

// 异步启动服务器
async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production' && config.app.autoUpdate) {
      await initializeServer();
      
      // 在生产环境下，如果 package.json 被更新，提示用户需要重新启动
      const git = require('simple-git')();
      const status = await git.status();
      if (status.modified.includes('package-lock.json')) {
        logger.warn('检测到依赖变更，请执行以下步骤：');
        logger.warn('1. 停止服务器');
        logger.warn('2. 执行 npm install');
        logger.warn('3. 重新启动服务器');
        process.exit(0);
      }
    }
    
    const server = app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${config.app.env}`);
    });

    // 初始化WebSocket
    setupWebSocket(server);
  } catch (error) {
    logger.error('服务器启动失败:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
