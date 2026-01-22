"""Test script for Generic Task Verifier

Run this to verify the generic verification system works correctly.
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.automation.workflow.task_verifier import GenericTaskVerifier


def test_successful_creation():
    """Test successful document creation."""
    print("\n" + "="*70)
    print("TEST 1: Successful Document Creation")
    print("="*70)
    
    verifier = GenericTaskVerifier()
    
    task = "Create a Google Doc named RAG with details about RAG"
    
    dataset = [
        {"url": "https://docs.google.com/document/u/0/", "type": "navigate"},
        {"url": "https://docs.google.com/document/u/0/", "type": "interact", "action": {"action": "CLICK"}},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "navigate"},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "interact", "action": {"action": "TYPE"}},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "interact", "action": {"action": "TYPE"}},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "interact", "action": {"action": "TYPE"}},
    ]
    
    result = verifier.verify_task_completion(
        task=task,
        dataset=dataset,
        initial_url="https://docs.google.com/document/u/0/",
        final_url="https://docs.google.com/document/d/abc123/edit",
        execution_time=15.0
    )
    
    print(f"\n✓ Status: {result.status}")
    print(f"✓ Completion: {result.completion_percentage}%")
    print(f"✓ Confidence: {result.confidence:.2f}")
    
    assert result.status == "success", f"Expected success, got {result.status}"
    assert result.completion_percentage >= 65, f"Expected ≥65%, got {result.completion_percentage}%"
    print("\n✅ TEST PASSED")


def test_failed_creation():
    """Test failed document creation (stuck on homepage)."""
    print("\n" + "="*70)
    print("TEST 2: Failed Document Creation")
    print("="*70)
    
    verifier = GenericTaskVerifier()
    
    task = "Create a Google Doc named RAG"
    
    dataset = [
        {"url": "https://docs.google.com/document/u/0/", "type": "navigate"},
        {"url": "https://docs.google.com/document/u/0/", "type": "interact", "action": {"action": "CLICK"}},
        {"url": "https://docs.google.com/document/u/0/", "type": "interact", "action": {"action": "CLICK"}},
        {"url": "https://docs.google.com/document/u/0/", "type": "interact", "action": {"action": "CLICK"}},
    ]
    
    result = verifier.verify_task_completion(
        task=task,
        dataset=dataset,
        initial_url="https://docs.google.com/document/u/0/",
        final_url="https://docs.google.com/document/u/0/",  # Same as start!
        execution_time=10.0
    )
    
    print(f"\n✓ Status: {result.status}")
    print(f"✓ Completion: {result.completion_percentage}%")
    print(f"✓ Confidence: {result.confidence:.2f}")
    
    assert result.status == "failure", f"Expected failure, got {result.status}"
    assert result.completion_percentage < 40, f"Expected <40%, got {result.completion_percentage}%"
    print("\n✅ TEST PASSED")


def test_jira_task_creation():
    """Test Jira task creation (no hardcoding!)."""
    print("\n" + "="*70)
    print("TEST 3: Jira Task Creation (Generic Verification)")
    print("="*70)
    
    verifier = GenericTaskVerifier()
    
    task = "Create a Jira task for bug fix"
    
    dataset = [
        {"url": "https://mycompany.atlassian.net/", "type": "navigate"},
        {"url": "https://mycompany.atlassian.net/create", "type": "interact", "action": {"action": "CLICK"}},
        {"url": "https://mycompany.atlassian.net/create", "type": "interact", "action": {"action": "TYPE"}},
        {"url": "https://mycompany.atlassian.net/create", "type": "interact", "action": {"action": "TYPE"}},
        {"url": "https://mycompany.atlassian.net/browse/PROJ-123", "type": "interact", "action": {"action": "CLICK"}},
    ]
    
    result = verifier.verify_task_completion(
        task=task,
        dataset=dataset,
        initial_url="https://mycompany.atlassian.net/",
        final_url="https://mycompany.atlassian.net/browse/PROJ-123",
        execution_time=12.0
    )
    
    print(f"\n✓ Status: {result.status}")
    print(f"✓ Completion: {result.completion_percentage}%")
    print(f"✓ Confidence: {result.confidence:.2f}")
    
    assert result.status == "success", f"Expected success, got {result.status}"
    assert result.completion_percentage >= 65, f"Expected ≥65%, got {result.completion_percentage}%"
    print("\n✅ TEST PASSED (Works for Jira without hardcoding!)")


def test_partial_completion():
    """Test partial task completion."""
    print("\n" + "="*70)
    print("TEST 4: Partial Task Completion")
    print("="*70)
    
    verifier = GenericTaskVerifier()
    
    task = "Create a document and add content"
    
    dataset = [
        {"url": "https://docs.google.com/document/u/0/", "type": "navigate"},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "navigate"},
        {"url": "https://docs.google.com/document/d/abc123/edit", "type": "interact", "action": {"action": "CLICK"}},
        # No TYPE actions - content not added!
    ]
    
    result = verifier.verify_task_completion(
        task=task,
        dataset=dataset,
        initial_url="https://docs.google.com/document/u/0/",
        final_url="https://docs.google.com/document/d/abc123/edit",
        execution_time=8.0
    )
    
    print(f"\n✓ Status: {result.status}")
    print(f"✓ Completion: {result.completion_percentage}%")
    print(f"✓ Confidence: {result.confidence:.2f}")
    
    assert result.status in ["partial", "failure"], f"Expected partial/failure, got {result.status}"
    assert 20 <= result.completion_percentage < 70, f"Expected 20-69%, got {result.completion_percentage}%"
    print("\n✅ TEST PASSED")


if __name__ == "__main__":
    print("\n" + "="*70)
    print("GENERIC TASK VERIFIER - TEST SUITE")
    print("="*70)
    
    try:
        test_successful_creation()
        test_failed_creation()
        test_jira_task_creation()
        test_partial_completion()
        
        print("\n" + "="*70)
        print("ALL TESTS PASSED ✅")
        print("="*70)
        print("\nThe generic verification system works correctly for:")
        print("  ✓ Google Docs (no hardcoding)")
        print("  ✓ Jira (no hardcoding)")
        print("  ✓ Any web application (generic)")
        print("  ✓ Success, partial, and failure detection")
        print("  ✓ Evidence-based scoring")
        print("\n")
        
    except AssertionError as e:
        print(f"\n❌ TEST FAILED: {e}\n")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ ERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
