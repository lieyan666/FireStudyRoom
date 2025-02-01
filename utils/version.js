/*
 * @Author: Lieyan
 * @Date: 2025-01-22 23:10:05
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 03:05:48
 * @FilePath: /FireStudyRoom/utils/version.js
 * @Description: 版本信息工具函数
 */
const simpleGit = require('simple-git');
const path = require('path');
const fs = require('fs');
const config = require('../config/config');
const logger = require('./logger');

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
      // 获取本地信息
      const [
        branch,
        hash,
        status,
        log,
        remote
      ] = await Promise.all([
        git.revparse(['--abbrev-ref', 'HEAD']),
        git.revparse(['HEAD']),
        git.status(),
        git.log(['--max-count=1']),
        git.listRemote(['--heads'])
      ]);

      // 获取远程最新提交
      const remoteHash = remote.split('\n')
        .find(line => line.endsWith(`refs/heads/${branch.trim()}`))
        ?.split('\t')[0] || '';

      // 获取远程最新提交信息
      let remoteLog = null;
      if (remoteHash) {
        try {
          remoteLog = await git.log([`${remoteHash}`, '--max-count=1']);
        } catch (error) {
          logger.warn('无法获取远程提交信息:', error.message);
        }
      }

      gitInfo = {
        branch: branch.trim(),
        commit: {
          hash: hash.trim(),
          shortHash: hash.trim().substring(0, 7),
          message: log.latest ? log.latest.message : '',
          author: log.latest ? log.latest.author_name : '',
          date: log.latest ? log.latest.date : ''
        },
        remote: remoteHash ? {
          hash: remoteHash,
          shortHash: remoteHash.substring(0, 7),
          message: remoteLog?.latest?.message || '',
          author: remoteLog?.latest?.author_name || '',
          date: remoteLog?.latest?.date || '',
          behindBy: await git.raw(['rev-list', '--count', `${hash.trim()}..${remoteHash}`]).catch(() => '0')
        } : null,
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
      arch: process.arch,
      serverInfo: {
        environment: process.env.NODE_ENV || 'development',
        autoUpdate: process.env.NODE_ENV === 'production' && config.app.autoUpdate || false
      }
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