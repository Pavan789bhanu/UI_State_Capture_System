"""Workflow execution service that bridges API to automation engine."""

import asyncio
import json
from typing import Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.automation.workflow.workflow_engine import WorkflowEngine
from app.automation.browser.browser_manager import BrowserManager
from app.automation.agent.vision_agent import VisionAgent
from app.automation.agent.planner_agent import PlannerAgent
from app.automation.browser.auth_manager import AuthManager
from app.services.websocket_manager import manager
from app.services.task_queue import task_queue
from app.models.models import Execution, Workflow, ExecutionStatus
from app.core.database import SessionLocal
from app.core.config import settings, APP_URL_MAPPINGS


async def execute_workflow(execution_id: int, db: Session = None):
    """
    Execute a workflow using the automation engine.
    
    Args:
        execution_id: ID of the execution record
        db: Database session (optional, will create new one if not provided)
    """
    print(f"[WORKFLOW EXECUTOR] Starting execution {execution_id}")
    
    # Create new session if not provided
    if db is None:
        db = SessionLocal()
        close_db = True
    else:
        close_db = False
    
    try:
        # Get execution and workflow from database
        execution = db.query(Execution).filter(Execution.id == execution_id).first()
        if not execution:
            print(f"[ERROR] Execution {execution_id} not found")
            return
        
        workflow = db.query(Workflow).filter(Workflow.id == execution.workflow_id).first()
        if not workflow:
            print(f"[ERROR] Workflow {execution.workflow_id} not found")
            execution.status = ExecutionStatus.FAILED
            execution.completed_at = datetime.utcnow()
            db.commit()
            return
        
        print(f"[WORKFLOW EXECUTOR] Executing workflow: {workflow.name} (ID: {workflow.id})")
        
        # Update status to running
        execution.status = ExecutionStatus.RUNNING
        execution.started_at = datetime.utcnow()
        db.commit()
        
        # Broadcast start event
        await manager.send_execution_update(
            execution_id=execution_id,
            event="started",
            data={
                "workflow_id": workflow.id,
                "workflow_name": workflow.name,
                "status": "RUNNING",
                "started_at": execution.started_at.isoformat() if execution.started_at else None
            }
        )
        print(f"[WORKFLOW EXECUTOR] Broadcasted start event for execution {execution_id}")
        
        # Extract task from workflow fields
        app_name = workflow.app_name or ""
        url = workflow.start_url or ""
        
        # Auto-generate URL from app name if not provided
        if not url and app_name:
            url = APP_URL_MAPPINGS.get(app_name.lower(), "")
            if url:
                print(f"[WORKFLOW EXECUTOR] Auto-generated URL for {app_name}: {url}")
            else:
                print(f"[WORKFLOW EXECUTOR] Warning: No URL mapping found for {app_name}")
        
        # Validate we have a URL
        if not url:
            raise ValueError(f"No start URL provided or found for app '{app_name}'. Please provide a start_url in the workflow.")
        
        # Generate task description from workflow
        if workflow.description:
            task = workflow.description
        else:
            task = f"Automate {workflow.name} in {app_name}" if app_name else f"Execute workflow: {workflow.name}"
        
        if not task:
            raise ValueError("No task specified in workflow")
        
        print(f"[WORKFLOW EXECUTOR] Task: {task}")
        print(f"[WORKFLOW EXECUTOR] App: {app_name}")
        print(f"[WORKFLOW EXECUTOR] URL: {url}")
        
        # Initialize automation components
        # Set headless=False for development to see browser interactions
        browser_manager = BrowserManager(headless=False)
        vision_agent = VisionAgent()
        planner_agent = PlannerAgent()
        
        # Initialize auth manager with credentials
        # Priority: workflow credentials > .env credentials
        auth_email = workflow.login_email or settings.LOGIN_EMAIL
        auth_password = workflow.login_password or settings.LOGIN_PASSWORD
        
        auth_manager = None
        if auth_email and auth_password:
            auth_manager = AuthManager(
                email=auth_email,
                password=auth_password
            )
            print(f"[WORKFLOW EXECUTOR] Using credentials for: {auth_email}")
        else:
            print("[WORKFLOW EXECUTOR] No credentials available - workflows may fail if login required")
        
        # Create workflow engine with correct parameter names
        engine = WorkflowEngine(
            browser=browser_manager,
            vision_agent=vision_agent,
            planner_agent=planner_agent,
            auth=auth_manager
        )
        
        # Send progress update
        await manager.send_execution_update(
            execution_id=execution_id,
            event="progress",
            data={
                "message": "Initializing automation engine...",
                "step": "setup"
            }
        )
        
        # Execute the task
        try:
            await engine.run_task(
                task=task,
                app_name=app_name,
                start_url=url
            )
            
            # Get the HTML report path
            html_report = engine.report_path if hasattr(engine, 'report_path') and engine.report_path else None
            
            # Check if task actually completed successfully
            # The engine stores this in the dataset metadata
            task_completed = False
            completion_status = "failure"
            completion_percentage = 0
            
            # Safely access dataset attribute
            try:
                if hasattr(engine, 'dataset') and engine.dataset:
                    # Find the completion metadata entry
                    completion_entry = next(
                        (entry for entry in engine.dataset if entry.get("completion_status")),
                        None
                    )
                    if completion_entry:
                        completion_status = completion_entry.get("completion_status", "failure")
                        completion_percentage = completion_entry.get("completion_percentage", 0)
                        task_completed = completion_status == "success"
                        print(f"[WORKFLOW EXECUTOR] Task completion: {completion_status} ({completion_percentage}%)")
            except Exception as dataset_error:
                print(f"[WORKFLOW EXECUTOR] Warning: Could not access dataset: {dataset_error}")
            
            # Update execution status based on actual completion
            if task_completed:
                execution.status = ExecutionStatus.SUCCESS
                status_message = "Workflow executed successfully"
            elif completion_status == "partial":
                execution.status = ExecutionStatus.FAILED
                status_message = f"Workflow partially completed ({completion_percentage}%)"
            else:
                execution.status = ExecutionStatus.FAILED
                status_message = f"Workflow execution failed ({completion_percentage}%)"
            
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                duration = (execution.completed_at - execution.started_at).total_seconds()
                execution.duration = int(duration)
            
            result_data = {
                "success": task_completed,
                "message": status_message,
                "task": task,
                "app_name": app_name,
                "url": url,
                "completion_status": completion_status,
                "completion_percentage": completion_percentage
            }
            
            # Add HTML report path if available
            if html_report:
                result_data["html_report"] = html_report
            
            execution.result = json.dumps(result_data)
            
            # Broadcast completion
            await manager.send_execution_update(
                execution_id=execution_id,
                event="completed" if task_completed else "failed",
                data={
                    "status": execution.status.value if hasattr(execution.status, 'value') else str(execution.status),
                    "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                    "duration": execution.duration,
                    "result": execution.result,
                    "success": task_completed
                }
            )
            
            if task_completed:
                print(f"[WORKFLOW EXECUTOR] Execution {execution_id} completed successfully in {execution.duration}s")
            else:
                print(f"[WORKFLOW EXECUTOR] Execution {execution_id} failed: {status_message}")
            
        except Exception as exec_error:
            # Handle execution failure
            execution.status = ExecutionStatus.FAILED
            execution.completed_at = datetime.utcnow()
            if execution.started_at:
                duration = (execution.completed_at - execution.started_at).total_seconds()
                execution.duration = int(duration)
            execution.result = json.dumps({
                "success": False,
                "error": str(exec_error),
                "message": "Workflow execution failed"
            })
            
            # Broadcast failure
            await manager.send_execution_update(
                execution_id=execution_id,
                event="failed",
                data={
                    "status": "FAILED",
                    "completed_at": execution.completed_at.isoformat() if execution.completed_at else None,
                    "duration": execution.duration,
                    "error": str(exec_error),
                    "success": False
                }
            )
            print(f"[WORKFLOW EXECUTOR] Execution {execution_id} failed: {str(exec_error)}")
            
            raise
        
        finally:
            # Cleanup
            await browser_manager.close()
            db.commit()
    
    except Exception as e:
        print(f"Error executing workflow: {e}")
        if db:
            try:
                execution = db.query(Execution).filter(Execution.id == execution_id).first()
                if execution:
                    execution.status = ExecutionStatus.FAILED
                    execution.completed_at = datetime.utcnow()
                    execution.result = json.dumps({"success": False, "error": str(e)})
                    db.commit()
            except Exception as db_error:
                print(f"Error updating execution status: {db_error}")
        raise
    
    finally:
        if close_db and db:
            db.close()
