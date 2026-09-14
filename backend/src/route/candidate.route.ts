import { Router } from "express";

import { prisma } from "../lib/prisma.js";
import { candidateSchema } from "../schemas/candidate.schema.js";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const result = candidateSchema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: result.error.flatten(),
      });
    }

    const {
      name,
      skills,
      yearsOfExperience,
      location,
      expectedSalary,
    } = result.data;

    const candidate = await prisma.candidate.create({
      data: {
        name,
        skills,
        yearsOfExperience,
        location,
        expectedSalary,
      },
    });

    res.status(201).json(candidate);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to create candidate",
    });
  }
});

export default router;
