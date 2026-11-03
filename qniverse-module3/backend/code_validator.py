import ast

SAFE_MODULES = {
    'math', 'numpy', 'pandas', 'scipy', 'matplotlib', 
    'qiskit', 'cirq', 'random', 'time', 'itertools', 'fractions'
}

UNSAFE_MODULES = {
    'os', 'sys', 'subprocess', 'shutil', 'socket', 'requests', 'urllib',
    'http', 'xml', 'pickle', 'marshal', 'importlib', 'builtins'
}

def validate_code(code: str):
    """
    Analyzes code using AST to detect unsafe imports or usage.
    Returns (bool, str): (is_valid, error_message)
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        return False, f"Syntax Error: {e}"

    for node in ast.walk(tree):
        # 1. Check imports
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            names = []
            if isinstance(node, ast.Import):
                names = [n.name.split('.')[0] for n in node.names]
            elif isinstance(node, ast.ImportFrom):
                if node.module:
                    names = [node.module.split('.')[0]]
            
            for name in names:
                if name in UNSAFE_MODULES:
                    return False, f"Security Error: Import of '{name}' is restricted."

        # 2. Check for __builtins__ access
        if isinstance(node, ast.Name) and node.id == '__builtins__':
            return False, "Security Error: Direct access to '__builtins__' is restricted."
            
        # 3. Check for open() calls (file system access)
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id == 'open':
                return False, "Security Error: File system access via 'open()' is restricted."

    return True, "Valid"