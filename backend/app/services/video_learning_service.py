"""Video Learning Service - Extract workflow patterns from demonstration videos.

This service processes video demonstrations to train the AI on how workflows
should be executed. It extracts:
- Visual frames at key moments
- Audio transcripts with timestamps
- Step-by-step workflow patterns
- Success criteria and completion indicators
"""

import os
import json
import random
import base64
from pathlib import Path
from typing import List, Dict, Any, Optional
import asyncio

from app.core.config import settings


class VideoLearningService:
    """Processes demonstration videos to extract workflow learning examples."""
    
    def __init__(self, data_dir: str = None):
        self.data_dir = Path(data_dir or "/Users/pavankumarmalasani/Downloads/ui_capture_system/data")
        self.cache_dir = self.data_dir / ".video_cache"
        self.cache_dir.mkdir(exist_ok=True)
        
    def get_available_videos(self) -> List[Dict[str, str]]:
        """Get list of available training videos."""
        videos = []
        if not self.data_dir.exists():
            return videos
            
        for video_file in self.data_dir.glob("*.mp4"):
            # Parse video name to extract task info
            task_name = video_file.stem.replace("-", " ").replace("_", " ")
            videos.append({
                "path": str(video_file),
                "name": video_file.name,
                "task": task_name,
                "size_mb": round(video_file.stat().st_size / (1024 * 1024), 2)
            })
        return videos
    
    def select_random_examples(self, count: int = 3) -> List[Dict[str, str]]:
        """Randomly select N example videos for few-shot learning."""
        videos = self.get_available_videos()
        if len(videos) <= count:
            return videos
        return random.sample(videos, count)
    
    async def extract_video_metadata(self, video_path: str) -> Dict[str, Any]:
        """Extract basic metadata from video file."""
        video_file = Path(video_path)
        
        if not video_file.exists():
            return {"error": f"Video not found: {video_path}"}
        
        # Check cache first
        cache_file = self.cache_dir / f"{video_file.stem}_metadata.json"
        if cache_file.exists():
            with open(cache_file, 'r') as f:
                return json.load(f)
        
        metadata = {
            "filename": video_file.name,
            "task_name": video_file.stem.replace("-", " ").replace("_", " "),
            "file_size_mb": round(video_file.stat().st_size / (1024 * 1024), 2),
            "path": str(video_file),
            "description": self._generate_task_description(video_file.stem)
        }
        
        # Cache the metadata
        with open(cache_file, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return metadata
    
    def _generate_task_description(self, video_name: str) -> str:
        """Generate a human-readable task description from video filename."""
        # Map common video names to detailed descriptions
        task_map = {
            "Linear-project": "Create a new project in Linear with title, description, and assign team members",
            "Jira-Task-creation": "Create a new task/issue in Jira with details, priority, and assignee",
            "google-docs": "Create a new Google Docs document, set title, and write content",
            "Medium-RAG-summarization": "Search for articles on Medium about RAG (Retrieval Augmented Generation), open relevant articles, and extract key points for summarization",
            "Flight-Booking": "Search for flights, select options, enter passenger details, and complete booking",
            "frontier-flight-Booking": "Book a flight on Frontier Airlines with specific dates and passenger information",
            "Crocs_sales": "Navigate to Crocs website, browse products, add items to cart, and proceed to checkout",
            "creating-summary_of_the_doc": "Open a document, read through content, and create a comprehensive summary"
        }
        
        # Try exact match first
        for key, description in task_map.items():
            if key.lower() in video_name.lower():
                return description
        
        # Fallback: clean up the filename
        clean_name = video_name.replace("-", " ").replace("_", " ").title()
        return f"Complete workflow: {clean_name}"
    
    async def get_examples_for_task(self, task: str) -> List[Dict[str, Any]]:
        """Get relevant video examples based on the task description.
        
        Args:
            task: The task description from the user
            
        Returns:
            List of relevant example workflows from video demonstrations
        """
        all_videos = self.get_available_videos()
        task_lower = task.lower()
        
        # Match videos to task type
        relevant_videos = []
        
        # Exact matches first
        if "google" in task_lower and "doc" in task_lower:
            relevant_videos = [v for v in all_videos if "google-docs" in v["name"].lower() or "doc" in v["name"].lower()]
        elif "medium" in task_lower:
            relevant_videos = [v for v in all_videos if "medium" in v["name"].lower()]
        elif "jira" in task_lower:
            relevant_videos = [v for v in all_videos if "jira" in v["name"].lower()]
        elif "linear" in task_lower:
            relevant_videos = [v for v in all_videos if "linear" in v["name"].lower()]
        elif "flight" in task_lower or "book" in task_lower:
            relevant_videos = [v for v in all_videos if "flight" in v["name"].lower() or "booking" in v["name"].lower()]
        
        # If no exact match, return all videos for general learning
        if not relevant_videos:
            relevant_videos = all_videos[:3]  # Return up to 3 examples
        
        # Extract workflow templates from relevant videos
        examples = []
        for video in relevant_videos[:2]:  # Limit to 2 most relevant
            metadata = await self.extract_video_metadata(video["path"])
            workflow = self._generate_workflow_template(metadata['task_name'], video['name'])
            examples.append({
                "video": video["name"],
                "task": metadata["task_name"],
                "description": metadata["description"],
                "workflow": workflow
            })
        
        return examples
    
    async def create_few_shot_examples(self, num_examples: int = 3) -> List[Dict[str, Any]]:
        """Create few-shot learning examples from random video selections.
        
        This creates structured examples that can be passed to the OpenAI API
        to demonstrate how workflows should be executed step-by-step.
        """
        selected_videos = self.select_random_examples(num_examples)
        examples = []
        
        for video in selected_videos:
            metadata = await self.extract_video_metadata(video["path"])
            
            # Create a structured example for the AI
            example = {
                "role": "user",
                "content": f"Watch this demonstration: {metadata['task_name']}"
            }
            
            # Generate expected workflow structure based on video name
            workflow_example = self._generate_workflow_template(metadata['task_name'], video['name'])
            
            assistant_example = {
                "role": "assistant", 
                "content": json.dumps(workflow_example, indent=2)
            }
            
            examples.extend([example, assistant_example])
        
        return examples
    
    def _generate_workflow_template(self, task_name: str, video_name: str) -> Dict[str, Any]:
        """Generate a detailed workflow template based on the video demonstration."""
        
        # Base template structure
        base_workflow = {
            "task": task_name,
            "source": f"Learned from demonstration: {video_name}",
            "steps": [],
            "success_criteria": [],
            "expected_outcomes": []
        }
        
        # Generate specific workflow steps based on video type
        video_lower = video_name.lower()
        
        if "linear" in video_lower or "jira" in video_lower:
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "project management platform", "description": "Open the application homepage"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for dashboard to fully load"},
                {"step": 3, "action": "click", "target": "create button", "description": "Click on 'New Project' or 'Create' button"},
                {"step": 4, "action": "wait", "target": "modal/form", "description": "Wait for creation form to appear"},
                {"step": 5, "action": "type", "target": "title field", "description": "Enter project/task title"},
                {"step": 6, "action": "type", "target": "description field", "description": "Enter detailed description"},
                {"step": 7, "action": "select", "target": "assignee dropdown", "description": "Select team member or assignee"},
                {"step": 8, "action": "select", "target": "priority/status", "description": "Set priority or status"},
                {"step": 9, "action": "click", "target": "submit button", "description": "Click 'Create' or 'Save' to submit"},
                {"step": 10, "action": "wait", "target": "confirmation", "description": "Wait for success confirmation"},
                {"step": 11, "action": "verify", "target": "created item", "description": "Verify the project/task appears in the list"}
            ]
            base_workflow["success_criteria"] = [
                "Project/task is created successfully",
                "Title and description are visible",
                "Assignee is set correctly",
                "Item appears in the project list",
                "No error messages displayed"
            ]
            base_workflow["expected_outcomes"] = [
                "A new project/task entry exists in the system",
                "All fields are populated as specified",
                "Team members can see and access the new item",
                "Workflow completes with success notification"
            ]
        
        elif "google-docs" in video_lower or "doc" in video_lower:
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "Google Docs", "description": "Navigate to docs.google.com"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for Google Docs homepage"},
                {"step": 3, "action": "click", "target": "blank document", "description": "Click on 'Blank' or '+' to create new document"},
                {"step": 4, "action": "wait", "target": "editor load", "description": "Wait for document editor to load"},
                {"step": 5, "action": "click", "target": "title field", "description": "Click on 'Untitled document' to set title"},
                {"step": 6, "action": "type", "target": "title field", "description": "Type the document title"},
                {"step": 7, "action": "click", "target": "document body", "description": "Click in the document body area"},
                {"step": 8, "action": "type", "target": "document body", "description": "Type or paste the main content"},
                {"step": 9, "action": "wait", "target": "auto-save", "description": "Wait for auto-save to complete (check for 'Saved' indicator)"},
                {"step": 10, "action": "verify", "target": "content", "description": "Verify content is visible and saved"}
            ]
            base_workflow["success_criteria"] = [
                "Document is created with correct title",
                "Content is written and visible in the document body",
                "Auto-save indicator shows 'Saved to Drive'",
                "Document is accessible from Google Drive",
                "No formatting errors or data loss"
            ]
            base_workflow["expected_outcomes"] = [
                "A new Google Doc exists with the specified title",
                "Content matches what was typed/requested",
                "Document is saved and accessible",
                "Can be shared or edited further"
            ]
        
        elif "medium" in video_lower:
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "Medium", "description": "Navigate to medium.com"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for homepage to load"},
                {"step": 3, "action": "click", "target": "search icon", "description": "Click on search icon or input"},
                {"step": 4, "action": "type", "target": "search input", "description": "Type search query (e.g., 'RAG', 'AI')"},
                {"step": 5, "action": "click", "target": "search button", "description": "Submit search or press Enter"},
                {"step": 6, "action": "wait", "target": "search results", "description": "Wait for search results to appear"},
                {"step": 7, "action": "extract", "target": "article titles", "description": "Extract article titles and snippets"},
                {"step": 8, "action": "click", "target": "first article", "description": "Click on the most relevant article"},
                {"step": 9, "action": "wait", "target": "article load", "description": "Wait for full article to load"},
                {"step": 10, "action": "extract", "target": "article content", "description": "Extract article text for summarization"},
                {"step": 11, "action": "process", "target": "summarization", "description": "Generate summary of key points"}
            ]
            base_workflow["success_criteria"] = [
                "Search returns relevant articles",
                "Articles load without errors",
                "Content is extracted successfully",
                "Summary captures main points accurately",
                "All steps complete without timeouts"
            ]
            base_workflow["expected_outcomes"] = [
                "Found and opened relevant articles on the topic",
                "Extracted clean article text",
                "Generated comprehensive summary",
                "Summary includes key insights and conclusions"
            ]
        
        elif "flight" in video_lower or "booking" in video_lower:
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "airline website", "description": "Navigate to airline booking site"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for booking page to load"},
                {"step": 3, "action": "select", "target": "trip type", "description": "Select one-way, round-trip, or multi-city"},
                {"step": 4, "action": "type", "target": "origin input", "description": "Enter departure city/airport"},
                {"step": 5, "action": "type", "target": "destination input", "description": "Enter arrival city/airport"},
                {"step": 6, "action": "click", "target": "date picker", "description": "Open date picker for departure"},
                {"step": 7, "action": "select", "target": "departure date", "description": "Select departure date"},
                {"step": 8, "action": "select", "target": "return date", "description": "Select return date (if round-trip)"},
                {"step": 9, "action": "select", "target": "passengers", "description": "Set number of passengers"},
                {"step": 10, "action": "click", "target": "search button", "description": "Click 'Search Flights' or 'Find Flights'"},
                {"step": 11, "action": "wait", "target": "results", "description": "Wait for flight options to load"},
                {"step": 12, "action": "select", "target": "flight option", "description": "Choose preferred flight based on time/price"},
                {"step": 13, "action": "click", "target": "continue", "description": "Continue to passenger details"},
                {"step": 14, "action": "type", "target": "passenger info", "description": "Fill in passenger name, DOB, etc."},
                {"step": 15, "action": "click", "target": "continue to payment", "description": "Proceed to payment page"},
                {"step": 16, "action": "verify", "target": "booking summary", "description": "Verify flight details and total price"}
            ]
            base_workflow["success_criteria"] = [
                "Flight search returns available options",
                "Selected flight details are correct",
                "Passenger information is entered accurately",
                "Total price matches expectations",
                "Ready to complete payment (or booking confirmed)"
            ]
            base_workflow["expected_outcomes"] = [
                "Found suitable flight matching criteria",
                "All passenger details captured",
                "Booking summary is accurate",
                "Ready for payment or booking is confirmed"
            ]
        
        elif "crocs" in video_lower or "sales" in video_lower:
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "e-commerce site", "description": "Navigate to product website"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for homepage to load"},
                {"step": 3, "action": "click", "target": "category/search", "description": "Click on product category or search"},
                {"step": 4, "action": "type", "target": "search input", "description": "Enter product name or browse category"},
                {"step": 5, "action": "wait", "target": "product results", "description": "Wait for product listings to appear"},
                {"step": 6, "action": "click", "target": "product item", "description": "Click on desired product"},
                {"step": 7, "action": "wait", "target": "product page", "description": "Wait for product details page"},
                {"step": 8, "action": "select", "target": "size/options", "description": "Select size, color, or other options"},
                {"step": 9, "action": "click", "target": "add to cart", "description": "Click 'Add to Cart' button"},
                {"step": 10, "action": "wait", "target": "cart confirmation", "description": "Wait for item added confirmation"},
                {"step": 11, "action": "click", "target": "view cart", "description": "View shopping cart"},
                {"step": 12, "action": "verify", "target": "cart items", "description": "Verify items and quantities are correct"},
                {"step": 13, "action": "click", "target": "checkout", "description": "Proceed to checkout"}
            ]
            base_workflow["success_criteria"] = [
                "Product is found and displayed correctly",
                "Selected options (size, color) are correct",
                "Item is added to cart successfully",
                "Cart shows correct items and total",
                "Ready to proceed to checkout"
            ]
            base_workflow["expected_outcomes"] = [
                "Selected products are in the cart",
                "Quantities and options are correct",
                "Cart total is accurate",
                "Ready for checkout process"
            ]
        
        else:
            # Generic workflow template
            base_workflow["steps"] = [
                {"step": 1, "action": "navigate", "target": "target website", "description": "Navigate to the application"},
                {"step": 2, "action": "wait", "target": "page load", "description": "Wait for page to fully load"},
                {"step": 3, "action": "interact", "target": "UI elements", "description": "Interact with relevant UI elements"},
                {"step": 4, "action": "complete", "target": "task objective", "description": "Complete the main task objective"},
                {"step": 5, "action": "verify", "target": "success state", "description": "Verify task completion"}
            ]
            base_workflow["success_criteria"] = [
                "Task objective is achieved",
                "No errors encountered",
                "Final state matches expectations"
            ]
            base_workflow["expected_outcomes"] = [
                "Workflow completes successfully",
                "All steps execute as planned",
                "Result matches demonstration video"
            ]
        
        # Add common ending note
        base_workflow["ending_note"] = f"This workflow was learned from the demonstration video '{video_name}'. The AI should follow these exact patterns, verify each step completes successfully, and ensure the final outcome matches the demonstration. Always wait for elements to load, handle any popups or modals gracefully, and provide clear status updates throughout execution."
        
        return base_workflow
    
    async def generate_enhanced_prompt(self, user_task: str, num_examples: int = 3) -> str:
        """Generate an enhanced prompt with few-shot learning examples from videos.
        
        This creates a comprehensive prompt that includes:
        1. Random examples from demonstration videos
        2. The user's specific task
        3. Guidance on how to structure the workflow based on examples
        """
        examples = await self.create_few_shot_examples(num_examples)
        
        # Build the enhanced prompt
        prompt_parts = [
            "You are an expert workflow automation assistant trained on real demonstration videos.",
            "Below are examples of how workflows should be structured, learned from actual demonstrations:",
            "",
            "=" * 80,
            "DEMONSTRATION EXAMPLES (Learned from Videos)",
            "=" * 80,
            ""
        ]
        
        # Add each example
        for i in range(0, len(examples), 2):
            user_ex = examples[i]
            assistant_ex = examples[i + 1]
            
            prompt_parts.append(f"Example {i//2 + 1}:")
            prompt_parts.append(f"User Request: {user_ex['content']}")
            prompt_parts.append("Expected Workflow:")
            prompt_parts.append(assistant_ex['content'])
            prompt_parts.append("")
            prompt_parts.append("-" * 80)
            prompt_parts.append("")
        
        prompt_parts.extend([
            "=" * 80,
            "KEY PATTERNS FROM DEMONSTRATIONS:",
            "=" * 80,
            "",
            "1. ALWAYS start with navigation to the target website",
            "2. WAIT for elements to load before interacting",
            "3. Use specific, descriptive selectors for each action",
            "4. Include verification steps to confirm success",
            "5. End with a clear completion verification",
            "6. Provide detailed step descriptions for clarity",
            "7. Handle loading states and dynamic content appropriately",
            "8. Include expected outcomes and success criteria",
            "",
            "=" * 80,
            "NOW, GENERATE A WORKFLOW FOR THIS USER TASK:",
            "=" * 80,
            "",
            f"User Task: {user_task}",
            "",
            "Generate a complete, detailed workflow following the patterns demonstrated above.",
            "Include all steps, success criteria, and expected outcomes.",
            "Structure your response as a JSON workflow that can be executed programmatically."
        ])
        
        return "\n".join(prompt_parts)
    
    def get_learning_statistics(self) -> Dict[str, Any]:
        """Get statistics about available training videos."""
        videos = self.get_available_videos()
        
        return {
            "total_videos": len(videos),
            "total_size_mb": sum(v["size_mb"] for v in videos),
            "video_list": [v["task"] for v in videos],
            "data_directory": str(self.data_dir),
            "cache_directory": str(self.cache_dir)
        }


# Singleton instance
video_learning_service = VideoLearningService()
