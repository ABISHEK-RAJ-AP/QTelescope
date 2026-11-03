import re
from typing import Dict, Any, List

# Try importing Cirq (fail silently if not installed)
try:
    import cirq
    CIRQ_AVAILABLE = True
except ImportError:
    CIRQ_AVAILABLE = False

class CircuitAnalyzer:
    @staticmethod
    def analyze_circuit_object(circuit) -> Dict[str, Any]:
        """
        Dispatches to the correct analyzer based on the circuit object type.
        Supports both Qiskit (QuantumCircuit) and Cirq (Circuit).
        """
        type_name = type(circuit).__name__
        
        # 1. Qiskit Support
        if 'QuantumCircuit' in type_name:
            return CircuitAnalyzer._analyze_qiskit_object(circuit)
        
        # 2. Cirq Support
        if CIRQ_AVAILABLE and isinstance(circuit, cirq.Circuit):
            return CircuitAnalyzer._analyze_cirq_object(circuit)
            
        return {'error': 'Unknown circuit type', 'num_qubits': 0, 'ops': []}

    # ==========================================
    # 1. QISKIT ANALYZER (Dynamic Object)
    # ==========================================
    @staticmethod
    def _analyze_qiskit_object(circuit) -> Dict[str, Any]:
        ops = []
        
        # Iterate over every instruction in the circuit
        for instruction in circuit.data:
            op = instruction.operation
            qubits = instruction.qubits
            clbits = instruction.clbits
            
            # Get integer indices for qubits
            q_indices = [circuit.find_bit(q).index for q in qubits]
            
            # Get integer indices for classical bits (if any)
            c_indices = [circuit.find_bit(c).index for c in clbits]
            
            name = op.name.upper()
            
            # --- GENERIC GATE EXTRACTION ---
            # Qiskit stores control and target qubits in a single list `instruction.qubits`.
            # The control qubits come first, followed by target qubits.
            # We can check op.num_ctrl_qubits to split them.
            
            num_ctrl = getattr(op, 'num_ctrl_qubits', 0)
            
            # Convert ALL qubit objects to integer indices
            all_qubit_indices = [circuit.find_bit(q).index for q in qubits]
            
            # Split into Controls and Targets
            ctrl_indices = all_qubit_indices[:num_ctrl]
            tgt_indices = all_qubit_indices[num_ctrl:]
            
            gate_info = {
                'gate': name,
                'controls': ctrl_indices,
                'targets': tgt_indices,
                'params': getattr(op, 'params', [])  # Capture rotation angles etc.
            }
            
            # Special Handling for Measurement
            if name == 'MEASURE':
                # Map classical bits 1-to-1 or as specified
                c_indices = [circuit.find_bit(c).index for c in clbits]
                gate_info['c_targets'] = c_indices if c_indices else [0]
                
            # Special Handling for Barrier (Frontend needs to know to draw line)
            if name == 'BARRIER':
                gate_info['gate'] = 'BARRIER'
                
            ops.append(gate_info)

        # Count gates using Qiskit's native method
        gates = {}
        if hasattr(circuit, 'count_ops'):
            try:
                gates = dict(circuit.count_ops())
            except:
                pass

        return {
            'num_qubits': circuit.num_qubits,
            'num_clbits': circuit.num_clbits,
            'ops': ops,
            'depth': circuit.depth(),
            'gate_count': len(ops),
            'gates': gates # Add detailed gate breakdown
        }

    # ==========================================
    # 2. CIRQ ANALYZER (Dynamic Object)
    # ==========================================
    @staticmethod
    def _analyze_cirq_object(circuit) -> Dict[str, Any]:
        ops = []
        
        # 1. Map Cirq Qubits to Integers
        # Cirq qubits can be NamedQubit, LineQubit, GridQubit. 
        # We sort them to create a consistent 0, 1, 2... index map.
        all_qubits = sorted(list(circuit.all_qubits()))
        qubit_map = {q: i for i, q in enumerate(all_qubits)}
        
        # 2. Iterate Operations
        for moment in circuit:
            for op in moment:
                gate_type = None
                
                # Detect Gate Type
                if op.gate == cirq.H: gate_type = 'H'
                elif op.gate == cirq.X: gate_type = 'X'
                elif op.gate == cirq.Z: gate_type = 'Z'
                elif op.gate == cirq.CNOT: gate_type = 'CX'
                elif isinstance(op.gate, cirq.MeasurementGate): gate_type = 'MEASURE'
                
                if gate_type:
                    # Convert specific qubits to integers
                    indices = [qubit_map[q] for q in op.qubits]
                    
                    if gate_type == 'CX':
                        ops.append({'gate': 'CX', 'controls': [indices[0]], 'targets': [indices[1]]})
                    elif gate_type == 'MEASURE':
                        # Cirq doesn't use classical registers explicitly in the same way.
                        # We map the measurement line 1-to-1 to the qubit index for visualization.
                        for idx in indices:
                            ops.append({'gate': 'MEASURE', 'targets': [idx], 'c_targets': [idx]})
                    else:
                        ops.append({'gate': gate_type, 'targets': [indices[0]]})

        return {
            'num_qubits': len(all_qubits),
            'num_clbits': len(all_qubits), # Default equal to qubits for Viz
            'ops': ops,
            'depth': len(circuit),
            'gate_count': len(list(circuit.all_operations()))
        }

    # ==========================================
    # 3. STATIC FALLBACK (Regex / Text Analysis)
    # ==========================================
    @staticmethod
    def analyze_qiskit(code: str) -> Dict[str, Any]:
        """
        Legacy static analyzer. Used only if the dynamic execution fails
        or for quick pre-checks.
        """
        metrics = {
            'num_qubits': 2,
            'num_clbits': 2,
            'ops': []
        }
        
        # Basic Register Detection
        qr_match = re.search(r'QuantumRegister\((\d+)', code)
        if qr_match: metrics['num_qubits'] = int(qr_match.group(1))

        cr_match = re.search(r'ClassicalRegister\((\d+)', code)
        if cr_match: metrics['num_clbits'] = int(cr_match.group(1))
        
        return metrics

    @staticmethod
    def _extract_qubit(line):
        match = re.search(r'\[(\d+)\]|\((\d+)\)', line)
        if match: return int(match.group(1) or match.group(2))
        return None

    @staticmethod
    def _extract_two_qubits(line):
        all_digits = re.findall(r'\d+', line)
        if len(all_digits) >= 2:
            return [int(all_digits[-2]), int(all_digits[-1])]
        return None