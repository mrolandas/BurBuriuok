import express from 'express';
import { chatWithAgent, testAgentConnection, AVAILABLE_GEMINI_MODELS } from '../services/agentService.ts';
import { createRateLimiter } from '../middleware/rateLimiter.ts';

const router = express.Router();

// Rate limiter for agent chat: 60 requests per hour per admin
const agentChatRateLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 60,
  keyGenerator: (req) => req.authUser?.id || req.ip || 'unknown',
  onLimitExceeded: (ctx) => {
    console.warn('[agent] Rate limit exceeded', { 
      userId: ctx.key, 
      limit: ctx.limit 
    });
  }
});

// Get available models
router.get('/models', (_req, res) => {
  res.json({ models: AVAILABLE_GEMINI_MODELS });
});

router.post('/chat', agentChatRateLimiter, async (req, res) => {
  try {
    const { messages, executionMode, confirmToolCalls, model } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    const response = await chatWithAgent(messages, { executionMode, confirmToolCalls, model });
    res.json(response);
  } catch (error: any) {
    console.error('[agent] Chat error:', error);
    
    // Build detailed error response for troubleshooting
    const errorResponse: any = {
      error: error.message || 'Unknown error',
      errorType: error.name || 'Error',
    };
    
    // Include additional context if available
    if (error.status) errorResponse.status = error.status;
    if (error.statusText) errorResponse.statusText = error.statusText;
    if (error.code) errorResponse.code = error.code;
    
    // Include stack trace in development
    if (process.env.NODE_ENV !== 'production') {
      errorResponse.stack = error.stack;
    }
    
    // Include Gemini-specific error details if available
    if (error.response?.data) {
      errorResponse.apiError = error.response.data;
    }
    if (error.errorDetails) {
      errorResponse.details = error.errorDetails;
    }
    
    res.status(500).json(errorResponse);
  }
});

router.get('/test', async (_req, res) => {
  try {
    await testAgentConnection();
    res.json({ status: 'ok' });
  } catch (error: any) {
    console.error('Agent test error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
