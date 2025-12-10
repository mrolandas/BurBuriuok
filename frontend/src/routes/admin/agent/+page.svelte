<script lang="ts">
  import { afterUpdate, onMount, tick } from 'svelte';
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
  let inputTextarea: HTMLTextAreaElement;
  let pendingPlan: Message | null = null;
  let testStatus: { state: 'idle' | 'loading' | 'success' | 'error'; message: string } = { state: 'idle', message: '' };
  
  // Model selection
  let availableModels: GeminiModel[] = [];
  let selectedModel = 'gemini-2.5-flash'; // Default
  let previousModel = ''; // Track for change detection

  onMount(async () => {
    // Hide the admin status bar for this page
    const statusEl = document.querySelector('.admin-shell__status');
    if (statusEl) (statusEl as HTMLElement).style.display = 'none';
    
    // Focus input on mount
    await tick();
    inputTextarea?.focus();
    
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
    
    // Auto-test connection on mount
    previousModel = selectedModel;
    testConnection();
  });

  // Auto-test when model actually changes (not on initial load)
  $: if (selectedModel && previousModel && selectedModel !== previousModel) {
    previousModel = selectedModel;
    testConnection();
  }

  afterUpdate(() => {
    if (chatContainer) {
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
  });

  async function focusInput() {
    await tick();
    inputTextarea?.focus();
  }

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
      focusInput();
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
      focusInput();
    }
  }

  function abortPlan() {
    pendingPlan = null;
    focusInput();
  }

  function clearChat() {
    messages = [];
    pendingPlan = null;
    input = '';
    focusInput();
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
    position: fixed;
    top: 4.5rem; /* app header height */
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    flex-direction: column;
    background: var(--color-bg);
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    z-index: 10;
  }

  .main-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
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
    color: var(--color-text);
    margin-bottom: 0.5rem;
  }

  .welcome-text {
    color: var(--color-text-muted);
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
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 0.875rem;
    text-align: left;
    cursor: pointer;
    transition: background 0.2s;
  }

  .quick-action-btn:hover {
    background: var(--color-surface-alt);
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

  .avatar.user { background: var(--color-accent); }
  .avatar.assistant { background: var(--color-accent-strong); }
  .avatar.system { background: var(--color-status-error-text); }
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
    color: var(--color-text-muted);
    text-transform: uppercase;
  }

  .message-time {
    font-size: 0.625rem;
    color: var(--color-text-soft);
  }

  .message-bubble {
    display: inline-block;
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    max-width: 100%;
    text-align: left;
  }

  .message-bubble.user {
    background: var(--color-accent);
    color: white;
  }

  .message-bubble.assistant {
    background: var(--color-panel);
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .message-bubble.system {
    background: var(--color-status-error-bg);
    color: var(--color-status-error-text);
    border: 1px solid var(--color-status-error-border);
  }

  .message-bubble.tool {
    background: var(--color-accent-faint);
    color: var(--color-text);
    border: 1px solid var(--color-accent-border);
    font-family: monospace;
    font-size: 0.75rem;
  }

  .message-text {
    white-space: pre-wrap;
    font-size: 0.875rem;
    line-height: 1.6;
  }

  .message-text.empty-response {
    color: var(--color-text-muted);
    font-style: italic;
  }

  .error-details {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    padding-top: 0.5rem;
  }

  .error-summary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
  }

  .error-summary:hover {
    color: var(--color-text);
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
    background: var(--color-surface-alt);
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
    color: var(--color-text-muted);
    font-weight: 500;
  }

  .error-pre {
    margin: 0.25rem 0 0 0;
    padding: 0.5rem;
    background: var(--color-surface);
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.6875rem;
    color: var(--color-text);
    border: 1px solid var(--color-border);
  }

  .error-stack {
    max-height: 200px;
    overflow-y: auto;
  }

  .tool-logs {
    margin-top: 0.75rem;
    border-top: 1px solid var(--color-border);
    padding-top: 0.5rem;
  }

  .tool-logs-summary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-accent);
    cursor: pointer;
    user-select: none;
  }

  .tool-logs-summary:hover {
    color: var(--color-accent-strong);
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
    background: var(--color-surface-alt);
    border-radius: 0.375rem;
    border-left: 3px solid var(--color-accent);
  }

  .tool-log-item.has-error {
    border-left-color: var(--color-status-error-text);
  }

  .tool-log-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.25rem;
  }

  .tool-log-name {
    font-weight: 600;
    color: var(--color-accent);
    font-size: 0.75rem;
    font-family: monospace;
  }

  .tool-log-time {
    font-size: 0.625rem;
    color: var(--color-text-soft);
  }

  .tool-log-section {
    margin-top: 0.25rem;
  }

  .tool-log-label {
    font-size: 0.6875rem;
    color: var(--color-text-muted);
  }

  .tool-log-label.error-label {
    color: var(--color-status-error-text);
  }

  .tool-log-pre {
    margin: 0.125rem 0 0 0;
    padding: 0.375rem;
    background: var(--color-surface);
    border-radius: 0.25rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
    font-size: 0.625rem;
    color: var(--color-text);
    font-family: monospace;
    max-height: 150px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
  }

  .tool-log-pre.error-text {
    color: var(--color-status-error-text);
  }

  .pending-plan {
    background: var(--color-panel);
    border-radius: 1rem;
    padding: 1rem;
    border: 1px solid var(--color-border);
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
    color: var(--color-text);
  }

  .plan-actions {
    display: flex;
    gap: 0.5rem;
  }

  .discard-btn {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    background: none;
    border: none;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .discard-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-alt);
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
    background: var(--color-surface-alt);
    border-radius: 0.5rem;
    padding: 0.75rem;
    margin-top: 0.5rem;
    font-family: monospace;
    font-size: 0.75rem;
  }

  .tool-call-name {
    color: var(--color-accent);
    font-weight: 700;
  }

  .tool-call-args {
    color: var(--color-text);
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
    background: var(--color-panel);
    border-radius: 1rem;
    padding: 0.75rem 1rem;
    display: inline-block;
    border: 1px solid var(--color-border);
  }

  .loading-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: var(--color-text-muted);
    font-size: 0.875rem;
  }

  .loading-dots {
    display: flex;
    gap: 0.25rem;
  }

  .loading-dot {
    width: 8px;
    height: 8px;
    background: var(--color-accent);
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
    color: var(--color-text-muted);
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
    border-top: 1px solid var(--color-border);
    background: var(--color-panel);
    padding: 0.75rem 1rem;
  }

  .input-wrapper {
    max-width: 48rem;
    margin: 0 auto;
  }

  .input-box {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: var(--color-surface);
    border-radius: 0.5rem;
    border: 1px solid var(--color-border);
    padding: 0.5rem 0.75rem;
  }

  .input-textarea {
    flex: 1;
    background: transparent;
    color: var(--color-text);
    border: none;
    outline: none;
    resize: none;
    font-size: 0.875rem;
    font-family: inherit;
    line-height: 1.4;
    min-height: 20px;
    max-height: 120px;
    padding: 0;
  }

  .input-textarea::placeholder {
    color: var(--color-text-muted);
  }

  .input-textarea:disabled {
    opacity: 0.5;
  }

  .send-btn {
    padding: 0.375rem;
    border-radius: 0.375rem;
    background: var(--color-accent);
    color: white;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
    flex-shrink: 0;
  }

  .send-btn:hover {
    background: var(--color-accent-strong);
  }

  .send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .send-btn svg {
    width: 1rem;
    height: 1rem;
    display: block;
  }

  /* Footer bar - replaces sidebar */
  .chat-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.5rem 1rem;
    background: var(--color-panel);
    border-top: 1px solid var(--color-border);
    font-size: 0.75rem;
  }

  .footer-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .footer-right {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .new-chat-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 0.75rem;
    cursor: pointer;
    transition: background 0.2s;
  }

  .new-chat-btn:hover {
    background: var(--color-surface-alt);
  }

  .new-chat-btn svg {
    width: 12px;
    height: 12px;
  }

  .model-dropdown {
    padding: 0.375rem 0.5rem;
    padding-right: 1.5rem;
    border-radius: 0.375rem;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    color: var(--color-text);
    font-size: 0.75rem;
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' fill='%23999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10l-5 5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.375rem center;
  }

  .model-dropdown:hover {
    border-color: var(--color-border-strong);
  }

  .model-dropdown:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .model-dropdown option {
    background: var(--color-surface);
    color: var(--color-text);
  }

  .status-indicator {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    color: var(--color-text-muted);
    font-size: 0.75rem;
  }

  .status-indicator span {
    min-width: 0;
    white-space: nowrap;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-text-muted);
    flex-shrink: 0;
  }

  .status-dot.success { background: #22c55e; }
  .status-dot.error { background: #ef4444; }
  .status-dot.loading { background: #eab308; animation: pulse 1s infinite; }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .refresh-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    border-radius: 0.25rem;
    transition: color 0.2s, background 0.2s;
  }

  .refresh-btn:hover {
    color: var(--color-text);
    background: var(--color-surface-alt);
  }

  .refresh-btn:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .refresh-btn svg {
    width: 12px;
    height: 12px;
  }

  .refresh-btn svg.spinning {
    animation: spin 1s linear infinite;
  }

  .disclaimer {
    font-size: 0.6875rem;
    color: var(--color-text-soft);
    text-align: center;
  }
</style>

<div class="chat-container">
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
              <button class="quick-action-btn" on:click={() => { input = 'What can you help me with?'; sendMessage(); }}>
                💡 What can you help me with?
              </button>
              <button class="quick-action-btn" on:click={() => { input = 'Help me plan curriculum changes'; sendMessage(); }}>
                📝 Help me plan changes
              </button>
              <button class="quick-action-btn" on:click={() => { input = 'Which sections need more content?'; sendMessage(); }}>
                🔍 Which sections need attention?
              </button>
              <button class="quick-action-btn" on:click={() => { input = 'Give me an overview of the curriculum structure'; sendMessage(); }}>
                🗂️ Curriculum overview
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
            bind:this={inputTextarea}
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
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          ></textarea>
          <button
            class="send-btn"
            on:click={() => sendMessage(false)}
            disabled={chatLoading || !input.trim()}
            aria-label="Send message"
          >
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Footer Bar -->
  <div class="chat-footer">
    <div class="footer-left">
      <button class="new-chat-btn" on:click={clearChat}>
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
        </svg>
        New
      </button>
      <select class="model-dropdown" bind:value={selectedModel}>
        {#each availableModels as model}
          <option value={model.id} title={model.description}>{model.name}</option>
        {/each}
      </select>
    </div>
    <div class="disclaimer">AI can make mistakes. Review proposed changes before executing.</div>
    <div class="footer-right">
      <div class="status-indicator">
        <div class="status-dot" class:success={testStatus.state === 'success'} class:error={testStatus.state === 'error'} class:loading={testStatus.state === 'loading'}></div>
        <span>{testStatus.state === 'loading' ? 'Testing…' : testStatus.state === 'success' ? 'Connected' : testStatus.state === 'error' ? testStatus.message : ''}</span>
        <button class="refresh-btn" on:click={testConnection} disabled={testStatus.state === 'loading'} aria-label="Re-test connection">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" class:spinning={testStatus.state === 'loading'}>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
          </svg>
        </button>
      </div>
    </div>
  </div>
</div>
