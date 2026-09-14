import { describe, expect, it } from "vitest";
import { calculateScore } from "./recommendation.scorer.js";

const baseCandidate = {
  skills: ["React", "Node.js", "TypeScript"],
  yearsOfExperience: 3,
  location: "Gurugram",
  expectedSalary: 1000000,
};

const baseJob = {
  requiredSkills: [
    {
      skill: "React",
      type: "must-have" as const,
    },
    {
      skill: "Node.js",
      type: "must-have" as const,
    },
    {
      skill: "Docker",
      type: "nice-to-have" as const,
    },
  ],
  minYearsExperience: 2,
  location: "Gurugram",
  salaryMin: 800000,
  salaryMax: 1500000,
  remoteAllowed: false,
};

describe("calculateScore", () => {
  it("should exclude a job when a must-have skill is missing", () => {
    const candidate = {
      ...baseCandidate,
      skills: ["React", "TypeScript"],
    };

    const result = calculateScore(candidate, baseJob);

    expect(result).toBeNull();
  });

  it("should calculate a score when all must-have skills are present", () => {
    const result = calculateScore(baseCandidate, baseJob);

    expect(result).not.toBeNull();
    expect(result!.total).toBeGreaterThan(0);
  });

  it("should give bonus points for nice-to-have skills", () => {
    const candidateWithoutDocker = {
      ...baseCandidate,
      skills: ["React", "Node.js", "TypeScript"],
    };

    const candidateWithDocker = {
      ...baseCandidate,
      skills: ["React", "Node.js", "TypeScript", "Docker"],
    };

    const withoutDocker = calculateScore(
      candidateWithoutDocker,
      baseJob
    );

    const withDocker = calculateScore(
      candidateWithDocker,
      baseJob
    );

    expect(withDocker!.total).toBeGreaterThan(withoutDocker!.total);
  });

  it("should penalize candidates below the required experience", () => {
    const candidate = {
      ...baseCandidate,
      yearsOfExperience: 1,
    };

    const result = calculateScore(candidate, baseJob);

    expect(result).not.toBeNull();
    expect(result!.breakdown.experience).toBe(10);
  });

  it("should give maximum location score for an exact match", () => {
    const result = calculateScore(baseCandidate, baseJob);

    expect(result!.breakdown.location).toBe(15);
  });

  it("should give remote score when location differs but remote is allowed", () => {
    const job = {
      ...baseJob,
      location: "Bangalore",
      remoteAllowed: true,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.location).toBe(10);
  });

  it("should give zero location score for a mismatch without remote", () => {
    const job = {
      ...baseJob,
      location: "Bangalore",
      remoteAllowed: false,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.location).toBe(0);
  });

  it("should give zero salary score when job maximum is below expectation", () => {
    const job = {
      ...baseJob,
      salaryMin: 600000,
      salaryMax: 800000,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.salary).toBe(0);
  });

  it("should give partial salary score when expectation is inside the range", () => {
    const job = {
      ...baseJob,
      salaryMin: 800000,
      salaryMax: 1200000,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.salary).toBe(8);
  });

  it("should give maximum salary score when salary range is comfortably above expectation", () => {
    const job = {
      ...baseJob,
      salaryMin: 1200000,
      salaryMax: 1800000,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.salary).toBe(15);
  });

  it.each([
    ["salaryMin", 1000000, 1500000, 15],
    ["salaryMax", 800000, 1000000, 0],
    ["fixed salary equal to expectation", 1000000, 1000000, 15],
    ["fixed salary below expectation", 800000, 800000, 0],
  ])(
    "should handle expected salary exactly at %s",
    (_case, salaryMin, salaryMax, expectedSalaryScore) => {
      const job = {
        ...baseJob,
        salaryMin,
        salaryMax,
      };

      const result = calculateScore(baseCandidate, job);

      expect(result!.breakdown.salary).toBe(expectedSalaryScore);
    },
  );

  it("should not exclude candidates below minimum experience", () => {
    const candidate = {
      ...baseCandidate,
      yearsOfExperience: 1,
    };

    const result = calculateScore(candidate, baseJob);

    expect(result).not.toBeNull();
    expect(result!.breakdown.experience).toBeLessThan(20);
  });

  it("should never produce a negative experience score", () => {
    const candidate = {
      ...baseCandidate,
      yearsOfExperience: 0,
    };

    const result = calculateScore(candidate, baseJob);

    expect(result!.breakdown.experience).toBe(0);
  });

  it("should give full experience score when minimum experience is zero", () => {
    const job = {
      ...baseJob,
      minYearsExperience: 0,
    };

    const result = calculateScore(baseCandidate, job);

    expect(result!.breakdown.experience).toBe(20);
  });

  it("should never exceed a score of 100", () => {
    const result = calculateScore(baseCandidate, baseJob);

    expect(result!.total).toBeLessThanOrEqual(100);
  });

  it("should keep individual scoring dimensions within their maximums", () => {
    const result = calculateScore(baseCandidate, baseJob);

    expect(result!.breakdown.skills).toBeLessThanOrEqual(50);
    expect(result!.breakdown.experience).toBeLessThanOrEqual(20);
    expect(result!.breakdown.location).toBeLessThanOrEqual(15);
    expect(result!.breakdown.salary).toBeLessThanOrEqual(15);
  });
});
