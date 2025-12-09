import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type LLMProviderType = 'openai' | 'gemini' | 'openrouter';

export interface LLMConfig {
  provider: LLMProviderType;
  apiKey: string;
  model?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
  toolLogs?: { tool: string; args: any; result: string; error?: string; timestamp: string }[];
}

export interface LLMResponse {
  message: ChatMessage;
}

export async function createChatCompletion(
  config: LLMConfig,
  messages: ChatMessage[],
  tools?: any[]
): Promise<LLMResponse> {
  if (config.provider === 'openai' || config.provider === 'openrouter') {
    const baseURL = config.provider === 'openrouter' ? 'https://openrouter.ai/api/v1' : undefined;
    const openai = new OpenAI({ apiKey: config.apiKey, baseURL });
    
    // Default models
    let model = config.model;
    if (!model) {
      model = config.provider === 'openrouter' ? 'openai/gpt-4-turbo' : 'gpt-4-turbo';
    }

    const response = await openai.chat.completions.create({
      model,
      messages: messages as any,
      tools: tools as any,
      tool_choice: tools ? 'auto' : undefined,
    });

    return { message: response.choices[0].message as ChatMessage };
  } 
  
  if (config.provider === 'gemini') {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    const modelName = config.model || 'gemini-3-pro-preview';

    const systemMessage = messages.find(m => m.role === 'system');
    const nonSystemMessages = messages.filter(m => m.role !== 'system');

    // Build lookup for tool_call_id -> function name to map tool responses
    const toolCallNameById: Record<string, string> = {};
    nonSystemMessages.forEach((m) => {
      if (m.role === 'assistant' && m.tool_calls) {
        m.tool_calls.forEach((tool, idx) => {
          const id = tool.id || `toolcall_${idx}`;
          const name = tool.function?.name;
          if (id && name) {
            toolCallNameById[id] = name;
          }
        });
      }
    });

    // Map tools to Gemini declarations
    const geminiTools = tools ? [{
      functionDeclarations: tools.map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }))
    }] : undefined;

    const contents = nonSystemMessages.map((m) => {
      if (m.role === 'user') {
        return { role: 'user', parts: [{ text: m.content || '' }] };
      }

      if (m.role === 'assistant') {
        const parts: any[] = [];
        if (m.content) {
          parts.push({ text: m.content });
        }
        if (m.tool_calls) {
          m.tool_calls.forEach((tool) => {
            const args = (() => {
              try {
                return JSON.parse(tool.function?.arguments || '{}');
              } catch (e) {
                return {} as Record<string, unknown>;
              }
            })();
            parts.push({
              functionCall: {
                name: tool.function?.name,
                args,
              },
            });
          });
        }
        return { role: 'model', parts };
      }

      if (m.role === 'tool') {
        const toolName = m.tool_call_id ? toolCallNameById[m.tool_call_id] : undefined;
        return {
          role: 'function',
          parts: [{
            functionResponse: {
              name: toolName || 'function_response',
              response: { result: m.content || '' },
            },
          }],
        };
      }

      return { role: 'user', parts: [{ text: m.content || '' }] };
    });

    const model = genAI.getGenerativeModel({
      model: modelName,
      tools: geminiTools,
      systemInstruction: systemMessage
        ? { role: 'system', parts: [{ text: systemMessage.content || '' }] }
        : undefined,
    });

    const result = await model.generateContent({
      contents,
      tools: geminiTools,
    });

    const candidate = result?.response?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    const textParts: string[] = [];
    const toolCalls: any[] = [];

    parts.forEach((part: any, index: number) => {
      if (part.text) {
        textParts.push(part.text);
      }
      if (part.functionCall) {
        toolCalls.push({
          id: `toolcall_${index}`,
          type: 'function',
          function: {
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args || {}),
          },
        });
      }
    });

    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: textParts.length ? textParts.join('\n').trim() : null,
    };

    if (toolCalls.length) {
      assistantMessage.tool_calls = toolCalls as any;
    }

    return { message: assistantMessage };
  }
  
  throw new Error(`Provider ${config.provider} not supported`);
}
