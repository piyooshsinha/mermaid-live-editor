<script lang="ts">
  import { Toaster } from '$/components/ui/sonner/index.js';
  import { loadingState } from '$/util/loading.svelte';
  import { toggleDarkTheme } from '$/util/state.svelte';
  import { initHandler } from '$/util/util';
  import { base } from '$app/paths';
  import { mode, ModeWatcher, setMode } from 'mode-watcher';
  import { onMount, type Snippet } from 'svelte';
  import '../app.css';

  interface Props {
    children: Snippet;
  }

  let { children }: Props = $props();

  // Light is the default surface: diagrams are authored for documents and
  // slides, which are light, so the canvas should match what gets exported.
  // ModeWatcher's own `defaultMode` is applied by its pre-hydration script but
  // then overwritten when its store initialises, so the choice is made here
  // instead. A one-time marker keeps this from overriding a real user choice:
  // once the toggle has been used, that preference always wins.
  const THEME_DEFAULT_KEY = 'mermaidpp-theme-default-applied';
  onMount(() => {
    if (!localStorage.getItem(THEME_DEFAULT_KEY)) {
      localStorage.setItem(THEME_DEFAULT_KEY, '1');
      setMode('light');
    }
  });

  // This can be removed once https://github.com/sveltejs/kit/issues/1612 is fixed.
  // Then move it into src and vite will bundle it automatically.
  onMount(() => {
    window.addEventListener('hashchange', () => {
      void initHandler();
    });

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`${base}/service-worker.js`, { scope: `${base}/` })
        .then(function (registration) {
          console.log('Registration successful, scope is:', registration.scope);
        })
        .catch(function (error) {
          console.log('Service worker registration failed, error:', error);
        });
    }
  });

  $effect(() => {
    toggleDarkTheme(mode.current === 'dark');
  });
</script>

<!-- Light is the default surface: diagrams are authored for documents and
     slides, which are light, so the canvas should match what gets exported.
     `track={false}` stops the OS dark preference from overriding that default;
     the in-app theme toggle still works and still persists the user's choice. -->
<ModeWatcher defaultMode="light" track={false} />
<Toaster />

<main class="h-dvh">
  {@render children()}
</main>

{#if loadingState.loading}
  <div
    class="absolute top-0 left-0 z-50 flex h-screen w-screen justify-center bg-gray-600 align-middle opacity-50">
    <div class="my-auto text-4xl font-bold text-indigo-100">
      <div class="loader mx-auto"></div>
      <div>{loadingState.message}</div>
    </div>
  </div>
{/if}

<style>
  .loader {
    border: 0.45em solid #f3f3f3;
    border-radius: 50%;
    border-top: 0.45em solid #6365f1;
    width: 3em;
    height: 3em;
    -webkit-animation: spin 2s linear infinite; /* Safari */
    animation: spin 2s linear infinite;
  }

  /* Safari */
  @-webkit-keyframes spin {
    0% {
      -webkit-transform: rotate(0deg);
    }
    100% {
      -webkit-transform: rotate(360deg);
    }
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>
