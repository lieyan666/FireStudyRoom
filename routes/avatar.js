/*
 * @Author: Lieyan
 * @Date: 2025-01-25 23:18:13
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 02:12:13
 * @FilePath: /FireStudyRoom/routes/avatar.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../utils/logger');

// 验证MIME类型
const validateMimeType = (mimetype) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    return allowedTypes.includes(mimetype);
};

// 配置文件上传
const storage = multer.diskStorage({
    destination: async function (req, file, cb) {
        const userId = req.params.userId;
        const userDir = path.join(__dirname, '../data/avatars', userId);
        
        try {
            // 确保用户目录存在
            await fs.mkdir(userDir, { recursive: true });
            
            // 清理旧头像文件
            const files = await fs.readdir(userDir);
            for (const file of files) {
                await fs.unlink(path.join(userDir, file));
            }
            
            cb(null, userDir);
        } catch (error) {
            logger.error('创建用户头像目录失败:', error);
            cb(error);
        }
    },
    filename: function (req, file, cb) {
        // 使用时间戳作为文件名，保留原始扩展名
        const timestamp = Date.now();
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制5MB
    },
    fileFilter: function (req, file, cb) {
        // 验证文件类型
        if (!validateMimeType(file.mimetype)) {
            return cb(new Error('只允许上传JPG、PNG、GIF或WebP格式的图片'));
        }
        
        // 验证文件大小（再次验证，因为limits可能会被绕过）
        if (parseInt(req.headers['content-length']) > 2 * 1024 * 1024) {
            return cb(new Error('文件大小不能超过2MB'));
        }
        
        cb(null, true);
    }
});

// 错误处理中间件
const handleError = (err, res) => {
    logger.error('头像处理错误:', err);
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: '文件大小不能超过2MB' });
        }
        return res.status(400).json({ error: '文件上传失败' });
    }
    if (err.message) {
        return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: '服务器内部错误' });
};

// 上传头像
router.post('/upload/:userId', upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const userId = req.params.userId;
        const avatarName = req.file.filename;

        // 更新配置文件
        const usersPath = path.join(__dirname, '../config/users.json');
        let usersData;
        try {
            const usersContent = await fs.readFile(usersPath, 'utf8');
            usersData = JSON.parse(usersContent);
        } catch (error) {
            logger.error('读取用户配置文件失败:', error);
            return res.status(500).json({ error: '服务器内部错误' });
        }

        const userIndex = usersData.users.findIndex(user => user.id === userId);
        if (userIndex === -1) {
            return res.status(404).json({ error: '用户不存在' });
        }

        usersData.users[userIndex].avatar = avatarName;
        await fs.writeFile(usersPath, JSON.stringify(usersData, null, 2));

        // 返回文件信息
        res.json({
            success: true,
            filename: avatarName,
            path: `/api/avatar/get/${userId}`
        });
    } catch (error) {
        handleError(error, res);
    }
});

// 获取头像
router.get('/get/:userId', async (req, res) => {
    try {
        const userId = req.params.userId;
        const usersPath = path.join(__dirname, '../config/users.json');
        let user;
        try {
            const usersContent = await fs.readFile(usersPath, 'utf8');
            const usersData = JSON.parse(usersContent);
            user = usersData.users.find(u => u.id === userId);
        } catch (error) {
            logger.error('读取用户配置文件失败:', error);
            return res.status(500).json({ error: '服务器内部错误' });
        }

        if (!user || !user.avatar) {
            return res.status(404).json({ error: '头像不存在' });
        }

        // 获取头像完整路径
        const avatarPath = path.join(__dirname, '../data/avatars', userId, user.avatar);
        
        try {
            // 确保文件存在
            await fs.access(avatarPath);
            
            // 发送文件
            const ext = path.extname(user.avatar).slice(1);
            res.set('Content-Type', `image/${ext}`);
            res.set('Cache-Control', 'public, max-age=300'); // 5分钟缓存
            res.sendFile(avatarPath);
        } catch (error) {
            return res.status(404).json({ error: '头像文件不存在' });
        }
    } catch (error) {
        logger.error('获取头像失败:', error);
        handleError(error, res);
    }
});

module.exports = router;