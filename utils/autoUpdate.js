/*
 * @Author: Lieyan
 * @Date: 2025-02-01 23:55:54
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-01 23:56:28
 * @FilePath: /FireStudyRoom/utils/autoUpdate.js
 * @Description: 自动更新工具函数
 */
const simpleGit = require('simple-git');
const logger = require('./logger');

/**
 * 执行自动更新
 * @returns {Promise<boolean>} 更新是否成功
 */
async function performAutoUpdate() {
  const git = simpleGit();
  
  try {
    // 检查是否有未提交的更改
    const status = await git.status();
    if (status.modified.length > 0 || status.not_added.length > 0) {
      logger.warn('检测到未提交的更改，跳过自动更新');
      return false;
    }

    // 获取当前分支
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    logger.info(`当前分支: ${branch}`);

    // 拉取最新代码
    logger.info('正在拉取最新代码...');
    const pullResult = await git.pull('origin', branch);
    
    if (pullResult.summary.changes === 0) {
      logger.info('已是最新版本，无需更新');
      return true;
    }

    logger.info(`更新成功，共更新 ${pullResult.summary.changes} 个文件`);
    return true;
  } catch (error) {
    logger.error('自动更新失败:', error.message);
    return false;
  }
}

module.exports = {
  performAutoUpdate
};