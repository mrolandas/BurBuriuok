<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import { getSupabaseClient } from '$lib/supabase/client';

  type ToolLog = {
    tool: string;
    args: any;
    result: string;
    error?: string;
    timestamp: string;
  };

  type Message = {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null;
    tool_calls?: any[];
    tool_call_id?: string;
    timestamp?: Date;
    toolLogs?: ToolLog[];
    errorDetails?: {
      errorType?: string;
      stack?: string;
      code?: string;
      apiError?: any;
      details?: any;
    };
  };

  type GeminiModel = {
    id: string;
    name: string;
    description: string;
  };

  let messages: Message[] = [];
  let input = '';
  let chatLoading = false;
  let chatContainer: HTMLDivElement;
  let pendingPlan: Message | null = null;
  let testStatus: { state: 'idle' | 'loading' | 'success' | 'error'; message: string } = { state: 'idle', message: '' };
  
  // Model selection
  let availableModels: GeminiModel[] = [];
  let selectedModel = 'gemini-2.5-flash'; // Default

  onMount(async () => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/agent/models', { headers });
      if (res.ok) {
        const data = await res.json();
        availableModels = data.models;
      }
    } catch (e) {
      console.error('Failed to load models:', e);
    }
  });

  afterUpdate(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });

  async function getAuthHeaders() {
    const supabase = getSupabaseClient();
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session?.access_token}`
    };
  }

  async function sendMessage(confirmPlan = false) {
    if (!confirmPlan && (!input.trim() || chatLoading)) return;

    chatLoading = true;
    let payloadMessages = [...messages];

    if (!confirmPlan) {
      pendingPlan = null;
      const userMessage: Message = { role: 'user', content: input, timestamp: new Date() };
      messages = [...messages, userMessage];
      payloadMessages.push(userMessage);
      input = '';
    } else if (pendingPlan) {
      messages = [...messages, pendingPlan];
      payloadMessages = [...messages];
      pendingPlan = null;
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: payloadMessages,
          executionMode: 'plan',
          confirmToolCalls: confirmPlan,
          model: selectedModel
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMsg: Message = {
          role: 'system',
          content: `Error: ${err.error || 'Failed to fetch response'}`,
          timestamp: new Date(),
          errorDetails: {
            errorType: err.errorType,
            stack: err.stack,
            code: err.code,
            apiError: err.apiError,
            details: err.details
          }
        };
        messages = [...messages, errorMsg];
        chatLoading = false;
        return;
      }

      const data: Message = await res.json();
      data.timestamp = new Date();

      if (data.tool_calls) {
        pendingPlan = data;
      } else {
        messages = [...messages, data];
      }
    } catch (error: any) {
      messages = [...messages, { role: 'system', content: `Error: ${error.message}`, timestamp: new Date() }];
    } finally {
      chatLoading = false;
    }
  }

  async function executePlan() {
    if (!pendingPlan || chatLoading) return;
    chatLoading = true;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/agent/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          messages: [...messages, pendingPlan],
          executionMode: 'auto',
          confirmToolCalls: true,
          model: selectedModel
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        const errorMsg: Message = {
          role: 'system',
          content: `Error: ${err.error || 'Failed to execute plan'}`,
          timestamp: new Date(),
          errorDetails: {
            errorType: err.errorType,
            stack: err.stack,
            code: err.code,
            apiError: err.apiError,
            details: err.details
          }
        };
        messages = [...messages, errorMsg];
        pendingPlan = null;
        chatLoading = false;
        return;
      }

      const data: Message = await res.json();
      data.timestamp = new Date();
      messages = [...messages, data];
      pendingPlan = null;
    } catch (error: any) {
      messages = [...messages, { role: 'system', content: `Error: ${error.message}`, timestamp: new Date() }];
    } finally {
      chatLoading = false;
    }
  }

  function abortPlan() {
    pendingPlan = null;
  }

  function clearChat() {
    messages = [];
    pendingPlan = null;
    input = '';
  }

  async function testConnection() {
    testStatus = { state: 'loading', message: 'Testing…' };
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/v1/agent/test', {
        method: 'GET',
        headers,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Test failed');
      }

      testStatus = { state: 'success', message: 'Connected' };
    } catch (error: any) {
      testStatus = { state: 'error', message: error.message };
    }
  }

  function formatTime(date?: Date) {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
</script>

<style>
  .chat-container {
    display: flex;
    height: 100vh;
    background: #343541;
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
  }

  .sidebar {
    width: 260px;
    background: #202123;
    display: flex;
    flex-direction: column;
    border-right: 1px solid rgba(255,255,255,0.1);
  }

  .sidebar-header {
    padding: 1rem;
  }

  .new-chat-btn {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255,255,255,0.2);
    background: transparent;
    color: rgba(255,255,255,0.9);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .new-chat-btn:hover {
    background: rgba(255,255,255,0.05);
  }

  .sidebar-content {
    flex: 1;
    overflow-y: auto;
    padding: 0 0.5rem;
  }

  .sidebar-label {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.4);
    padding: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .model-selector {
    padding: 0.5rem;
    margin-top: 0.5rem;
  }

  .model-label {
    display: block;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    margin-bottom: 0.375rem;
  }

  .model-dropdown {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid rgba(255,255,255,0.2);
    background: #2a2b32;
    color: rgba(255,255,255,0.9);
    font-size: 0.875rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.5rem center;
    padding-right: 2rem;
  }

  .model-dropdown:hover {
    border-color: rgba(255,255,255,0.3);
  }

  .model-dropdown:focus {
    outline: none;
    border-color: #0d9488;
  }

  .model-dropdown option {
    background: #2a2b32;
    color: rgba(255,255,255,0.9);
  }

  .sidebar-footer {
    padding: 1rem;
    border-top: 1px solid rgba(255,255,255,0.1);
  }

  .status-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: rgba(255,255,255,0.7);
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6b7280;
  }

  .status-dot.success { background: #22c55e; }
  .status-dot.error { background: #ef4444; }
  .status-dot.loading { background: #eab308; animation: pulse 1s infinite; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .test-btn {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    background: none;
    border: none;
    cursor: pointer;
  }

  .test-btn:hover {
    color: rgba(255,255,255,0.8);
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .messages-area {
    flex: 1;
    overflow-y: auto;
    padding: 1.5rem;
  }

  .welcome-screen {
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .welcome-content {
    text-align: center;
    max-width: 32rem;
    padding: 1rem;
  }

  .welcome-emoji {
    font-size: 3rem;
    margin-bottom: 1rem;
  }

  .welcome-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    margin-bottom: 0.5rem;
  }

  .welcome-text {
    color: rgba(255,255,255,0.6);
    margin-bottom: 1.5rem;
    line-height: 1.6;
  }

  .quick-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
  }

  .quick-action-btn {
    padding: 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid rgba(255,255,255,0.1);
    background: transparent;
    color: rgba(255,255,255,0.8);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .quick-action-btn:hover {
    background: rgba(255,255,255,0.05);
  }

  .messages-list {
    max-width: 48rem;
    margin: 0 auto;
  }

  .message-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .message-row.user {
    flex-direction: row-reverse;
  }

  .avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .avatar.user { background: #2563eb; }
  .avatar.assistant { background: #0d9488; }
  .avatar.system { background: #dc2626; }
  .avatar.tool { background: #7c3aed; }

  .avatar svg {
    width: 1rem;
    height: 1rem;
    fill: white;
  }

  .message-content {
    flex: 1;
  }

  .message-row.user .message-content {
    text-align: right;
  }

  .message-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }

  .message-row.user .message-meta {
    justify-content: flex-end;
  }

  .message-role {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255,255,255,0.6);
    text-transform: uppercase;
  }

  .message-time {
    font-size: 0.625rem;
    color: rgba(255,255,255,0.3);
  }

  .message-bubble {
    display: inline-block;
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    max-width: 100%;
    text-align: left;
  }

  .message-bubble.user {
    background: #2563eb;
    color: white;
  }

  .message-bubble.assistant {
    background: #444654;
    color: rgba(255,255,255,0.9);
  }

  .message-bubble.system {
    background: rgba(127, 29, 29, 0.5);
    color: #fca5a5;
    border: 1px solid rgba(185, 28, 28, 0.5);
  }

  .message-bubble.tool {
    background: rgba(88, 28, 135, 0.5);
    color: #c4b5fd;
    border: 1px solid rgba(124, 58, 237, 0.5);
    font-family: monospace;
    font-size: 0.75rem;
  }

  .message-text {
    white-space: pre-wrap;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .message-text.empty-response {
    color: rgba(255,255,255,0.5);
    font-style: italic;
  }

  .error-details {
    margin-top: 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 0.5rem;
  }

  .error-summary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: rgba(255,255,255,0.5);
    cursor: pointer;
    user-select: none;
  }

  .error-summary:hover {
    color: rgba(255,255,255,0.7);
  }

  .error-summary svg {
    transition: transform 0.2s;
  }

  .error-details[open] .error-summary svg {
    transform: rotate(90deg);
  }

  .error-content {
    margin-top: 0.5rem;
    padding: 0.5rem;
    background: rgba(0,0,0,0.3);
    border-radius: 0.375rem;
    font-size: 0.75rem;
  }

  .error-field {
    margin-bottom: 0.5rem;
  }

  .error-field:last-child {
    margin-bottom: 0;
  }

  .error-label {
    color: rgba(255,255,255,0.6);
    font-weight: 500;
  }

  .error-pre {
    margin: 0.25rem 0 0 0;
    padding: 0.5rem;
    background: rgba(0,0,0,0.3);
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.6875rem;
    color: rgba(255,255,255,0.7);
  }

  .error-stack {
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-logs {
    margin-top: 0.75rem;
    border-top: 1px solid rgba(255,255,255,0.1);
    padding-top: 0.5rem;
  }

  .tool-logs-summary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: rgba(45, 212, 191, 0.7);
    cursor: pointer;
    user-select: none;
  }

  .tool-logs-summary:hover {
    color: rgba(45, 212, 191, 0.9);
  }

  .tool-logs-summary svg {
    transition: transform 0.2s;
  }

  .tool-logs[open] .tool-logs-summary svg {
    transform: rotate(90deg);
  }

  .tool-logs-content {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tool-log-item {
    padding: 0.5rem;
    background: rgba(0,0,0,0.25);
    border-radius: 0.375rem;
    border-left: 3px solid rgba(45, 212, 191, 0.5);
  }

  .tool-log-item.has-error {
    border-left-color: #ef4444;
  }

  .tool-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .tool-log-name {
    font-weight: 600;
    color: #2dd4bf;
    font-size: 0.75rem;
    font-family: monospace;
  }

  .tool-log-time {
    font-size: 0.625rem;
    color: rgba(255,255,255,0.4);
  }

  .tool-log-section {
    margin-top: 0.25rem;
  }

  .tool-log-label {
    font-size: 0.6875rem;
    color: rgba(255,255,255,0.5);
  }

  .tool-log-label.error-label {
    color: #f87171;
  }

  .tool-log-pre {
    margin: 0.125rem 0 0 0;
    padding: 0.375rem;
    background: rgba(0,0,0,0.3);
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.625rem;
    color: rgba(255,255,255,0.7);
    font-family: monospace;
    max-height: 150px;
    overflow-y: auto;
  }

  .tool-log-pre.error-text {
    color: #f87171;
  }

  .pending-plan {
    background: #444654;
    border-radius: 1rem;
    padding: 1rem;
    border: 1px solid rgba(255,255,255,0.1);
    margin-bottom: 1.5rem;
  }

  .plan-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .plan-title-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .plan-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #eab308;
    animation: pulse 1s infinite;
  }

  .plan-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: white;
  }

  .plan-actions {
    display: flex;
    gap: 0.5rem;
  }

  .discard-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255,255,255,0.7);
    background: none;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .discard-btn:hover {
    color: white;
    background: rgba(255,255,255,0.1);
  }

  .execute-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
    background: #16a34a;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .execute-btn:hover {
    background: #15803d;
  }

  .execute-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tool-call-item {
    background: rgba(0,0,0,0.2);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-top: 0.5rem;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .tool-call-name {
    color: #2dd4bf;
    font-weight: 700;
  }

  .tool-call-args {
    color: rgba(255,255,255,0.7);
    margin-top: 0.25rem;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .loading-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .loading-bubble {
    background: #444654;
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    display: inline-block;
  }

  .loading-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: rgba(255,255,255,0.7);
    font-size: 0.875rem;
  }

  .loading-dots {
    display: flex;
    gap: 0.25rem;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    background: rgba(255,255,255,0.5);
    border-radius: 50%;
    animation: bounce 1s infinite;
  }

  .loading-dot:nth-child(2) { animation-delay: 0.1s; }
  .loading-dot:nth-child(3) { animation-delay: 0.2s; }

  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-4px); }
  }

  .loading-text {
    color: rgba(255,255,255,0.5);
    margin-left: 0.5rem;
  }

  .spinner {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .input-area {
    border-top: 1px solid rgba(255,255,255,0.1);
    background: #343541;
    padding: 1rem;
  }

  .input-wrapper {
    max-width: 48rem;
    margin: 0 auto;
  }

  .input-box {
    display: flex;
    align-items: flex-end;
    gap: 0.75rem;
    background: #40414f;
    border-radius: 0.75rem;
    border: 1px solid rgba(255,255,255,0.1);
    padding: 0.75rem;
  }

  .input-textarea {
    flex: 1;
    background: transparent;
    color: white;
    border: none;
    outline: none;
    resize: none;
    font-size: 0.875rem;
    font-family: inherit;
    min-height: 24px;
    max-height: 200px;
  }

  .input-textarea::placeholder {
    color: rgba(255,255,255,0.4);
  }

  .input-textarea:disabled {
    opacity: 0.5;
  }

  .send-btn {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: #0d9488;
    color: white;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .send-btn:hover {
    background: #0f766e;
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .send-btn svg {
    width: 1rem;
    height: 1rem;
  }

  .disclaimer {
    font-size: 0.75rem;
    color: rgba(255,255,255,0.3);
    text-align: center;
    margin-top: 0.5rem;
  }
</style>

<div class="chat-container">
  <!-- Sidebar -->
  <div class="sidebar">
    <div class="sidebar-header">
      <button class="new-chat-btn" on:click={clearChat}>
        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        New chat
      </button>
    </div>
    <div class="sidebar-content">
      <div class="sidebar-label">Curriculum Architect</div>
      
      <!-- Model Selector -->
      <div class="model-selector">
        <label class="model-label" for="model-select">Model</label>
        <select id="model-select" class="model-dropdown" bind:value={selectedModel}>
          {#each availableModels as model}
            <option value={model.id} title={model.description}>{model.name}</option>
          {/each}
        </select>
      </div>
    </div>
    <div class="sidebar-footer">
      <div class="status-row">
        <div class="status-dot" class:success={testStatus.state === 'success'} class:error={testStatus.state === 'error'} class:loading={testStatus.state === 'loading'}></div>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          {testStatus.state === 'idle' ? 'AI Status' : testStatus.message}
        </span>
        <button class="test-btn" on:click={testConnection} disabled={testStatus.state === 'loading'}>
          Test
        </button>
      </div>
    </div>
  </div>

  <!-- Main Chat Area -->
  <div class="main-area">
    <!-- Messages -->
    <div class="messages-area" bind:this={chatContainer}>
      {#if messages.length === 0 && !pendingPlan && !chatLoading}
        <div class="welcome-screen">
          <div class="welcome-content">
            <div class="welcome-emoji">🎓</div>
            <h1 class="welcome-title">Curriculum Architect</h1>
            <p class="welcome-text">
              Chat with AI to inspect, modify, or redesign your curriculum. 
              All changes require your approval before being applied.
            </p>
            <div class="quick-actions">
              <button class="quick-action-btn" on:click={() => { input = 'Show me the current curriculum structure'; sendMessage(); }}>
                📋 Show current curriculum
              </button>
              <button class="quick-action-btn" on:click={() => { input = 'Create a new Physics section with 5 concepts'; sendMessage(); }}>
                ➕ Create new section
              </button>
            </div>
          </div>
        </div>
      {:else}
        <div class="messages-list">
          {#each messages as msg}
            <div class="message-row" class:user={msg.role === 'user'}>
              <div class="avatar" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'} class:system={msg.role === 'system'} class:tool={msg.role === 'tool'}>
                {#if msg.role === 'user'}
                  <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                {:else if msg.role === 'system'}
                  <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
                {:else}
                  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
                {/if}
              </div>
              <div class="message-content">
                <div class="message-meta">
                  <span class="message-role">{msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'AI' : msg.role}</span>
                  <span class="message-time">{formatTime(msg.timestamp)}</span>
                </div>
                <div class="message-bubble" class:user={msg.role === 'user'} class:assistant={msg.role === 'assistant'} class:system={msg.role === 'system'} class:tool={msg.role === 'tool'}>
                  {#if msg.content}
                    <div class="message-text">{msg.content}</div>
                  {:else if msg.toolLogs && msg.toolLogs.length > 0}
                    <div class="message-text empty-response">
                      <em>The AI executed tools but didn't provide a text response. This may indicate a timeout or processing issue. Check the tool logs below.</em>
                    </div>
                  {:else}
                    <div class="message-text empty-response">
                      <em>No response content.</em>
                    </div>
                  {/if}
                  
                  {#if msg.errorDetails && (msg.errorDetails.stack || msg.errorDetails.apiError || msg.errorDetails.details)}
                    <details class="error-details">
                      <summary class="error-summary">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                        Show error details
                      </summary>
                      <div class="error-content">
                        {#if msg.errorDetails.errorType}
                          <div class="error-field">
                            <span class="error-label">Type:</span> {msg.errorDetails.errorType}
                          </div>
                        {/if}
                        {#if msg.errorDetails.code}
                          <div class="error-field">
                            <span class="error-label">Code:</span> {msg.errorDetails.code}
                          </div>
                        {/if}
                        {#if msg.errorDetails.apiError}
                          <div class="error-field">
                            <span class="error-label">API Error:</span>
                            <pre class="error-pre">{JSON.stringify(msg.errorDetails.apiError, null, 2)}</pre>
                          </div>
                        {/if}
                        {#if msg.errorDetails.details}
                          <div class="error-field">
                            <span class="error-label">Details:</span>
                            <pre class="error-pre">{JSON.stringify(msg.errorDetails.details, null, 2)}</pre>
                          </div>
                        {/if}
                        {#if msg.errorDetails.stack}
                          <div class="error-field">
                            <span class="error-label">Stack Trace:</span>
                            <pre class="error-pre error-stack">{msg.errorDetails.stack}</pre>
                          </div>
                        {/if}
                      </div>
                    </details>
                  {/if}
                  
                  {#if msg.toolLogs && msg.toolLogs.length > 0}
                    <details class="tool-logs">
                      <summary class="tool-logs-summary">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                        </svg>
                        Tool execution logs ({msg.toolLogs.length})
                      </summary>
                      <div class="tool-logs-content">
                        {#each msg.toolLogs as log, i}
                          <div class="tool-log-item" class:has-error={log.error}>
                            <div class="tool-log-header">
                              <span class="tool-log-name">{log.tool}</span>
                              <span class="tool-log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                            </div>
                            {#if Object.keys(log.args).length > 0}
                              <div class="tool-log-section">
                                <span class="tool-log-label">Args:</span>
                                <pre class="tool-log-pre">{JSON.stringify(log.args, null, 2)}</pre>
                              </div>
                            {/if}
                            <div class="tool-log-section">
                              <span class="tool-log-label">Result:</span>
                              <pre class="tool-log-pre" class:error-text={log.result.startsWith('Error:')}>{log.result}</pre>
                            </div>
                            {#if log.error}
                              <div class="tool-log-section">
                                <span class="tool-log-label error-label">Error Details:</span>
                                <pre class="tool-log-pre error-stack">{log.error}</pre>
                              </div>
                            {/if}
                          </div>
                        {/each}
                      </div>
                    </details>
                  {/if}
                </div>
              </div>
            </div>
          {/each}

          <!-- Pending Plan -->
          {#if pendingPlan}
            <div class="pending-plan">
              <div class="plan-header">
                <div class="plan-title-row">
                  <div class="plan-dot"></div>
                  <span class="plan-title">Proposed Changes</span>
                </div>
                <div class="plan-actions">
                  <button class="discard-btn" on:click={abortPlan}>Discard</button>
                  <button class="execute-btn" on:click={executePlan} disabled={chatLoading}>
                    {chatLoading ? 'Executing…' : 'Execute'}
                  </button>
                </div>
              </div>
              {#each pendingPlan.tool_calls || [] as tool}
                <div class="tool-call-item">
                  <div class="tool-call-name">{tool.function.name}</div>
                  <pre class="tool-call-args">{tool.function.arguments}</pre>
                </div>
              {/each}
            </div>
          {/if}

          <!-- Loading Indicator -->
          {#if chatLoading}
            <div class="loading-row">
              <div class="avatar assistant">
                <svg class="spinner" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" opacity="0.25"></circle>
                  <path fill="currentColor" opacity="0.75" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
              <div>
                <div class="message-meta">
                  <span class="message-role">AI</span>
                </div>
                <div class="loading-bubble">
                  <div class="loading-content">
                    <div class="loading-dots">
                      <div class="loading-dot"></div>
                      <div class="loading-dot"></div>
                      <div class="loading-dot"></div>
                    </div>
                    <span class="loading-text">Thinking...</span>
                  </div>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <div class="input-wrapper">
        <div class="input-box">
          <textarea
            bind:value={input}
            disabled={chatLoading}
            class="input-textarea"
            placeholder="Message Curriculum Architect…"
            rows="1"
            on:keydown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage(false);
              }
            }}
            on:input={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 200) + 'px';
            }}
          ></textarea>
          <button
            class="send-btn"
            on:click={() => sendMessage(false)}
            disabled={chatLoading || !input.trim()}
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </div>
        <p class="disclaimer">AI can make mistakes. Review proposed changes before executing.</p>
      </div>
    </div>
  </div>
</div>
