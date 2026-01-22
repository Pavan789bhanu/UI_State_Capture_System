from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_superuser: bool
    created_at: datetime

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Workflow Schemas
class WorkflowBase(BaseModel):
    name: str
    description: Optional[str] = None
    app_name: str
    start_url: Optional[str] = None
    login_email: Optional[str] = None
    login_password: Optional[str] = None

class WorkflowCreate(WorkflowBase):
    pass

class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    app_name: Optional[str] = None
    start_url: Optional[str] = None
    login_email: Optional[str] = None
    login_password: Optional[str] = None
    status: Optional[str] = None

class Workflow(WorkflowBase):
    id: int
    status: str
    owner_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class WorkflowResponse(Workflow):
    """Workflow with execution statistics"""
    execution_count: int = 0
    success_count: int = 0
    last_executed: Optional[datetime] = None

    class Config:
        from_attributes = True

# Execution Schemas
class ExecutionBase(BaseModel):
    workflow_id: int

class ExecutionCreate(ExecutionBase):
    pass

class Execution(ExecutionBase):
    id: int
    status: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    error_message: Optional[str] = None
    result: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ExecutionResponse(Execution):
    """Execution with workflow details"""
    workflow_name: str

    class Config:
        from_attributes = True
