# Testing System

> **Status**: Planned (Priority 3 in Roadmap)

This document describes the planned dynamic testing system for the Moxlai platform.

## Vision

A testing system that:

- Works with any subject matter
- Generates tests from curriculum structure
- Uses AI for advanced question generation
- Tracks learner progress and adapts difficulty
- Supports gamification and interactive formats

## Phases

### Phase 3a: Structured Tests

Basic test types with predefined questions.

#### Question Types

| Type                | Description               | Example                         |
| ------------------- | ------------------------- | ------------------------------- |
| **Multiple Choice** | Select one correct answer | "Kas yra jolė?" A) B) C) D)     |
| **True/False**      | Binary choice             | "Jolė turi kilį. Tiesa/Netiesa" |
| **Matching**        | Pair items                | Match terms to definitions      |

#### Data Model

```sql
-- Test templates (reusable test definitions)
CREATE TABLE test_templates (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  subject_id UUID REFERENCES subjects(id),
  node_codes TEXT[],           -- Curriculum nodes covered
  question_count INT,
  time_limit_minutes INT,
  passing_score DECIMAL,
  metadata JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Individual questions
CREATE TABLE test_questions (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES test_templates(id),
  concept_slug TEXT REFERENCES concepts(slug),
  question_type TEXT NOT NULL,  -- 'multiple_choice', 'true_false', 'matching'
  question_text TEXT NOT NULL,
  options JSONB,               -- Array of options for MC
  correct_answer JSONB,        -- Correct answer(s)
  explanation TEXT,            -- Shown after answering
  difficulty INT DEFAULT 1,    -- 1-5 scale
  ordinal INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Test attempts
CREATE TABLE test_attempts (
  id UUID PRIMARY KEY,
  template_id UUID REFERENCES test_templates(id),
  profile_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  score DECIMAL,
  passed BOOLEAN,
  time_spent_seconds INT
);

-- Individual answers
CREATE TABLE test_answers (
  id UUID PRIMARY KEY,
  attempt_id UUID REFERENCES test_attempts(id),
  question_id UUID REFERENCES test_questions(id),
  answer JSONB,
  is_correct BOOLEAN,
  answered_at TIMESTAMPTZ DEFAULT now()
);
```

#### Auto-Generation

Tests can be auto-generated based on:

- Curriculum node selection
- Concept difficulty distribution
- Learner progress (avoid mastered concepts)

### Phase 3b: AI-Assisted Tests

AI-generated questions for deeper assessment.

#### Capabilities

| Feature                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| **Question Generation** | AI creates questions from concept descriptions |
| **Free-Text Grading**   | AI evaluates written answers                   |
| **Scenario-Based**      | AI generates practical scenarios               |
| **Adaptive Difficulty** | Questions adjust to learner level              |

#### AI Question Generation

```typescript
interface AIQuestionRequest {
  conceptSlug: string;
  questionType: "free_text" | "scenario" | "application";
  difficulty: 1 | 2 | 3 | 4 | 5;
  context?: string;
}

interface AIQuestionResponse {
  questionText: string;
  expectedAnswer?: string; // For grading reference
  rubric?: string; // Grading criteria
  hints?: string[];
}
```

#### Free-Text Grading

```typescript
interface GradingRequest {
  questionId: string;
  expectedAnswer: string;
  rubric: string;
  studentAnswer: string;
}

interface GradingResponse {
  score: number; // 0-100
  feedback: string; // Detailed feedback
  keyPointsMissed: string[];
  suggestions: string[];
}
```

#### Storage for AI Tests

```sql
-- AI-generated questions (for repeatability)
CREATE TABLE ai_generated_questions (
  id UUID PRIMARY KEY,
  concept_slug TEXT REFERENCES concepts(slug),
  question_type TEXT NOT NULL,
  prompt_used TEXT,           -- AI prompt for regeneration
  question_data JSONB,        -- Full question content
  model_used TEXT,            -- e.g., 'gemini-2.5-flash'
  quality_score DECIMAL,      -- Admin rating
  times_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Phase 3c: Gamified Testing

Interactive and engaging test formats.

#### Formats

| Format              | Description                                 |
| ------------------- | ------------------------------------------- |
| **Timed Challenge** | Answer as many as possible in X minutes     |
| **Lives Mode**      | 3 lives, each wrong answer costs one        |
| **Streak Bonus**    | Consecutive correct answers increase points |
| **Daily Quiz**      | New quiz each day from subscribed subjects  |
| **Battle Mode**     | Compare scores with other learners (future) |

#### Game Mechanics

```typescript
interface GameSession {
  mode: "timed" | "lives" | "streak" | "daily";
  maxTime?: number; // seconds
  maxLives?: number;
  currentStreak: number;
  highestStreak: number;
  score: number;
  multiplier: number;
}

interface ScoreCalculation {
  basePoints: number; // Per correct answer
  streakBonus: number; // Extra for consecutive
  timeBonus: number; // Extra for speed
  difficultyMultiplier: number;
}
```

## Progress Integration

### Updating Learned Status

After test completion:

```typescript
async function updateProgressFromTest(attempt: TestAttempt) {
  const answers = await getAnswersForAttempt(attempt.id);

  for (const answer of answers) {
    const progress = await getProgress(answer.conceptSlug);

    progress.times_tested += 1;
    if (answer.is_correct) {
      progress.times_passed += 1;
    }
    progress.last_tested_at = new Date();

    // Calculate confidence
    progress.confidence_score = calculateConfidence(progress);

    // Update status based on confidence
    if (progress.confidence_score >= 0.8) {
      progress.status = "known";
    } else if (progress.confidence_score < 0.5) {
      progress.status = "review";
    }

    await saveProgress(progress);
  }
}

function calculateConfidence(progress: Progress): number {
  const passRate = progress.times_passed / progress.times_tested;
  const recency = daysSinceLastTest(progress.last_tested_at);
  const decay = Math.exp(-recency / 30); // 30-day decay constant

  return passRate * decay;
}
```

### Smart Question Selection

Use progress data to select appropriate questions:

```typescript
function selectQuestionsForLearner(
  learnerProgress: Map<string, Progress>,
  availableQuestions: Question[],
  count: number
): Question[] {
  // Prioritize:
  // 1. Concepts marked for review
  // 2. Low confidence concepts
  // 3. Never tested concepts
  // 4. Mix in mastered concepts for retention

  return selectedQuestions;
}
```

## UI Components

### Test Taking Interface

```
┌─────────────────────────────────────────┐
│ Quiz: Laivo dalys                   1/10│
│ ⏱️ 4:32                          📊 80% │
├─────────────────────────────────────────┤
│                                         │
│ Kas yra jolė?                          │
│                                         │
│ ○ A) Laivo korpuso dalis               │
│ ○ B) Mažas burlaivis su švertu        │
│ ○ C) Burės tvirtinimo elementas       │
│ ○ D) Navigacijos prietaisas           │
│                                         │
├─────────────────────────────────────────┤
│         [⏮️ Atgal]  [Toliau ⏭️]         │
└─────────────────────────────────────────┘
```

### Results Screen

```
┌─────────────────────────────────────────┐
│           🎉 Quiz baigtas!              │
├─────────────────────────────────────────┤
│                                         │
│           Rezultatas: 8/10              │
│              ⭐⭐⭐⭐☆                   │
│                                         │
│ ✅ Teisingi: 8                         │
│ ❌ Neteisingi: 2                       │
│ ⏱️ Laikas: 3:24                        │
│                                         │
├─────────────────────────────────────────┤
│  [Peržiūrėti atsakymus]                │
│  [Bandyti dar kartą]                   │
│  [Grįžti į curriculum]                 │
└─────────────────────────────────────────┘
```

## API Endpoints (Planned)

| Method | Endpoint                     | Description                   |
| ------ | ---------------------------- | ----------------------------- |
| GET    | `/tests/templates`           | List available tests          |
| GET    | `/tests/templates/:id`       | Get test details              |
| POST   | `/tests/generate`            | Generate test from curriculum |
| POST   | `/tests/start/:templateId`   | Start test attempt            |
| POST   | `/tests/answer`              | Submit answer                 |
| POST   | `/tests/complete/:attemptId` | Finish test                   |
| GET    | `/tests/results/:attemptId`  | Get results                   |
| GET    | `/tests/history`             | User's test history           |

---

## Maintenance

- **Last verified**: 2025-12-10
- **Status**: Planning document - not yet implemented
- **Update when**: Implementation begins, requirements change
- **Related docs**: [Roadmap](../ROADMAP.md), [Progress Tracking](PROGRESS_TRACKING.md)
