import "dotenv/config";
import type { Request, Response } from "express";
import cors from "cors";
import express from "express";
import apiRouter from "./routes/index.ts";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/errorHandler.ts";

const app = express();

const allowedOrigins = process.env.BACKEND_ALLOWED_ORIGINS
  ? process.env.BACKEND_ALLOWED_ORIGINS.split(",").map((origin) => origin.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : undefined,
    credentials: true,
  })
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

app.get("/health", (_req: Request, res: Response) => {
  res.json({
    data: { status: "ok" },
    meta: { timestamp: new Date().toISOString() },
  });
});

app.use("/api/v1", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
