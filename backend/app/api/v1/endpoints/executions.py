from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from fastapi.responses import HTMLResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List
from pathlib import Path
from datetime import datetime
import json

from app.core.database import get_db
from app.models.models import Execution as ExecutionModel, Workflow as WorkflowModel, User as UserModel, ExecutionStatus
from app.schemas.schemas import Execution, ExecutionCreate, ExecutionResponse
from app.api.v1.endpoints.auth import get_current_user
from app.services.workflow_executor import execute_workflow
from app.services.task_queue import task_queue

router = APIRouter()

@router.get("/", response_model=List[ExecutionResponse])
def get_executions(
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page (max 100)"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    # Calculate offset from page number
    skip = (page - 1) * page_size
    
    # Query executions with workflow names (filtered by current user)
    results = db.query(
        ExecutionModel,
        WorkflowModel.name.label('workflow_name')
    ).join(
        WorkflowModel, ExecutionModel.workflow_id == WorkflowModel.id
    ).filter(
        WorkflowModel.owner_id == current_user.id
    ).order_by(
        ExecutionModel.created_at.desc()
    ).offset(skip).limit(page_size).all()
    
    # Build response with workflow names
    executions = []
    for execution, workflow_name in results:
        # Calculate duration
        duration = None
        if execution.started_at:
            if execution.completed_at:
                duration = int((execution.completed_at - execution.started_at).total_seconds())
            elif execution.status.value == 'running':
                from datetime import datetime
                duration = int((datetime.utcnow() - execution.started_at).total_seconds())
        
        executions.append({
            'id': execution.id,
            'workflow_id': execution.workflow_id,
            'workflow_name': workflow_name,
            'status': execution.status.value if hasattr(execution.status, 'value') else str(execution.status),
            'started_at': execution.started_at,
            'completed_at': execution.completed_at,
            'duration': duration,
            'error_message': execution.error_message,
            'result': execution.result,
            'created_at': execution.created_at
        })
    
    return executions

@router.post("/", response_model=Execution)
async def create_execution(
    execution: ExecutionCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    workflow = db.query(WorkflowModel).filter(
        WorkflowModel.id == execution.workflow_id,
        WorkflowModel.owner_id == current_user.id
    ).first()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    
    # Create execution record with pending status
    db_execution = ExecutionModel(
        workflow_id=execution.workflow_id,
        status=ExecutionStatus.PENDING
    )
    db.add(db_execution)
    db.commit()
    db.refresh(db_execution)
    
    # Add to concurrent task queue
    task_id = f"execution_{db_execution.id}"
    await task_queue.add_task(
        task_id=task_id,
        task_func=execute_workflow,
        execution_id=db_execution.id,
        db=None  # Will create new session in executor
    )
    
    return db_execution

@router.get("/{execution_id}/report", response_class=HTMLResponse)
def get_execution_report(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    Get the HTML report for a specific execution.
    Returns the execution report HTML file if it exists.
    """
    # Get the execution
    execution = db.query(ExecutionModel).filter(
        ExecutionModel.id == execution_id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Parse the result JSON to get the HTML report path
    if not execution.result:
        raise HTTPException(
            status_code=404, 
            detail="No execution result available. The workflow may have failed before generating a report."
        )
    
    try:
        result_data = json.loads(execution.result)
        
        # Check if execution was successful
        if not result_data.get("success", False):
            error_msg = result_data.get("error", "Unknown error")
            raise HTTPException(
                status_code=404, 
                detail=f"Execution failed: {error_msg}. No report was generated."
            )
        
        html_report_path = result_data.get("html_report")
        
        if not html_report_path:
            raise HTTPException(
                status_code=404, 
                detail="No HTML report generated for this execution. Check execution logs for details."
            )
        
        # Check if the file exists
        report_file = Path(html_report_path)
        if not report_file.exists():
            raise HTTPException(
                status_code=404, 
                detail=f"HTML report file not found at: {html_report_path}"
            )
        
        # Read and return the HTML content
        html_content = report_file.read_text(encoding="utf-8")
        return HTMLResponse(content=html_content, status_code=200)
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid execution result data")
    except HTTPException:
        raise  # Re-raise HTTP exceptions as-is
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading report: {str(e)}")

@router.get("/{execution_id}/{filename}")
def get_execution_file(
    execution_id: int,
    filename: str,
    db: Session = Depends(get_db)
):
    """
    Serve static files (images, etc.) from the execution directory.
    """
    # Get the execution
    execution = db.query(ExecutionModel).filter(
        ExecutionModel.id == execution_id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Parse the result JSON to get the report path
    if not execution.result:
        raise HTTPException(status_code=404, detail="No execution result available")
    
    try:
        result_data = json.loads(execution.result)
        html_report_path = result_data.get("html_report")
        
        if not html_report_path:
            raise HTTPException(status_code=404, detail="No HTML report available")
        
        # Get the directory containing the report
        report_dir = Path(html_report_path).parent
        
        # Construct the file path (prevent directory traversal)
        if ".." in filename or filename.startswith("/"):
            raise HTTPException(status_code=400, detail="Invalid filename")
        
        file_path = report_dir / filename
        
        if not file_path.exists() or not file_path.is_file():
            raise HTTPException(status_code=404, detail=f"File not found: {filename}")
        
        # Return the file
        return FileResponse(file_path)
        
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="Invalid execution result data")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {str(e)}")

@router.get("/{execution_id}", response_model=Execution)
def get_execution(
    execution_id: int,
    db: Session = Depends(get_db)
):
    # TODO: Add authentication back
    execution = db.query(ExecutionModel).filter(
        ExecutionModel.id == execution_id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return execution

@router.delete("/{execution_id}")
def delete_execution(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete an execution record.
    """
    # Get the execution
    execution = db.query(ExecutionModel).filter(
        ExecutionModel.id == execution_id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Delete the execution
    db.delete(execution)
    db.commit()
    
    return {"message": "Execution deleted successfully", "id": execution_id}


@router.get("/queue/status")
async def get_queue_status():
    """
    Get the status of the concurrent task queue.
    
    Returns information about running, queued, and completed tasks.
    """
    return {
        "queue_stats": task_queue.get_stats(),
        "all_tasks": task_queue.get_all_tasks()
    }


@router.post("/{execution_id}/cancel")
async def cancel_execution(
    execution_id: int,
    db: Session = Depends(get_db)
):
    """
    Cancel a running or queued execution.
    """
    # Check if execution exists
    execution = db.query(ExecutionModel).filter(
        ExecutionModel.id == execution_id
    ).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    
    # Try to cancel the task
    task_id = f"execution_{execution_id}"
    cancelled = await task_queue.cancel_task(task_id)
    
    if cancelled:
        # Update execution status
        execution.status = ExecutionStatus.FAILED
        execution.completed_at = datetime.utcnow()
        execution.error_message = "Execution cancelled by user"
        db.commit()
        
        return {
            "message": "Execution cancelled successfully",
            "execution_id": execution_id,
            "cancelled": True
        }
    else:
        return {
            "message": "Execution could not be cancelled (already completed or not found in queue)",
            "execution_id": execution_id,
            "cancelled": False
        }
