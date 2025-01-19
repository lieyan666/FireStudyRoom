/*
 * @Author: Lieyan
 * @Date: 2025-01-19 18:59:18
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-19 19:32:20
 * @FilePath: /FireStudyRoom/config/config.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

// 环境变量覆盖
if (process.env.NODE_ENV) {
  config.app.env = process.env.NODE_ENV;
}

module.exports = config;
