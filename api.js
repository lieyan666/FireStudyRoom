/*
 * @Author: Lieyan
 * @Date: 2025-01-19 20:47:40
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 02:14:16
 * @FilePath: /FireStudyRoom/api.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const express = require('express');
const logger = require('./utils/logger');
const config = require('./config/config');
const { getVersionInfo } = require('./utils/version');

const apiRouter = express.Router();

// 登录尝试记录
const loginAttempts = new Map();
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5分钟

// 验证中间件
const requireAuth = (req, res, next) => {
  if (!req.signedCookies.authenticated) {
    logger.warn(`Unauthorized access attempt to ${req.path} from IP: ${req.ip}`);
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
};

// Rate limiting中间件
const rateLimiter = (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const attempt = loginAttempts.get(ip);

  if (attempt) {
    if (attempt.count >= MAX_ATTEMPTS && now - attempt.firstAttempt < LOCKOUT_DURATION) {
      const remainingTime = Math.ceil((attempt.firstAttempt + LOCKOUT_DURATION - now) / 1000);
      logger.warn(`Rate limited login attempt from IP: ${ip}`);
      return res.status(429).json({
        error: 'Too many login attempts',
        remainingTime
      });
    }

    if (now - attempt.firstAttempt >= LOCKOUT_DURATION) {
      loginAttempts.delete(ip);
    }
  }

  next();
};

// 清理过期的登录尝试记录
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempt] of loginAttempts.entries()) {
    if (now - attempt.firstAttempt >= LOCKOUT_DURATION) {
      loginAttempts.delete(ip);
    }
  }
}, 60000); // 每分钟清理一次

// 登录路由
apiRouter.post('/login', rateLimiter, (req, res) => {
  const { secretKey } = req.body;
  const ip = req.ip;

  // 记录登录尝试
  logger.info(`Login attempt from IP: ${ip}`);

  // 验证密钥格式
  if (!secretKey || typeof secretKey !== 'string' || secretKey.length < 4) {
    logger.warn(`Invalid secret key format from IP: ${ip}`);
    return res.status(400).json({ error: 'Invalid secret key format' });
  }

  // 更新登录尝试记录
  const attempt = loginAttempts.get(ip) || { count: 0, firstAttempt: Date.now() };
  attempt.count++;
  loginAttempts.set(ip, attempt);

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

    // 清除该IP的登录尝试记录
    loginAttempts.delete(ip);

    // 记录成功登录
    logger.info(`Successful login from IP: ${ip}`);

// 获取版本信息路由
apiRouter.get('/version', async (req, res) => {
  try {
    const versionInfo = await getVersionInfo();
    res.json(versionInfo);
    logger.info('Version info requested');
  } catch (error) {
    logger.error('Error getting version info:', error);
    res.status(500).json({
      error: '获取版本信息失败',
      message: error.message
    });
  }
});

    // 设置cookie
    res.cookie('authenticated', 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge,
      signed: true
    });

    // 从配置中获取用户列表
    const users = config.users || [];
    res.json({ 
      message: 'Login successful',
      users: users
    });
  } else {
    // 记录失败登录
    logger.warn(`Failed login attempt from IP: ${ip}`);

    const remainingAttempts = MAX_ATTEMPTS - attempt.count;
    const message = remainingAttempts > 0
      ? `Invalid secret key. ${remainingAttempts} attempts remaining`
      : 'Account locked. Please try again later';

    res.status(401).json({ error: message });
  }
});

// 登出路由
apiRouter.post('/logout', (req, res) => {
  res.clearCookie('authenticated');
  logger.info(`User logged out from IP: ${req.ip}`);
  res.json({ message: 'Logged out successfully' });
});

// 检查认证状态
apiRouter.get('/auth-status', (req, res) => {
  res.json({
    authenticated: !!req.signedCookies.authenticated
  });
});

// 获取WebSocket服务器列表
apiRouter.get('/ws-servers', requireAuth, (req, res) => {
  const servers = config.wsServers || [];
  res.json({ servers });
});

// 获取用户列表
apiRouter.get('/users', requireAuth, (req, res) => {
  const users = config.users || [];
  res.json({ users });
});

// 获取服务器信息
apiRouter.get('/server-info', (req, res) => {
  const { getSystemInfo } = require('./utils/systemInfo');
  const serverInfo = getSystemInfo();
  res.json({
    type: 'API_SERVER',
    ...serverInfo
  });
});

// 受保护的路由示例
apiRouter.get('/protected', requireAuth, (req, res) => {
  res.json({ message: 'Access granted' });
});

// 错误处理中间件
apiRouter.use((err, req, res, next) => {
  logger.error(`API Error: ${err.stack}`);
  res.status(500).json({
    error: process.env.NODE_ENV === 'development'
      ? err.message
      : 'Internal server error'
  });
});

module.exports = apiRouter;
