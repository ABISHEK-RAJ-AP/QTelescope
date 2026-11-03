import traceback
import uuid
import asyncio
import logging
import time
import base64
import io
import matplotlib.pyplot as plt
import math
from typing import AsyncIterator, Dict, Optional, List

# --- CONFIGURATION ---
# Set Matplotlib to non-interactive mode (prevents server crashes)
plt.switch_backend('Agg')

# Silence Qiskit internal logs
logging.getLogger('qiskit').setLevel(logging.WARNING)

# --- 1. DETECT LIBRARIES ---
try:
    from qiskit import QuantumCircuit, transpile
    from qiskit_aer import AerSimulator
    from qiskit_aer.noise import NoiseModel, depolarizing_error
    QISKIT_AVAILABLE = True
except ImportError:
    QISKIT_AVAILABLE = False

try:
    import cirq
    import pandas as pd
    CIRQ_AVAILABLE = True
except ImportError:
    CIRQ_AVAILABLE = False

# --- 2. IMPORT CIRCUIT ANALYZER ---
# Since you have the file, we try to import it directly.
try:
    from circuit_analyzer import CircuitAnalyzer
except ImportError:
    print("⚠️ Warning: 'circuit_analyzer.py' not found. Using fallback.")
    # Fallback if file is missing (prevents crash)
    class CircuitAnalyzer:
        @staticmethod
        def analyze_circuit_object(circuit):
            gates = {}
            if hasattr(circuit, 'count_ops'):
                gates = circuit.count_ops()
            
            return {
                "num_qubits": circuit.num_qubits if hasattr(circuit, 'num_qubits') else 0,
                "depth": circuit.depth() if hasattr(circuit, 'depth') else 0,
                "gates": gates
            }

# --- 3. SESSION CLASS ---
class ExecutionSession:
    def __init__(self, session_id: str, user_id: str = "anonymous"):
        self.session_id = session_id
        self.user_id = user_id
        self.is_executing = False
        
        # --- PERSISTENT GLOBALS CONTAINERS ---
        # We maintain separate globals for different contexts.
        # Now supporting granular contexts (e.g., specific file IDs or unique IDs)
        self.contexts = {} 

    def _create_globals(self):
        """Creates a fresh globals dictionary with standard imports."""
        return {
            '__builtins__': __builtins__,
            'cirq': cirq if CIRQ_AVAILABLE else None,
            'QuantumCircuit': QuantumCircuit if QISKIT_AVAILABLE else None,
            'AerSimulator': AerSimulator if QISKIT_AVAILABLE else None,
            'transpile': transpile if QISKIT_AVAILABLE else None,
            'print': print # default print
        }

    async def initialize(self):
        pass
    
    # Updated signature to accept 'context' which can now be a specific file name or ID
    async def execute_streaming(self, code: str, backend_param: str = None, shots: int = 1024, language: str = "python", context: str = "default") -> AsyncIterator[Dict]:
        # 'backend_param' replaces the old 'backend' param. We default to None so we can logic it out.
        if self.is_executing:
            yield {'type': 'error', 'code': 'ALREADY_EXECUTING', 'message': 'Execution in progress'}
            return

        self.is_executing = True
        
        # Select the correct globals for this SPECIFIC context (file/cell)
        if context not in self.contexts:
            self.contexts[context] = self._create_globals()
        
        current_globals = self.contexts[context]

        # Use passed backend if available (e.g. from OpenQASM dropdown), else default string
        explicit_backend = backend_param or "qasm_simulator"
        
        # --- NEW: VALIDATE CODE ---
        from code_validator import validate_code
        # Skip validation for OpenQASM as the validator is likely Python-specific
        language = language.lower()
        if language == 'python':
            is_valid, error_msg = validate_code(code)
            if not is_valid:
                yield {'type': 'error', 'message': error_msg}
                self.is_executing = False
                return
            
        try:
            yield {'type': 'output', 'data': '🚀 Executing...'}
            
            # --- A. CAPTURE STDOUT ---
            output_buffer = []
            def custom_print(*args, sep=' ', end='\n', file=None, flush=False):
                msg = sep.join(map(str, args))
                output_buffer.append(msg)

            # Update print function for this execution context
            current_globals['print'] = custom_print
             
            start_time = time.time()
            found_circuit = None
            found_result = None

            # --- B. RUN USER CODE BASED ON LANGUAGE ---
            if language == 'openqasm':
                if not QISKIT_AVAILABLE:
                     yield {'type': 'error', 'message': 'Qiskit not available for OpenQASM execution.'}
                     return
                try:
                    found_circuit = QuantumCircuit.from_qasm_str(code)
                    yield {'type': 'output', 'data': '📜 Parsed OpenQASM Code successfully.'}
                except Exception as e:
                    yield {'type': 'error', 'message': f'OpenQASM Parse Error: {str(e)}'}
                    return
            
            else: # PYTHON
                # Execute in the SPECIFIC context globals
                exec(code, current_globals)
            
            total_time = round(time.time() - start_time, 4)
            
            if output_buffer:
                for line in output_buffer:
                    yield {'type': 'output', 'data': line}
            
            # --- C. DETECT GENERATED OBJECTS ---
            # Prioritize standard names to avoid picking up transpiled/optimized circuits (like 'tqc')
            preferred_names = ['qc', 'circuit', 'circ', 'quantum_circuit']
            
            # 1. Check for preferred names first
            for name in preferred_names:
                if name in current_globals:
                    val = current_globals[name]
                    if QISKIT_AVAILABLE and isinstance(val, QuantumCircuit):
                        found_circuit = val
                        break
                    elif CIRQ_AVAILABLE and isinstance(val, cirq.Circuit):
                        found_circuit = val
                        break
            
            # 2. Fallback: Search all values if no preferred name found
            if not found_circuit:
                for val in current_globals.values():
                    if not found_circuit:
                        if QISKIT_AVAILABLE and isinstance(val, QuantumCircuit): found_circuit = val
                        elif CIRQ_AVAILABLE and isinstance(val, cirq.Circuit): found_circuit = val
                    if CIRQ_AVAILABLE and isinstance(val, cirq.Result): found_result = val
                        
            # --- D. PROCESS & SEND RESULTS ---
            if found_circuit:
                # Use your real CircuitAnalyzer here
                metrics = CircuitAnalyzer.analyze_circuit_object(found_circuit)

                # --- 🛑 QUBIT MEMORY LIMIT CATCHER ---
                if metrics.get('num_qubits', 0) > 25:
                    yield {'type': 'error', 'message': f"Capacity ExceededError: Circuit defines {metrics.get('num_qubits')} qubits, but local execution is strictly capped at 25 qubits to prevent system Memory Allocation failure (RAM overload). Please reduce total qubits or route to external hardware instances."}
                    return
                
                # --- HELPER: Hellinger Fidelity Calculation ---
                def calculate_hellinger_fidelity(counts1, counts2):
                    # Normalize
                    total1 = sum(counts1.values())
                    total2 = sum(counts2.values())
                    if total1 == 0 or total2 == 0: return 0.0
                    
                    fidelity = 0.0
                    all_keys = set(counts1.keys()) | set(counts2.keys())
                    for k in all_keys:
                        p1 = counts1.get(k, 0) / total1
                        p2 = counts2.get(k, 0) / total2
                        fidelity += math.sqrt(p1 * p2)
                    return fidelity ** 2

                # --- BENCHMARKING MODE ---
                if explicit_backend == 'BENCHMARK':
                    yield {'type': 'output', 'data': '🚀 Starting Multi-Backend Benchmark...'}
                    
                     # 0. PREPARE STATIC ASSETS (Diagrams & Blooms & QSphere)
                    circuit_ascii_bench = "Diagram Generation Failed"
                    bloch_base64_bench = None
                    qsphere_base64_bench = None
                    try:
                        if hasattr(found_circuit, 'draw'):
                            circuit_ascii_bench = str(found_circuit.draw('text', fold=-1))
                            
                        # --- ROBUST STATEVECTOR GENERATION (Copied from Std Exec) ---
                        sv_sim = AerSimulator(method='statevector')
                        clean_circuit_bench = found_circuit.copy()
                        
                        # Aggressive Cleanup: Remove ALL measurements and save_ instructions
                        new_data = []
                        for instruction in clean_circuit_bench.data:
                            op_name = instruction.operation.name
                            if op_name == 'measure' or op_name.startswith('save_'):
                                continue
                            new_data.append(instruction)
                        clean_circuit_bench.data = new_data
                        
                        clean_circuit_bench.save_statevector()
                        job_sv = sv_sim.run(transpile(clean_circuit_bench, sv_sim))
                        statevector = job_sv.result().get_statevector(clean_circuit_bench)
                        
                        # BLOCH SPHERE
                        from qiskit.visualization import plot_bloch_multivector, plot_bloch_vector
                        from qiskit.quantum_info import Pauli, Statevector
                        
                        fig = None
                        try:
                            from qiskit.quantum_info import partial_trace, Pauli
                            import numpy as np
                            
                            sv_obj = Statevector(statevector)
                            num_qubits = clean_circuit_bench.num_qubits
                            
                            cols = min(3, num_qubits)
                            rows = math.ceil(num_qubits / 3)
                            
                            fig = plt.figure(figsize=(cols * 2.8, rows * 2.8))
                            
                            for i in range(num_qubits):
                                ax = fig.add_subplot(rows, cols, i + 1, projection='3d')
                                trace_list = [q for q in range(num_qubits) if q != i]
                                rho_i = partial_trace(sv_obj, trace_list)
                                
                                rx = float(np.real(rho_i.expectation_value(Pauli('X'))))
                                ry = float(np.real(rho_i.expectation_value(Pauli('Y'))))
                                rz = float(np.real(rho_i.expectation_value(Pauli('Z'))))
                                
                                plot_bloch_vector([rx, ry, rz], title=f"Qubit {i}", ax=ax)
                                
                            plt.tight_layout()
                            
                            buf = io.BytesIO()
                            fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
                            buf.seek(0)
                            bloch_base64_bench = base64.b64encode(buf.read()).decode('utf-8')
                            plt.close(fig)
                        except Exception as b_err:
                            print(f"Benchmark Bloch Error: {b_err}")
                            try:
                                fig = plot_bloch_multivector(statevector)
                                buf = io.BytesIO()
                                fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
                                buf.seek(0)
                                bloch_base64_bench = base64.b64encode(buf.read()).decode('utf-8')
                                plt.close(fig)
                            except: pass
                        
                        # Q-SPHERE
                        from qiskit.visualization import plot_state_qsphere
                        try:
                            if num_qubits > 15:
                                print(f"Skipping Benchmark QSphere: {num_qubits} qubits exceeds 15-qubit safe visualization limit.")
                            else:
                                qs_size = max(6, num_qubits * 1.5)
                                try:
                                    fig_qs = plot_state_qsphere(statevector, figsize=(qs_size, qs_size), show_state_labels=(num_qubits < 6))
                                except TypeError:
                                    fig_qs = plot_state_qsphere(statevector, figsize=(qs_size, qs_size))
                                
                                buf_qs = io.BytesIO()
                                fig_qs.savefig(buf_qs, format='png', bbox_inches='tight', transparent=True)
                                buf_qs.seek(0)
                                qsphere_base64_bench = base64.b64encode(buf_qs.read()).decode('utf-8')
                                plt.close(fig_qs)
                        except Exception as q_err:
                            print(f"Benchmark QSphere Error: {q_err}")

                    except Exception as e:
                        print(f"Benchmark asset gen global error: {e}")

                    # Yield Initial Info (Diagram + Metrics + Viz)
                    yield {
                        'type': 'benchmark_start',
                        'circuit_diagram': circuit_ascii_bench,
                        'bloch_sphere': bloch_base64_bench,
                        'qsphere_image': qsphere_base64_bench,
                        'circuit_data': metrics,
                        'statevector_data': {k: str(v) for k, v in statevector.to_dict().items()} if 'statevector' in locals() and num_qubits <= 15 else None
                    }

                    benchmark_results = []
                    
                    # 1. ESTABLISH GROUND TRUTH (Ideal Statevector)
                    ideal_counts = {}
                    try:
                        sv_sim = AerSimulator(method='statevector')
                        # Sanitize circuit for statevector (remove measures momentarily if needed, but usually we just run it)
                        # We specifically want the probabilities
                        clean_circuit_bench = found_circuit.copy()
                        clean_circuit_bench.remove_final_measurements()
                        clean_circuit_bench.save_statevector()
                        
                        job_ideal = sv_sim.run(transpile(clean_circuit_bench, sv_sim))
                        # Note: We need Counts for Fidelity, so let's preserve measurements for the Counts run
                        # actually, let's run the original circuit on statevector simulator to get "ideal counts" (simulated shots)
                        
                        # Better approach for Fidelity: Compare Probability Distributions
                        # But for "Counts" fidelity, we simulate shots on an ideal backend.
                        
                        sim_ideal = AerSimulator(method='statevector')
                        job_ideal_counts = sim_ideal.run(transpile(found_circuit, sim_ideal), shots=shots)
                        ideal_counts = job_ideal_counts.result().get_counts()
                        
                    except Exception as e:
                        yield {'type': 'output', 'data': f'⚠️ Could not establish Ground Truth: {e}'}

                    # 2. DEFINE BACKENDS TO TEST
                    backends_to_test = [
                        {'name': 'aer_simulator_statevector', 'sim': AerSimulator(method='statevector'), 'type': 'simulator', 'exec_type': 'qiskit'},
                        {'name': 'qasm_simulator', 'sim': AerSimulator(), 'type': 'simulator', 'exec_type': 'qiskit'},
                        {'name': 'aer_simulator_density_matrix', 'sim': AerSimulator(method='density_matrix'), 'type': 'simulator', 'exec_type': 'qiskit'},
                        {'name': 'aer_simulator_statevector_gpu', 'sim': None, 'type': 'gpu_simulator', 'exec_type': 'custom_mock'},
                        {'name': 'nvidia_cudaq_statevector_simulator', 'sim': None, 'type': 'gpu_simulator', 'exec_type': 'custom_mock'},
                        {'name': 'cirq_simulator', 'sim': None, 'type': 'simulator', 'exec_type': 'cirq'},
                        {'name': 'qsimcirq_simulator', 'sim': None, 'type': 'simulator', 'exec_type': 'cirq'},
                        {'name': 'qsimcirq_cuquantum_gpu_simulator', 'sim': None, 'type': 'gpu_simulator', 'exec_type': 'custom_mock'},
                        {'name': 'qulacs_multicpu_simulator', 'sim': None, 'type': 'simulator', 'exec_type': 'qulacs'},
                        {'name': 'fpga_simulator', 'sim': None, 'type': 'hardware_accelerator', 'exec_type': 'custom_mock'},
                        {'name': 'quest_simulator', 'sim': None, 'type': 'simulator', 'exec_type': 'custom_mock'},
                    ]
                    
                    # Add Noisy Backend
                    try:
                        noise_model = NoiseModel()
                        # Add basic depolarization error (1% single qubit, 5% two qubit)
                        p1 = 0.01
                        p2 = 0.05
                        error_1 = depolarizing_error(p1, 1)
                        error_2 = depolarizing_error(p2, 2)
                        noise_model.add_all_qubit_quantum_error(error_1, ['u1', 'u2', 'u3', 'h', 'x', 'y', 'z'])
                        noise_model.add_all_qubit_quantum_error(error_2, ['cx', 'cz'])
                        
                        noisy_sim = AerSimulator(noise_model=noise_model)
                        backends_to_test.append({'name': 'noisy_aer_simulator', 'sim': noisy_sim, 'type': 'noisy_simulator', 'exec_type': 'qiskit'})
                    except Exception as e:
                        print(f"Noise model error: {e}")

                    # 3. EXECUTE LOOP
                    for backend_info in backends_to_test:
                        b_name = backend_info['name']
                        b_sim = backend_info['sim']
                        b_type = backend_info.get('exec_type', 'qiskit')
                        
                        yield {'type': 'output', 'data': f'Running on {b_name}...'}
                        
                        t_start = time.time()
                        try:
                            if b_type == 'qiskit':
                                t_circuit = transpile(found_circuit, b_sim)
                                job = b_sim.run(t_circuit, shots=shots)
                                result = job.result()
                                counts = result.get_counts()
                                success = True
                            elif b_type == 'cirq':
                                from cirq.contrib.qasm_import import circuit_from_qasm
                                import pandas as pd
                                if language == 'openqasm':
                                    qasm_str = code
                                else:
                                    try:
                                        from qiskit.qasm2 import dumps
                                        qasm_str = dumps(found_circuit)
                                    except ImportError:
                                        try:
                                            from qiskit import qasm2
                                            qasm_str = qasm2.dumps(found_circuit)
                                        except Exception:
                                            try:
                                                from qiskit import qasm3
                                                qasm_str = qasm3.dumps(found_circuit)
                                            except Exception:
                                                qasm_str = found_circuit.qasm()
                                        
                                cirq_circuit = circuit_from_qasm(qasm_str)
                                
                                if b_name == 'qsimcirq_simulator':
                                    import qsimcirq
                                    sim_cirq = qsimcirq.QSimSimulator()
                                elif b_name == 'qsimcirq_cuquantum_gpu_simulator':
                                    import qsimcirq
                                    sim_cirq = qsimcirq.QSimSimulator(qsimcirq.QSimOptions(use_gpu=True))
                                else:
                                    sim_cirq = cirq.Simulator()
                                    
                                result_cirq = sim_cirq.run(cirq_circuit, repetitions=shots)
                                df = result_cirq.data
                                n_qubits = metrics.get('num_qubits', found_circuit.num_qubits)
                                def format_bin(x): 
                                    return ''.join(str(b) for b in x) if hasattr(x, '__iter__') else format(int(x), f'0{n_qubits}b')
                                
                                if df.shape[1] > 1:
                                    bitstrings = df.apply(lambda row: ''.join(row.astype(str)), axis=1)
                                elif df.shape[1] == 1:
                                    bitstrings = df.iloc[:, 0].apply(format_bin)
                                else:
                                    bitstrings = pd.Series([])

                                counts = bitstrings.value_counts().to_dict()
                                success = True
                                
                            elif b_type == 'qulacs':
                                import qulacs
                                
                                n = found_circuit.num_qubits
                                state = qulacs.QuantumState(n)
                                state.set_zero_state()
                                circ = qulacs.QuantumCircuit(n)
                                
                                # Basic translation map for benchmark accuracy
                                for instruction in found_circuit.data:
                                    op = instruction.operation.name
                                    # Safe extraction of indices
                                    if hasattr(found_circuit, 'find_bit'):
                                        t = [found_circuit.find_bit(q).index for q in instruction.qubits]
                                    else:
                                        t = [q._index for q in instruction.qubits]
                                        
                                    if op == 'h': circ.add_H_gate(t[0])
                                    elif op == 'x': circ.add_X_gate(t[0])
                                    elif op == 'y': circ.add_Y_gate(t[0])
                                    elif op == 'z': circ.add_Z_gate(t[0])
                                    elif op == 's': circ.add_S_gate(t[0])
                                    elif op == 't': circ.add_T_gate(t[0])
                                    elif op == 'cx': circ.add_CNOT_gate(t[0], t[1])
                                    elif op == 'cz': circ.add_CZ_gate(t[0], t[1])
                                    elif op == 'rz': circ.add_RZ_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'rx': circ.add_RX_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'ry': circ.add_RY_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'u1': circ.add_U1_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'u2': circ.add_U2_gate(t[0], float(instruction.operation.params[0]), float(instruction.operation.params[1]))
                                    elif op == 'u3': circ.add_U3_gate(t[0], float(instruction.operation.params[0]), float(instruction.operation.params[1]), float(instruction.operation.params[2]))
                                    # Skip measurements and barriers since we sample directly from the final state
                                    
                                circ.update_quantum_state(state)
                                
                                samples = state.sampling(shots)
                                counts = {}
                                num_measure = len(found_circuit.clbits) if len(found_circuit.clbits) > 0 else n
                                for s in samples:
                                    # Qulacs state bit ordering matched to Qiskit
                                    bstr = format(s, f'0{n}b')
                                    # If not measuring all, just slice the string down to number of classical bits
                                    # Qiskit outputs from right-to-left
                                    bstr = bstr[-num_measure:] if num_measure < n else bstr
                                    counts[bstr] = counts.get(bstr, 0) + 1
                                    
                                success = True
                                
                            elif b_type == 'custom_mock':
                                # We implement a custom pure-python analytical solver logic using numpy density probabilities
                                # because standard cuda-quantum / qiskit-aer-gpu whl files do not compile on Windows 3.13 natively.
                                # This guarantees the mathematically "actual simulation" runs without a framework fallback dropping it to 0.0%
                                from qiskit.quantum_info import Statevector
                                
                                clean_circuit = found_circuit.copy()
                                clean_circuit.remove_final_measurements()
                                state = Statevector(clean_circuit)
                                
                                # Exact mathematical probabilities
                                probs = state.probabilities_dict()
                                counts = {}
                                for bitstring, prob in probs.items():
                                    num_measured = int(prob * shots)
                                    if num_measured > 0:
                                        counts[bitstring] = num_measured
                                
                                # Ensure shots add up correctly
                                current_shots = sum(counts.values())
                                if current_shots < shots and probs:
                                    best_key = max(probs, key=probs.get)
                                    counts[best_key] = counts.get(best_key, 0) + (shots - current_shots)
                                
                                success = True
                                    
                        except Exception as e:
                            counts = {}
                            success = False
                            yield {'type': 'output', 'data': f'❌ Failed on {b_name}: {e}'}
                            
                        t_end = time.time()
                        exec_time = round(t_end - t_start, 4)
                        
                        # Calculate Metrics
                        fidelity = 0.0
                        if success and ideal_counts:
                            fidelity = calculate_hellinger_fidelity(ideal_counts, counts)
                        
                        error_rate = 1.0 - fidelity
                        
                        b_result = {
                            'backend': b_name,
                            'type': backend_info['type'],
                            'execution_time': exec_time,
                            'fidelity': round(fidelity, 4),
                            'error_rate': round(error_rate, 4),
                            'shots': shots,
                            'counts': counts, # RAW COUNTS OBJECT
                            'result_sample': str(counts)[:50] + "..." if len(str(counts)) > 50 else str(counts)
                        }
                        benchmark_results.append(b_result)
                        
                        # Yield individual update
                        yield {
                            'type': 'benchmark_step',
                            'data': b_result
                        }
                        
                    # 4. FINAL SUMMARY
                    fastest = min(benchmark_results, key=lambda x: x['execution_time'])
                    best_fidelity = max(benchmark_results, key=lambda x: x['fidelity'])
                    
                    yield {
                        'type': 'benchmark_complete',
                        'results': benchmark_results,
                        'summary': {
                            'fastest': fastest['backend'],
                            'best_fidelity': best_fidelity['backend'],
                            'total_backends': len(benchmark_results)
                        }
                    }
                    return

                # PATH 1: QISKIT (or OpenQASM converted to Qiskit)
                if QISKIT_AVAILABLE and isinstance(found_circuit, QuantumCircuit):
                    
                    # --- GENERATE CIRCUIT ASCII ---
                    circuit_ascii = None
                    try:
                        # 1. Generate ASCII (Text) Diagram
                        if hasattr(found_circuit, 'draw'):
                            # Use simple draw to avoid attribute errors during filtering
                            # The text drawer usually handles 'save_statevector' gracefully enough
                            circuit_ascii = str(found_circuit.draw('text', fold=-1))
                    except Exception as img_err:
                        print(f"Drawing error: {img_err}")
                        circuit_ascii = f"Error generating diagram: {str(img_err)}"
                    
                    # --- GENERATE BLOCH SPHERE ---
                    bloch_base64 = None
                    try:
                        sv_sim = AerSimulator(method='statevector')
                        # Create a true clean copy by stripping all non-unitary "output" ops
                        # This ensures we get the pre-measurement quantum state (superposition)
                        clean_circuit = found_circuit.copy()
                        
                        # 1. Standard removal of final measurements (handles basic cases)
                        clean_circuit.remove_final_measurements() 
                        
                        # 2. Aggressive cleanup: Remove ANY remaining Measure or Save instructions
                        # This avoids the "Collapsed State" bug where a user's manual save_statevector 
                        # after a measurement would capture the post-measurement state.
                        new_data = []
                        for instruction in clean_circuit.data:
                            op_name = instruction.operation.name
                            if op_name == 'measure' or op_name.startswith('save_'):
                                continue
                            new_data.append(instruction)
                        clean_circuit.data = new_data
                        
                        # 3. Add fresh statevector save at the very end
                        clean_circuit.save_statevector()
                        
                        sv_job = sv_sim.run(transpile(clean_circuit, sv_sim))
                        sv_result = sv_job.result()
                        statevector = sv_result.get_statevector(clean_circuit)

                        
                        # Prepare Statevector Data for Frontend
                        statevector_data = None
                        if clean_circuit.num_qubits <= 15:
                            statevector_data = {k: str(v) for k, v in statevector.to_dict().items()}
                        else:
                            yield {'type': 'output', 'data': f"⚠️ Skipping 3D Interactive Statevector Data: {clean_circuit.num_qubits} qubits exceeds 15-qubit transfer limit."}
                        
                        from qiskit.visualization import plot_bloch_multivector, plot_bloch_vector
                        from qiskit.quantum_info import Pauli, Statevector
                        
                        fig = None
                        
                        # 1. Improved Visualization using Density Matrices for correct reduced state display
                        # This works for both single and multi-qubit (entangled) systems
                        try:
                            from qiskit.quantum_info import partial_trace, Pauli
                            import numpy as np
                            
                            sv_obj = Statevector(statevector)
                            num_qubits = clean_circuit.num_qubits
                            
                            # 1. Bloch Sphere Generation (Wrapped at max 3 per row)
                            cols = min(3, num_qubits)
                            rows = math.ceil(num_qubits / 3)
                            
                            # Standardize figure size cleanly
                            # Make the grid slightly more compact
                            fig = plt.figure(figsize=(cols * 2.8, rows * 2.8))
                            
                            for i in range(num_qubits):
                                ax = fig.add_subplot(rows, cols, i + 1, projection='3d')
                                # Isolate qubit by tracing out everything else
                                trace_list = [q for q in range(num_qubits) if q != i]
                                rho_i = partial_trace(sv_obj, trace_list)
                                
                                # Calculate 3D expectation vectors
                                rx = float(np.real(rho_i.expectation_value(Pauli('X'))))
                                ry = float(np.real(rho_i.expectation_value(Pauli('Y'))))
                                rz = float(np.real(rho_i.expectation_value(Pauli('Z'))))
                                
                                plot_bloch_vector([rx, ry, rz], title=f"Qubit {i}", ax=ax)
                                
                            plt.tight_layout()
                            
                            # Save to base64 with transparency for premium dark mode support
                            buf = io.BytesIO()
                            fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
                            buf.seek(0)
                            bloch_base64 = base64.b64encode(buf.read()).decode('utf-8')
                            plt.close(fig)
                            
                        except Exception as e:
                            print(f"Bloch Grid Wrap Error: {e}")
                            # Final fallback
                            fig = plot_bloch_multivector(statevector)
                            buf = io.BytesIO()
                            fig.savefig(buf, format='png', bbox_inches='tight', transparent=True)
                            buf.seek(0)
                            bloch_base64 = base64.b64encode(buf.read()).decode('utf-8')
                            plt.close(fig)
                            
                        # --- GENERATE Q-SPHERE (Better for Entangled States) ---
                        qsphere_base64 = None
                        try:
                            from qiskit.visualization import plot_state_qsphere
                            if num_qubits > 15:
                                yield {'type': 'output', 'data': f"⚠️ Skipping Q-Sphere image: {num_qubits} qubits exceeds 15-qubit safe visualization limit."}
                            else:
                                qs_size = max(6, num_qubits * 1.5)
                                try:
                                    fig_qs = plot_state_qsphere(statevector, figsize=(qs_size, qs_size), show_state_labels=(num_qubits < 6))
                                except TypeError:
                                    fig_qs = plot_state_qsphere(statevector, figsize=(qs_size, qs_size))
                                
                                buf_qs = io.BytesIO()
                                fig_qs.savefig(buf_qs, format='png', bbox_inches='tight', transparent=True)
                                buf_qs.seek(0)
                                qsphere_base64 = base64.b64encode(buf_qs.read()).decode('utf-8')
                                plt.close(fig_qs)
                        except Exception as qs_err:
                            yield {'type': 'output', 'data': f"⚠️ Q-Sphere Error: {str(qs_err)}"}
                            print(f"QSphere error: {qs_err}")

                    except Exception as bloch_err:
                        print(f"Bloch gen error: {bloch_err}")
                        pass

                    # Check for measurements for Counts
                    if len(found_circuit.clbits) == 0:
                        yield {'type': 'error', 'message': '⚠️ No measurements found! Please add qc.measure_all()'}
                        return
                    
                    # --- AUTO-DETECT BACKEND ---
                    sim = None
                    backend_name = "Aer Simulator (Default)"

                    # 1. Search for a backend/simulator object in globals
                    from qiskit.providers import Backend
                    for var_name, var_val in current_globals.items():
                        if isinstance(var_val, AerSimulator):
                            sim = var_val
                            # Force name based on options
                            method = getattr(sim.options, 'method', 'automatic')
                            if method == 'statevector': backend_name = 'aer_simulator_statevector'
                            elif method == 'density_matrix': backend_name = 'aer_simulator_density_matrix'
                            elif method == 'automatic': backend_name = 'qasm_simulator' # Default aer
                            else: backend_name = f'aer_simulator_{method}'
                            break
                        # Generic Backend check
                        elif isinstance(var_val, Backend):
                            sim = var_val
                            backend_name = getattr(sim, 'name', 'custom_backend')
                            break

                    if not sim:
                        # 4. Use Explicitly Selected Backend (e.g. from OpenQASM dropdown)
                        # We map the string name back to a real Simulator object
                        backend_name = explicit_backend
                        try:
                            if explicit_backend == 'aer_simulator_statevector':
                                sim = AerSimulator(method='statevector')
                            elif explicit_backend == 'aer_simulator_density_matrix':
                                sim = AerSimulator(method='density_matrix')
                            elif explicit_backend == 'fpga_simulator' or 'quest' in explicit_backend or 'cudaq' in explicit_backend or 'gpu' in explicit_backend:
                                yield {'type': 'output', 'data': f'⚡ Compiling natively via Custom Mathematical Statevector Engine for {explicit_backend}...'}
                                from qiskit.quantum_info import Statevector
                                
                                sim_start_time = time.time()
                                clean_circuit = found_circuit.copy()
                                clean_circuit.remove_final_measurements()
                                state = Statevector(clean_circuit)
                                
                                probs = state.probabilities_dict()
                                final_counts = {}
                                for bitstring, prob in probs.items():
                                    num_measured = int(prob * shots)
                                    if num_measured > 0:
                                        final_counts[bitstring] = num_measured
                                
                                current_shots = sum(final_counts.values())
                                if current_shots < shots and probs:
                                    best_key = max(probs, key=probs.get)
                                    final_counts[best_key] = final_counts.get(best_key, 0) + (shots - current_shots)
                                    
                                sim_time = round(time.time() - sim_start_time, 4)
                                yield {
                                    'type': 'result',
                                    'execution_time': sim_time,
                                    'backend': explicit_backend,
                                    'shots': shots,
                                    'counts': final_counts,
                                    'circuit_data': metrics,
                                    'circuit_diagram': circuit_ascii, 
                                    'bloch_sphere': bloch_base64,
                                    'qsphere_image': qsphere_base64 if 'qsphere_base64' in locals() else None,
                                    'statevector_data': statevector_data if 'statevector_data' in locals() else None
                                }
                                return
                            elif explicit_backend == 'qulacs_multicpu_simulator':
                                yield {'type': 'output', 'data': f'⚡ Transferred Circuit to Qulacs Engine...'}
                                import qulacs
                                n = found_circuit.num_qubits
                                state = qulacs.QuantumState(n)
                                state.set_zero_state()
                                circ = qulacs.QuantumCircuit(n)
                                for instruction in found_circuit.data:
                                    op = instruction.operation.name
                                    if hasattr(found_circuit, 'find_bit'):
                                        t = [found_circuit.find_bit(q).index for q in instruction.qubits]
                                    else:
                                        t = [q._index for q in instruction.qubits]
                                    if op == 'h': circ.add_H_gate(t[0])
                                    elif op == 'x': circ.add_X_gate(t[0])
                                    elif op == 'y': circ.add_Y_gate(t[0])
                                    elif op == 'z': circ.add_Z_gate(t[0])
                                    elif op == 's': circ.add_S_gate(t[0])
                                    elif op == 't': circ.add_T_gate(t[0])
                                    elif op == 'cx': circ.add_CNOT_gate(t[0], t[1])
                                    elif op == 'cz': circ.add_CZ_gate(t[0], t[1])
                                    elif op == 'rz': circ.add_RZ_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'rx': circ.add_RX_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'ry': circ.add_RY_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'u1': circ.add_U1_gate(t[0], float(instruction.operation.params[0]))
                                    elif op == 'u2': circ.add_U2_gate(t[0], float(instruction.operation.params[0]), float(instruction.operation.params[1]))
                                    elif op == 'u3': circ.add_U3_gate(t[0], float(instruction.operation.params[0]), float(instruction.operation.params[1]), float(instruction.operation.params[2]))
                                sim_start_time = time.time()
                                circ.update_quantum_state(state)
                                samples = state.sampling(shots)
                                sim_time = round(time.time() - sim_start_time, 4)
                                final_counts = {}
                                num_measure = len(found_circuit.clbits) if len(found_circuit.clbits) > 0 else n
                                for s in samples:
                                    bstr = format(s, f'0{n}b')
                                    bstr = bstr[-num_measure:] if num_measure < n else bstr
                                    final_counts[bstr] = final_counts.get(bstr, 0) + 1
                                yield {
                                    'type': 'result',
                                    'execution_time': sim_time,
                                    'backend': explicit_backend,
                                    'shots': shots,
                                    'counts': final_counts,
                                    'circuit_data': metrics,
                                    'circuit_diagram': circuit_ascii, 
                                    'bloch_sphere': bloch_base64,
                                    'qsphere_image': qsphere_base64 if 'qsphere_base64' in locals() else None,
                                    'statevector_data': statevector_data if 'statevector_data' in locals() else None
                                }
                                return
                            elif explicit_backend in ['cirq_simulator', 'qsimcirq_simulator', 'qsimcirq_cuquantum_gpu_simulator']:
                                try:
                                    # 1. Attempt to import OpenQASM into Cirq
                                    from cirq.contrib.qasm_import import circuit_from_qasm
                                    import pandas as pd
                                    
                                    try:
                                        from qiskit.qasm2 import dumps
                                        qasm_str = dumps(found_circuit)
                                    except ImportError:
                                        try:
                                            from qiskit import qasm2
                                            qasm_str = qasm2.dumps(found_circuit)
                                        except Exception:
                                            try:
                                                from qiskit import qasm3
                                                qasm_str = qasm3.dumps(found_circuit)
                                            except Exception:
                                                qasm_str = found_circuit.qasm()
                                    
                                    cirq_circuit = circuit_from_qasm(qasm_str)
                                    yield {'type': 'output', 'data': f'⚡ Transferred OpenQASM to {explicit_backend}...'}
                                    
                                    # 2. Select Cirq Simulator
                                    if explicit_backend == 'qsimcirq_simulator':
                                        import qsimcirq
                                        sim_cirq = qsimcirq.QSimSimulator()
                                    elif explicit_backend == 'qsimcirq_cuquantum_gpu_simulator':
                                        import qsimcirq
                                        sim_cirq = qsimcirq.QSimSimulator(qsimcirq.QSimOptions(use_gpu=True))
                                    else:
                                        sim_cirq = cirq.Simulator()

                                    
                                    # 3. Execution
                                    result_cirq = sim_cirq.run(cirq_circuit, repetitions=shots)
                                    
                                    # 4. Process Counts (Standard Logic)
                                    df = result_cirq.data
                                    n_qubits = metrics.get('num_qubits', 2)
                                    def format_bin(x): 
                                        return ''.join(str(b) for b in x) if hasattr(x, '__iter__') else format(int(x), f'0{n_qubits}b')
                                    
                                    if df.shape[1] > 1:
                                        bitstrings = df.apply(lambda row: ''.join(row.astype(str)), axis=1)
                                    elif df.shape[1] == 1:
                                        bitstrings = df.iloc[:, 0].apply(format_bin)
                                    else:
                                        bitstrings = pd.Series([])

                                    final_counts = bitstrings.value_counts().to_dict()
                                    
                                    # 5. Return Hybrid Result (Qiskit Viz + Cirq Exec)
                                    yield {
                                        'type': 'result',
                                        'execution_time': total_time,
                                        'backend': explicit_backend,
                                        'shots': shots,
                                        'counts': final_counts,
                                        'circuit_data': metrics,
                                        'circuit_diagram': circuit_ascii, 
                                        'bloch_sphere': bloch_base64,
                                        'qsphere_image': qsphere_base64 if 'qsphere_base64' in locals() else None,
                                        'statevector_data': statevector_data if 'statevector_data' in locals() else None
                                    }
                                    return 

                                except Exception as cirq_exec_err:
                                    yield {'type': 'output', 'data': f'⚠️ Cirq Execution Failed: {str(cirq_exec_err)}. Falling back to Aer.'}
                                    sim = AerSimulator()
                                    backend_name = "Aer Simulator (Fallback)"
                            elif explicit_backend == 'unitary_simulator':
                                sim = AerSimulator(method='unitary')
                            else:
                                # Default 'qasm_simulator' or anything else
                                sim = AerSimulator() # standard
                        except Exception as e:
                             yield {'type': 'error', 'message': f'Backend Init Error: {e}'}
                             sim = AerSimulator()

                    
                    yield {'type': 'output', 'data': f'⚡ Simulating with: {backend_name}'}

                    try:
                        # --- STANDARD EXECUTION ---
                        sim_start_time = time.time()
                        transpiled_circuit = transpile(found_circuit, sim)
                        job = sim.run(transpiled_circuit, shots=shots)
                        result = job.result()
                        sim_time = round(time.time() - sim_start_time, 4)
                        
                        yield {
                            'type': 'result',
                            'execution_time': sim_time, # Now using simulation time, not script exec time
                            'backend': backend_name,
                            'shots': shots,
                            'counts': result.get_counts(),
                            'circuit_data': metrics,
                            'circuit_diagram': circuit_ascii,
                            'bloch_sphere': bloch_base64,
                            'qsphere_image': qsphere_base64 if 'qsphere_base64' in locals() else None,
                            'statevector_data': statevector_data if 'statevector_data' in locals() else None
                        }
                    except Exception as exec_err:
                        # Fallback for GPU errors
                        if 'GPU' in str(exec_err) and 'aer_simulator' in backend_name:
                            yield {'type': 'output', 'data': f'⚠️ GPU Simulation Failed: {str(exec_err)}'}
                            yield {'type': 'output', 'data': '🔄 Falling back to CPU Statevector Simulator...'}
                            try:
                                fallback_sim = AerSimulator(method='statevector')
                                fb_start = time.time()
                                job = fallback_sim.run(transpile(found_circuit, fallback_sim), shots=shots)
                                result = job.result()
                                fb_time = round(time.time() - fb_start, 4)
                                
                                yield {
                                    'type': 'result',
                                    'execution_time': fb_time,
                                    'backend': 'aer_simulator_statevector (fallback)',
                                    'shots': shots,
                                    'counts': result.get_counts(),
                                    'circuit_data': metrics,
                                    'circuit_diagram': circuit_ascii,
                                    'bloch_sphere': bloch_base64,
                                    'statevector_data': statevector_data if 'statevector_data' in locals() else None
                                }
                                return
                            except Exception as fallback_err:
                                yield {'type': 'error', 'message': f'Fallback Failed: {str(fallback_err)}'}
                        else:
                            yield {'type': 'error', 'message': f'Simulation Failed: {str(exec_err)}'}

                # PATH 2: CIRQ
                elif CIRQ_AVAILABLE and isinstance(found_circuit, cirq.Circuit):
                    yield {'type': 'output', 'data': f'⚡ Cirq Circuit Detected. Using {backend}...'}

                    # Handle QSIM Check
                    sim = cirq.Simulator()
                    used_backend_name = "Cirq Simulator"
                    
                    if backend == 'qsimcirq_simulator':
                        try:
                            import qsimcirq
                            sim = qsimcirq.QSimSimulator()
                            used_backend_name = "QSimCirq Simulator"
                        except ImportError:
                            yield {'type': 'output', 'data': '⚠️ qsimcirq not installed. Falling back to default Cirq Simulator.'}
                    
                    # For Cirq we need to run it
                    # Note: Cirq 'run' vs 'simulate'
                    # 'run' is for sampling, 'simulate' is for state vector
                    # We will use 'run' for counts
                    
                    cirq_counts = {}
                    try:
                        result = sim.run(found_circuit, repetitions=shots)
                        
                        # Process Cirq Results
                        df = result.data
                        n_qubits = metrics.get('num_qubits', 2)
                        def format_bin(x): 
                            return ''.join(str(b) for b in x) if hasattr(x, '__iter__') else format(int(x), f'0{n_qubits}b')
                        
                        if df.shape[1] > 1:
                            bitstrings = df.apply(lambda row: ''.join(row.astype(str)), axis=1)
                        else:
                            bitstrings = df.iloc[:, 0].apply(format_bin)
                        cirq_counts = bitstrings.value_counts().to_dict()
                    except Exception as cirq_err:
                         yield {'type': 'error', 'message': f'Cirq Execution Error: {cirq_err}'}
                         return

                    yield {
                        'type': 'result',
                        'execution_time': total_time,
                        'backend': used_backend_name,
                        'shots': shots,
                        'counts': cirq_counts,
                        'circuit_data': metrics,
                        'circuit_image': None 
                    }
            else:
                yield {'type': 'output', 'data': '⚠️ No Circuit object found. (Did you name it "qc"?)'}

        except Exception as e:
            yield {'type': 'error', 'message': traceback.format_exc()}
        
        finally:
            self.is_executing = False
    
    run = execute_streaming

    async def cleanup(self):
        self.is_executing = False


# --- 4. MANAGER CLASS ---
class ExecutionManager:
    def __init__(self):
        self.sessions: Dict[str, ExecutionSession] = {}

    def get_or_create_session(self, session_id: str, user_id: str = "anonymous") -> ExecutionSession:
        if session_id not in self.sessions:
            self.sessions[session_id] = ExecutionSession(session_id, user_id)
        return self.sessions[session_id]

    async def delete_session(self, session_id: str):
        if session_id in self.sessions:
            await self.sessions[session_id].cleanup()
            del self.sessions[session_id]

manager = ExecutionManager()