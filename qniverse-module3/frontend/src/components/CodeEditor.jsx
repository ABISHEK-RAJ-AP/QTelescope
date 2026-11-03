import React from 'react';
import Editor from '@monaco-editor/react';

const CodeEditor = ({ code, onChange, language = "python", height = "100%", options = {} }) => {
  return (
    <div style={{ height: height, minHeight: '100px' }}>
      <Editor
        defaultLanguage={language === 'openqasm' ? 'cpp' : language}
        language={language === 'openqasm' ? 'cpp' : language}
        value={code}
        theme="vs-dark"
        onChange={(value) => onChange(value || '')}
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          ...options
        }}
      />
    </div>
  );
};

export default CodeEditor;