import { GoogleGenerativeAI } from '@google/generative-ai';
import { resetContent } from '../../../data/repositories/contentRepository.ts';
import { createCurriculumNodeAdmin, createCurriculumItemAdmin, updateCurriculumItemAdmin, reorderCurriculumItemAdmin, moveCurriculumItemAdmin, deleteCurriculumItemsAdminBySlug, listAllCurriculumNodes } from '../../../data/repositories/curriculumRepository.ts';
import { listConcepts, getConceptBySlug } from '../../../data/repositories/conceptsRepository.ts';
import { getSupabaseClient } from '../../../data/supabaseClient.ts';
import { createChatCompletion, type ChatMessage } from './llmProvider.ts';

const tools = [
  {
    type: "function",
    function: {
      name: "reset_content",
      description: "Wipes all existing curriculum nodes and concepts. Use this ONLY when starting a completely new subject.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "create_curriculum_node",
      description: "Creates a new section or subsection in the curriculum.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "Unique code for the node (e.g., 'PHYS-1')" },
          title: { type: "string", description: "Title of the section" },
          summary: { type: "string", description: "Short summary" },
          level: { type: "integer", description: "1 for Section, 2 for Subsection" },
          parentCode: { type: "string", description: "Parent node code (required for level 2)" },
          ordinal: { type: "integer", description: "Order index" },
        },
        required: ["code", "title", "level", "ordinal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_concept",
      description: "Creates a new learning concept.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "URL-friendly ID" },
          term: { type: "string", description: "Main term/title" },
          description: { type: "string", description: "Markdown content" },
          curriculumNodeCode: { type: "string", description: "Code of the parent curriculum node" },
          ordinal: { type: "integer", description: "Order index" },
        },
        required: ["slug", "term", "description", "curriculumNodeCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_curriculum",
      description: "Returns the full curriculum tree with all sections and subsections (nodes). Use this to understand the structure.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_concepts",
      description: "Returns all learning concepts, optionally filtered by section or node code. Each concept belongs to a curriculum node.",
      parameters: {
        type: "object",
        properties: {
          sectionCode: { type: "string", description: "Filter by top-level section code (e.g., 'LBS-1')" },
          nodeCode: { type: "string", description: "Filter by specific curriculum node code" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_concept",
      description: "Gets detailed information about a specific concept by its slug.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The URL-friendly slug of the concept" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_concept",
      description: "Updates the content of an existing concept (term, description, etc.). Does NOT change position.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The slug of the concept to edit" },
          term: { type: "string", description: "New Lithuanian term/title" },
          termEn: { type: "string", description: "New English term/title" },
          description: { type: "string", description: "New description in Markdown" },
          descriptionEn: { type: "string", description: "New English description" },
          label: { type: "string", description: "New curriculum item label (usually same as term)" },
        },
        required: ["slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reorder_concept",
      description: "Changes the position (ordinal) of a concept within its current curriculum node/subsection.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The slug of the concept to reorder" },
          newOrdinal: { type: "integer", description: "New position (1-based index)" },
        },
        required: ["slug", "newOrdinal"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "move_concept",
      description: "Moves a concept from its current curriculum node to a different section/subsection.",
      parameters: {
        type: "object",
        properties: {
          slug: { type: "string", description: "The slug of the concept to move" },
          targetNodeCode: { type: "string", description: "The code of the destination curriculum node" },
          targetOrdinal: { type: "integer", description: "Optional position in the target node (appends at end if not specified)" },
        },
        required: ["slug", "targetNodeCode"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_concepts",
      description: "Deletes one or more concepts by their slugs. Efficiently handles batch deletions.",
      parameters: {
        type: "object",
        properties: {
          slugs: { 
            type: "array", 
            items: { type: "string" },
            description: "Array of concept slugs to delete" 
          },
        },
        required: ["slugs"],
      },
    },
  },
];

// Tools that don't modify data and can be auto-executed
const READ_ONLY_TOOLS = new Set(["list_curriculum", "list_concepts", "get_concept"]);

function isReadOnlyToolCall(toolCalls: any[]): boolean {
  return toolCalls.every(tc => READ_ONLY_TOOLS.has(tc.function?.name));
}

const systemMessage: ChatMessage = {
  role: "system",
  content: `You are an expert curriculum designer for the 'Mokslai' learning platform. 
    Your goal is to help the user design and implement a curriculum for a specific subject.
    You have access to tools to query and manipulate the curriculum database.
    
    Available tools:
    READ (auto-executed):
    - list_curriculum: Get all curriculum nodes (sections/subsections) - the structure
    - list_concepts: Get all learning concepts (optionally filtered by section or node)
    - get_concept: Get detailed info about a specific concept by slug
    
    CREATE:
    - create_curriculum_node: Create a new section or subsection
    - create_concept: Create a new learning concept
    
    EDIT:
    - edit_concept: Update a concept's term, description, or label (does NOT change position)
    - reorder_concept: Change a concept's position within its current subsection
    - move_concept: Move a concept to a different section/subsection
    
    DELETE:
    - delete_concepts: Delete one or more concepts by their slugs (supports batch deletion)
    
    DESTRUCTIVE:
    - reset_content: Wipe all data (DANGEROUS - always ask for confirmation)
    
    The curriculum has a hierarchical structure:
    - Level 1 nodes are main sections (e.g., "LBS-1", "LBS-2")
    - Level 2 nodes are subsections under a parent section (e.g., "LBS-1-1A", "LBS-1-2-1")
    - Concepts belong to nodes and contain the actual learning content
    
    Code format: All curriculum codes follow the pattern "{SUBJECT}-{SECTION}[-{SUBSECTION}]"
    - Current subject prefix: LBS (Laivo Buriuotojo Sertifikatas - sailing theory)
    - Examples: LBS-1 (main section), LBS-1-1A (subsection), LBS-10-17 (subsection under section 10)
    - Concept slugs: lowercase with subject prefix, e.g., "lbs-1-1a-jole"
    
    When answering questions about the curriculum:
    1. Use list_curriculum to see the structure
    2. Use list_concepts to see what content exists
    3. Use get_concept for detailed information about specific concepts
    
    Always ask for confirmation before running destructive actions like 'reset_content' or 'delete_concepts'.`
};

const DEFAULT_GEMINI_MODEL = 'gemini-2.5-flash';

// Available Gemini models for the UI dropdown
export const AVAILABLE_GEMINI_MODELS = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'Fast and efficient' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', description: 'Most capable' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', description: 'Previous generation' },
] as const;

function requireLLMConfig(modelOverride?: string) {
  const config = {
    provider: 'gemini' as const,
    apiKey: process.env.GOOGLE_AI_STUDIO_KEY || process.env.GEMINI_API_KEY || '',
    model: modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  };

  if (!config.apiKey) {
    throw new Error('Google AI Studio key is missing on the server. Set GOOGLE_AI_STUDIO_KEY or GEMINI_API_KEY.');
  }

  return config;
}

export async function chatWithAgent(
  messages: ChatMessage[], 
  options: { executionMode?: 'auto' | 'plan', confirmToolCalls?: boolean, model?: string } = {}
) {
  const { executionMode = 'auto', confirmToolCalls = false, model } = options;
  // Use public schema for curriculum views, burburiuok for content tables
  const publicClient = getSupabaseClient({ service: true, schema: 'public' });
  const contentClient = getSupabaseClient({ service: true, schema: 'burburiuok' });
  
  // Track tool execution logs for debugging
  const toolLogs: { tool: string; args: any; result: string; error?: string; timestamp: string }[] = [];
  
  const config = requireLLMConfig(model);

  // 1. Check if we need to resume execution (User confirmed plan)
  const lastMsg = messages[messages.length - 1];
  let resumeExecution = false;
  
  if (lastMsg && lastMsg.role === 'assistant' && lastMsg.tool_calls && confirmToolCalls) {
    resumeExecution = true;
  }

  let responseMessage: ChatMessage;
  let currentMessages = [...messages];

  if (!resumeExecution) {
    const fullMessages = [systemMessage, ...messages];
    const response = await createChatCompletion(config as any, fullMessages, tools);
    responseMessage = response.message;
    
    // If no tool calls, just return the text
    if (!responseMessage.tool_calls) {
      return responseMessage;
    }
    
    // If tool calls exist and mode is 'plan', check if they're all read-only
    if (executionMode === 'plan') {
      // Auto-execute read-only tools without confirmation
      if (isReadOnlyToolCall(responseMessage.tool_calls)) {
        currentMessages.push(responseMessage);
        // Fall through to execution loop
      } else {
        return responseMessage; // Return for confirmation
      }
    } else {
      // If auto, append and continue
      currentMessages.push(responseMessage);
    }
  } else {
    // Resuming: The last message IS the response message with tool calls
    responseMessage = lastMsg;
    // It's already in currentMessages (passed in messages)
  }

  // Execution Loop
  while (responseMessage.tool_calls) {
    // Execute tools
    for (const toolCall of responseMessage.tool_calls) {
      const functionName = (toolCall as any).function.name;
      const functionArgs = JSON.parse((toolCall as any).function.arguments);
      let functionResult;
      let toolError: string | undefined;

      console.log(`Executing tool: ${functionName}`, functionArgs);

      try {
        if (functionName === "reset_content") {
          await resetContent(contentClient);
          functionResult = "Content reset successfully.";
        } else if (functionName === "create_curriculum_node") {
          await createCurriculumNodeAdmin(functionArgs);
          functionResult = `Node ${functionArgs.code} created.`;
        } else if (functionName === "create_concept") {
          // Use createCurriculumItemAdmin which properly creates both:
          // 1. curriculum_item entry (required for frontend display)
          // 2. concept entry with all metadata
          const result = await createCurriculumItemAdmin({
            nodeCode: functionArgs.curriculumNodeCode,
            label: functionArgs.term,
            conceptSlug: functionArgs.slug,
            termLt: functionArgs.term,
            descriptionLt: functionArgs.description || 'Aprašymas bus papildytas vėliau.',
          });
          functionResult = `Concept "${result.concept.termLt}" created with slug "${result.concept.slug}" at ordinal ${result.item.ordinal}.`;
        } else if (functionName === "list_curriculum") {
          const tree = await listAllCurriculumNodes(publicClient);
          functionResult = JSON.stringify(tree);
        } else if (functionName === "list_concepts") {
          const concepts = await listConcepts(publicClient, {
            sectionCode: functionArgs.sectionCode,
            nodeCode: functionArgs.nodeCode,
          });
          // Return summary info to avoid overwhelming the LLM
          const summary = concepts.map(c => ({
            slug: c.slug,
            term: c.termLt || c.termEn,
            nodeCode: c.curriculumNodeCode,
            sectionCode: c.sectionCode,
          }));
          functionResult = JSON.stringify({ count: concepts.length, concepts: summary });
        } else if (functionName === "get_concept") {
          const concept = await getConceptBySlug(functionArgs.slug, publicClient);
          if (concept) {
            functionResult = JSON.stringify(concept);
          } else {
            functionResult = `Concept with slug '${functionArgs.slug}' not found.`;
          }
        } else if (functionName === "edit_concept") {
          const result = await updateCurriculumItemAdmin(functionArgs.slug, {
            termLt: functionArgs.term,
            termEn: functionArgs.termEn,
            descriptionLt: functionArgs.description,
            descriptionEn: functionArgs.descriptionEn,
            label: functionArgs.label,
          });
          functionResult = `Concept "${result.concept.slug}" updated. New term: "${result.concept.termLt}".`;
        } else if (functionName === "reorder_concept") {
          const result = await reorderCurriculumItemAdmin({
            slug: functionArgs.slug,
            newOrdinal: functionArgs.newOrdinal,
          });
          functionResult = `Concept "${result.concept.slug}" reordered to position ${result.item.ordinal} in node ${result.item.nodeCode}.`;
        } else if (functionName === "move_concept") {
          const result = await moveCurriculumItemAdmin({
            slug: functionArgs.slug,
            targetNodeCode: functionArgs.targetNodeCode,
            targetOrdinal: functionArgs.targetOrdinal,
          });
          functionResult = `Concept "${result.concept.slug}" moved to node ${result.item.nodeCode} at position ${result.item.ordinal}.`;
        } else if (functionName === "delete_concepts") {
          const slugs = functionArgs.slugs as string[];
          const result = await deleteCurriculumItemsAdminBySlug(slugs);
          const deletedList = result.deleted.map(d => d.termLt).join(', ');
          const failedList = result.failed.map(f => `${f.slug}: ${f.error}`).join('; ');
          functionResult = `Deleted ${result.deleted.length} concept(s): ${deletedList || 'none'}.${result.failed.length ? ` Failed: ${failedList}` : ''}`;
        } else {
          functionResult = "Unknown function";
        }
      } catch (error: any) {
        functionResult = `Error: ${error.message}`;
        toolError = error.stack || error.message;
        console.error(`Tool ${functionName} failed:`, error);
      }
      
      // Log tool execution
      toolLogs.push({
        tool: functionName,
        args: functionArgs,
        result: functionResult.substring(0, 500), // Truncate long results
        error: toolError,
        timestamp: new Date().toISOString()
      });

      currentMessages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: functionResult,
      });
    }

    // Call LLM again with results
    const response = await createChatCompletion(config as any, [systemMessage, ...currentMessages], tools);
    responseMessage = response.message;
    
    // If new tool calls appear:
    if (responseMessage.tool_calls) {
      if (executionMode === 'plan') {
        return responseMessage; // Return for another confirmation
      }
      currentMessages.push(responseMessage);
    } else {
      // Final text response - include tool logs
      return { ...responseMessage, toolLogs: toolLogs.length > 0 ? toolLogs : undefined };
    }
  }

  return { ...responseMessage, toolLogs: toolLogs.length > 0 ? toolLogs : undefined };
}

export async function testAgentConnection() {
  const config = requireLLMConfig();

  if (config.provider !== 'gemini') {
    return { ok: true };
  }

  const genAI = new GoogleGenerativeAI(config.apiKey);
  const model = genAI.getGenerativeModel({ model: config.model || DEFAULT_GEMINI_MODEL });

  await model.countTokens({
    contents: [
      {
        role: 'user',
        parts: [{ text: 'ping' }],
      },
    ],
  });

  return { ok: true };
}
