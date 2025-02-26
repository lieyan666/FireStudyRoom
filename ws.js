/*
 * @Author: Lieyan
 * @Date: 2025-01-19 20:53:54
 * @LastEditors: Lieyan
 * @LastEditTime: 2025-02-02 21:50:02
 * @FilePath: /FireStudyRoom/ws.js
 * @Description: 
 * @Contact: QQ: 2102177341  Website: lieyan.space  Github: @lieyan666
 * @Copyright: Copyright (c) 2025 by lieyanDevTeam, All Rights Reserved. 
 */
const WebSocket = require('ws');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./utils/logger');
const { getSystemInfo } = require('./utils/systemInfo');

const MAX_CONNECTIONS = 100;
const SYSTEM_INFO_INTERVAL = 60000; // 每60秒广播一次系统信息
const PING_INTERVAL = 30000;
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB

module.exports = (server) => {
  const wss = new WebSocket.Server({
    server,
    path: '/ws',
    maxPayload: MAX_PAYLOAD_SIZE,
    clientTracking: true,
    maxConnections: MAX_CONNECTIONS
  });

  // 确保数据目录存在
  const dataDir = path.join(__dirname, 'data');
  fs.mkdir(dataDir, { recursive: true }).catch(err => {
    logger.error('Failed to create data directory:', err);
  });

  const todoFilePath = path.join(dataDir, 'todolist.json');
  const studyPlanFilePath = path.join(dataDir, 'studyplan.json');
  const chatHistoryFilePath = path.join(dataDir, 'chathistory.json');

  // 初始化或读取数据文件
  async function initDataFile(filePath, defaultData = []) {
    try {
      await fs.access(filePath);
    } catch {
      await fs.writeFile(filePath, JSON.stringify(defaultData, null, 2));
    }
  }

  // 异步保存数据
  async function saveData(filePath, data) {
    try {
      await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    } catch (err) {
      logger.error(`Failed to save data to ${filePath}:`, err);
      throw err;
    }
  }

  // 异步读取数据
  async function readData(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (err) {
      logger.error(`Failed to read data from ${filePath}:`, err);
      throw err;
    }
  }

  // 心跳检测
  function heartbeat() {
    this.isAlive = true;
  }

  // 心跳检测定时器
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach(ws => {
      if (ws.isAlive === false) {
        logger.info('Terminating inactive connection');
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, PING_INTERVAL);

  // 系统信息广播定时器
  const systemInfoInterval = setInterval(() => {
    const systemInfo = getSystemInfo();
    broadcast({
      type: 'SYSTEM_INFO',
      data: {
        type: 'WS_SERVER',
        ...systemInfo
      }
    });
  }, SYSTEM_INFO_INTERVAL);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
    clearInterval(systemInfoInterval);
  });

  // WebSocket连接处理
  wss.on('connection', async (ws, req) => {
    const ip = req.socket.remoteAddress;
    logger.info(`New WebSocket connection from ${ip}`);

    ws.isAlive = true;
    ws.on('pong', heartbeat);

    try {
      // 发送初始数据
      const todos = await readData(todoFilePath);
      const studyPlans = await readData(studyPlanFilePath);
      const chatHistory = await loadChatHistory();
      
      // 发送初始数据
      ws.send(JSON.stringify({
        type: 'INIT_ALL',
        data: {
          todos,
          studyPlans,
          chatHistory
        }
      }));

      // 发送当前系统信息
      const systemInfo = getSystemInfo();
      ws.send(JSON.stringify({
        type: 'SYSTEM_INFO',
        data: {
          type: 'WS_SERVER',
          ...systemInfo
        }
      }));
    } catch (err) {
      logger.error('Failed to send initial data:', err);
      ws.close();
      return;
    }

    ws.on('message', async (message) => {
      try {
        if (message.length > MAX_PAYLOAD_SIZE) {
          throw new Error('Message too large');
        }

        const { type, data } = JSON.parse(message);

        switch (type) {
          case 'ADD_TODO':
          case 'UPDATE_TODO':
          case 'DELETE_TODO':
            const todos = await readData(todoFilePath);
            switch (type) {
              case 'ADD_TODO':
                todos.push(data[data.length - 1]); // Add the new todo
                break;
              case 'UPDATE_TODO':
                // Replace all todos for the current user
                const otherTodosForUpdate = todos.filter(todo => todo.userId !== data[0]?.userId);
                todos.length = 0;
                todos.push(...otherTodosForUpdate, ...data);
                break;
              case 'DELETE_TODO':
                // Keep all todos except the deleted one
                const todoToDelete = data.id;
                const userIdToDelete = data.userId;
                
                // Only allow deletion if the user owns the todo
                const filteredTodos = todos.filter(todo =>
                  !(todo.id === todoToDelete && todo.userId === userIdToDelete)
                );
                
                if (filteredTodos.length === todos.length) {
                  logger.warn(`Failed to delete todo: todo not found or unauthorized`);
                  ws.send(JSON.stringify({
                    type: 'ERROR',
                    error: '无权删除该待办事项'
                  }));
                  return;
                }
                
                todos.length = 0;
                todos.push(...filteredTodos);
                break;
            }
            await saveData(todoFilePath, todos);
            broadcast({ type, data: todos });
            break;
          
          case 'ADD_STUDY_PLAN':
            const plans = await readData(studyPlanFilePath);
            const newPlan = {
              ...data,
              id: Date.now().toString(),
              createdAt: new Date().toISOString(),
              progress: 0
            };
            plans.push(newPlan);
            await saveData(studyPlanFilePath, plans);
            broadcast({ type: 'UPDATE_STUDY_PLANS', data: plans });
            logger.info(`New study plan added by user ${data.userName}`);
            break;

          case 'UPDATE_STUDY_PLAN':
            const updatedPlans = await readData(studyPlanFilePath);
            const planIndex = updatedPlans.findIndex(p => p.id === data.id);
            const plan = updatedPlans[planIndex];
            
            if (planIndex !== -1 && plan.userId === data.userId) {
              updatedPlans[planIndex] = {
                ...plan,
                ...data,
                updatedAt: new Date().toISOString()
              };
              await saveData(studyPlanFilePath, updatedPlans);
              broadcast({ type: 'UPDATE_STUDY_PLANS', data: updatedPlans });
              logger.info(`Study plan ${data.id} updated by user ${plan.userName}`);
            } else {
              logger.warn(`Failed to update study plan: plan not found or unauthorized`);
            }
            break;

          case 'DELETE_STUDY_PLAN':
            const currentPlans = await readData(studyPlanFilePath);
            const planToDelete = currentPlans.find(p => p.id === data.id);
            
            if (planToDelete && planToDelete.userId === data.userId) {
              const filteredPlans = currentPlans.filter(p => p.id !== data.id);
              await saveData(studyPlanFilePath, filteredPlans);
              broadcast({ type: 'UPDATE_STUDY_PLANS', data: filteredPlans });
              logger.info(`Study plan ${data.id} deleted by user ${planToDelete.userName}`);
            } else {
              logger.warn(`Failed to delete study plan: plan not found or unauthorized`);
            }
            break;

          case 'UPDATE_STUDY_PROGRESS':
            const progressPlans = await readData(studyPlanFilePath);
            const targetPlan = progressPlans.find(p => p.id === data.id);
            
            if (targetPlan && targetPlan.userId === data.userId) {
              targetPlan.progress = Math.min(100, Math.max(0, data.progress));
              targetPlan.lastProgressUpdate = new Date().toISOString();
              await saveData(studyPlanFilePath, progressPlans);
              broadcast({ type: 'UPDATE_STUDY_PLANS', data: progressPlans });
              logger.info(`Study plan ${data.id} progress updated to ${data.progress}% by user ${targetPlan.userName}`);
            } else {
              logger.warn(`Failed to update study plan progress: plan not found or unauthorized`);
              ws.send(JSON.stringify({
                type: 'ERROR',
                error: '无权更新该学习计划的进度'
              }));
            }
            break;

          case 'CHAT_MESSAGE':
            const chatMessage = {
              id: Date.now().toString(),
              text: data.text,
              sender: data.sender,
              userId: data.userId,
              timestamp: new Date().toISOString()
            };
            // 保存并广播聊天消息
            await saveChatMessage(chatMessage);
            broadcast({
              type: 'CHAT_MESSAGE',
              data: chatMessage
            });
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
// 加载聊天历史
async function loadChatHistory() {
  try {
    const history = await readData(chatHistoryFilePath);
    return history;
  } catch (err) {
    logger.error('Failed to load chat history:', err);
    return [];
  }
}

// 保存聊天消息
async function saveChatMessage(message) {
  try {
    const history = await loadChatHistory();
    history.push(message);
    // 保留最近1000条消息
    const recentHistory = history.slice(-1000);
    await saveData(chatHistoryFilePath, recentHistory);
  } catch (err) {
    logger.error('Failed to save chat message:', err);
  }
}

// 初始化数据文件
Promise.all([
  initDataFile(todoFilePath),
  initDataFile(studyPlanFilePath),
  initDataFile(chatHistoryFilePath, [])
]).catch(err => {
  logger.error('Failed to initialize data files:', err);
});
};
