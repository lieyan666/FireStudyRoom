/*
 * @Author: Lieyan
 * @Date: 2025-01-19 18:59:18
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-25 22:04:13
 * @FilePath: /FireStudyRoom/config/config.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const usersPath = path.join(__dirname, 'users.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const usersConfig = JSON.parse(fs.readFileSync(usersPath, 'utf8'));

// 合并用户配置
config.users = usersConfig.users;

// 环境变量覆盖
if (process.env.NODE_ENV) {
  config.app.env = process.env.NODE_ENV;
}

module.exports = config;
