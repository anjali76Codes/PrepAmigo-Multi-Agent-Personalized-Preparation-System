import { Router } from "express";
import { runAgentHandler, streamAgentHandler } from "./controller.js";

const agentRouter = Router();

agentRouter.post("/run", runAgentHandler);
agentRouter.get("/stream/:runId", streamAgentHandler);

export default agentRouter;
