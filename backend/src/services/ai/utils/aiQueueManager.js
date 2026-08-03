import logger from '../../../config/logger.js';
import { aiRouterConfig } from '../../../config/aiRouter.config.js';

class AIQueueManager {
  constructor() {
    this.maxConcurrent = aiRouterConfig.tuning?.queueSize || 3;
    this.activeCount = 0;
    this.waitingQueue = [];
  }

  /**
   * Run the requested async task inside the concurrency queue lock.
   */
  async run(task) {
    const queueWaitStart = Date.now();
    
    // Refresh maxConcurrent from config if updated
    this.maxConcurrent = aiRouterConfig.tuning?.queueSize || 3;

    if (this.activeCount >= this.maxConcurrent) {
      logger.info(`[AI Queue] Concurrency limit (${this.maxConcurrent}) reached. Enqueuing request (Queue length: ${this.waitingQueue.length + 1}).`);
      
      await new Promise(resolve => {
        this.waitingQueue.push(resolve);
      });
    }

    const queueWaitTime = Date.now() - queueWaitStart;
    if (queueWaitTime > 0) {
      logger.info(`[AI Queue] Request dequeued after waiting ${queueWaitTime}ms.`);
    }

    this.activeCount += 1;
    
    try {
      // Execute task and pass the wait time
      return await task(queueWaitTime);
    } finally {
      this.activeCount -= 1;
      
      // Release next in line
      if (this.waitingQueue.length > 0) {
        const nextResolver = this.waitingQueue.shift();
        nextResolver();
      }
    }
  }

  getQueueLength() {
    return this.waitingQueue.length;
  }
}

export default new AIQueueManager();
