# Job Match API

A backend service that recommends and ranks jobs for candidates based on skills, experience, location, and salary expectations.

Built with **Node.js, Express.js, TypeScript, PostgreSQL, Prisma, Zod, and Vitest**.

---

## Features

* Create candidates
* Create jobs
* Generate ranked job recommendations for a candidate
* Recommendation score from **0–100**
* Score breakdown by:

  * Skills
  * Experience
  * Location
  * Salary
* Must-have skill hard exclusion
* Nice-to-have skill scoring
* Experience-based penalty
* Location matching with remote support
* Salary overlap scoring
* Configurable recommendation limit
* Input validation using Zod
* Unit and API tests using Vitest
* Dockerized API and PostgreSQL

---

## Tech Stack

* **Runtime:** Node.js
* **Language:** TypeScript
* **Framework:** Express.js
* **Database:** PostgreSQL
* **ORM:** Prisma
* **Validation:** Zod
* **Testing:** Vitest
* **Containerization:** Docker & Docker Compose

---

## Project Structure

```text
backend/
├── prisma/
│   ├── migrations/
│   └── schema.prisma
│
├── src/
│   ├── generated/
│   ├── lib/
│   │   └── prisma.ts
│   ├── route/
│   │   ├── candidate.route.ts
│   │   ├── job.route.ts
│   │   └── recommendation.route.ts
│   ├── schemas/
│   │   ├── candidate.schema.ts
│   │   └── job.schema.ts
│   ├── scoring/
│   │   └── recommendation.scorer.ts
│   ├── app.ts
│   ├── app.test.ts
│   └── server.ts
│
├── .env
├── .env.example
├── .dockerignore
├── Dockerfile
├── docker-compose.yml
├── package.json
└── tsconfig.json
```

---

# Getting Started

## Prerequisites

Make sure you have:

* Node.js 22+
* npm
* Docker Desktop

---

## Running Locally

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/job_match"
```

### 3. Start PostgreSQL

If using Docker:

```bash
docker compose up -d postgres
```

### 4. Run Prisma migrations

```bash
npx prisma migrate dev
```

### 5. Start the API

```bash
npm run dev
```

The API will be available at:

```text
http://localhost:5000
```

---

# Running with Docker

The project includes Docker support for both the API and PostgreSQL.

### Build the API image

```bash
docker compose build backend
```

### Start all services

```bash
docker compose up -d
```

### Run database migrations

```bash
docker compose exec backend npx prisma migrate deploy
```

### Check running containers

```bash
docker compose ps
```

Expected services:

```text
job-match-api
job-match-postgres
```

The API will be available at:

```text
http://localhost:5000
```

Inside Docker, the API connects to PostgreSQL using:

```text
postgres:5432
```

rather than `localhost`.

---

# API Endpoints

## 1. Create Candidate

### `POST /candidates`

Request:

```json
{
  "name": "Arham",
  "skills": [
    "React",
    "Node.js",
    "TypeScript",
    "PostgreSQL"
  ],
  "yearsOfExperience": 2,
  "location": "Gurugram",
  "expectedSalary": 1000000
}
```

Example response:

```json
{
  "id": "candidate-id",
  "name": "Arham",
  "skills": [
    "React",
    "Node.js",
    "TypeScript",
    "PostgreSQL"
  ],
  "yearsOfExperience": 2,
  "location": "Gurugram",
  "expectedSalary": 1000000
}
```

---

## 2. Create Job

### `POST /jobs`

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

---

## 3. Get Job Recommendations

### `GET /candidates/:candidateId/recommendations`

Example:

```text
GET /candidates/<candidateId>/recommendations
```

Optional limit:

```text
GET /candidates/<candidateId>/recommendations?limit=5
```

The response contains jobs ranked by their recommendation score.

Example:

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

---

# Recommendation Scoring

The recommendation score is normalized to a maximum of **100 points**.

| Factor     | Maximum Score |
| ---------- | ------------: |
| Skills     |            50 |
| Experience |            20 |
| Location   |            15 |
| Salary     |            15 |
| **Total**  |       **100** |

## 1. Skills — 50 points

Skills have the highest weight because they are the strongest indicator of whether a candidate can perform the job.

### Must-have skills — 40 points

All must-have skills must be present.

If **any must-have skill is missing**, the job is completely excluded from recommendations.

Example:

```text
Job requires:
- React → must-have
- Node.js → must-have

Candidate:
- React
- TypeScript
```

The job is excluded because Node.js is missing.

### Nice-to-have skills — 10 points

Nice-to-have skills do not exclude a candidate.

The 10 points are awarded proportionally based on how many nice-to-have skills match.

Example:

```text
3 nice-to-have skills
2 matched

Score = 2 / 3 × 10
     ≈ 6.67
```

If a job has no nice-to-have skills, the full 10 points are awarded after satisfying the must-have requirements.

---

## 2. Experience — 20 points

Candidates meeting or exceeding the minimum experience receive the full 20 points.

Candidates below the requirement are **penalized proportionally rather than excluded**.

Example:

```text
Required: 3 years
Candidate: 2 years

Score = 2 / 3 × 20
     ≈ 13.33
```

### Why penalize instead of exclude?

Experience is often a flexible requirement.

A candidate with slightly less experience may still be a strong match because of their skills, location, salary expectations, or other qualifications.

Therefore, experience reduces the ranking score instead of acting as a hard filter.

---

## 3. Location — 15 points

Location is scored using the following priority:

| Condition                               | Score |
| --------------------------------------- | ----: |
| Exact location match                    |    15 |
| Different location + remote allowed     |    10 |
| Different location + remote not allowed |     0 |

Example:

```text
Candidate: Gurugram
Job: Gurugram

Score = 15
```

If the candidate is in another location but the job supports remote work:

```text
Score = 10
```

---

## 4. Salary — 15 points

Salary is based on how well the job's salary range aligns with the candidate's expected salary.

### Job maximum below candidate expectation

If:

```text
job.salaryMax < candidate.expectedSalary
```

the salary score is:

```text
0
```

This indicates that the job cannot meet the candidate's expectation.

### Job minimum meets or exceeds expectation

If:

```text
job.salaryMin >= candidate.expectedSalary
```

the candidate receives the full:

```text
15 points
```

### Partial overlap

If the candidate's expectation falls inside the job's salary range, the score is proportional to the remaining salary range above the candidate's expectation.

This rewards jobs that provide reasonable salary overlap while giving higher scores to jobs that comfortably exceed expectations.

---

# Hard Exclusion vs Ranking

The recommendation system distinguishes between **hard requirements** and **ranking factors**.

### Hard exclusion

Only missing must-have skills cause a job to be excluded.

```text
Missing must-have skill
        ↓
Job excluded
```

### Ranking penalties

The following affect ranking but do not necessarily exclude the job:

* Lower experience
* Location mismatch
* Salary mismatch

This allows the system to return useful alternatives instead of aggressively filtering candidates.

---

# Validation

Request bodies are validated using **Zod**.

Validation covers:

* Required fields
* Non-empty strings
* Skills array
