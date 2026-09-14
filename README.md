# Job Match API

A TypeScript backend API that creates candidate profiles, creates job postings, and returns ranked job recommendations based on skills, experience, location, and salary fit.

Built with Node.js, Express.js, Prisma, PostgreSQL, Zod, Vitest, and Docker.

## Features

- Create candidate profiles
- Create job postings
- Get ranked job recommendations for a candidate
- Return an overall match score from 0 to 100
- Return a score breakdown for skills, experience, location, and salary
- Hard-filter jobs when must-have skills are missing
- Boost scores for nice-to-have skills without filtering candidates out
- Penalize lower experience without excluding the candidate
- Prefer exact location matches over remote matches and mismatches
- Score salary fit based on the candidate expectation and job salary range
- Support a `limit` query parameter for top-N recommendations
- Validate request bodies with Zod
- Test scoring and API behavior with Vitest
- Run locally or with Docker Compose

## Tech Stack

- Runtime: Node.js
- Language: TypeScript
- Framework: Express.js
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Testing: Vitest
- Containerization: Docker and Docker Compose

## Project Structure

```text
.
|-- README.md
`-- backend/
    |-- prisma/
    |   |-- migrations/
    |   `-- schema.prisma
    |-- scoring/
    |   |-- recommendation.scorer.ts
    |   `-- recommendation.scorer.test.ts
    |-- src/
    |   |-- app.ts
    |   |-- app.test.ts
    |   |-- generated/
    |   |-- lib/
    |   |   `-- prisma.ts
    |   |-- route/
    |   |   |-- candidate.route.ts
    |   |   |-- job.route.ts
    |   |   `-- recommendation.route.ts
    |   |-- schemas/
    |   |   |-- candidate.schema.ts
    |   |   `-- job.schema.ts
    |   `-- server.ts
    |-- .dockerignore
    |-- .env.example
    |-- .gitignore
    |-- Dockerfile
    |-- docker-compose.yml
    |-- package.json
    |-- package-lock.json
    `-- tsconfig.json
```

## Getting Started

### Prerequisites

- Node.js 22+
- npm
- Docker Desktop, if running PostgreSQL or the API with Docker

### Run Locally

From the repository root:

```bash
cd backend
npm install
```

Create a `.env` file from the example:

```bash
cp .env.example .env
```

Use a local PostgreSQL connection string:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/job_match"
```

Start PostgreSQL with Docker:

```bash
docker compose up -d postgres
```

Run Prisma migrations:

```bash
npx prisma migrate dev
```

Start the API:

```bash
npm run dev
```

The API runs at:

```text
http://localhost:5000
```

## Run With Docker

From `backend/`:

```bash
docker compose build backend
docker compose up -d
```

Run database migrations inside the API container:

```bash
docker compose exec backend npx prisma migrate deploy
```

Check containers:

```bash
docker compose ps
```

Expected services:

```text
job-match-api
job-match-postgres
```

## API Endpoints

### Health Check

```http
GET /health
```

### Create Candidate

```http
POST /candidates
```

Request:

```json
{
  "name": "Arham",
  "skills": ["React", "Node.js", "TypeScript", "PostgreSQL"],
  "yearsOfExperience": 2,
  "location": "Gurugram",
  "expectedSalary": 1000000
}
```

### Create Job

```http
POST /jobs
```

Request:

```json
{
  "title": "Full Stack Developer",
  "requiredSkills": [
    {
      "skill": "React",
      "type": "must-have"
    },
    {
      "skill": "Node.js",
      "type": "must-have"
    },
    {
      "skill": "TypeScript",
      "type": "nice-to-have"
    }
  ],
  "minYearsExperience": 2,
  "location": "Gurugram",
  "salaryMin": 900000,
  "salaryMax": 1400000,
  "remoteAllowed": true
}
```

### Get Candidate Recommendations

```http
GET /candidates/:candidateId/recommendations
```

Optional top-N limit:

```http
GET /candidates/:candidateId/recommendations?limit=5
```

Response:

```json
{
  "candidateId": "candidate-id",
  "recommendations": [
    {
      "jobId": "job-id",
      "title": "Full Stack Developer",
      "score": 92,
      "breakdown": {
        "skills": 50,
        "experience": 20,
        "location": 15,
        "salary": 7
      }
    }
  ]
}
```

Invalid, zero, negative, or decimal `limit` values safely fall back to the default limit. Very large valid limits are capped at 50.

## Data Model

### Candidate

- `id`
- `name`
- `skills`
- `yearsOfExperience`
- `location`
- `expectedSalary`
- `createdAt`

### Job

- `id`
- `title`
- `requiredSkills`
- `minYearsExperience`
- `location`
- `salaryMin`
- `salaryMax`
- `remoteAllowed`
- `createdAt`

The assignment describes salary as `salaryRange`. This implementation stores it as `salaryMin` and `salaryMax`, which keeps validation and scoring straightforward while representing the same concept.

## Recommendation Scoring

The total score is capped at 100 points.

| Factor     | Max points |
| ---------- | ---------: |
| Skills     |         50 |
| Experience |         20 |
| Location   |         15 |
| Salary     |         15 |
| Total      |        100 |

Skills are weighted highest because matching the required technical abilities is the strongest signal for whether a candidate can perform the job. Experience is important but flexible, so it gets a meaningful score without becoming a hard filter. Location and salary are important fit factors, but they should not overpower a strong skills match.

### Skills: 50 Points

Must-have skills are a hard filter. If a candidate is missing any must-have skill, the scorer returns `null` and the job is excluded from recommendations.

```text
Missing must-have skill -> job excluded
```

If all must-have skills are present, the candidate receives the base must-have score:

```text
skillsScore starts at 40
```

Nice-to-have skills add up to 10 more points:

```text
skillsScore = 40 + (matchedNiceToHave / totalNiceToHave) * 10
```

If a job has no nice-to-have skills, the candidate gets the full 10-point nice-to-have portion after passing the must-have filter.

### Experience: 20 Points

Candidates who meet or exceed `minYearsExperience` receive full points:

```text
experienceScore = 20
```

Candidates below the minimum are penalized proportionally:

```text
experienceScore = (candidate.yearsOfExperience / job.minYearsExperience) * 20
```

I chose penalize instead of exclude because experience requirements are often flexible. A candidate with slightly less experience can still be a strong match if they satisfy the must-have skills and fit the location or salary expectations well.

### Location: 15 Points

Location is scored by priority:

| Condition                                 | Points |
| ----------------------------------------- | -----: |
| Exact location match                      |     15 |
| Different location and remote allowed     |     10 |
| Different location and remote not allowed |      0 |

Exact location is best because it requires no relocation or remote compromise. Remote support is still useful, so it receives partial credit.

### Salary: 15 Points

Salary score compares the candidate's `expectedSalary` with the job's salary range.

If the job maximum is below the candidate expectation:

```text
salaryScore = 0
```

If the job minimum meets or exceeds the candidate expectation:

```text
salaryScore = 15
```

If the candidate expectation falls inside the job range:

```text
salaryScore = ((job.salaryMax - candidate.expectedSalary) / (job.salaryMax - job.salaryMin)) * 15
```

This gives partial credit when the job can meet the expectation, and higher credit when more of the salary range sits above the candidate's expectation.

## Validation

Request bodies are validated with Zod before Prisma is called.

Candidate validation includes:

- Required `name`
- At least one skill
- No empty skill strings
- Non-negative `yearsOfExperience`
- Required `location`
- Positive `expectedSalary`

Job validation includes:

- Required `title`
- At least one required skill
- Skill type must be `must-have` or `nice-to-have`
- Non-negative `minYearsExperience`
- Required `location`
- Positive `salaryMin`
- Positive `salaryMax`
- `salaryMax` must be greater than or equal to `salaryMin`
- `remoteAllowed` must be a boolean

## Tests

Run tests from `backend/`:

```bash
npm run test:run
```

Run TypeScript checking:

```bash
npx tsc --noEmit
```

The test suite covers:

- Scoring logic
- Missing must-have skill exclusion
- Nice-to-have skill boost
- Experience penalties
- Location score cases
- Salary score cases and edge cases
- Score boundary checks
- Candidate API validation
- Job API validation
- Recommendation API ranking, missing candidate handling, and limit behavior

## Assumptions

- Skill matching is case-insensitive but otherwise exact.
- Candidate skills and job skills are stored as JSON arrays in PostgreSQL.
- Salaries are numeric values in the same currency.
- `salaryMin` and `salaryMax` represent the assignment's salary range.
- The recommendation endpoint scores all jobs in memory, which is acceptable for a small assignment project.
- Authentication, authorization, frontend UI, and machine learning are intentionally out of scope.

## What I Would Do Differently With More Time

- Move scoring weights into a configuration object or environment-backed config.
- Add pagination or database-side filtering for larger job datasets.
- Add `GET /jobs/:id/recommendations` for reverse matching candidates to a job.
- Add integration tests against a real PostgreSQL test database.
- Normalize skills into separate tables if the project needed search, analytics, or advanced filtering.

## AI Tool Usage

AI assistance was used to review the assignment requirements, identify test gaps, add focused tests, and improve documentation structure. I reviewed and kept the implementation rule-based and transparent, and I overrode broad restructuring suggestions in favor of small route files because the assignment is compact and does not require a controller/service split.

## Submission Notes

- Core requirements are implemented.
- Docker support is included as a bonus.
- The reverse recommendation endpoint and configurable scoring weights are not implemented because they are bonus items.
- Local secrets are kept out of git with `.gitignore`; use `.env.example` as the template for local configuration.
