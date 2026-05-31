"""
Automation endpoint — natural language → live browser execution.

A single English query is all you need:
  POST  /api/automation/run           → plan + execute, return full results
  WS    /api/automation/run-live      → plan + execute, stream progress + screenshots
"""
import asyncio
import base64
import json
from typing import Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from app.services.ai_service import ai_service
from app.services.playground_executor import PlaygroundExecutor

router = APIRouter()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class RunRequest(BaseModel):
    query: str = Field(..., description="Plain English description of the automation task")
    url: Optional[str] = Field(None, description="Target URL (optional — the AI will infer it from the query when omitted)")
    headless: bool = Field(default=False, description="Run the browser in headless (invisible) mode")


# ---------------------------------------------------------------------------
# REST endpoint — plan + execute and return all results at once
# ---------------------------------------------------------------------------

@router.post("/run")
async def run_automation(request: RunRequest):
    """
    Convert a plain English query into a live browser automation and return the results.

    Example body:
    ```json
    {"query": "Go to github.com and search for 'fastapi'", "url": "https://github.com"}
    ```
    """
    parsed = await ai_service.parse_task_description(request.query, request.url)

    executor = PlaygroundExecutor()
    results = []
    try:
        await executor.initialize(headless=request.headless)

        for i, step in enumerate(parsed.steps):
            result = await executor.execute_step(step.dict())
            if result.get("screenshot"):
                result["screenshot"] = base64.b64encode(result["screenshot"]).decode("utf-8")
            results.append({"step_index": i, "step": step.dict(), "result": result})
            if result["status"] == "error":
                break
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        await executor.cleanup()

    success = bool(results) and all(r["result"]["status"] == "success" for r in results)
    return {
        "query": request.query,
        "steps_planned": len(parsed.steps),
        "steps_executed": len(results),
        "success": success,
        "confidence": parsed.confidence,
        "requires_auth": parsed.requires_auth,
        "warnings": parsed.warnings,
        "results": results,
    }


# ---------------------------------------------------------------------------
# WebSocket endpoint — stream progress and screenshots in real-time
# ---------------------------------------------------------------------------

@router.websocket("/run-live")
async def run_automation_live(websocket: WebSocket):
    """
    WebSocket endpoint for streaming browser automation execution.

    Client → Server (JSON):
        {"query": "...", "url": "...", "headless": false}

    Server → Client (JSON event stream):
        {"type": "planning_start",    "message": "..."}
        {"type": "planning_complete", "steps": [...], "confidence": 0.9, ...}
        {"type": "browser_starting",  "message": "..."}
        {"type": "browser_ready"}
        {"type": "step_start",        "step_index": 0, "step": {...}, "total_steps": N}
        {"type": "step_complete",     "step_index": 0, "result": {...}, "total_steps": N}
        {"type": "execution_stopped", "reason": "...", "step_index": N}   ← on first error
        {"type": "execution_complete","success": true, "steps_executed": N}
        {"type": "error",             "message": "..."}
    """
    await websocket.accept()
    executor = PlaygroundExecutor()

    async def send(payload: dict):
        try:
            await websocket.send_json(payload)
        except Exception:
            pass

    try:
        data = await websocket.receive_json()
        query: str = data.get("query", "").strip()
        url: Optional[str] = data.get("url") or None
        headless: bool = bool(data.get("headless", False))

        if not query:
            await send({"type": "error", "message": "query is required"})
            return

        # ── Phase 1: Planning ──────────────────────────────────────────────
        await send({"type": "planning_start", "message": "AI is planning your automation…"})

        try:
            parsed = await ai_service.parse_task_description(query, url)
        except Exception as exc:
            await send({"type": "error", "message": f"Planning failed: {exc}"})
            return

        steps = [s.dict() for s in parsed.steps]

        await send({
            "type": "planning_complete",
            "steps": steps,
            "confidence": parsed.confidence,
            "requires_auth": parsed.requires_auth,
            "warnings": parsed.warnings,
            "estimated_duration": parsed.estimated_duration,
        })

        if not steps:
            await send({"type": "error", "message": "AI could not generate any steps for this query."})
            return

        # ── Phase 2: Browser start ─────────────────────────────────────────
        await send({"type": "browser_starting", "message": "Launching browser…"})
        try:
            await executor.initialize(headless=headless)
        except Exception as exc:
            await send({"type": "error", "message": f"Browser failed to start: {exc}"})
            return
        await send({"type": "browser_ready"})

        # ── Phase 3: Execute steps ─────────────────────────────────────────
        executed = 0
        failed = False

        for i, step in enumerate(steps):
            await send({
                "type": "step_start",
                "step_index": i,
                "step": step,
                "total_steps": len(steps),
            })

            result = await executor.execute_step(step)

            if result.get("screenshot"):
                result["screenshot"] = base64.b64encode(result["screenshot"]).decode("utf-8")

            executed += 1

            await send({
                "type": "step_complete",
                "step_index": i,
                "step": step,
                "result": result,
                "total_steps": len(steps),
            })

            if result["status"] == "error":
                failed = True
                await send({
                    "type": "execution_stopped",
                    "reason": result["message"],
                    "step_index": i,
                })
                break

        # ── Phase 4: Summary ───────────────────────────────────────────────
        await send({
            "type": "execution_complete",
            "success": not failed,
            "steps_planned": len(steps),
            "steps_executed": executed,
            "query": query,
        })

    except WebSocketDisconnect:
        pass
    except Exception as exc:
        await send({"type": "error", "message": str(exc)})
    finally:
        await executor.cleanup()
