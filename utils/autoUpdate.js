/*
 * @Author: Lieyan
 * @Date: 2025-02-01 23:55:54
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 00:40:31
 * @FilePath: /FireStudyRoom/utils/autoUpdate.js
 * @Description: 自动更新工具函数
 */
const simpleGit = require('simple-git');
const logger = require('./logger');
const fs = require('fs').promises;
const path = require('path');

/**
 * 执行自动更新
 * @returns {Promise<boolean>} 更新是否成功
 */
async function performAutoUpdate() {
  const git = simpleGit();
  
  try {
    // 检查是否有未提交的更改（忽略 package-lock.json）
    const status = await git.status();
    const hasOtherChanges = status.modified
      .concat(status.not_added)
      .filter(file => file !== 'package-lock.json')
      .length > 0;

    if (hasOtherChanges) {
      logger.warn('检测到未提交的更改（除package-lock.json外），跳过自动更新');
      return false;
    }

    // 获取当前分支
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    logger.info(`当前分支: ${branch}`);

    // 如果 package-lock.json 有更改，先保存它
    let packageLockContent = null;
    if (status.modified.includes('package-lock.json')) {
      logger.info('暂存 package-lock.json 的更改');
      const lockPath = path.join(process.cwd(), 'package-lock.json');
      packageLockContent = await fs.readFile(lockPath, 'utf8');
    }

    // 强制还原 package-lock.json
    if (packageLockContent) {
      await git.checkout(['--', 'package-lock.json']);
    }

    // 拉取最新代码
    logger.info('正在拉取最新代码...');
    const pullResult = await git.pull('origin', branch);
    
    // 恢复保存的 package-lock.json
    if (packageLockContent) {
      logger.info('恢复 package-lock.json 的更改');
      const lockPath = path.join(process.cwd(), 'package-lock.json');
      await fs.writeFile(lockPath, packageLockContent, 'utf8');
    }

    if (pullResult.summary.changes === 0 && !pullResult.summary.deletions && !pullResult.summary.insertions) {
      logger.info('已是最新版本，无需更新');
      return true;
    }

    logger.info(`更新成功，共更新 ${pullResult.summary.changes} 个文件`);
    
    // 如果有依赖更新，执行 npm install
    if (pullResult.files.includes('package.json')) {
      logger.info('检测到 package.json 更新，正在更新依赖...');
      // 这里不使用 npm install 命令，因为它会再次修改 package-lock.json
      // 而是建议在外部手动执行 npm install
      logger.warn('请手动执行 npm install 以更新依赖');
    }

    return true;
  } catch (error) {
    logger.error('自动更新失败:', error.message);
    return false;
  }
}

module.exports = {
  performAutoUpdate
};