#!/usr/bin/env python3
"""Comprehensive backend health check for dependency and attribute errors."""

import sys

def test_core_imports():
    """Test core module imports."""
    print("\n[1/8] Testing core imports...")
    try:
        from app.main import app
        from app.core.config import settings
        from app.core.database import get_db, SessionLocal
        print("  ✓ Core modules imported successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_workflow_engine():
    """Test workflow engine and its attributes."""
    print("\n[2/8] Testing workflow engine...")
    try:
        from app.automation.workflow.workflow_engine import WorkflowEngine
        engine = WorkflowEngine()
        
        required_attrs = [
            'browser', 'vision_agent', 'planner_agent', 'dataset',
            'workflow_learner', 'loop_detector', 'completion_checker'
        ]
        
        all_ok = True
        for attr in required_attrs:
            if hasattr(engine, attr):
                print(f"  ✓ WorkflowEngine.{attr} exists")
            else:
                print(f"  ✗ WorkflowEngine.{attr} MISSING")
                all_ok = False
        
        if hasattr(engine, 'browser_manager'):
            print("  ⚠️  WorkflowEngine has 'browser_manager' (should be 'browser')")
        
        return all_ok
    except Exception as e:
        print(f"  ✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_task_verifier():
    """Test task verifier."""
    print("\n[3/8] Testing task verifier...")
    try:
        from app.automation.workflow.task_verifier import GenericTaskVerifier, VerificationResult
        verifier = GenericTaskVerifier()
        print("  ✓ GenericTaskVerifier instantiated successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_workflow_executor():
    """Test workflow executor."""
    print("\n[4/8] Testing workflow executor...")
    try:
        from app.services.workflow_executor import execute_workflow
        print("  ✓ execute_workflow function imported successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_api_endpoints():
    """Test API endpoints."""
    print("\n[5/8] Testing API endpoints...")
    try:
        from app.api.v1.endpoints.workflows import router as workflows_router
        from app.api.v1.endpoints.executions import router as executions_router
        print("  ✓ API endpoint routers imported successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_services():
    """Test service modules."""
    print("\n[6/8] Testing services...")
    try:
        from app.services.task_queue import task_queue
        from app.services.websocket_manager import manager
        from app.services.workflow_learner import WorkflowLearner
        from app.services.content_generator import ContentGenerator
        print("  ✓ Service modules imported successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_utilities():
    """Test utility classes."""
    print("\n[7/8] Testing utility classes...")
    try:
        from app.automation.utils.screenshot_analyzer import ScreenshotAnalyzer
        from app.automation.utils.url_validator import URLValidator
        from app.automation.workflow.loop_detector import LoopDetector
        from app.automation.workflow.completion_checker import CompletionChecker
        print("  ✓ Utility classes imported successfully")
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def test_environment():
    """Test environment configuration."""
    print("\n[8/8] Testing environment configuration...")
    try:
        from app.core.config import settings
        
        if hasattr(settings, 'OPENAI_API_KEY') and settings.OPENAI_API_KEY:
            print(f"  ✓ OPENAI_API_KEY loaded ({len(settings.OPENAI_API_KEY)} chars)")
        else:
            print("  ⚠️  OPENAI_API_KEY not set in environment")
        
        if hasattr(settings, 'DATABASE_URL'):
            print(f"  ✓ DATABASE_URL configured")
        
        if hasattr(settings, 'SCREENSHOT_DIR'):
            print(f"  ✓ SCREENSHOT_DIR: {settings.SCREENSHOT_DIR}")
        
        return True
    except Exception as e:
        print(f"  ✗ Error: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 70)
    print("COMPREHENSIVE BACKEND DEPENDENCY & ATTRIBUTE CHECK")
    print("=" * 70)
    
    tests = [
        test_core_imports,
        test_workflow_engine,
        test_task_verifier,
        test_workflow_executor,
        test_api_endpoints,
        test_services,
        test_utilities,
        test_environment
    ]
    
    results = [test() for test in tests]
    
    print("\n" + "=" * 70)
    print("TEST SUMMARY")
    print("=" * 70)
    
    passed = sum(results)
    total = len(results)
    
    if passed == total:
        print(f"✅ ALL {total} TESTS PASSED - Backend is healthy!")
        return 0
    else:
        print(f"❌ {total - passed}/{total} TESTS FAILED")
        return 1

if __name__ == "__main__":
    sys.exit(main())
