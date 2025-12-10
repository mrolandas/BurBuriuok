# AI Agent Admin Interface

The Agent Admin interface (`/admin/agent`) provides a conversational AI-powered tool for managing curriculum content. It enables administrators to create, edit, reorder, move, and delete curriculum items through natural language commands.

## Overview

- **URL**: `http://localhost:5173/admin/agent` (dev) or `https://<domain>/admin/agent` (prod)
- **Purpose**: AI-assisted curriculum management via chat interface
- **Backend**: Express API at `POST /api/v1/admin/agent/chat`
- **LLM Provider**: Google Gemini (configurable model selection)

## Features

### Chat Interface

The main interface consists of:

1. **Message History**: Displays the conversation between user and AI
2. **Input Area**: Text input for sending messages to the AI
3. **Model Selector**: Dropdown to choose between available Gemini models
4. **Tool Execution Logs**: Collapsible panel showing executed tool calls and results

### Available Models

| Model              | Description                          | Default |
| ------------------ | ------------------------------------ | ------- |
| `gemini-2.5-flash` | Fast, efficient model for most tasks | ✓       |
| `gemini-2.5-pro`   | More capable model for complex tasks |         |
| `gemini-2.0-flash` | Previous generation flash model      |         |

### Execution Modes

The agent operates in two modes:

- **Plan Mode**: AI proposes tool calls, user confirms before execution
- **Execute Mode**: READ-only tools execute automatically; modifying tools still require confirmation

READ-only tools (`list_curriculum`, `list_concepts`, `get_concept`) are auto-executed to gather context without user intervention.

## Available Tools

### READ Tools (Auto-executed)

These tools gather information and execute automatically:

#### `list_curriculum`
Returns the full curriculum tree with all sections and subsections.

```
User: "Show me the curriculum structure"
AI: [Executes list_curriculum] "The curriculum has 10 main sections..."
```

#### `list_concepts`
Lists concepts, optionally filtered by section or node.

Parameters:
- `sectionCode` (optional): Filter by top-level section (e.g., `LBS-1`)
- `nodeCode` (optional): Filter by specific node (e.g., `LBS-1-1A`)

```
User: "What concepts are in the boat types section?"
AI: [Executes list_concepts with nodeCode: LBS-1-1A] "Found 7 concepts..."
```

#### `get_concept`
Gets detailed information about a specific concept.

Parameters:
- `slug` (required): The URL-friendly slug of the concept

```
User: "Show me details about the 'jolė' concept"
AI: [Executes get_concept] "Jolė is a type of sailboat..."
```

### CREATE Tools

#### `create_curriculum_node`
Creates a new section or subsection in the curriculum.

Parameters:
- `code` (required): Unique code (e.g., `LBS-11`)
- `title` (required): Display title
- `summary` (optional): Short description
- `level` (required): 1 for section, 2 for subsection
- `parentCode` (required for level 2): Parent node code
- `ordinal` (required): Order position

```
User: "Create a new section about navigation"
AI: "I'll create a new section. Please confirm..."
```

#### `create_concept`
Creates a new learning concept with associated curriculum item.

Parameters:
- `slug` (optional): URL-friendly ID (auto-generated if omitted)
- `term` (required): Main term/title in Lithuanian
- `description` (required): Markdown content
- `curriculumNodeCode` (required): Parent node code

```
User: "Add a concept about compass navigation to LBS-4"
AI: "I'll create the concept. Please confirm..."
```

### EDIT Tools

#### `edit_concept`
Updates a concept's content without changing its position.

Parameters:
- `slug` (required): Concept to edit
- `term` (optional): New Lithuanian term
- `termEn` (optional): New English term
- `description` (optional): New description (Markdown)
- `descriptionEn` (optional): New English description
- `label` (optional): New curriculum item label

```
User: "Update the description of 'lbs-1-1a-jole'"
AI: "I'll update the concept. Please confirm..."
```

#### `reorder_concept`
Changes a concept's position within its current node.

Parameters:
- `slug` (required): Concept to reorder
- `newOrdinal` (required): New position (1-based)

```
User: "Move 'Sample Concept' to position 2"
AI: "I'll reorder the concept. Please confirm..."
```

#### `move_concept`
Moves a concept to a different section/subsection.

Parameters:
- `slug` (required): Concept to move
- `targetNodeCode` (required): Destination node code
- `targetOrdinal` (optional): Position in target (appends if omitted)

```
User: "Move this concept to the Korpusas section"
AI: "I'll move the concept to LBS-1-2-1. Please confirm..."
```

### DELETE Tools

#### `delete_concepts`
Deletes one or more concepts by their slugs. Supports efficient batch deletion.

Parameters:
- `slugs` (required): Array of concept slugs to delete

```
User: "Delete all the sample concepts"
AI: "I'll delete 3 concepts. Please confirm..."
```

### DESTRUCTIVE Tools

#### `reset_content`
Wipes all curriculum nodes and concepts. **Use with extreme caution.**

```
User: "Reset all content"
AI: "⚠️ This will delete ALL content. Are you absolutely sure?"
```

## Code Conventions

The curriculum follows a unified naming convention:

### Node Codes
Format: `{SUBJECT}-{SECTION}[-{SUBSECTION}]`

Examples:
- `LBS-1` - Main section 1
- `LBS-1-1A` - Subsection 1A under section 1
- `LBS-10-17` - Subsection 17 under section 10

### Concept Slugs
Format: Lowercase, derived from node code and term

Examples:
- `lbs-1-1a-jole` - "Jolė" concept in LBS-1-1A
- `lbs-1-2-1-kilis` - "Kilis" concept in LBS-1-2-1

## UI Components

### Message Display

Messages are styled by role:
- **User**: Right-aligned, highlighted background
- **Assistant**: Left-aligned, contains formatted response
- **Tool Calls**: Displayed as pending actions awaiting confirmation
- **Errors**: Red-highlighted with expandable details

### Tool Execution Log

The collapsible log panel shows:
- Tool name and arguments
- Execution result (truncated for readability)
- Timestamp
- Error details (if any)

### Confirmation Dialog

When the AI proposes modifying actions:
1. Tool calls are displayed with their parameters
2. User can **Confirm** to execute or **Cancel** to abort
3. Multiple tools can be executed in a single confirmation

## Error Handling

Common errors and resolutions:

| Error | Cause | Resolution |
| ----- | ----- | ---------- |
| `CONCEPT_NOT_FOUND` | Slug doesn't exist | Verify slug with `get_concept` first |
| `NODE_NOT_FOUND` | Invalid node code | Check codes with `list_curriculum` |
| `CONCEPT_ALREADY_EXISTS` | Duplicate term in section | Use unique term or different section |
| `VALIDATION_ERROR` | Invalid input format | Check field requirements |

## Example Workflows

### Creating a New Topic

```
User: "I want to add a new section about weather"

AI: I'll create a new section for weather. Based on the existing structure,
    I recommend code "LBS-11" with ordinal 11. Here's my plan:
    
    1. Create section: LBS-11 "Oro sąlygos" (Weather Conditions)
    
    Shall I proceed?

User: "Yes, and add some concepts about wind"

AI: I'll add concepts about wind to LBS-11. Creating:
    1. lbs-11-vejas - "Vėjas" (Wind basics)
    2. lbs-11-vejo-kryptis - "Vėjo kryptis" (Wind direction)
    3. lbs-11-vejo-stiprumas - "Vėjo stiprumas" (Wind strength)
    
    Please confirm.
```

### Reorganizing Content

```
User: "The boat parts section is too long. Can you help reorganize it?"

AI: [Executes list_concepts] I see LBS-1-2-1 (Korpusas) has 45 concepts.
    I suggest splitting into:
    - LBS-1-2-1A: Structural components (keel, hull parts)
    - LBS-1-2-1B: Interior spaces (cabin, galley)
    - LBS-1-2-1C: Systems (water, ventilation)
    
    Would you like me to create this structure and move the concepts?
```

### Batch Operations

```
User: "Delete all concepts with 'sample' in their name"

AI: [Executes list_concepts] Found 3 sample concepts:
    - lbs-1-1a-sample-concept
    - lbs-1-1a-sample-concept-1  
    - lbs-1-1a-sample-concept-2
    
    I'll delete all 3. Please confirm.

User: "Confirm"

AI: ✓ Deleted 3 concepts successfully.
```

## Technical Details

### Backend Architecture

```
frontend/src/routes/admin/agent/
├── +page.svelte          # Main chat UI
├── AgentChat.svelte      # Chat component
└── types.ts              # TypeScript interfaces

backend/src/
├── routes/admin/agent.ts # Express route handler
└── services/
    ├── agentService.ts   # Tool orchestration
    └── llmProvider.ts    # Gemini API wrapper
```

### API Flow

1. User sends message via `POST /admin/agent/chat`
2. Backend constructs system prompt with available tools
3. Gemini processes message and may return tool calls
4. READ tools execute immediately; others await confirmation
5. After confirmation, tools execute and results are sent back to Gemini
6. Final response is returned to the user

### Rate Limits

The agent API inherits admin rate limits:
- 30 content modifications per hour
- No limit on read operations

## Troubleshooting

### "Empty response from AI"
- Check browser console for errors
- Verify Gemini API key is configured
- Try a simpler message to test connectivity

### "Tool execution failed"
- Expand the error details in the tool log
- Verify referenced slugs/codes exist
- Check for unique constraint violations

### "Changes not visible in frontend"
- Refresh the curriculum page
- Check if ordinals were resequenced correctly
- Verify the concept has a matching curriculum_item

## Future Enhancements

- [ ] Undo/redo for recent operations
- [ ] Bulk import from structured documents
- [ ] Export conversation history
- [ ] Custom system prompts per subject
- [ ] Multi-language content generation
