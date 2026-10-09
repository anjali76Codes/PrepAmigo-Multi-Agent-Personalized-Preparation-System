import { Router } from "express";

import agentRouter from "../agent/routes.js";
import jobIntelligenceRouter from "../agent/jobIntelligence/routes.js";
import plansRouter from "./plans.routes.js";
import sprintsRouter from "./sprints.routes.js";
import sprintDaysRouter from "./sprint-days.routes.js";
import progressRouter from "./progress.routes.js";
import assessmentsRouter from "./assessments.routes.js";
import flashcardsRouter from "./flashcards.routes.js";
import resourcesRouter from "./resources.routes.js";
import notificationsRouter from "./notifications.routes.js";
import customTasksRouter from "./customTasks.routes.js";
import chatSessionsRouter from "./chatSessions.routes.js";

const apiRouter = Router();

apiRouter.use("/api/agent", agentRouter);
apiRouter.use(jobIntelligenceRouter);
apiRouter.use("/api", plansRouter);
apiRouter.use("/api", sprintsRouter);
apiRouter.use("/api", sprintDaysRouter);
apiRouter.use("/api", progressRouter);
apiRouter.use("/api/assessments", assessmentsRouter);
apiRouter.use("/api/flashcards", flashcardsRouter);
apiRouter.use("/api", resourcesRouter);
apiRouter.use("/api/notifications", notificationsRouter);
apiRouter.use("/api", customTasksRouter);
apiRouter.use("/api", chatSessionsRouter);

export default apiRouter;