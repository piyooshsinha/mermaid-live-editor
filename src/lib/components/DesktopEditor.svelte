<script lang="ts">
  import { selectedLines } from '$/canvas/interaction.svelte';
  import type { EditorProps } from '$/types';
  import { env } from '$/util/env';
  import { urls, validatedState } from '$/util/state.svelte';
  import { logMermaidChartClick } from '$/util/stats';
  import { AIPromptViewZoneManager } from '$lib/util/AIPromptViewZoneManager';
  import { initEditor } from '$lib/util/monacoExtra';
  import { errorDebug } from '$lib/util/util';
  import { mode } from 'mode-watcher';
  import * as monaco from 'monaco-editor';
  import monacoEditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
  import monacoJsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
  import { onMount } from 'svelte';
  import AIPromptPopup from './AIPromptPopup.svelte';

  const { onUpdate }: EditorProps = $props();

  let divElement: HTMLDivElement | undefined = $state();
  let aiPromptPopupElement: HTMLDivElement | undefined = $state();
  let editor: monaco.editor.IStandaloneCodeEditor | undefined;
  let editorOptions = {
    minimap: {
      enabled: false
    },
    overviewRulerLanes: 0,
    glyphMargin: true,
    lineNumbersMinChars: 4
  } satisfies monaco.editor.IStandaloneEditorConstructionOptions;
  let currentText = '';
  let isUpdatingFromState = false;
  let showPopup = $state(false);
  let popupPosition = $state({ top: 0, lineNumber: 0 });
  let decorationsCollection: monaco.editor.IEditorDecorationsCollection | undefined;
  /**
   * Separate from `decorationsCollection` so canvas selection and the existing
   * gutter decorations can never clobber one another.
   */
  let selectionDecorations: monaco.editor.IEditorDecorationsCollection | undefined;
  let input = $state('');
  let lastMouseLine = 0;
  const aiPromptManager = new AIPromptViewZoneManager();

  const applyEditorTheme = (currentMode: typeof mode.current) => {
    if (!editor) return;
    monaco.editor.setTheme(`mermaid${currentMode === 'dark' ? '-dark' : ''}`);
    divElement?.classList.toggle('mermaid-dark', currentMode === 'dark');
  };

  $effect(() => {
    applyEditorTheme(mode.current);
  });

  const jsonModel = monaco.editor.createModel(
    '',
    'json',
    monaco.Uri.parse('internal://config.json')
  );
  const mermaidModel = monaco.editor.createModel(
    '',
    'mermaid',
    monaco.Uri.parse('internal://mermaid.mmd')
  );

  const renderAIPromptGutterGlyphIcon = () => {
    decorationsCollection?.clear();
    if (!editor || showPopup) {
      return;
    }
    const model = editor.getModel();
    if (!model) {
      return;
    }

    if (lastMouseLine > 0 && model.id === mermaidModel.id) {
      decorationsCollection?.set([
        {
          range: new monaco.Range(lastMouseLine, 1, lastMouseLine, 1),
          options: {
            glyphMarginClassName: 'suggestion-icon'
          }
        }
      ]);
    }
  };

  const closePopup = () => {
    showPopup = false;
    input = '';
    aiPromptManager.hide();
    renderAIPromptGutterGlyphIcon();
  };

  const toggleAIPopup = (lineNumber: number) => {
    if (!divElement || !aiPromptPopupElement) return;
    popupPosition = {
      top: 0,
      lineNumber
    };
    showPopup = !showPopup;
    if (showPopup) {
      aiPromptManager.show(popupPosition.lineNumber, aiPromptPopupElement, 100);
      editor?.setSelection(new monaco.Range(0, 0, 0, 0));
    } else {
      aiPromptManager.hide();
    }
    renderAIPromptGutterGlyphIcon();
  };

  onMount(() => {
    self.MonacoEnvironment = {
      getWorker(_, label) {
        if (label === 'json') {
          return new monacoJsonWorker();
        }
        return new monacoEditorWorker();
      }
    };

    if (!divElement) {
      throw new Error('divEl is undefined');
    }

    monaco.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      enableSchemaRequest: true,
      schemas: [
        {
          fileMatch: ['config.json'],
          uri: `${env.docsUrl}/schemas/config.schema.json`
        }
      ]
    });

    initEditor(monaco);
    errorDebug();
    editor = monaco.editor.create(divElement, editorOptions);
    aiPromptManager.setEditor(editor);
    decorationsCollection = editor.createDecorationsCollection([]);
    selectionDecorations = editor.createDecorationsCollection([]);

    editor.onMouseDown((e) => {
      const isGutter = e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN;
      if (isGutter && e.target.position?.lineNumber === lastMouseLine && lastMouseLine > 0) {
        e.event.preventDefault();
        e.event.stopPropagation();
        toggleAIPopup(e.target.position.lineNumber);
      }
    });

    editor.onDidChangeModelContent(({ isFlush }) => {
      const newText = editor?.getValue();
      if (!newText || currentText === newText || isFlush || isUpdatingFromState) {
        return;
      }
      currentText = newText;
      onUpdate(currentText);
    });

    editor.onMouseMove((e) => {
      if (!editor) return;
      if (showPopup) return;
      if (editor.getModel()?.id !== mermaidModel.id) return;

      lastMouseLine = e.target.position?.lineNumber ?? 0;
      renderAIPromptGutterGlyphIcon();
    });

    editor.onMouseLeave(() => {
      lastMouseLine = 0;
      renderAIPromptGutterGlyphIcon();
    });

    applyEditorTheme(mode.current);

    const resizeObserver = new ResizeObserver((entries) => {
      editor?.layout({
        height: entries[0].contentRect.height,
        width: entries[0].contentRect.width
      });
    });

    if (divElement.parentElement) {
      resizeObserver.observe(divElement);
    }

    renderAIPromptGutterGlyphIcon();

    return () => {
      resizeObserver.disconnect();
      jsonModel.dispose();
      mermaidModel.dispose();
      aiPromptManager.destroy();
      editor?.dispose();
    };
  });

  $effect(() => {
    const { errorMarkers, editorMode, code, mermaid } = validatedState.current;
    if (!editor) {
      return;
    }

    const model = editorMode === 'code' ? mermaidModel : jsonModel;

    if (editor.getModel()?.id !== model.id) {
      editor.setModel(model);
      renderAIPromptGutterGlyphIcon();
    }

    // Clear decorations if not in 'code' mode, or if the model changes
    if (editorMode !== 'code' || editor.getModel()?.id !== mermaidModel.id) {
      decorationsCollection?.clear();
    }

    // Update editor text if it's different
    const newText = editorMode === 'code' ? code : mermaid;
    if (newText !== currentText) {
      isUpdatingFromState = true;
      try {
        editor.setScrollTop(0);
        editor.pushUndoStop();
        editor.executeEdits('updateCode', [
          {
            range: model.getFullModelRange(),
            text: newText
          }
        ]);
        editor.pushUndoStop();
        currentText = newText;
      } finally {
        isUpdatingFromState = false;
      }
      renderAIPromptGutterGlyphIcon();
    }

    // Display/clear errors
    monaco.editor.setModelMarkers(model, 'mermaid', errorMarkers);
  });

  /**
   * Highlights the source lines behind the current canvas selection, and
   * scrolls the first of them into view so clicking a node off-screen in the
   * code still shows you where it lives.
   */
  $effect(() => {
    const lines = selectedLines.current;
    if (!editor || !selectionDecorations) {
      return;
    }
    const model = editor.getModel();
    if (!model || model.id !== mermaidModel.id) {
      selectionDecorations.clear();
      return;
    }
    if (lines.length === 0) {
      selectionDecorations.clear();
      return;
    }
    const lineCount = model.getLineCount();
    const valid = lines.filter((line) => line >= 1 && line <= lineCount);
    selectionDecorations.set(
      valid.map((line) => ({
        options: {
          className: 'canvas-selected-line',
          isWholeLine: true,
          overviewRuler: {
            color: '#2563eb',
            position: monaco.editor.OverviewRulerLane.Left
          }
        },
        range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line))
      }))
    );
    if (valid.length > 0) {
      editor.revealLineInCenterIfOutsideViewport(valid[0]);
    }
  });
</script>

<div class="relative h-full grow overflow-hidden">
  <div bind:this={divElement} id="editor" class="h-full w-full"></div>
  <div bind:this={aiPromptPopupElement}>
    <AIPromptPopup
      show={showPopup}
      bind:input
      onHeightChange={(height) => aiPromptManager.updateHeight(height)}
      onClose={closePopup}
      onTryFree={() => {
        logMermaidChartClick('vibeDiagramming');
        window.open(
          urls.current.mermaidChart({ medium: 'vibe_diagramming' }).save,
          '_blank',
          'noopener'
        );
        closePopup();
      }} />
  </div>
</div>

<style>
  :global(.suggestion-icon) {
    background-color: #e8eaf9;
    width: 20px !important;
    height: 20px !important;
    margin-left: 4px;
    background-image: url('/icons/use-chat.svg');
    background-size: 16px 16px;
    background-repeat: no-repeat;
    background-position: center;
    border-radius: 4px;
    cursor: pointer;
  }

  :global(#editor.mermaid-dark .suggestion-icon) {
    background-color: #2e4d6b;
    background-image: url('/icons/use-chat-dark.svg');
  }

  /* Lines behind the current canvas selection. Tinted rather than boxed so it
     reads as a highlight and not as a text selection. */
  :global(.canvas-selected-line) {
    background-color: rgb(37 99 235 / 12%);
    border-left: 2px solid #2563eb;
  }

  :global(#editor.mermaid-dark .canvas-selected-line) {
    background-color: rgb(96 165 250 / 18%);
    border-left-color: #60a5fa;
  }
</style>
