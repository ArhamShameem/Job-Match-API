import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { calculateScore } from "../../scoring/recommendation.scorer.js";

const router = Router();

function parseRecommendationLimit(limit: unknown) {
  const rawLimit = Array.isArray(limit) ? limit[0] : limit;
  const parsedLimit =
    typeof rawLimit === "string" && rawLimit.trim() !== ""
      ? Number(rawLimit)
      : 10;

  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0) {
    return 10;
  }

  return Math.min(parsedLimit, 50);
}

router.get("/:candidateId/recommendations", async (req, res) => {
  try {
    const { candidateId } = req.params;

    const limit = parseRecommendationLimit(req.query.limit);

    const candidate = await prisma.candidate.findUnique({
      where: {
        id: candidateId,
      },
    });

    if (!candidate) {
      return res.status(404).json({
        message: "Candidate not found",
      });
    }

    const jobs = await prisma.job.findMany();

    const recommendations = jobs
      .map((job) => {
        const result = calculateScore(
          {
            skills: candidate.skills as string[],
            yearsOfExperience: candidate.yearsOfExperience,
            location: candidate.location,
            expectedSalary: candidate.expectedSalary,
          },
          {
            requiredSkills: job.requiredSkills as {
              skill: string;
              type: "must-have" | "nice-to-have";
            }[],
            minYearsExperience: job.minYearsExperience,
            location: job.location,
            salaryMin: job.salaryMin,
            salaryMax: job.salaryMax,
            remoteAllowed: job.remoteAllowed,
          }
        );

        if (!result) {
          return null;
        }

        return {
          jobId: job.id,
          title: job.title,
          score: result.total,
          breakdown: result.breakdown,
        };
      })
      .filter((job) => job !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return res.json({
      candidateId,
      recommendations,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Failed to generate recommendations",
    });
  }
});

export default router;
