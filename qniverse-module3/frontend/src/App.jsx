import React, { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import CodeEditor from './components/CodeEditor';
import Terminal from './components/Terminal';
import MetricsPanel from './components/MetricsPanel';
import CircuitOutput from './components/CircuitOutput';
import Notebook from './components/Notebook'; // Import Notebook
import ResultWindow from './components/ResultWindow'; // Import ResultWindow
import BenchmarkPanel from './components/BenchmarkPanel'; // Import BenchmarkPanel
import './App.css';

// --- UPDATED: Default file is now empty ---
const DEFAULT_FILE = {
  name: 'main.py',
  content: `# Write your quantum code here

`
};

function App() {
  const [files, setFiles] = useState(() => {
    const saved = localStorage.getItem('quantum_files');
    return saved ? JSON.parse(saved) : [DEFAULT_FILE];
  });
  const [activeFileName, setActiveFileName] = useState('main.py');

  // View State: 'editor' or 'notebook'
  const [viewMode, setViewMode] = useState('editor');

  // Notebook State
  const [cells, setCells] = useState([]);

  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [circuitData, setCircuitData] = useState(null);
  const [status, setStatus] = useState('Disconnected');

  // NEW STATES
  const [language, setLanguage] = useState('python');
  const [backend, setBackend] = useState('qasm_simulator');
  const [lastResult, setLastResult] = useState(null);

  // BENCHMARK STATE
  const [benchmarkResults, setBenchmarkResults] = useState([]);
  const [benchmarkSummary, setBenchmarkSummary] = useState(null);
  const [benchmarkStatic, setBenchmarkStatic] = useState(null); // New State

  const ws = useRef(null);

  // Safe check to ensure activeFile always exists
  const activeFile = files.find(f => f.name === activeFileName) || files[0];

  useEffect(() => {
    const sessionId = 'session-' + Math.random().toString(36).substr(2, 9);
    ws.current = new WebSocket(`ws://localhost:12346/ws/execute/${sessionId}`);

    ws.current.onopen = () => {
      addLog('Connected to Backend', 'success');
      setStatus('Ready');
    };

    ws.current.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      // If message targets a specific cell (Notebook Mode)
      if (msg.cell_id) {
        setCells(prev => prev.map(cell => {
          if (cell.id !== msg.cell_id) return cell;

          if (msg.type === 'output') {
            return { ...cell, logs: [...cell.logs, { msg: msg.data, type: 'info' }] };
          } else if (msg.type === 'result') {
            return { ...cell, result: msg, status: 'completed' };
          } else if (msg.type === 'error') {
            return { ...cell, logs: [...cell.logs, { msg: msg.message, type: 'error' }], status: 'error' };
          } else if (msg.type === 'done') {
            // Ensure status is cleared if it was running but no result came
            return { ...cell, status: cell.status === 'running' ? 'idle' : cell.status };
          }
          return cell;
        }));
        return;
      }

      // Default Protocol (Editor Mode)
      if (msg.type === 'output') addLog(msg.data, 'info');
      else if (msg.type === 'result') {
        addLog(`Execution time: ${msg.execution_time}s`, 'success');
        setMetrics(msg);
        setLastResult(msg); // Store for Result Window
        if (msg.circuit_data) setCircuitData(msg.circuit_data);
        setStatus('Completed');
      }
      else if (msg.type === 'error') {
        addLog(`Error: ${msg.message}`, 'error');
        setStatus('Error');
      }
      else if (msg.type === 'done') {
        if (status === 'Running...') setStatus('Ready');
      }
      // BENCHMARK MESSAGES
      else if (msg.type === 'benchmark_start') {
        setBenchmarkStatic(msg);
      }
      else if (msg.type === 'benchmark_step') {
        setBenchmarkResults(prev => [...prev, msg.data]);
      }
      else if (msg.type === 'benchmark_complete') {
        setBenchmarkSummary(msg.summary);
        setStatus('Completed');
        addLog(`Benchmark Completed. Fastest: ${msg.summary.fastest}`, 'success');
      }
    };

    ws.current.onclose = () => setStatus('Disconnected');
    return () => { if (ws.current) ws.current.close(); };
  }, []);



  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('quantum_files', JSON.stringify(files));
  }, [files]);

  const addLog = (msg, type) => {
    setLogs(prev => [...prev, { msg, type, id: Date.now() + Math.random() }]);
  };

  // --- NOTEBOOK FILES STATE ---
  const [notebookFiles, setNotebookFiles] = useState(() => {
    const saved = localStorage.getItem('quantum_notebooks');
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed && parsed.length > 0) {
      // MIGRATION: Ensure all notebooks have a 'language' property
      return parsed.map(nb => ({
        ...nb,
        language: nb.language || 'python'
      }));
    }
    return [{
      name: 'notebook.json',
      content: [],
      language: 'python'
    }];
  });
  const [activeNotebookName, setActiveNotebookName] = useState(() => {
    // Logic to get first notebook name if available
    const saved = localStorage.getItem('quantum_notebooks');
    const parsed = saved ? JSON.parse(saved) : [{ name: 'notebook.json' }];
    return (parsed && parsed.length > 0) ? parsed[0].name : 'notebook.json';
  });

  // Persistence for Notebooks
  useEffect(() => {
    localStorage.setItem('quantum_notebooks', JSON.stringify(notebookFiles));
  }, [notebookFiles]);

  // Sync active notebook content to 'cells' state
  // When activeNotebookName changes, load its content into 'cells'
  useEffect(() => {
    const nb = notebookFiles.find(n => n.name === activeNotebookName);
    if (nb) {
      setCells(nb.content || []);
    }
  }, [activeNotebookName]);

  // When 'cells' change, update the content of the active notebook in 'notebookFiles'
  // But be careful to avoid infinite loops. 
  // We should only update notebookFiles when cells change.
  useEffect(() => {
    setNotebookFiles(prev => prev.map(nb =>
      nb.name === activeNotebookName ? { ...nb, content: cells } : nb
    ));
  }, [cells]);


  const handleCodeChange = (newContent) => {
    setFiles(prevFiles =>
      prevFiles.map(f =>
        f.name === activeFileName ? { ...f, content: newContent } : f
      )
    );
  };

  // --- GENERIC FILE HANDLERS (Delegator) ---
  const isEditor = viewMode === 'editor';

  const handleCreateGeneric = () => {
    if (isEditor) handleCreateFile();
    else handleCreateNotebook();
  };

  const handleRenameGeneric = (e, oldName) => {
    if (isEditor) handleRenameFile(e, oldName);
    else handleRenameNotebook(e, oldName);
  };

  const handleDeleteGeneric = (e, name) => {
    if (isEditor) handleDeleteFile(e, name);
    else handleDeleteNotebook(e, name);
  };

  const handleSelectGeneric = (name) => {
    if (isEditor) setActiveFileName(name);
    else setActiveNotebookName(name);
  };


  // --- EDITOR FILE HANDLERS ---
  const handleCreateFile = () => {
    const name = prompt("Enter file name (e.g., experiment.py):");
    if (!name) return;
    if (files.some(f => f.name === name)) {
      alert("File already exists!");
      return;
    }
    const newFile = { name, content: "# New Quantum Experiment\n" };
    setFiles([...files, newFile]);
    setActiveFileName(name);
  };

  const handleRenameFile = (e, oldName) => {
    e.stopPropagation();
    const newName = prompt("Enter new file name:", oldName);

    if (!newName || newName === oldName) return;

    if (files.some(f => f.name === newName)) {
      alert("A file with this name already exists!");
      return;
    }

    setFiles(prev => prev.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    ));

    if (activeFileName === oldName) {
      setActiveFileName(newName);
    }
  };

  // --- NOTEBOOK FILE HANDLERS ---
  const handleCreateNotebook = () => {
    const name = prompt("Enter notebook name (e.g., study.json):");
    if (!name) return;
    if (notebookFiles.some(f => f.name === name)) {
      alert("Notebook already exists!");
      return;
    }

    // Prompt for Language
    const langInput = prompt("Choose Notebook Language:\n1. Python (Default)\n2. OpenQASM", "1");
    let chosenLang = 'python';
    if (langInput === '2' || langInput.toLowerCase().includes('qasm')) {
      chosenLang = 'openqasm';
    }

    const newNb = { name, content: [], language: chosenLang }; // Store language in notebook metadata
    setNotebookFiles([...notebookFiles, newNb]);
    setActiveNotebookName(name);
  };

  const handleRenameNotebook = (e, oldName) => {
    e.stopPropagation();
    const newName = prompt("Enter new notebook name:", oldName);

    if (!newName || newName === oldName) return;

    if (notebookFiles.some(f => f.name === newName)) {
      alert("A notebook with this name already exists!");
      return;
    }

    setNotebookFiles(prev => prev.map(f =>
      f.name === oldName ? { ...f, name: newName } : f
    ));

    if (activeNotebookName === oldName) {
      setActiveNotebookName(newName);
    }
  };

  const handleDeleteNotebook = (e, name) => {
    e.stopPropagation();
    if (confirm(`Delete Notebook ${name}?`)) {
      const newFiles = notebookFiles.filter(f => f.name !== name);
      if (newFiles.length === 0) {
        const defaultNb = { name: 'notebook.json', content: [], language: 'python' };
        setNotebookFiles([defaultNb]);
        setActiveNotebookName(defaultNb.name);
      } else {
        setNotebookFiles(newFiles);
        if (activeNotebookName === name) {
          setActiveNotebookName(newFiles[0].name);
        }
      }
    }
  };

  const handleUploadFile = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const name = file.name;

      if (isEditor) {
        if (files.some(f => f.name === name)) {
          if (!confirm(`Overwrite ${name}?`)) return;
          setFiles(prev => prev.map(f => f.name === name ? { ...f, content } : f));
        } else {
          setFiles(prev => [...prev, { name, content }]);
        }
        setActiveFileName(name);
      } else {
        // Notebook Upload (expecting JSON)
        try {
          const jsonContent = JSON.parse(content);
          if (notebookFiles.some(f => f.name === name)) {
            if (!confirm(`Overwrite ${name}?`)) return;
            setNotebookFiles(prev => prev.map(f => f.name === name ? { ...f, content: jsonContent } : f));
          } else {
            setNotebookFiles(prev => [...prev, { name, content: jsonContent }]);
          }
          setActiveNotebookName(name);
        } catch (err) {
          alert("Invalid JSON file for notebook");
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteFile = (e, name) => {
    e.stopPropagation();

    if (confirm(`Delete ${name}?`)) {
      const newFiles = files.filter(f => f.name !== name);

      if (newFiles.length === 0) {
        // Create fresh empty file if last one is deleted
        const defaultFile = {
          name: 'new_script.py',
          content: '# Start coding here...\n'
        };
        setFiles([defaultFile]);
        setActiveFileName(defaultFile.name);
      } else {
        setFiles(newFiles);
        if (activeFileName === name) {
          setActiveFileName(newFiles[0].name);
        }
      }
    }
  };

  const handleRun = (arg) => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Check if Benchmark (string argument from Sidebar)
    const isBenchmark = (typeof arg === 'string' && arg === 'BENCHMARK');

    // Editor Run
    if (viewMode === 'editor') {
      setLogs([]);
      setMetrics(null);
      setCircuitData(null);
      setLastResult(null); // Clear last result

      if (isBenchmark) {
        setBenchmarkResults([]);
        setBenchmarkSummary(null);
        setBenchmarkStatic(null);
        setViewMode('benchmark');
        setStatus('Benchmarking...');
      } else {
        setStatus('Running...');
      }

      const payload = {
        type: 'execute',
        code: activeFile.content,
        shots: 1024,
        language: language, // Pass selected language
        context: `editor-${activeFileName}` // Context separation by file
      };

      // Only pass manually selected backend for OpenQASM OR Benchmark
      if (isBenchmark) {
        payload.backend = 'BENCHMARK';
      } else if (language === 'openqasm') {
        payload.backend = backend;
      }

      ws.current.send(JSON.stringify(payload));
    }
  };

  const handleExportToNotebook = () => {
    // Generate unique notebook name
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const scriptName = activeFileName.split('.')[0];
    const newNotebookName = `${scriptName}_export_${timestamp}.json`;

    if (notebookFiles.some(f => f.name === newNotebookName)) {
      // Fallback random name if collision (unlikely)
      alert("Name collision error. Try again.");
      return;
    }

    const newCell = {
      id: 'cell-' + Date.now(),
      type: 'code',
      content: activeFile.content,
      language: language, // Export language too
      logs: logs.map(l => ({ msg: l.msg, type: l.type })),
      result: lastResult,
      status: 'completed'
    };

    const newNotebook = {
      name: newNotebookName,
      content: [newCell],
      language: language // Inherit from current editor language
    };

    // Add to notebook files list
    setNotebookFiles(prev => [...prev, newNotebook]);

    // Switch to notebook view and activate the new notebook
    setActiveNotebookName(newNotebookName);
    setViewMode('notebook');

    alert(`Exported to new notebook: ${newNotebookName}`);
  };

  // --- NOTEBOOK HANDLERS ---
  const handleAddCell = (type, index = null) => {
    // Determine notebook language
    const currentNb = notebookFiles.find(n => n.name === activeNotebookName);
    const nbLang = currentNb ? (currentNb.language || 'python') : 'python';

    const newCell = {
      id: 'cell-' + Date.now(),
      type,
      content: '',
      language: nbLang, // Enforce Notebook Language
      backend: (nbLang === 'openqasm' ? 'qasm_simulator' : undefined), // Default backend if needed
      logs: [],
      result: null,
      status: 'idle'
    };

    // Pre-fill content based on language
    if (type === 'code') {
      if (nbLang === 'openqasm') {
        // Only add headers if it's the first cell or notebook is empty
        const isFirstCell = (index === 0) || (cells.length === 0 && index === null);

        if (isFirstCell) {
          newCell.content = `// OpenQASM 2.0
OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0], q[1];
measure q -> c;`;
        } else {
          newCell.content = `// Continue circuit...
// h q[0];`;
        }
      }
    }

    if (index !== null) {
      setCells(prev => [...prev.slice(0, index), newCell, ...prev.slice(index)]);
    } else {
      setCells(prev => [...prev, newCell]);
    }
  };

  const handleDeleteCell = (id) => {
    setCells(prev => prev.filter(c => c.id !== id));
  };

  const handleUpdateCell = (id, newContent) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, content: newContent } : c));
  };

  const handleUpdateCellBackend = (id, newBackend) => {
    setCells(prev => prev.map(c => c.id === id ? { ...c, backend: newBackend } : c));
  };

  const handleRunCell = (id) => {
    const cellIndex = cells.findIndex(c => c.id === id);
    if (cellIndex === -1 || !ws.current) return;

    const cell = cells[cellIndex];

    // Clear previous output
    setCells(prev => prev.map(c => c.id === id ? { ...c, logs: [], result: null, status: 'running' } : c));

    let codeToRun = cell.content;

    // OpenQASM Context Handling: Concatenate all previous cells
    if (cell.language === 'openqasm') {
      const previousCode = cells
        .slice(0, cellIndex + 1) // Include current cell
        .filter(c => c.type === 'code' && c.language === 'openqasm')
        .map(c => c.content)
        .join('\n');

      codeToRun = previousCode;
    }

    const payload = {
      type: 'execute',
      code: codeToRun,
      cell_id: id,
      shots: 1024,
      language: cell.language || 'python',
      context: `notebook-${activeNotebookName}`
    };

    if (cell.language === 'openqasm') {
      payload.backend = cell.backend || 'qasm_simulator';
    }

    ws.current.send(JSON.stringify(payload));
  };

  const handleTemplateLoad = (templateCode) => {
    handleCodeChange(templateCode);
  };

  return (
    <div className="app-container">
      <Sidebar
        files={viewMode === 'editor' ? files : notebookFiles}
        activeFileName={viewMode === 'editor' ? activeFileName : activeNotebookName}
        onSelectFile={handleSelectGeneric}
        onCreateFile={handleCreateGeneric}
        onRenameFile={handleRenameGeneric}
        onUploadFile={handleUploadFile}
        onDeleteFile={handleDeleteGeneric}
        onRun={handleRun}
        onLoadTemplate={handleTemplateLoad}

        /* Notebook Props */
        viewMode={viewMode}
        onSetViewMode={setViewMode}
      />


      <div className="main-panel">

        {viewMode === 'editor' ? (
          <>
            <div className="editor-header">

              {/* LEFT: File Tab */}
              <div className="header-left">
                <span className="file-tab">{activeFileName.split('.')[0]}</span>
              </div>

              {/* CENTER: Language & Backend Controls */}
              <div className="header-center">
                <select
                  value={language}
                  onChange={(e) => {
                    const newLang = e.target.value;
                    setLanguage(newLang);

                    // Clear/Template content based on language
                    if (newLang === 'openqasm') {
                      handleCodeChange(`// OpenQASM 2.0
OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0], q[1];
measure q -> c;
`);
                    } else {
                      handleCodeChange(`# Write your quantum code here
from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator

qc = QuantumCircuit(2)
qc.h(0)
qc.cx(0, 1)
qc.measure_all()
`);
                    }
                  }}
                  className="select-premium"
                >
                  <option value="python">Python</option>
                  <option value="openqasm">OpenQASM 2.0</option>
                </select>

                {language === 'openqasm' && (
                  <select
                    value={backend}
                    onChange={(e) => setBackend(e.target.value)}
                    className="select-premium"
                    title="Select Backend for OpenQASM"
                    style={{ minWidth: '160px' }}
                  >
                    <option value="qasm_simulator">QASM Simulator</option>
                    <option value="aer_simulator_statevector">Aer Statevector</option>
                    <option value="aer_simulator_density_matrix">Aer Density Matrix</option>
                    <option value="aer_simulator_statevector_gpu">Aer Statevector GPU</option>
                    <option value="nvidia_cudaq_statevector_simulator">NVIDIA cuQuantum</option>
                    <option value="cirq_simulator">Cirq Simulator</option>
                    <option value="qsimcirq_simulator">QSimCirq Simulator</option>
                    <option value="qsimcirq_cuquantum_gpu_simulator">QSimCirq cuQuantum GPU</option>
                    <option value="qulacs_multicpu_simulator">Qulacs Multi-CPU</option>
                    <option value="fpga_simulator">FPGA Simulator</option>
                    <option value="quest_simulator">QuEST Simulator</option>
                  </select>
                )}
              </div>

              {/* RIGHT: Action Buttons */}
              <div className="header-right">
                <button
                  onClick={handleExportToNotebook}
                  className="btn-premium"
                  title="Export Code and Output to Notebook"
                >
                  <span>Export to Notebook</span>
                </button>

                <button
                  onClick={() => setViewMode('result')}
                  className="btn-premium btn-result"
                  disabled={!lastResult}
                >
                  Result
                </button>

                <button
                  onClick={() => setViewMode('benchmark')}
                  className="btn-premium btn-result"
                  disabled={benchmarkResults.length === 0}
                  style={{ marginLeft: '10px', background: '#d7ba7d', color: '#000' }}
                  title="View Last Benchmark Results"
                >
                  View Benchmark
                </button>
              </div>
            </div>

            <div className="editor-wrapper">
              <CodeEditor
                code={activeFile.content}
                onChange={handleCodeChange}
                language={language}
                options={{ readOnly: false }}
              />
            </div>

            <div className="bottom-panel">
              <Terminal logs={logs} />
              <CircuitOutput circuitData={lastResult ? { ...lastResult.circuit_data, circuit_diagram: lastResult.circuit_diagram } : null} />
              <MetricsPanel status={status} metrics={metrics} />
            </div>
          </>
        ) : viewMode === 'notebook' ? (
          /* --- NOTEBOOK VIEW --- */
          <React.Suspense fallback={<div>Loading Notebook...</div>}>
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <Notebook
                cells={cells}
                onRunCell={handleRunCell}
                onAddCell={handleAddCell}
                onDeleteCell={handleDeleteCell}
                onUpdateCell={handleUpdateCell}
                onUpdateCellBackend={handleUpdateCellBackend}
              />
            </div>
          </React.Suspense>
        ) : viewMode === 'result' ? (
          /* --- NATIVE RESULT VIEW --- */
          <ResultWindow
            metrics={lastResult}
            onClose={() => setViewMode('editor')}
          />
        ) : viewMode === 'benchmark' ? (
          /* --- NATIVE BENCHMARK VIEW --- */
          <BenchmarkPanel
            results={benchmarkResults}
            summary={benchmarkSummary}
            staticData={benchmarkStatic}
            onClose={() => setViewMode('editor')}
          />
        ) : null}
      </div>
    </div>
  );
}

export default App;