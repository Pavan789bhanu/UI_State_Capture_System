"""
Comprehensive test suite for the Video Learning System.

Tests:
1. VisionAgent video learning initialization
2. Pattern extraction from demo videos
3. Report generation with ending notes
4. Integration with workflow engine
"""

import asyncio
import json
from pathlib import Path
from typing import Dict, List

from app.automation.agent.vision_agent import VisionAgent
from app.automation.utils.logger import log


class VideoLearningTester:
    """Test suite for video learning capabilities."""
    
    def __init__(self):
        self.agent = None
        self.test_results: List[Dict] = []
    
    def log_result(self, test_name: str, passed: bool, details: str = ""):
        """Log test result."""
        status = "✅ PASS" if passed else "❌ FAIL"
        self.test_results.append({
            "test": test_name,
            "passed": passed,
            "details": details
        })
        print(f"{status} - {test_name}")
        if details:
            print(f"     {details}")
    
    async def test_initialization(self) -> bool:
        """Test 1: VisionAgent initialization."""
        print("\n" + "="*80)
        print("TEST 1: VisionAgent Initialization")
        print("="*80)
        
        try:
            self.agent = VisionAgent()
            self.log_result("VisionAgent initialization", True, "Agent created successfully")
            return True
        except Exception as e:
            self.log_result("VisionAgent initialization", False, f"Error: {e}")
            return False
    
    async def test_video_discovery(self) -> bool:
        """Test 2: Demo video discovery."""
        print("\n" + "="*80)
        print("TEST 2: Demo Video Discovery")
        print("="*80)
        
        try:
            data_dir = Path("/Users/pavankumarmalasani/Downloads/ui_capture_system/data")
            video_files = list(data_dir.glob("*.mp4"))
            
            if len(video_files) == 8:
                self.log_result("Video discovery", True, f"Found all 8 demo videos")
                for video in video_files:
                    print(f"     • {video.name}")
                return True
            else:
                self.log_result("Video discovery", False, f"Expected 8 videos, found {len(video_files)}")
                return False
        except Exception as e:
            self.log_result("Video discovery", False, f"Error: {e}")
            return False
    
    async def test_video_learning(self) -> bool:
        """Test 3: Video learning and pattern extraction."""
        print("\n" + "="*80)
        print("TEST 3: Video Learning and Pattern Extraction")
        print("="*80)
        
        try:
            learning_context = await self.agent.learn_from_demo_videos()
            
            # Verify structure
            required_keys = ["workflow_patterns", "success_criteria", "report_structure", "ending_note_template"]
            missing_keys = [key for key in required_keys if key not in learning_context]
            
            if missing_keys:
                self.log_result("Video learning", False, f"Missing keys: {missing_keys}")
                return False
            
            # Verify workflow patterns
            workflow_patterns = learning_context.get("workflow_patterns", {})
            expected_categories = ["project_management", "document_creation", "content_research", "travel_booking", "ecommerce"]
            found_categories = list(workflow_patterns.keys())
            
            if len(found_categories) >= 3:  # At least 3 categories
                self.log_result("Pattern extraction", True, f"Extracted patterns for {len(found_categories)} categories")
                for category in found_categories:
                    print(f"     • {category}")
                return True
            else:
                self.log_result("Pattern extraction", False, f"Expected at least 3 categories, found {len(found_categories)}")
                return False
        except Exception as e:
            self.log_result("Video learning", False, f"Error: {e}")
            import traceback
            print(traceback.format_exc())
            return False
    
    async def test_report_generation(self) -> bool:
        """Test 4: Comprehensive report generation."""
        print("\n" + "="*80)
        print("TEST 4: Comprehensive Report Generation")
        print("="*80)
        
        # Test scenarios for different workflow types
        test_scenarios = [
            {
                "name": "Project Management",
                "task": "Create a new issue in Jira for bug tracking",
                "actions": [
                    {"type": "navigate", "reason": "Navigate to Jira project"},
                    {"type": "click", "reason": "Click 'Create Issue' button"},
                    {"type": "type", "reason": "Enter issue title"},
                    {"type": "click", "reason": "Select issue type: Bug"},
                    {"type": "type", "reason": "Enter issue description"},
                    {"type": "click", "reason": "Click 'Create' button"},
                    {"type": "verify", "reason": "Verify issue appears in backlog"}
                ],
                "success": True,
                "final_state": {"url": "https://jira.atlassian.com/browse/BUG-123", "verified": True}
            },
            {
                "name": "E-commerce",
                "task": "Purchase a pair of shoes from Crocs website",
                "actions": [
                    {"type": "navigate", "reason": "Navigate to Crocs.com"},
                    {"type": "type", "reason": "Search for 'classic clogs'"},
                    {"type": "click", "reason": "Select product from results"},
                    {"type": "click", "reason": "Select size: M10"},
                    {"type": "click", "reason": "Add to cart"},
                    {"type": "click", "reason": "Proceed to checkout"},
                    {"type": "type", "reason": "Enter shipping information"},
                    {"type": "type", "reason": "Enter payment details"},
                    {"type": "click", "reason": "Place order"},
                    {"type": "verify", "reason": "Verify order confirmation"}
                ],
                "success": True,
                "final_state": {"url": "https://crocs.com/order-confirmation", "verified": True}
            }
        ]
        
        all_passed = True
        
        for scenario in test_scenarios:
            try:
                print(f"\nScenario: {scenario['name']}")
                print(f"Task: {scenario['task']}")
                
                report = await self.agent.generate_comprehensive_report(
                    task=scenario["task"],
                    actions_taken=scenario["actions"],
                    success=scenario["success"],
                    final_state=scenario["final_state"]
                )
                
                # Verify report structure
                required_sections = ["Executive Summary", "Workflow Steps", "Success Criteria"]
                missing_sections = [section for section in required_sections if section not in report]
                
                if missing_sections:
                    self.log_result(f"Report generation - {scenario['name']}", False, 
                                   f"Missing sections: {missing_sections}")
                    all_passed = False
                    continue
                
                # Verify ending note exists
                if "Ending Note" not in report and "ending note" not in report.lower():
                    self.log_result(f"Report generation - {scenario['name']}", False, 
                                   "Missing ending note")
                    all_passed = False
                    continue
                
                # Save report for review
                report_file = Path(f"test_report_{scenario['name'].lower().replace(' ', '_')}.md")
                report_file.write_text(report)
                
                self.log_result(f"Report generation - {scenario['name']}", True, 
                               f"Report saved to {report_file}")
                print(f"     Report length: {len(report)} characters")
                print(f"     Contains ending note: Yes")
                
            except Exception as e:
                self.log_result(f"Report generation - {scenario['name']}", False, f"Error: {e}")
                all_passed = False
        
        return all_passed
    
    async def test_ending_note_quality(self) -> bool:
        """Test 5: Ending note quality and relevance."""
        print("\n" + "="*80)
        print("TEST 5: Ending Note Quality")
        print("="*80)
        
        try:
            # Generate a report
            task = "Research and publish an article on Medium about AI trends"
            actions = [
                {"type": "navigate", "reason": "Navigate to Medium.com"},
                {"type": "click", "reason": "Click 'Write' button"},
                {"type": "type", "reason": "Enter article title"},
                {"type": "type", "reason": "Write article content"},
                {"type": "click", "reason": "Add tags"},
                {"type": "click", "reason": "Publish article"},
                {"type": "verify", "reason": "Verify article is live"}
            ]
            
            report = await self.agent.generate_comprehensive_report(
                task=task,
                actions_taken=actions,
                success=True,
                final_state={"url": "https://medium.com/@user/article", "verified": True}
            )
            
            # Extract ending note section
            ending_note_start = report.find("## Ending Note")
            if ending_note_start == -1:
                ending_note_start = report.lower().find("ending note")
            
            if ending_note_start == -1:
                self.log_result("Ending note presence", False, "Ending note not found in report")
                return False
            
            ending_note = report[ending_note_start:]
            
            # Quality checks
            quality_checks = {
                "Contains task reference": task.split()[0].lower() in ending_note.lower(),
                "Contains actionable next steps": any(phrase in ending_note.lower() for phrase in ["next steps", "your next", "follow up"]),
                "Professional tone": any(phrase in ending_note.lower() for phrase in ["thank you", "ensure", "please"]),
                "Sufficient length": len(ending_note) > 100
            }
            
            passed_checks = sum(quality_checks.values())
            total_checks = len(quality_checks)
            
            print(f"\nEnding Note Quality Analysis:")
            for check, result in quality_checks.items():
                status = "✓" if result else "✗"
                print(f"  {status} {check}")
            
            if passed_checks >= 3:  # At least 3 out of 4 checks
                self.log_result("Ending note quality", True, 
                               f"Passed {passed_checks}/{total_checks} quality checks")
                return True
            else:
                self.log_result("Ending note quality", False, 
                               f"Only passed {passed_checks}/{total_checks} quality checks")
                return False
        except Exception as e:
            self.log_result("Ending note quality", False, f"Error: {e}")
            return False
    
    async def run_all_tests(self):
        """Run all tests and display summary."""
        print("\n" + "="*80)
        print("🧪 VIDEO LEARNING SYSTEM - COMPREHENSIVE TEST SUITE")
        print("="*80)
        
        # Run tests
        await self.test_initialization()
        if self.agent:
            await self.test_video_discovery()
            await self.test_video_learning()
            await self.test_report_generation()
            await self.test_ending_note_quality()
        
        # Display summary
        print("\n" + "="*80)
        print("📊 TEST SUMMARY")
        print("="*80 + "\n")
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results if result["passed"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        # Detailed results
        if failed_tests > 0:
            print("\nFailed Tests:")
            for result in self.test_results:
                if not result["passed"]:
                    print(f"  ❌ {result['test']}")
                    if result["details"]:
                        print(f"     {result['details']}")
        
        print("\n" + "="*80)
        
        if failed_tests == 0:
            print("🎉 ALL TESTS PASSED! Video Learning System is fully operational.")
        else:
            print(f"⚠️  {failed_tests} test(s) failed. Please review the errors above.")
        
        print("="*80 + "\n")


async def main():
    """Run the test suite."""
    tester = VideoLearningTester()
    await tester.run_all_tests()


if __name__ == "__main__":
    asyncio.run(main())
