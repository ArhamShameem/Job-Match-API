import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";

const prismaMock = vi.hoisted(() => ({
  candidate: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  job: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("./lib/prisma.js", () => ({
  prisma: prismaMock,
}));

let server: Server;
let baseUrl: string;

async function request(path: string, init?: RequestInit) {
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });
}

beforeEach(async () => {
  vi.clearAllMocks();

  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        throw new Error("Failed to bind test server");
      }

      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });
});

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

const validCandidate = {
  name: "Asha Sharma",
  skills: ["React", "Node.js", "TypeScript"],
  yearsOfExperience: 3,
  location: "Gurugram",
  expectedSalary: 1000000,
};

const validJob = {
  title: "Frontend Engineer",
  requiredSkills: [
    { skill: "React", type: "must-have" },
    { skill: "Node.js", type: "nice-to-have" },
  ],
  minYearsExperience: 2,
  location: "Gurugram",
  salaryMin: 800000,
  salaryMax: 1200000,
  remoteAllowed: true,
};

describe("candidate API", () => {
  it("creates a valid candidate", async () => {
    prismaMock.candidate.create.mockResolvedValue({
      id: "candidate-1",
      ...validCandidate,
      createdAt: new Date().toISOString(),
    });

    const response = await request("/candidates", {
      method: "POST",
      body: JSON.stringify(validCandidate),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: "candidate-1",
      name: validCandidate.name,
    });
    expect(prismaMock.candidate.create).toHaveBeenCalledWith({
      data: validCandidate,
    });
  });

  it.each([
    ["missing name", { ...validCandidate, name: undefined }],
    ["empty skills", { ...validCandidate, skills: [] }],
    ["negative experience", { ...validCandidate, yearsOfExperience: -1 }],
    ["zero expected salary", { ...validCandidate, expectedSalary: 0 }],
    ["negative expected salary", { ...validCandidate, expectedSalary: -1 }],
  ])("rejects invalid candidate data: %s", async (_case, body) => {
    const response = await request("/candidates", {
      method: "POST",
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(prismaMock.candidate.create).not.toHaveBeenCalled();
  });
});

describe("job API", () => {
  it("creates a valid job", async () => {
    prismaMock.job.create.mockResolvedValue({
      id: "job-1",
      ...validJob,
      createdAt: new Date().toISOString(),
    });

    const response = await request("/jobs", {
      method: "POST",
      body: JSON.stringify(validJob),
    });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      id: "job-1",
      title: validJob.title,
    });
    expect(prismaMock.job.create).toHaveBeenCalledWith({
      data: validJob,
    });
  });

  it.each([
    ["missing title", { ...validJob, title: undefined }],
    ["empty required skills", { ...validJob, requiredSkills: [] }],
    [
      "invalid skill type",
      {
        ...validJob,
        requiredSkills: [{ skill: "React", type: "critical" }],
      },
    ],
    ["negative experience", { ...validJob, minYearsExperience: -1 }],
    ["invalid salary range", { ...validJob, salaryMin: 1200000, salaryMax: 800000 }],
    ["invalid remote flag", { ...validJob, remoteAllowed: "yes" }],
  ])("rejects invalid job data: %s", async (_case, body) => {
    const response = await request("/jobs", {
      method: "POST",
      body: JSON.stringify(body),
    });

    expect(response.status).toBe(400);
    expect(prismaMock.job.create).not.toHaveBeenCalled();
  });
});

describe("recommendation API", () => {
  const jobs = [
    {
      id: "job-low",
      title: "Lower Salary Remote Role",
      requiredSkills: [{ skill: "React", type: "must-have" }],
      minYearsExperience: 5,
      location: "Bengaluru",
      salaryMin: 600000,
      salaryMax: 800000,
      remoteAllowed: true,
    },
    {
      id: "job-high",
      title: "Exact Match Role",
      requiredSkills: [
        { skill: "React", type: "must-have" },
        { skill: "Node.js", type: "nice-to-have" },
      ],
      minYearsExperience: 2,
      location: "Gurugram",
      salaryMin: 1200000,
      salaryMax: 1800000,
      remoteAllowed: false,
    },
    {
      id: "job-excluded",
      title: "Python Role",
      requiredSkills: [
        { skill: "React", type: "must-have" },
        { skill: "Python", type: "must-have" },
      ],
      minYearsExperience: 1,
      location: "Gurugram",
      salaryMin: 1200000,
      salaryMax: 1800000,
      remoteAllowed: false,
    },
  ];

  it("returns ranked recommendations and excludes missing must-have skills", async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(validCandidate);
    prismaMock.job.findMany.mockResolvedValue(jobs);

    const response = await request("/candidates/candidate-1/recommendations");

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.candidateId).toBe("candidate-1");
    expect(body.recommendations).toHaveLength(2);
    expect(body.recommendations.map((job: { title: string }) => job.title)).toEqual([
      "Exact Match Role",
      "Lower Salary Remote Role",
    ]);
    expect(body.recommendations[0].score).toBeGreaterThanOrEqual(
      body.recommendations[1].score,
    );
  });

  it("returns 404 for a missing candidate", async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(null);

    const response = await request("/candidates/missing/recommendations");

    expect(response.status).toBe(404);
    expect(prismaMock.job.findMany).not.toHaveBeenCalled();
  });

  it("honors a valid limit", async () => {
    prismaMock.candidate.findUnique.mockResolvedValue(validCandidate);
    prismaMock.job.findMany.mockResolvedValue(jobs);

    const response = await request("/candidates/candidate-1/recommendations?limit=1");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.recommendations).toHaveLength(1);
  });

  it.each(["abc", "-1", "0", "1.5"])(
    "handles invalid limit safely: %s",
    async (limit) => {
      prismaMock.candidate.findUnique.mockResolvedValue(validCandidate);
      prismaMock.job.findMany.mockResolvedValue(jobs);

      const response = await request(
        `/candidates/candidate-1/recommendations?limit=${limit}`,
      );
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.recommendations).toHaveLength(2);
    },
  );
});
