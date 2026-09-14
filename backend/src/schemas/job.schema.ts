import { z } from "zod";

const requiredSkillSchema = z.object({
  skill: z.string().min(1),
  type: z.enum(["must-have", "nice-to-have"]),
});

export const jobSchema = z
  .object({
    title: z.string().min(1, "Title is required"),

    requiredSkills: z
      .array(requiredSkillSchema)
      .min(1, "At least one skill is required"),

    minYearsExperience: z.number().min(0, "Experience cannot be negative"),

    location: z.string().min(1, "Location is required"),

    salaryMin: z.number().positive("Minimum salary must be greater than 0"),

    salaryMax: z.number().positive("Maximum salary must be greater than 0"),

    remoteAllowed: z.boolean(),
  })
  .refine((data) => data.salaryMax >= data.salaryMin, {
    message: "Maximum salary must be greater than or equal to minimum salary",
    path: ["salaryMax"],
  });
