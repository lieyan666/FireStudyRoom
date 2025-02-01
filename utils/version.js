/*
 * @Author: Lieyan
 * @Date: 2025-01-22 23:10:05
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 00:02:20
 * @FilePath: /FireStudyRoom/utils/version.js
 * @Description: 版本信息工具函数
 */
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');

/**
 * 获取项目版本信息
 * @returns {Promise<Object>} 版本信息对象
 */
async function getVersionInfo() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageInfo = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const git = simpleGit();

    let gitInfo = {};
    try {
      // 使用 simple-git 获取所有 git 信息
      const [
        branch,
        hash,
        status,
        log
      ] = await Promise.all([
        git.revparse(['--abbrev-ref', 'HEAD']),
        git.revparse(['HEAD']),
        git.status(),
        git.log(['-1', '--pretty=format:%B%n%an%n%ad', '--date=iso'])
      ]);

      gitInfo = {
        branch: branch.trim(),
        commit: {
          hash: hash.trim(),
          shortHash: hash.trim().substring(0, 7),
          message: log.latest.message,
          author: log.latest.author_name,
          date: log.latest.date
        },
        isDirty: status.modified.length > 0 || status.not_added.length > 0
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