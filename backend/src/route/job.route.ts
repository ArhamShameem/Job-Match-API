import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { jobSchema } from "../schemas/job.schema.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const result = jobSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    const {
      title,
      requiredSkills,
      minYearsExperience,
      location,
      salaryMin,
      salaryMax,
      remoteAllowed,
    } = result.data;

    const job = await prisma.job.create({
      data: {
        title,
        requiredSkills,
        minYearsExperience,
        location,
        salaryMin,
        salaryMax,
        remoteAllowed,
      },
    });

    res.status(201).json(job);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create job",
    });
  }
});

export default router;
