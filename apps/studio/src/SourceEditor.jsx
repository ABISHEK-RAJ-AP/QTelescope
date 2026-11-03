import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { readTheme } from '@qre-theme/theme.js';
import { registerQasmLanguage, registerQreEditorThemes, resolveQreMonacoTheme } from './monacoQasm.js';

const Monaco = lazy(() => import('@monaco-editor/react').then((m) => ({ default: m.default })));

export default function SourceEditor({ value, onChange, language = 'qasm', editorTheme, height = 420, onSaveShortcut }) {
  const monacoLang = language === 'python' ? 'python' : 'qasm';
  const [theme, setTheme] = useState(() => resolveQreMonacoTheme(readTheme(), editorTheme));
  const [editorApi, setEditorApi] = useState(null);

  useEffect(() => {
    const sync = () => setTheme(resolveQreMonacoTheme(readTheme(), editorTheme));
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    window.addEventListener('qre-theme-changed', sync);
    return () => {
      obs.disconnect();
      window.removeEventListener('qre-theme-changed', sync);
    };
  }, [editorTheme]);

  useEffect(() => {
    if (editorApi) {
      editorApi.layout();
    }
  }, [height, editorApi]);

  const beforeMount = useCallback((monaco) => {
    registerQreEditorThemes(monaco);
    registerQasmLanguage(monaco);
  }, []);

  const onMount = useCallback(
    (editor, monaco) => {
      setEditorApi(editor);
      if (onSaveShortcut) {
        editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => onSaveShortcut());
      }
    },
    [onSaveShortcut],
  );

  return (
    <div className="qre-monaco-wrap">
      <Suspense
        fallback={
          <textarea
            className="qre-monaco-fallback"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            spellCheck={false}
          />
        }
      >
        <Monaco
          height={`${height}px`}
          theme={theme}
          language={monacoLang}
          value={value}
          beforeMount={beforeMount}
          onMount={onMount}
          onChange={(v) => onChange(v ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            renderLineHighlight: 'line',
            smoothScrolling: true,
            bracketPairColorization: { enabled: true },
            folding: true,
            scrollbars: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
          }}
        />
      </Suspense>
    </div>
  );
}
