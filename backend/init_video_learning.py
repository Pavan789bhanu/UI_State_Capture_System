"""Tool to initialize VisionAgent with video learning and test report generation."""

import asyncio
import json
from pathlib import Path

from app.automation.agent.vision_agent import VisionAgent
from app.automation.utils.logger import log


async def main():
    """Initialize VisionAgent and demonstrate video learning capabilities."""
    
    print("\n" + "="*80)
    print("🎥 VisionAgent Video Learning Initialization")
    print("="*80 + "\n")
    
    # Initialize VisionAgent
    print("1. Initializing VisionAgent...")
    try:
        agent = VisionAgent()
        print("   ✓ VisionAgent initialized successfully\n")
    except Exception as e:
        print(f"   ✗ Error initializing VisionAgent: {e}")
        return
    
    # Learn from demo videos
    print("2. Analyzing demonstration videos...")
    print("   Reading from: /data/*.mp4")
    
    try:
        learning_context = await agent.learn_from_demo_videos()
        print(f"   ✓ Video learning completed\n")
        
        # Display learned patterns
        print("="*80)
        print("📚 LEARNED PATTERNS FROM DEMO VIDEOS")
        print("="*80 + "\n")
        
        print("Workflow Patterns:")
        for category, patterns in learning_context.get("workflow_patterns", {}).items():
            print(f"\n  {category.upper()}:")
            if isinstance(patterns, list):
                for pattern in patterns:
                    print(f"    • {pattern}")
            else:
                print(f"    • {patterns}")
        
        print("\n" + "-"*80 + "\n")
        print("Success Criteria:")
        for category, criteria in learning_context.get("success_criteria", {}).items():
            print(f"\n  {category.upper()}:")
            if isinstance(criteria, list):
                for criterion in criteria:
                    print(f"    ✓ {criterion}")
            else:
                print(f"    ✓ {criteria}")
        
        print("\n" + "-"*80 + "\n")
        print("Report Structure:")
        report_structure = learning_context.get("report_structure", {})
        sections = report_structure.get("sections", [])
        print(f"\n  Required Sections: {len(sections)}")
        for section in sections:
            print(f"    • {section}")
        
        print("\n" + "-"*80 + "\n")
        print("Ending Note Template:")
        template = learning_context.get("ending_note_template", "No template defined")
        print(f"\n  {template}\n")
        
        # Save learned context to file
        output_file = Path("video_learning_context.json")
        with open(output_file, 'w') as f:
            json.dump(learning_context, f, indent=2)
        print(f"  ✓ Learning context saved to: {output_file}\n")
        
    except Exception as e:
        print(f"   ✗ Error during video learning: {e}\n")
        return
    
    # Test report generation
    print("="*80)
    print("📝 TESTING REPORT GENERATION")
    print("="*80 + "\n")
    
    # Sample workflow execution
    sample_task = "Create a new project in Linear named Q1 2026 Planning"
    sample_actions = [
        {"type": "navigate", "reason": "Navigate to Linear application"},
        {"type": "wait", "reason": "Wait for dashboard to load"},
        {"type": "click", "reason": "Click 'New Project' button in sidebar"},
        {"type": "wait", "reason": "Wait for project creation form"},
        {"type": "type", "reason": "Enter project title: 'Q1 2026 Planning'"},
        {"type": "type", "reason": "Enter project description"},
        {"type": "click", "reason": "Click 'Create' button"},
        {"type": "wait", "reason": "Wait for project creation confirmation"},
        {"type": "verify", "reason": "Verify project appears in project list"},
    ]
    sample_final_state = {
        "success": True,
        "url": "https://linear.app/projects/q1-2026-planning",
        "verified": True
    }
    
    print(f"Task: {sample_task}")
    print(f"Actions: {len(sample_actions)} steps")
    print(f"Status: Success\n")
    
    try:
        report = await agent.generate_comprehensive_report(
            task=sample_task,
            actions_taken=sample_actions,
            success=True,
            final_state=sample_final_state
        )
        
        print("Generated Report:")
        print("-"*80)
        print(report)
        print("-"*80 + "\n")
        
        # Save sample report
        report_file = Path("sample_workflow_report.md")
        with open(report_file, 'w') as f:
            f.write(report)
        print(f"✓ Sample report saved to: {report_file}\n")
        
    except Exception as e:
        print(f"✗ Error generating report: {e}\n")
    
    print("="*80)
    print("✅ Video Learning Initialization Complete!")
    print("="*80 + "\n")
    
    print("Summary:")
    print(f"  • VisionAgent learned from {len(list(Path('/Users/pavankumarmalasani/Downloads/ui_capture_system/data').glob('*.mp4')))} demo videos")
    print(f"  • Extracted workflow patterns for multiple categories")
    print(f"  • Learned report writing structure and best practices")
    print(f"  • Ready to generate comprehensive reports with ending notes")
    print("\nThe VisionAgent will now use these learned patterns for all workflows!\n")


if __name__ == "__main__":
    asyncio.run(main())
