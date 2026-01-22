"""
API endpoints for AI-powered workflow features
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services.ai_service import ai_service, WorkflowAction, ParsedWorkflow

router = APIRouter()


class TaskDescriptionRequest(BaseModel):
    """Request to parse task description"""
    description: str = Field(..., description="Natural language task description")
    target_url: Optional[str] = Field(None, description="Target website URL")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")


class ParsedWorkflowResponse(BaseModel):
    """Response with parsed workflow"""
    workflow: ParsedWorkflow
    suggestions: List[str] = []


class SuggestActionsRequest(BaseModel):
    """Request for action suggestions"""
    current_steps: List[Dict[str, Any]] = Field(..., description="Current workflow steps")
    page_context: Optional[Dict[str, Any]] = Field(None, description="Current page context")


class ValidateWorkflowRequest(BaseModel):
    """Request to validate workflow"""
    steps: List[Dict[str, Any]] = Field(..., description="Workflow steps to validate")


class OptimizeWorkflowRequest(BaseModel):
    """Request to optimize workflow"""
    steps: List[Dict[str, Any]] = Field(..., description="Workflow steps to optimize")


@router.post("/parse-task", response_model=ParsedWorkflowResponse)
async def parse_task_description(
    request: TaskDescriptionRequest,
    db: Session = Depends(get_db)
):
    """
    Parse natural language task description into workflow steps
    
    Example:
    ```json
    {
      "description": "Login to GitHub and search for 'react' repositories",
      "target_url": "https://github.com"
    }
    ```
    """
    try:
        workflow = await ai_service.parse_task_description(
            description=request.description,
            target_url=request.target_url,
            context=request.context
        )
        
        # Generate helpful suggestions
        suggestions = [
            "Review the generated steps and adjust selectors if needed",
            "Test the workflow in Playground before running",
        ]
        
        if workflow.requires_auth:
            suggestions.append("This workflow requires authentication - ensure credentials are configured")
            
        if workflow.confidence < 0.7:
            suggestions.append("Low confidence score - manual review recommended")
        
        return ParsedWorkflowResponse(
            workflow=workflow,
            suggestions=suggestions
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse task: {str(e)}")


@router.post("/suggest-actions")
async def suggest_next_actions(
    request: SuggestActionsRequest,
    db: Session = Depends(get_db)
):
    """
    Suggest next possible actions based on current workflow state
    
    Example:
    ```json
    {
      "current_steps": [
        {"type": "navigate", "url": "https://example.com"}
      ]
    }
    ```
    """
    try:
        suggestions = await ai_service.suggest_next_actions(
            current_steps=request.current_steps,
            page_context=request.page_context
        )
        
        return {
            "suggestions": [s.dict() for s in suggestions],
            "count": len(suggestions)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate suggestions: {str(e)}")


@router.post("/validate-workflow")
async def validate_workflow(
    request: ValidateWorkflowRequest,
    db: Session = Depends(get_db)
):
    """
    Validate workflow for common issues and best practices
    
    Example:
    ```json
    {
      "steps": [
        {"type": "click", "selector": "button"}
      ]
    }
    ```
    """
    try:
        validation = await ai_service.validate_workflow(request.steps)
        
        return validation
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to validate workflow: {str(e)}")


@router.post("/optimize-workflow")
async def optimize_workflow(
    request: OptimizeWorkflowRequest,
    db: Session = Depends(get_db)
):
    """
    Optimize workflow by removing redundant steps and adding necessary waits
    
    Example:
    ```json
    {
      "steps": [
        {"type": "navigate", "url": "https://example.com"},
        {"type": "click", "selector": "button"}
      ]
    }
    ```
    """
    try:
        optimized_steps = await ai_service.optimize_workflow(request.steps)
        
        return {
            "original_count": len(request.steps),
            "optimized_count": len(optimized_steps),
            "steps": optimized_steps,
            "improvements": [
                f"Optimized from {len(request.steps)} to {len(optimized_steps)} steps"
            ]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to optimize workflow: {str(e)}")


@router.get("/workflow-templates")
async def get_workflow_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    Get pre-built workflow templates
    
    Query params:
    - category: Filter by category (login, scraping, testing, etc.)
    - search: Search templates by name/description
    """
    # TODO: Implement database storage for templates
    templates = [
        {
            "id": "login-generic",
            "name": "Generic Login",
            "description": "Login to any website with email/password",
            "category": "authentication",
            "steps": [
                {"type": "navigate", "url": "{{LOGIN_URL}}", "description": "Go to login page"},
                {"type": "type", "selector": "input[type='email']", "value": "{{EMAIL}}", "description": "Enter email"},
                {"type": "type", "selector": "input[type='password']", "value": "{{PASSWORD}}", "description": "Enter password"},
                {"type": "click", "selector": "button[type='submit']", "description": "Click login button"}
            ],
            "variables": ["LOGIN_URL", "EMAIL", "PASSWORD"],
            "usage_count": 1250
        },
        {
            "id": "extract-table",
            "name": "Extract Table Data",
            "description": "Extract data from HTML tables",
            "category": "scraping",
            "steps": [
                {"type": "navigate", "url": "{{PAGE_URL}}", "description": "Navigate to page"},
                {"type": "wait", "selector": "table", "description": "Wait for table to load"},
                {"type": "extract", "selector": "table tr", "description": "Extract table rows"}
            ],
            "variables": ["PAGE_URL"],
            "usage_count": 890
        },
        {
            "id": "form-fill",
            "name": "Auto-fill Form",
            "description": "Automatically fill out web forms",
            "category": "automation",
            "steps": [
                {"type": "navigate", "url": "{{FORM_URL}}", "description": "Go to form page"},
                {"type": "type", "selector": "input[name='name']", "value": "{{NAME}}", "description": "Fill name"},
                {"type": "type", "selector": "input[name='email']", "value": "{{EMAIL}}", "description": "Fill email"},
                {"type": "select", "selector": "select[name='country']", "value": "{{COUNTRY}}", "description": "Select country"},
                {"type": "click", "selector": "button[type='submit']", "description": "Submit form"}
            ],
            "variables": ["FORM_URL", "NAME", "EMAIL", "COUNTRY"],
            "usage_count": 650
        }
    ]
    
    # Filter by category
    if category:
        templates = [t for t in templates if t["category"] == category]
    
    # Filter by search
    if search:
        search_lower = search.lower()
        templates = [
            t for t in templates 
            if search_lower in t["name"].lower() or search_lower in t["description"].lower()
        ]
    
    return {
        "templates": templates,
        "count": len(templates),
        "categories": ["authentication", "scraping", "automation", "testing"]
    }
