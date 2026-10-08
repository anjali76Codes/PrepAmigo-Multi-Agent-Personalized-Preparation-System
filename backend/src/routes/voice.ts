import { Router } from 'express';
import { processVoice } from '../controllers/VoiceController.js';
import { requireAuth } from '../middlewares/auth.middleware.js';
// Note: rate limit middleware can be added here if available

const router = Router();

router.post('/process', requireAuth, processVoice);

export default router;
