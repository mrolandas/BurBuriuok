<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { createEventDispatcher } from 'svelte';

  export let isOpen = false;
  export let provider: 'openai' | 'gemini' | 'openrouter' = 'openai';

  const dispatch = createEventDispatcher();

  function close() {
    dispatch('close');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && isOpen) {
      close();
    }
  }

  const instructions = {
    openai: {
      title: 'Get Your OpenAI API Key',
      description: 'Standard choice for reliable reasoning and tool use.',
      steps: [
        'Go to https://platform.openai.com/api-keys',
        'Sign in or create an OpenAI account',
        'Click "Create new secret key"',
        'Copy the key and paste it above',
        'Note: The key will only be visible once. Save it securely.'
      ],
      link: 'https://platform.openai.com/api-keys',
      linkText: 'Open OpenAI API Keys'
    },
    gemini: {
      title: 'Get Your Google Gemini API Key',
      description: 'Fast processing with large context window.',
      steps: [
        'Go to https://aistudio.google.com/app/apikey',
        'Sign in with your Google account',
        'Click "Create API Key"',
        'Select a Google Cloud project (or create a new one)',
        'Copy the key and paste it above'
      ],
      link: 'https://aistudio.google.com/app/apikey',
      linkText: 'Open Google AI Studio'
    },
    openrouter: {
      title: 'Get Your OpenRouter API Key',
      description: 'Access to Claude, Llama, Mistral, and many others.',
      steps: [
        'Go to https://openrouter.ai/keys',
        'Sign up or sign in',
        'Your API key will be displayed in the dashboard',
        'Copy the key and paste it above',
        'Keep your key private and secure'
      ],
      link: 'https://openrouter.ai/keys',
      linkText: 'Open OpenRouter Dashboard'
    }
  };

  $: currentInstructions = instructions[provider];
</script>

<svelte:window on:keydown={handleKeydown} />

{#if isOpen}
  <div 
    class="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
    transition:fade={{ duration: 200 }}
    on:click|self={close}
    role="presentation"
  >
    <div 
      class="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden"
      transition:scale={{ duration: 200, start: 0.95 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <!-- Header -->
      <div class="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gradient-to-r from-blue-50 to-blue-100">
        <h2 id="modal-title" class="text-lg font-bold text-gray-900">{currentInstructions.title}</h2>
        <button 
          on:click={close}
          class="text-gray-400 hover:text-gray-600 transition-colors text-2xl leading-none"
          aria-label="Close"
        >
          &times;
        </button>
      </div>
      
      <!-- Content -->
      <div class="p-6 space-y-4">
        <p class="text-sm text-gray-600">{currentInstructions.description}</p>
        
        <div class="space-y-2">
          <h3 class="text-sm font-bold text-gray-900">Steps:</h3>
          <ol class="space-y-2">
            {#each currentInstructions.steps as step, i}
              <li class="flex gap-3">
                <span class="text-xs font-bold text-blue-600 min-w-6">{i + 1}.</span>
                <span class="text-sm text-gray-700">{step}</span>
              </li>
            {/each}
          </ol>
        </div>

        <a 
          href={currentInstructions.link}
          target="_blank" 
          rel="noopener noreferrer"
          class="block w-full px-4 py-2.5 bg-blue-600 text-white text-center rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors mt-4"
        >
          {currentInstructions.linkText} →
        </a>
      </div>
    </div>
  </div>
{/if}
