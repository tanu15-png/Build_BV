import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const healthRouter = Router();

healthRouter.get("/live", (_req, res) => {
  res.status(200).json({
    ok: true,
    status: "alive",
  });
});

healthRouter.get("/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      ok: true,
      status: "ready",
    });
  } catch {
    res.status(503).json({
      ok: false,
      status: "not_ready",
    });
  }
});