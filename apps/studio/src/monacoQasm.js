/** Minimal OpenQASM / QASM2 highlighting for Monaco. */
export function registerQasmLanguage(monaco) {
  const langs = monaco.languages.getLanguages();
  if (langs.some((l) => l.id === 'qasm')) return;

  monaco.languages.register({
    id: 'qasm',
    extensions: ['.qasm', '.qasm2', '.qasm3'],
    aliases: ['OpenQASM', 'QASM', 'qasm'],
  });

  monaco.languages.setMonarchTokensProvider('qasm', {
    defaultToken: '',
    ignoreCase: false,
    keywords: [
      'OPENQASM',
      'include',
      'creg',
      'qreg',
      'gate',
      'opaque',
      'barrier',
      'reset',
      'measure',
      'if',
      'else',
      'input',
      'output',
      'const',
      'let',
      'defcal',
      'def',
      'for',
      'while',
      'return',
      'break',
      'continue',
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/\b(?:OPENQASM|include|creg|qreg|gate|opaque|barrier|reset|measure|if|else|input|output|const|let|defcal|def|for|while|return)\b/, 'keyword'],
        [/\b[0-9]+(?:\.[0-9]+(?:[eE][+-]?\d+)?)?\b/, 'number'],
        [/\b(h|x|y|z|s|t|sdg|tdg|id|p|u\d?|rx|ry|rz|cx|cy|cz|swap|ccx|measure|barrier|reset)\b/, 'type.identifier'],
        [/[;,\[\](){}\-+*/=<>!&|~^?:]/, 'delimiter'],
        [/[a-zA-Z_]\w*/, 'identifier'],
      ],
      comment: [
        [/[^/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  });
}

export function registerQreEditorThemes(monaco) {
  monaco.editor.defineTheme('qre-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c4b5fd', fontStyle: 'bold' },
      { token: 'type.identifier', foreground: 'fcd34d' },
      { token: 'number', foreground: '6ee7b7' },
      { token: 'string', foreground: '93c5fd' },
    ],
    colors: {
      'editor.background': '#14161c',
      'editor.lineHighlightBackground': '#1f293780',
      'editorLineNumber.foreground': '#4b5563',
      'editorCursor.foreground': '#f0c14b',
    },
  });

  monaco.editor.defineTheme('qre-light', {
    base: 'vs',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '6b7280', fontStyle: 'italic' },
      { token: 'keyword', foreground: '4338ca', fontStyle: 'bold' },
      { token: 'type.identifier', foreground: 'b45309' },
      { token: 'number', foreground: '047857' },
      { token: 'string', foreground: '1d4ed8' },
    ],
    colors: {
      'editor.background': '#f8fafc',
      'editor.lineHighlightBackground': '#e5e7eb55',
      'editorLineNumber.foreground': '#9ca3af',
      'editorCursor.foreground': '#1b3a6b',
    },
  });
}

export function resolveQreMonacoTheme(shellTheme, editorTheme) {
  if (editorTheme === 'light' || editorTheme === 'high_contrast') return 'qre-light';
  if (editorTheme === 'dark') return 'qre-dark';
  return shellTheme === 'light' ? 'qre-light' : 'qre-dark';
}
