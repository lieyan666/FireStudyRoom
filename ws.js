/*
 * @Author: Lieyan
 * @Date: 2025-01-19 20:53:54
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-01-20 15:31:00
 * @FilePath: /FireStudyRoom/ws.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');

const MAX_CONNECTIONS = 100;
const PING_INTERVAL = 30000;
const MAX_TODO_SIZE = 1024 * 1024; // 1MB

module.exports = (server) => {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
    maxPayload: MAX_TODO_SIZE,
    clientTracking: true,
    maxConnections: MAX_CONNECTIONS
  });

  // 确保数据目录存在
  const dataDir = path.join(__dirname, 'data');
  fs.mkdir(dataDir, { recursive: true }).catch(err => {
    logger.error('Failed to create data directory:', err);
  });

  const todoFilePath = path.join(dataDir, 'todolist.json');

  // 初始化或读取todolist
  async function initTodoList() {
    try {
      await fs.access(todoFilePath);
    } catch {
      // 文件不存在，创建空的todolist
      await fs.writeFile(todoFilePath, JSON.stringify([], null, 2));
    }
  }

  // 异步保存数据
  async function saveTodoList(data) {
    try {
      await fs.writeFile(todoFilePath, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error('Failed to save todolist:', err);
      throw err;
    }
  }

  // 心跳检测
  function heartbeat() {
    this.isAlive = true;
  }

  const interval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        logger.info('Terminating inactive connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL);

  wss.on('close', () => {
    clearInterval(interval);
  });

  // WebSocket连接处理
  wss.on('connection', async (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`New WebSocket connection from ${ip}`);

    ws.isAlive = true;
    ws.on('pong', heartbeat);

    try {
      // 发送当前todolist数据
      const data = await fs.readFile(todoFilePath, 'utf8');
      ws.send(JSON.stringify({
        type: 'INIT',
        data: JSON.parse(data)
      }));
    } catch (err) {
      logger.error('Failed to send initial data:', err);
      ws.close();
      return;
    }

    ws.on('message', async (message) => {
      try {
        if (message.length > MAX_TODO_SIZE) {
          throw new Error('Message too large');
        }

        const { type, data } = JSON.parse(message);

        switch (type) {
          case 'ADD_TODO':
          case 'UPDATE_TODO':
          case 'DELETE_TODO':
            await saveTodoList(data);
            broadcast({ type, data });
            break;
          default:
            logger.warn(`Unknown message type: ${type}`);
        }
      } catch (err) {
        logger.error('WebSocket message error:', err);
        ws.send(JSON.stringify({
          type: 'ERROR',
          error: err.message
        }));
      }
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket error from ${ip}:`, err);
    });

    ws.on('close', () => {
      logger.info(`Client disconnected: ${ip}`);
    });
  });

  // 广播消息给所有客户端
  function broadcast(message) {
    const messageStr = JSON.stringify(message);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  // 初始化todolist
  initTodoList().catch(err => {
    logger.error('Failed to initialize todolist:', err);
  });
};
