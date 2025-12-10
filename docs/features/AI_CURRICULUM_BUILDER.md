# AI Curriculum Builder

The AI Curriculum Builder provides a chat-based interface for admins to create, modify, and manage curriculum content using natural language commands.

## Overview

| Aspect          | Details                   |
| --------------- | ------------------------- |
| **URL**         | `/admin/agent`            |
| **Backend**     | `POST /api/v1/agent/chat` |
| **AI Provider** | Google Gemini             |
| **Access**      | Admin role required       |

## Interface

### Chat Window

The main interface consists of:

- **Message history**: Scrollable conversation area
- **Input field**: Text area with auto-focus
- **Footer bar**: Model selector, status indicator, new chat button

### Quick Actions

Four suggested prompts help users get started:

- 💡 "What can you help me with?"
- 📝 "Help me plan changes"
- 🔍 "Which sections need attention?"
- 🗂️ "Curriculum overview"

### Models

| Model              | Description                    |
| ------------------ | ------------------------------ |
| `gemini-2.5-flash` | Fast, efficient (default)      |
| `gemini-2.5-pro`   | More capable for complex tasks |
| `gemini-2.0-flash` | Previous generation            |

## Execution Modes

### Plan Mode (Default)

1. User sends message
2. AI analyzes and proposes tool calls
3. User reviews and confirms/rejects
4. Tools execute after confirmation

### Auto-Execute Mode

- **READ tools**: Execute immediately without confirmation
- **WRITE tools**: Still require confirmation

READ tools: `list_curriculum`, `list_concepts`, `get_concept`, `get_concepts`

## Available Tools

### READ Tools

| Tool              | Purpose                    | Parameters                  |
| ----------------- | -------------------------- | --------------------------- |
| `list_curriculum` | Get full curriculum tree   | None                        |
| `list_concepts`   | List concepts              | `sectionCode?`, `nodeCode?` |
| `get_concept`     | Get single concept details | `slug`                      |
| `get_concepts`    | Batch get concept details  | `slugs[]` (max 50)          |

### CREATE Tools

| Tool                     | Purpose                   | Key Parameters                                          |
| ------------------------ | ------------------------- | ------------------------------------------------------- |
| `create_curriculum_node` | Create section/subsection | `code`, `title`, `level`, `parentCode?`, `ordinal`      |
| `create_concept`         | Create single concept     | `term`, `description`, `curriculumNodeCode`, `ordinal?` |
| `batch_create_concepts`  | Create multiple concepts  | `items[]`, `dryRun?`                                    |

### EDIT Tools

| Tool              | Purpose                 | Parameters                                 |
| ----------------- | ----------------------- | ------------------------------------------ |
| `edit_concept`    | Update concept content  | `slug`, `term?`, `description?`, `label?`  |
| `reorder_concept` | Change position in node | `slug`, `newOrdinal`                       |
| `move_concept`    | Move to different node  | `slug`, `targetNodeCode`, `targetOrdinal?` |

### DELETE Tools

| Tool              | Purpose         | Parameters |
| ----------------- | --------------- | ---------- |
| `delete_concepts` | Delete concepts | `slugs[]`  |

### DESTRUCTIVE Tools

| Tool            | Purpose       | Warning               |
| --------------- | ------------- | --------------------- |
| `reset_content` | Wipe all data | ⚠️ Deletes EVERYTHING |

## Batch Operations

### Workflow

For creating multiple concepts:

1. **Dry run first**: Call `batch_create_concepts` with `dryRun: true`
2. **Review preview**: See what would be created
3. **Confirm**: Call again with `dryRun: false`

### Limits

- Maximum 50 items per batch
- All items validated before any are created

### Example

```
User: "Create 5 concepts about sail types for LBS-2-1A"

AI: I'll first do a dry run to validate the concepts...

[Executes batch_create_concepts with dryRun: true]

Preview:
✓ lbs-2-1a-spinakeris - valid
✓ lbs-2-1a-genakeris - valid
✓ lbs-2-1a-gennakeris - valid
✓ lbs-2-1a-foka - valid
✓ lbs-2-1a-grotas - valid

Shall I create these 5 concepts?

User: "Yes"

[Executes batch_create_concepts with dryRun: false]

✓ Created 5 concepts successfully.
```

## Guardrails

### Iteration Limits

| Limit                   | Value |
| ----------------------- | ----- |
| Max tool iterations     | 10    |
| Max tools per iteration | 20    |

### Rate Limiting

- 60 requests per hour per user

### AI Behavior

The system prompt instructs the AI to:

1. **Always explain first**: Describe what it will do before calling tools
2. **Use dry runs**: Preview batch operations before executing
3. **Confirm destructive actions**: Always ask before delete/reset

## Curriculum Structure

### Code Format

All curriculum codes follow: `{SUBJECT}-{SECTION}[-{SUBSECTION}]`

**Current subject**: LBS (Laivo Buriuotojo Sertifikatas)

Examples:

- `LBS-1` - Main section 1
- `LBS-1-1A` - Subsection 1A under section 1
- `LBS-10-17` - Subsection 17 under section 10

### Concept Slugs

Format: Lowercase, derived from node code and term

Examples:

- `lbs-1-1a-jole` - "Jolė" concept in LBS-1-1A
- `lbs-1-2-1-kilis` - "Kilis" concept in LBS-1-2-1

## Error Handling

| Error                    | Cause             | Resolution                           |
| ------------------------ | ----------------- | ------------------------------------ |
| `CONCEPT_NOT_FOUND`      | Invalid slug      | Verify with `get_concept`            |
| `NODE_NOT_FOUND`         | Invalid node code | Check with `list_curriculum`         |
| `CONCEPT_ALREADY_EXISTS` | Duplicate term    | Use unique term or different section |
| `VALIDATION_ERROR`       | Invalid input     | Check field requirements             |

## Example Workflows

### Creating a New Topic

```
User: I want to add a new section about weather

AI: I'll create a new section. Looking at the existing structure,
    I recommend code "LBS-11". Here's my plan:

    Tool: create_curriculum_node
    - code: LBS-11
    - title: "Oro sąlygos"
    - level: 1
    - ordinal: 11

    Shall I proceed?
```

### Analyzing Content Gaps

```
User: Which sections need more content?

AI: I'll analyze the curriculum structure and concept counts...

[Executes list_curriculum, list_concepts]

Here's my analysis:
- LBS-1: 45 concepts ✓
- LBS-2: 12 concepts (below average)
- LBS-3: 8 concepts (needs attention)
...

LBS-3 and LBS-5 have fewer concepts than average.
Would you like me to suggest additions?
```

### Reorganizing Content

```
User: The boat parts section (LBS-1-2-1) is too long. Help reorganize.

AI: [Analyzes] LBS-1-2-1 has 45 concepts. I suggest splitting into:

    - LBS-1-2-1A: Structural components (keel, hull)
    - LBS-1-2-1B: Interior spaces (cabin, galley)
    - LBS-1-2-1C: Systems (water, ventilation)

    This would require:
    1. Creating 3 new subsections
    2. Moving concepts to appropriate sections

    Want me to show the full plan?
```

## Technical Details

### Backend Flow

```
1. POST /api/v1/agent/chat
2. requireAdminRole middleware validates JWT
3. agentService.processChat() called
4. System prompt + tools sent to Gemini
5. If tool_calls returned → execution or await confirmation
6. Results fed back to Gemini for final response
7. Response returned to frontend
```

### Frontend Flow

```
1. User types message
2. getAuthHeaders() fetches admin JWT
3. POST to /api/v1/agent/chat
4. If tool_calls → show confirmation UI
5. User confirms → POST with confirmToolCalls: true
6. Display final response and tool logs
```

---

## Maintenance

- **Last verified**: 2025-12-10
- **Related code**:
  - `backend/src/services/agentService.ts`
  - `backend/src/services/llmProvider.ts`
  - `backend/src/routes/agent.ts`
  - `frontend/src/routes/admin/agent/+page.svelte`
- **Update when**: New tools added, AI behavior changes, guardrails modified
- **Related docs**: [API Design](../architecture/API_DESIGN.md), [Roadmap](../ROADMAP.md)
