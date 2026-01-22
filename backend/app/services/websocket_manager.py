"""WebSocket connection manager for real-time updates."""

from typing import List, Dict, Any, Optional
from fastapi import WebSocket
import json
import asyncio
from datetime import datetime

class ConnectionManager:
    """Manage WebSocket connections and broadcast messages."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.user_connections: Dict[int, List[WebSocket]] = {}  # user_id -> connections
    
    async def connect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Accept and register a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if user_id:
            if user_id not in self.user_connections:
                self.user_connections[user_id] = []
            self.user_connections[user_id].append(websocket)
        
        print(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket, user_id: Optional[int] = None):
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if user_id and user_id in self.user_connections:
            if websocket in self.user_connections[user_id]:
                self.user_connections[user_id].remove(websocket)
            if not self.user_connections[user_id]:
                del self.user_connections[user_id]
        
        print(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_personal_message(self, message: Dict[str, Any], websocket: WebSocket):
        """Send a message to a specific connection."""
        try:
            await websocket.send_json(message)
        except Exception as e:
            print(f"Error sending personal message: {e}")
    
    async def broadcast(self, message: Dict[str, Any]):
        """Broadcast a message to all connected clients."""
        if not self.active_connections:
            return
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.now().isoformat()
        
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to connection: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)
    
    async def broadcast_to_user(self, user_id: int, message: Dict[str, Any]):
        """Broadcast a message to all connections of a specific user."""
        if user_id not in self.user_connections:
            return
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.now().isoformat()
        
        disconnected = []
        for connection in self.user_connections[user_id]:
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting to user connection: {e}")
                disconnected.append(connection)
        
        # Clean up disconnected clients
        for conn in disconnected:
            if conn in self.user_connections[user_id]:
                self.user_connections[user_id].remove(conn)
    
    async def send_workflow_update(self, workflow_id: int, event: str, data: Dict[str, Any]):
        """Send a workflow-related update."""
        message = {
            "type": f"workflow_{event}",
            "workflow_id": workflow_id,
            "data": data,
        }
        await self.broadcast(message)
    
    async def send_execution_update(self, execution_id: int, event: str, data: Dict[str, Any]):
        """Send an execution-related update."""
        message = {
            "type": f"execution_{event}",
            "execution_id": execution_id,
            "data": data,
        }
        await self.broadcast(message)

# Global instance
manager = ConnectionManager()
