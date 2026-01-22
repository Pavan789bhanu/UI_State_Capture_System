"""Few-shot example generator for vision and planning agents.

This module creates detailed workflow examples from demonstration videos
to guide the AI in understanding how to execute similar tasks step-by-step.
"""

from typing import Dict, List, Any, Optional
from pathlib import Path
import json


class FewShotExampleGenerator:
    """Generates few-shot examples from video demonstrations."""
    
    def __init__(self):
        self.examples_cache = self._build_example_library()
    
    def _build_example_library(self) -> Dict[str, Dict[str, Any]]:
        """Build comprehensive examples from all demonstration videos."""
        return {
            "google_docs_creation": {
                "task": "Create a Google Doc titled 'RAG Systems' with content about Retrieval Augmented Generation",
                "category": "document_creation",
                "workflow": {
                    "description": "This workflow demonstrates creating and populating a Google Doc",
                    "steps": [
                        {
                            "step": 1,
                            "action": "navigate",
                            "target": "Google Docs homepage",
                            "url": "https://docs.google.com",
                            "reasoning": "Start at the Google Docs homepage to access document creation"
                        },
                        {
                            "step": 2,
                            "action": "wait",
                            "duration": "2-3 seconds",
                            "reasoning": "Allow page to fully load and render all buttons"
                        },
                        {
                            "step": 3,
                            "action": "click",
                            "target": "Blank document template",
                            "selector": "[aria-label='Blank'] or .docs-homescreen-template-overlay",
                            "reasoning": "Click the blank template to create a new empty document"
                        },
                        {
                            "step": 4,
                            "action": "wait",
                            "duration": "2-3 seconds",
                            "reasoning": "Wait for document editor to fully load"
                        },
                        {
                            "step": 5,
                            "action": "click",
                            "target": "Document title (says 'Untitled document')",
                            "selector": ".docs-title-input or input[aria-label*='title']",
                            "reasoning": "Focus on the title field to rename the document"
                        },
                        {
                            "step": 6,
                            "action": "type",
                            "target": "Document title field",
                            "value": "RAG Systems",
                            "reasoning": "Enter the document title as specified in the task"
                        },
                        {
                            "step": 7,
                            "action": "click",
                            "target": "Document body area",
                            "selector": ".kix-page or [role='textbox']",
                            "reasoning": "Click in the main document body to start typing content"
                        },
                        {
                            "step": 8,
                            "action": "type",
                            "target": "Document body",
                            "value": """# Retrieval Augmented Generation (RAG)

RAG is an AI framework that combines retrieval systems with large language models to provide more accurate and up-to-date responses.

## Key Components:
1. **Retrieval System**: Searches through a knowledge base to find relevant documents
2. **Language Model**: Generates responses based on retrieved context
3. **Integration Layer**: Combines retrieved information with the LLM's generation

## Benefits:
- Reduces hallucinations by grounding responses in factual data
- Allows updating information without retraining the model
- Improves accuracy for domain-specific queries

## Common Use Cases:
- Enterprise knowledge bases
- Customer support systems
- Research assistants
- Documentation search""",
                            "reasoning": "Type comprehensive content about RAG as specified in the task description"
                        },
                        {
                            "step": 9,
                            "action": "wait",
                            "duration": "3 seconds",
                            "reasoning": "Wait for Google Docs auto-save to complete (look for 'Saved to Drive' indicator)"
                        },
                        {
                            "step": 10,
                            "action": "verify",
                            "target": "Document state",
                            "checks": [
                                "Title shows 'RAG Systems'",
                                "Content is visible in the document",
                                "Auto-save indicator shows 'Saved to Drive' or similar",
                                "URL contains document ID"
                            ],
                            "reasoning": "Confirm the document was created successfully with correct title and content"
                        }
                    ],
                    "success_criteria": [
                        "Document created with title 'RAG Systems'",
                        "Content about RAG is written and visible",
                        "Document is auto-saved (indicator shows 'Saved')",
                        "URL changed from docs.google.com to specific document URL"
                    ],
                    "key_patterns": [
                        "Google Docs auto-saves, so no manual save button click needed",
                        "Title must be clicked separately from document body",
                        "Wait for page loads between navigation steps",
                        "Verify auto-save indicator before marking complete"
                    ]
                }
            },
            
            "linear_project_creation": {
                "task": "Create a project in Linear called 'Q1 2025 Planning' with description 'Quarterly planning for engineering team'",
                "category": "project_management",
                "workflow": {
                    "description": "This workflow demonstrates creating a project in Linear",
                    "steps": [
                        {
                            "step": 1,
                            "action": "navigate",
                            "target": "Linear workspace",
                            "url": "https://linear.app",
                            "reasoning": "Navigate to Linear's main workspace page"
                        },
                        {
                            "step": 2,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for workspace dashboard to load"
                        },
                        {
                            "step": 3,
                            "action": "click",
                            "target": "Projects in sidebar",
                            "selector": "a[href*='/projects'] or button:has-text('Projects')",
                            "reasoning": "Navigate to the Projects section via left sidebar"
                        },
                        {
                            "step": 4,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for projects page to load"
                        },
                        {
                            "step": 5,
                            "action": "click",
                            "target": "New Project button",
                            "selector": "button:has-text('New project') or button[aria-label*='New project']",
                            "reasoning": "Click the button to initiate project creation"
                        },
                        {
                            "step": 6,
                            "action": "wait",
                            "duration": "1 second",
                            "reasoning": "Wait for project creation modal/form to appear"
                        },
                        {
                            "step": 7,
                            "action": "type",
                            "target": "Project name field",
                            "selector": "input[name='name'] or input[placeholder*='Project name']",
                            "value": "Q1 2025 Planning",
                            "reasoning": "Enter the project name as specified in the task"
                        },
                        {
                            "step": 8,
                            "action": "type",
                            "target": "Project description field",
                            "selector": "textarea[name='description'] or textarea[placeholder*='description']",
                            "value": "Quarterly planning for engineering team",
                            "reasoning": "Enter the project description from the task"
                        },
                        {
                            "step": 9,
                            "action": "click",
                            "target": "Create button",
                            "selector": "button:has-text('Create') or button[type='submit']",
                            "reasoning": "Submit the form to create the project"
                        },
                        {
                            "step": 10,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for project creation to complete and page to update"
                        },
                        {
                            "step": 11,
                            "action": "verify",
                            "target": "Project existence",
                            "checks": [
                                "Project name 'Q1 2025 Planning' is visible",
                                "Project appears in the projects list",
                                "URL contains the new project ID or slug",
                                "No error messages displayed"
                            ],
                            "reasoning": "Confirm the project was created successfully"
                        }
                    ],
                    "success_criteria": [
                        "Project 'Q1 2025 Planning' exists in Linear",
                        "Description is saved correctly",
                        "Project is visible in the projects list",
                        "URL changed to the new project's page"
                    ],
                    "key_patterns": [
                        "Use sidebar navigation to reach Projects section",
                        "Look for 'New Project' button (often in top-right)",
                        "Fill form fields in order: name first, then description",
                        "Wait for confirmation after clicking Create",
                        "Verify by checking URL change and visible project name"
                    ]
                }
            },
            
            "jira_task_creation": {
                "task": "Create a Jira issue with title 'Fix login bug' and type 'Bug' with priority 'High'",
                "category": "project_management",
                "workflow": {
                    "description": "This workflow demonstrates creating an issue in Jira",
                    "steps": [
                        {
                            "step": 1,
                            "action": "navigate",
                            "target": "Jira project",
                            "url": "https://[workspace].atlassian.net/jira/software/projects/[PROJECT]",
                            "reasoning": "Navigate to the Jira project board"
                        },
                        {
                            "step": 2,
                            "action": "wait",
                            "duration": "2-3 seconds",
                            "reasoning": "Wait for Jira board to fully load"
                        },
                        {
                            "step": 3,
                            "action": "click",
                            "target": "Create button",
                            "selector": "button:has-text('Create') or #createGlobalItem",
                            "reasoning": "Click the main Create button (usually in top navigation)"
                        },
                        {
                            "step": 4,
                            "action": "wait",
                            "duration": "1-2 seconds",
                            "reasoning": "Wait for issue creation dialog to appear"
                        },
                        {
                            "step": 5,
                            "action": "click",
                            "target": "Issue type dropdown",
                            "selector": "#issuetype or [name='issuetype']",
                            "reasoning": "Open the issue type selector"
                        },
                        {
                            "step": 6,
                            "action": "click",
                            "target": "Bug option",
                            "selector": "option:has-text('Bug') or [data-testid='Bug']",
                            "reasoning": "Select 'Bug' as the issue type"
                        },
                        {
                            "step": 7,
                            "action": "type",
                            "target": "Summary field",
                            "selector": "#summary or input[name='summary']",
                            "value": "Fix login bug",
                            "reasoning": "Enter the issue title/summary"
                        },
                        {
                            "step": 8,
                            "action": "click",
                            "target": "Priority dropdown",
                            "selector": "#priority or [name='priority']",
                            "reasoning": "Open priority selector"
                        },
                        {
                            "step": 9,
                            "action": "click",
                            "target": "High priority option",
                            "selector": "option:has-text('High') or [data-testid='High']",
                            "reasoning": "Select 'High' priority"
                        },
                        {
                            "step": 10,
                            "action": "click",
                            "target": "Create button in dialog",
                            "selector": "button[type='submit']:has-text('Create')",
                            "reasoning": "Submit the form to create the issue"
                        },
                        {
                            "step": 11,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for issue creation confirmation"
                        },
                        {
                            "step": 12,
                            "action": "verify",
                            "target": "Issue creation",
                            "checks": [
                                "Success message or toast appears",
                                "Issue appears in the backlog/board",
                                "Issue has correct title 'Fix login bug'",
                                "Issue type shows as 'Bug'",
                                "Priority shows as 'High'"
                            ],
                            "reasoning": "Confirm the issue was created with all correct attributes"
                        }
                    ],
                    "success_criteria": [
                        "Issue created with title 'Fix login bug'",
                        "Issue type is 'Bug'",
                        "Priority is set to 'High'",
                        "Issue appears in project backlog",
                        "Issue has a unique ID (e.g., PROJ-123)"
                    ],
                    "key_patterns": [
                        "Use the global 'Create' button in top navigation",
                        "Select issue type before filling other fields",
                        "Jira forms have many optional fields - focus on required ones",
                        "Success confirmation often appears as a toast notification",
                        "New issues appear at top of backlog"
                    ]
                }
            },
            
            "ecommerce_purchase": {
                "task": "Find and add classic clogs size M10 to cart on Crocs website",
                "category": "ecommerce",
                "workflow": {
                    "description": "This workflow demonstrates product search and cart addition",
                    "steps": [
                        {
                            "step": 1,
                            "action": "navigate",
                            "target": "Crocs website",
                            "url": "https://www.crocs.com",
                            "reasoning": "Navigate to the main Crocs e-commerce site"
                        },
                        {
                            "step": 2,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for homepage to load"
                        },
                        {
                            "step": 3,
                            "action": "click",
                            "target": "Search bar",
                            "selector": "input[type='search'] or input[placeholder*='Search']",
                            "reasoning": "Focus on the search input field"
                        },
                        {
                            "step": 4,
                            "action": "type",
                            "target": "Search bar",
                            "value": "classic clogs",
                            "reasoning": "Enter the product search term"
                        },
                        {
                            "step": 5,
                            "action": "keyboard",
                            "target": "Search bar",
                            "value": "Enter",
                            "reasoning": "Submit the search by pressing Enter"
                        },
                        {
                            "step": 6,
                            "action": "wait",
                            "duration": "2-3 seconds",
                            "reasoning": "Wait for search results to load"
                        },
                        {
                            "step": 7,
                            "action": "click",
                            "target": "First Classic Clog product",
                            "selector": ".product-tile:first-child or a[href*='classic-clog']",
                            "reasoning": "Click on the first classic clog product from search results"
                        },
                        {
                            "step": 8,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for product detail page to load"
                        },
                        {
                            "step": 9,
                            "action": "click",
                            "target": "Size selector",
                            "selector": "select[name='size'] or button[aria-label*='size']",
                            "reasoning": "Open the size selector dropdown"
                        },
                        {
                            "step": 10,
                            "action": "click",
                            "target": "Size M10 option",
                            "selector": "option:has-text('M10') or button:has-text('M10')",
                            "reasoning": "Select size M10 as specified in the task"
                        },
                        {
                            "step": 11,
                            "action": "click",
                            "target": "Add to Cart button",
                            "selector": "button:has-text('Add to Cart') or button[data-testid='add-to-cart']",
                            "reasoning": "Add the product to the shopping cart"
                        },
                        {
                            "step": 12,
                            "action": "wait",
                            "duration": "2 seconds",
                            "reasoning": "Wait for cart update confirmation"
                        },
                        {
                            "step": 13,
                            "action": "verify",
                            "target": "Cart addition",
                            "checks": [
                                "Success message appears (e.g., 'Added to cart')",
                                "Cart icon shows item count (1 or more)",
                                "Product appears in mini cart preview",
                                "Size M10 is confirmed in cart"
                            ],
                            "reasoning": "Confirm the product was added to cart with correct size"
                        }
                    ],
                    "success_criteria": [
                        "Product found in search results",
                        "Correct product (classic clogs) selected",
                        "Size M10 selected successfully",
                        "Product added to cart",
                        "Cart count increased"
                    ],
                    "key_patterns": [
                        "Use search functionality to find products",
                        "Wait for search results to load completely",
                        "Select size before adding to cart (usually required)",
                        "Look for success confirmation after add to cart",
                        "Cart icon typically updates to show item count"
                    ]
                }
            }
        }
    
    def get_examples_for_task(self, task: str, num_examples: int = 3) -> List[Dict[str, Any]]:
        """Get relevant few-shot examples based on the task description.
        
        Args:
            task: The user's task description
            num_examples: Number of examples to return (default 3)
            
        Returns:
            List of relevant workflow examples
        """
        task_lower = task.lower()
        relevant_examples = []
        
        # Score each example based on keyword matches
        scores = []
        for key, example in self.examples_cache.items():
            score = 0
            example_text = (example["task"] + " " + example["category"]).lower()
            
            # Keyword matching
            if "google" in task_lower and "doc" in task_lower:
                if "google_docs" in key:
                    score += 10
            if "linear" in task_lower or "project" in task_lower:
                if "linear_project" in key:
                    score += 10
            if "jira" in task_lower or "issue" in task_lower or "bug" in task_lower:
                if "jira_task" in key:
                    score += 10
            if any(word in task_lower for word in ["buy", "purchase", "cart", "product", "shop"]):
                if "ecommerce" in key:
                    score += 10
            
            # Category matching
            if "document" in task_lower or "doc" in task_lower or "write" in task_lower:
                if example["category"] == "document_creation":
                    score += 5
            if "project" in task_lower or "task" in task_lower:
                if example["category"] == "project_management":
                    score += 5
            if "shop" in task_lower or "buy" in task_lower:
                if example["category"] == "ecommerce":
                    score += 5
            
            scores.append((score, key, example))
        
        # Sort by score and get top examples
        scores.sort(reverse=True, key=lambda x: x[0])
        
        # If no good matches, return random examples
        if scores[0][0] == 0:
            import random
            return random.sample(list(self.examples_cache.values()), min(num_examples, len(self.examples_cache)))
        
        # Return top scored examples
        for score, key, example in scores[:num_examples]:
            relevant_examples.append(example)
        
        return relevant_examples
    
    def format_examples_for_prompt(self, examples: List[Dict[str, Any]]) -> str:
        """Format examples into a structured prompt section.
        
        Args:
            examples: List of example workflows
            
        Returns:
            Formatted string for inclusion in LLM prompt
        """
        formatted = "## DEMONSTRATION EXAMPLES (Learn from these workflows):\n\n"
        
        for i, example in enumerate(examples, 1):
            formatted += f"### Example {i}: {example['task']}\n"
            formatted += f"**Category**: {example['category']}\n\n"
            
            workflow = example['workflow']
            formatted += f"**Description**: {workflow['description']}\n\n"
            
            formatted += "**Step-by-Step Workflow**:\n"
            for step in workflow['steps']:
                formatted += f"{step['step']}. **{step['action'].upper()}**: {step.get('target', 'N/A')}\n"
                formatted += f"   - Reasoning: {step['reasoning']}\n"
                if 'selector' in step:
                    formatted += f"   - Selector: `{step['selector']}`\n"
                if 'value' in step:
                    formatted += f"   - Value: `{step['value']}`\n"
                formatted += "\n"
            
            formatted += "**Success Criteria**:\n"
            for criterion in workflow['success_criteria']:
                formatted += f"- {criterion}\n"
            
            formatted += "\n**Key Patterns to Follow**:\n"
            for pattern in workflow['key_patterns']:
                formatted += f"- {pattern}\n"
            
            formatted += "\n" + "="*80 + "\n\n"
        
        return formatted
    
    def get_category_patterns(self, category: str) -> Dict[str, Any]:
        """Get common patterns for a specific category.
        
        Args:
            category: The workflow category (e.g., 'document_creation')
            
        Returns:
            Dictionary of common patterns for that category
        """
        patterns = {
            "document_creation": {
                "common_steps": ["navigate", "wait", "click_blank", "wait", "set_title", "type_content", "wait_autosave", "verify"],
                "key_behaviors": [
                    "Documents often auto-save, no manual save needed",
                    "Title must be set separately from content",
                    "Wait for editor to fully load before typing",
                    "Verify auto-save indicator before completion"
                ],
                "success_indicators": ["Document saved", "Title visible", "Content displayed", "URL changed"]
            },
            "project_management": {
                "common_steps": ["navigate", "wait", "navigate_section", "click_create", "wait", "fill_form", "submit", "verify"],
                "key_behaviors": [
                    "Use sidebar navigation to reach correct section",
                    "Look for 'Create' or 'New' buttons in top-right",
                    "Fill required fields first (usually title/name)",
                    "Wait for confirmation after submission"
                ],
                "success_indicators": ["Item appears in list", "Success message", "URL contains item ID", "No errors"]
            },
            "ecommerce": {
                "common_steps": ["navigate", "search", "wait", "select_product", "wait", "select_options", "add_to_cart", "verify"],
                "key_behaviors": [
                    "Use search to find products quickly",
                    "Select size/color before adding to cart",
                    "Look for 'Add to Cart' confirmation",
                    "Check cart icon for item count update"
                ],
                "success_indicators": ["Product in cart", "Cart count increased", "Success message", "Price displayed"]
            }
        }
        
        return patterns.get(category, {})
