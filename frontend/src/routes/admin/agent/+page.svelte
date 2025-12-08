<script lang="ts">
  import { onMount } from 'svelte';
  import { createClient } from '@supabase/supabase-js';
  import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY } from '$env/static/public';

  // Initialize Supabase client locally if not available via store
  const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY);

  let messages: { role: string; content: string }[] = [];
  let input = '';
  let loading = false;
  
  let showSettings = false;
  let apiKey = '';
  let apiKeyStatus = { isSet: false, masked: null as string | null };

  onMount(() => {
    fetchApiKeyStatus();
  });

  async function fetchApiKeyStatus() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('http://localhost:3000/api/v1/admin/settings/api-key', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const json = await response.json();
        apiKeyStatus = json.data;
      }
    } catch (e) {
      console.error("Failed to fetch API key status", e);
    }
  }

  async function saveApiKey() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const response = await fetch('http://localhost:3000/api/v1/admin/settings/api-key', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ key: apiKey }),
      });
      
      if (response.ok) {
        apiKey = '';
        await fetchApiKeyStatus();
        alert('API Key saved successfully');
      } else {
        alert('Failed to save API Key');
      }
    } catch (e) {
      console.error("Failed to save API key", e);
      alert('Error saving API Key');
    }
  }

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
  <div class="flex justify-between items-center mb-4">
    <h1 class="text-2xl font-bold">AI Agent Workspace</h1>
    <button on:click={() => showSettings = !showSettings} class="text-sm text-blue-600 hover:underline">
      {showSettings ? 'Hide Settings' : 'Settings'}
    </button>
  </div>

  {#if showSettings}
    <div class="bg-gray-100 p-4 rounded mb-4 border">
      <h2 class="font-bold mb-2 text-sm uppercase text-gray-600">Configuration</h2>
      <div class="flex gap-2 items-end">
        <div class="flex-1">
          <label class="block text-xs font-bold text-gray-700 mb-1">OpenAI API Key</label>
          <input 
            type="password" 
            bind:value={apiKey} 
            class="w-full border rounded p-2 text-sm" 
            placeholder={apiKeyStatus.isSet ? 'Key is set (hidden)' : 'sk-...'} 
          />
        </div>
        <button on:click={saveApiKey} class="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-700">
          Save Key
        </button>
      </div>
      {#if apiKeyStatus.isSet}
        <p class="text-xs text-green-600 mt-2 flex items-center gap-1">
          <span class="font-bold">✓</span> API Key is currently set ({apiKeyStatus.masked})
        </p>
      {:else}
        <p class="text-xs text-red-600 mt-2 flex items-center gap-1">
          <span class="font-bold">⚠</span> API Key is missing. The agent will not work.
        </p>
      {/if}
    </div>
  {/if}
  
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
