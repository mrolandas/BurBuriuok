<script lang="ts">
  import { onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

  // Initialize Supabase client locally if not available via store
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

  let messages: { role: string; content: string }[] = [];
  let input = '';
  let loading = false;

  async function sendMessage() {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    messages = [...messages, userMessage];
    input = '';
    loading = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      // Assuming backend is on port 3000. In production this should be configured.
      const response = await fetch('http://localhost:3000/api/v1/agent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messages }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch response');
      }

      const data = await response.json();
      messages = [...messages, data];
    } catch (error: any) {
      console.error(error);
      messages = [...messages, { role: 'system', content: 'Error: ' + error.message }];
    } finally {
      loading = false;
    }
  }
</script>

<div class="container mx-auto p-4 max-w-4xl">
  <h1 class="text-2xl font-bold mb-4">AI Agent Workspace</h1>
  
  <div class="bg-white rounded-lg shadow p-4 h-[600px] flex flex-col">
    <div class="flex-1 overflow-y-auto mb-4 space-y-4 p-2 border rounded bg-gray-50">
      {#if messages.length === 0}
        <div class="text-center text-gray-500 mt-10">
          <p>Start a conversation with the AI Agent to manage the curriculum.</p>
          <p class="text-sm mt-2">Try: "Create a new section for Meteorology"</p>
        </div>
      {/if}
      {#each messages as msg}
        <div class={`p-3 rounded-lg ${msg.role === 'user' ? 'bg-blue-100 ml-auto max-w-[80%]' : 'bg-white border mr-auto max-w-[80%]'}`}>
          <div class="font-bold text-xs mb-1 text-gray-600">{msg.role.toUpperCase()}</div>
          <div class="whitespace-pre-wrap text-sm">{msg.content}</div>
        </div>
      {/each}
      {#if loading}
        <div class="text-gray-500 italic text-sm ml-2">Agent is thinking...</div>
      {/if}
    </div>

    <div class="flex gap-2">
      <textarea
        bind:value={input}
        class="flex-1 border rounded p-2 focus:ring-2 focus:ring-blue-500 outline-none"
        placeholder="Describe the curriculum changes you want..."
        rows="3"
        on:keydown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
      ></textarea>
      <button
        on:click={sendMessage}
        disabled={loading}
        class="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700 disabled:opacity-50 font-medium"
      >
        Send
      </button>
    </div>
  </div>
</div>
