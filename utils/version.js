/*
 * @Author: Lieyan
 * @Date: 2025-01-22 23:10:05
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-22 23:10:05
 * @FilePath: /FireStudyRoom/utils/version.js
 * @Description: 版本信息工具函数
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

/**
 * 获取项目版本信息
 * @returns {Object} 版本信息对象
 */
function getVersionInfo() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

    let gitInfo = {};
    try {
      gitInfo = {
        branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
        commit: {
          hash: execSync('git rev-parse HEAD').toString().trim(),
          shortHash: execSync('git rev-parse --short HEAD').toString().trim(),
          message: execSync('git log -1 --pretty=%B').toString().trim(),
          author: execSync('git log -1 --pretty=%an').toString().trim(),
          date: execSync('git log -1 --pretty=%ad --date=iso').toString().trim()
        },
        isDirty: execSync('git status --porcelain').toString().length > 0
      };
    } catch (error) {
      gitInfo = {
        error: '无法获取Git信息',
        message: error.message
      };
    }

    return {
      name: packageInfo.name,
      version: packageInfo.version,
      description: packageInfo.description,
      author: packageInfo.author,
      license: packageInfo.license,
      git: gitInfo,
      buildTime: new Date().toISOString(),
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch
    };
  } catch (error) {
    console.error('获取版本信息失败:', error);
    return {
      error: '获取版本信息失败',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = {
  getVersionInfo
};