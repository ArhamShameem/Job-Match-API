import { z } from "zod";

export const candidateSchema = z.object({
  name: z.string().min(1, "Name is required"),

  skills: z
    .array(z.string().min(1))
    .min(1, "At least one skill is required"),

  yearsOfExperience: z
    .number()
    .min(0, "Experience cannot be negative"),

  location: z.string().min(1, "Location is required"),

  expectedSalary: z
    .number()
    .positive("Expected salary must be greater than 0"),
});
