import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import asyncio

# --- IMPORT THE MANAGER ---
# Ensure execution_manager.py is in the same folder
from execution_manager import manager

app = FastAPI()

# Enable CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    print("Health Check - Backend is running with updated Execution Manager")
    return {"status": "Quantum Backend Running"}

@app.websocket("/ws/execute/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    await websocket.accept()
    
    # FIX 1: Use the correct method name 'get_or_create_session'
    # FIX 2: Do NOT use 'await' here (the method is not async)
  
    # FIX 3: It returns the session object directly, so we don't need a separate get_session call
    session = manager.get_or_create_session(client_id)
    
    try:
        while True:
            # Wait for code from Frontend
            data = await websocket.receive_json()
            
            if data.get('type') == 'execute':
                code = data.get('code')
                shots = data.get('shots', 1024)
                
                cell_id = data.get('cell_id')
                
                language = data.get('language', 'python')
                
                context = data.get('context', 'editor') # 'editor' or 'notebook'
                backend = data.get('backend') # Optional backend

                # Stream the execution results back to the frontend
                # This part is correct: execute_streaming is an async generator
                async for response in session.execute_streaming(code, shots=shots, language=language, context=context, backend_param=backend):
                    if cell_id:
                        response['cell_id'] = cell_id
                    await websocket.send_json(response)
                
                # Signal execution completion
                done_msg = {'type': 'done'}
                if cell_id:
                    done_msg['cell_id'] = cell_id
                await websocket.send_json(done_msg)
                    
    except WebSocketDisconnect:
        # FIX 4: Use the correct cleanup method 'delete_session'
        await manager.delete_session(client_id)
        print(f"Client {client_id} disconnected")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=12346, reload=True)