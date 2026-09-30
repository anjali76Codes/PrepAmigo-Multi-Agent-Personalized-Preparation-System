import { Router } from "express";

import agentRouter from "../agent/routes.js";
import jobIntelligenceRouter from "../agent/jobIntelligence/routes.js";
import plansRouter from "./plans.routes.js";
import sprintsRouter from "./sprints.routes.js";
import sprintDaysRouter from "./sprint-days.routes.js";
import progressRouter from "./progress.routes.js";

const apiRouter = Router();

apiRouter.use("/api/agent", agentRouter);
apiRouter.use(jobIntelligenceRouter);
apiRouter.use("/api", plansRouter);
apiRouter.use("/api", sprintsRouter);
apiRouter.use("/api", sprintDaysRouter);
apiRouter.use("/api", progressRouter);

export default apiRouter;