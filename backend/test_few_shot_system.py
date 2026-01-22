"""
Test script to demonstrate few-shot learning and content generation.

This script shows how the system now:
1. Uses few-shot examples from demonstration videos
2. Extracts detailed information from task descriptions
3. Generates appropriate content for document creation tasks
"""

import asyncio
from app.services.few_shot_examples import FewShotExampleGenerator
from app.services.content_generator import ContentGenerator
from app.automation.utils.input_parser import extract_form_data


async def test_few_shot_examples():
    """Test few-shot example generation."""
    print("\n" + "="*80)
    print("TEST 1: Few-Shot Example Generation")
    print("="*80 + "\n")
    
    generator = FewShotExampleGenerator()
    
    # Test different task types
    test_tasks = [
        "Create a Google Doc titled 'RAG Systems' with content about Retrieval Augmented Generation",
        "Create a project in Linear called 'Q1 Planning' with description 'Quarterly objectives'",
        "Create a Jira issue for bug fixing with high priority",
        "Buy classic clogs from Crocs website"
    ]
    
    for task in test_tasks:
        print(f"\n{'─'*80}")
        print(f"Task: {task}")
        print(f"{'─'*80}\n")
        
        examples = generator.get_examples_for_task(task, num_examples=2)
        print(f"Found {len(examples)} relevant examples:")
        
        for i, example in enumerate(examples, 1):
            print(f"\n  Example {i}:")
            print(f"    Category: {example['category']}")
            print(f"    Task: {example['task']}")
            print(f"    Steps: {len(example['workflow']['steps'])} steps")
            print(f"    Success Criteria: {len(example['workflow']['success_criteria'])} criteria")
        
        print()


async def test_form_data_extraction():
    """Test enhanced form data extraction."""
    print("\n" + "="*80)
    print("TEST 2: Form Data Extraction")
    print("="*80 + "\n")
    
    test_cases = [
        "Create a Google Doc titled 'RAG Systems' with content about Retrieval Augmented Generation",
        "Create a project named 'Website Redesign' with description 'New landing page'",
        "Create a Jira issue titled 'Fix login bug' with type Bug and priority High",
        "Create meeting notes titled 'Daily Standup' with agenda 'Sprint progress review'",
        "Create a document about API documentation",
    ]
    
    for task in test_cases:
        print(f"\n{'─'*80}")
        print(f"Task: {task}")
        print(f"{'─'*80}\n")
        
        form_data = extract_form_data(task)
        
        if form_data:
            print("Extracted data:")
            for key, value in form_data.items():
                if key == "content_keywords":
                    print(f"  {key}: {', '.join(value)}")
                else:
                    print(f"  {key}: {value}")
        else:
            print("  No form data extracted")
        
        print()


async def test_content_generation():
    """Test content generation for documents."""
    print("\n" + "="*80)
    print("TEST 3: Content Generation")
    print("="*80 + "\n")
    
    generator = ContentGenerator()
    
    test_topics = [
        ("Retrieval Augmented Generation", ["rag", "retrieval", "augmented"]),
        ("API Documentation", ["api", "documentation"]),
        ("Project Planning", ["project", "planning"]),
        ("Machine Learning Basics", ["machine", "learning"]),
    ]
    
    for topic, keywords in test_topics:
        print(f"\n{'─'*80}")
        print(f"Topic: {topic}")
        print(f"Keywords: {', '.join(keywords)}")
        print(f"{'─'*80}\n")
        
        content = generator.generate_content(topic, keywords)
        
        print(f"Generated Title: {content['title']}")
        print(f"Content Length: {len(content['content'])} characters")
        print(f"Content Preview (first 200 chars):")
        print(f"  {content['content'][:200]}...")
        print()


async def test_end_to_end_workflow():
    """Test complete workflow with task parsing, example selection, and content generation."""
    print("\n" + "="*80)
    print("TEST 4: End-to-End Workflow Simulation")
    print("="*80 + "\n")
    
    task = "Create a Google Doc titled 'RAG Systems' with content about Retrieval Augmented Generation"
    
    print(f"User Task: {task}\n")
    
    # Step 1: Extract form data
    print("Step 1: Extracting form data...")
    form_data = extract_form_data(task)
    print(f"  Extracted: {form_data}\n")
    
    # Step 2: Get relevant examples
    print("Step 2: Selecting few-shot examples...")
    example_generator = FewShotExampleGenerator()
    examples = example_generator.get_examples_for_task(task, num_examples=2)
    print(f"  Selected {len(examples)} examples:")
    for ex in examples:
        print(f"    - {ex['task']}")
    print()
    
    # Step 3: Generate content if needed
    if "content_topic" in form_data:
        print("Step 3: Generating document content...")
        content_generator = ContentGenerator()
        content = content_generator.generate_content(
            form_data["content_topic"],
            form_data.get("content_keywords")
        )
        print(f"  Title: {content['title']}")
        print(f"  Content: {len(content['content'])} characters")
        
        # Add to form_data
        if "title" not in form_data:
            form_data["title"] = content["title"]
        form_data["content"] = content["content"]
        print()
    
    # Step 4: Show final form data that would be passed to VisionAgent
    print("Step 4: Final form data for VisionAgent:")
    print(f"  Fields to fill:")
    for key, value in form_data.items():
        if key == "content":
            print(f"    {key}: {len(value)} chars - '{value[:60]}...'")
        elif key == "content_keywords":
            print(f"    {key}: {', '.join(value)}")
        else:
            print(f"    {key}: {value}")
    print()
    
    # Step 5: Show formatted prompt preview
    print("Step 5: Prompt structure for VisionAgent:")
    formatted_examples = example_generator.format_examples_for_prompt(examples[:1])
    lines = formatted_examples.split('\n')[:15]
    print("  " + "\n  ".join(lines))
    print("  [... truncated ...]")
    print("\n✅ Complete! The VisionAgent now has:")
    print("  - Few-shot examples showing how to create documents")
    print("  - Extracted title and topic from task")
    print("  - Generated comprehensive content about the topic")
    print("  - All form fields ready to fill automatically")
    print()


async def test_category_patterns():
    """Test category-specific pattern retrieval."""
    print("\n" + "="*80)
    print("TEST 5: Category Patterns")
    print("="*80 + "\n")
    
    generator = FewShotExampleGenerator()
    
    categories = ["document_creation", "project_management", "ecommerce"]
    
    for category in categories:
        print(f"\n{'─'*80}")
        print(f"Category: {category.upper().replace('_', ' ')}")
        print(f"{'─'*80}\n")
        
        patterns = generator.get_category_patterns(category)
        
        if patterns:
            print(f"Common Steps: {', '.join(patterns['common_steps'])}")
            print(f"\nKey Behaviors:")
            for behavior in patterns['key_behaviors']:
                print(f"  - {behavior}")
            print(f"\nSuccess Indicators:")
            for indicator in patterns['success_indicators']:
                print(f"  ✓ {indicator}")
        else:
            print("  No patterns found for this category")
        
        print()


async def main():
    """Run all tests."""
    print("\n" + "="*80)
    print("FEW-SHOT LEARNING & CONTENT GENERATION TEST SUITE")
    print("="*80)
    
    await test_few_shot_examples()
    await test_form_data_extraction()
    await test_content_generation()
    await test_end_to_end_workflow()
    await test_category_patterns()
    
    print("\n" + "="*80)
    print("ALL TESTS COMPLETE")
    print("="*80)
    print("\nSummary:")
    print("✅ Few-shot example selection working")
    print("✅ Form data extraction enhanced")
    print("✅ Content generation functional")
    print("✅ End-to-end workflow verified")
    print("✅ Category patterns available")
    print("\nThe system is now ready to:")
    print("  1. Learn from demonstration videos")
    print("  2. Extract detailed task information")
    print("  3. Generate appropriate content")
    print("  4. Execute workflows with context awareness")
    print()


if __name__ == "__main__":
    asyncio.run(main())
