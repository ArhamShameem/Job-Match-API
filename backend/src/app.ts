import express from "express";
import candidateRoutes from "./route/candidate.route.js";
import jobRoutes from "./route/job.route.js";
import recommendationRoutes from "./route/recommendation.route.js";

export const app = express();

app.use(express.json());

app.get("/health", (req, res) => {
  res.json({
    message: "API is running",
  });
});

app.use("/candidates", candidateRoutes);
app.use("/jobs", jobRoutes);
app.use("/candidates", recommendationRoutes);
