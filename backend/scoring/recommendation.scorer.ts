type SkillRequirement = {
  skill: string;
  type: "must-have" | "nice-to-have";
};

type Candidate = {
  skills: string[];
  yearsOfExperience: number;
  location: string;
  expectedSalary: number;
};

type Job = {
  requiredSkills: SkillRequirement[];
  minYearsExperience: number;
  location: string;
  salaryMin: number;
  salaryMax: number;
  remoteAllowed: boolean;
};

export function calculateScore(candidate: Candidate, job: Job) {
  // 1. Check must-have skills
  const mustHaveSkills = job.requiredSkills.filter(
    (skill) => skill.type === "must-have",
  );

  const hasAllMustHaveSkills = mustHaveSkills.every((required) =>
    candidate.skills.some(
      (candidateSkill) =>
        candidateSkill.toLowerCase() === required.skill.toLowerCase(),
    ),
  );

  if (!hasAllMustHaveSkills) {
    return null;
  }

  // 2. Skills score
  const niceToHaveSkills = job.requiredSkills.filter(
    (skill) => skill.type === "nice-to-have",
  );

  const matchedNiceToHave = niceToHaveSkills.filter((required) =>
    candidate.skills.some(
      (candidateSkill) =>
        candidateSkill.toLowerCase() === required.skill.toLowerCase(),
    ),
  );

  const skillsScore =
    40 +
    (niceToHaveSkills.length > 0
      ? (matchedNiceToHave.length / niceToHaveSkills.length) * 10
      : 10);

  // 3. Experience score
  const experienceScore =
    candidate.yearsOfExperience >= job.minYearsExperience
      ? 20
      : (candidate.yearsOfExperience / job.minYearsExperience) * 20;

  // 4. Location score
  let locationScore = 0;

  if (candidate.location.toLowerCase() === job.location.toLowerCase()) {
    locationScore = 15;
  } else if (job.remoteAllowed) {
    locationScore = 10;
  }

  // 5. Salary score
  let salaryScore = 0;

  if (job.salaryMax < candidate.expectedSalary) {
    salaryScore = 0;
  } else if (job.salaryMin >= candidate.expectedSalary) {
    salaryScore = 15;
  } else {
    const overlap = job.salaryMax - candidate.expectedSalary;

    const jobRange = job.salaryMax - job.salaryMin;

    salaryScore = Math.min(15, (overlap / jobRange) * 15);
  }

  const totalScore = Math.min(
    100,
    skillsScore + experienceScore + locationScore + salaryScore,
  );

  return {
    total: Math.round(totalScore),
    breakdown: {
      skills: Math.round(skillsScore),
      experience: Math.round(experienceScore),
      location: locationScore,
      salary: Math.round(salaryScore),
    },
  };
}
