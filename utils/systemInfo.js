/*
 * @Author: Lieyan
 * @Date: 2025-01-22 22:43:32
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-23 00:30:55
 * @FilePath: /FireStudyRoom/utils/systemInfo.js
 * @Description: 系统信息工具函数
 */
const os = require('os');

/**
 * 获取系统信息
 * @returns {Object} 系统信息对象
 */
function getSystemInfo() {
  try {
    // 计算系统运行时间
    const uptimeTotal = os.uptime();
    const days = Math.floor(uptimeTotal / (24 * 3600));
    const hours = Math.floor((uptimeTotal % (24 * 3600)) / 3600);
    const minutes = Math.floor((uptimeTotal % 3600) / 60);
    const uptime = `${days}天${hours}小时${minutes}分钟`;

    // 格式化内存大小，保留2位小数
    const formatMemory = (bytes) => {
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + 'GB';
    };

    return {
      // 基本系统信息
      hostname: os.hostname(),
      platform: os.platform(),
      arch: os.arch(),
      type: os.type(),
      release: os.release(),
      
      // CPU信息
      cpus: {
        count: os.cpus().length,
        model: os.cpus()[0].model,
        speed: `${os.cpus()[0].speed}MHz`
      },
      
      // 内存信息
      memory: {
        total: formatMemory(os.totalmem()),
        free: formatMemory(os.freemem()),
        used: formatMemory(os.totalmem() - os.freemem())
      },
      
      // 系统运行信息
      uptime: uptime,
      loadavg: os.loadavg().map(load => load.toFixed(2)),
      
      // 环境信息
      userInfo: {
        username: os.userInfo().username,
        homedir: os.homedir(),
        shell: os.userInfo().shell
      },
      
      // 运行环境
      nodeVersion: process.version,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      locale: process.env.LANG || 'unknown',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('获取系统信息失败:', error);
    return {
      error: '获取系统信息失败',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getSystemInfo
};