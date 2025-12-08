import OpenAI from 'openai';
import { resetContent } from '../../../data/repositories/contentRepository.ts';
import { createCurriculumNodeAdmin, listAllCurriculumNodes } from '../../../data/repositories/curriculumRepository.ts';
import { upsertConcepts } from '../../../data/repositories/conceptsRepository.ts';
import { getSupabaseClient } from '../../../data/supabaseClient.ts';

let openai: OpenAI | null = null;

function getOpenAIClient() {
  if (!openai) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set in the environment.");
    }
    openai = new OpenAI({ apiKey });
  }
  return openai;
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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
      description: "Returns the full curriculum tree.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export async function chatWithAgent(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]) {
  const supabase = getSupabaseClient({ service: true, schema: 'burburiuok' });

  // Ensure we have a system message
  const systemMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = {
    role: "system",
    content: `You are an expert curriculum designer for the 'Mokslai' learning platform. 
    Your goal is to help the user design and implement a curriculum for a specific subject.
    You have access to tools to manipulate the database directly.
    
    When asked to create a curriculum:
    1. Plan the structure first.
    2. Use 'create_curriculum_node' to build the tree.
    3. Use 'create_concept' to populate content.
    
    Always ask for confirmation before running destructive actions like 'reset_content'.`
  };

  const fullMessages = [systemMessage, ...messages];

  const client = getOpenAIClient();
  let response = await client.chat.completions.create({
    model: "gpt-4-turbo",
    messages: fullMessages,
    tools,
    tool_choice: "auto",
  });

  let responseMessage = response.choices[0].message;

  // Handle tool calls loop
  while (responseMessage.tool_calls) {
    fullMessages.push(responseMessage); // Add the assistant's message with tool calls

    for (const toolCall of responseMessage.tool_calls) {
      const functionName = (toolCall as any).function.name;
      const functionArgs = JSON.parse((toolCall as any).function.arguments);
      let functionResult;

      console.log(`Executing tool: ${functionName}`, functionArgs);

      try {
        if (functionName === "reset_content") {
          await resetContent(supabase);
          functionResult = "Content reset successfully.";
        } else if (functionName === "create_curriculum_node") {
          await createCurriculumNodeAdmin(functionArgs);
          functionResult = `Node ${functionArgs.code} created.`;
        } else if (functionName === "create_concept") {
          // upsertConcepts expects an array
          await upsertConcepts([functionArgs], supabase);
          functionResult = `Concept ${functionArgs.slug} created.`;
        } else if (functionName === "list_curriculum") {
          const tree = await listAllCurriculumNodes(supabase);
          functionResult = JSON.stringify(tree);
        } else {
          functionResult = "Unknown function";
        }
      } catch (error: any) {
        functionResult = `Error: ${error.message}`;
      }

      fullMessages.push({
        tool_call_id: toolCall.id,
        role: "tool",
        content: functionResult,
      });
    }

    // Call OpenAI again with the tool results
    response = await client.chat.completions.create({
      model: "gpt-4-turbo",
      messages: fullMessages,
      tools,
      tool_choice: "auto",
    });

    responseMessage = response.choices[0].message;
  }

  return responseMessage;
}
