import { Request, Response } from 'express';
import { voiceAssistantService } from '../services/VoiceAssistantService.js';
import { AuthenticatedRequest } from '../types/authenticated-request.js';

export const processVoice = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const { transcript, sessionId } = req.body as { transcript?: unknown; sessionId?: unknown };
    if (typeof transcript !== 'string' || !transcript.trim()) {
      return res.status(400).json({ error: 'Transcript is required' });
    }

    const result = await voiceAssistantService.processVoiceInput(userId, transcript.trim());

    // Map intent to route
    let route = null;
    if (result.navigationTarget) {
      switch (result.navigationTarget) {
        case 'plan': route = `/roadmap?jump=${Date.now()}`; break;
        case 'plan_day': route = `/roadmap?day=${result.dayNumber}&jump=${Date.now()}`; break;
        case 'plan_sprint': route = `/roadmap?sprint=${result.sprintNumber}&jump=${Date.now()}`; break;
        case 'progress': route = '/progress'; break;
        case 'gaps': route = '/progress'; break;
        case 'readiness': route = '/dashboard'; break;
        case 'resources': route = '/resource-pack'; break;
        case 'profile': route = '/profile'; break;
        case 'assessment': route = '/assessment'; break;
        case 'interview_prep': route = '/dashboard/interview-prep'; break;
        case 'calendar': route = '/calendar'; break;
      }
    }

    res.json({
      intentType: result.intentType,
      spokenAnswer: result.spokenAnswer,
      navigation: route ? { target: result.navigationTarget, route } : null,
      forwardToResearchAgent: result.forwardToResearchAgent || false,
      sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    });
  } catch (error: any) {
    console.error('Voice Assistant Error:', error);
    res.status(500).json({ error: 'Internal Server Error', spokenAnswer: 'I encountered an error. Let me try again later.' });
  }
};
