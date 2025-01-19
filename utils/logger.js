/*
 * @Author: Lieyan
 * @Date: 2025-01-19 19:37:45
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-19 19:37:52
 * @FilePath: /FireStudyRoom/utils/logger.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const winston = require('winston');
const config = require('../config/config');

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.printf(info => {
    return `${info.timestamp} [${info.level.toUpperCase()}] ${info.message}`;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: config.app.env === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ 
      filename: 'logs/app.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    })
  ]
});

module.exports = logger;
