import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import {
	resumeInterviewPrepHandler,
	interviewPrepFieldsHandler,
	runAgentHandler,
	parseResumeHandler,
	startInterviewPrepHandler,
	streamAgentHandler,
} from "./controller.js";

const agentRouter = Router();

agentRouter.post("/run", requireAuth as any, runAgentHandler as any);
agentRouter.post("/parse-resume", requireAuth as any, parseResumeHandler as any);
agentRouter.post("/interview-prep", requireAuth as any, startInterviewPrepHandler as any);
agentRouter.post("/interview-prep/resume", requireAuth as any, resumeInterviewPrepHandler as any);
agentRouter.get("/interview-prep/fields", requireAuth as any, interviewPrepFieldsHandler as any);
agentRouter.get("/stream/:runId", streamAgentHandler);

export default agentRouter;
