# Form Auto-Fill Feature

## Overview

The system now automatically extracts specific form field values from your task descriptions and uses them when filling forms, instead of having the AI agent generate values.

## How It Works

### 1. Task Parsing
When you provide a task, the system extracts field names and values using pattern matching:

```python
# Example task
task = "Create a project named 'Q4 Marketing Campaign' with description 'Holiday sales planning'"

# System extracts:
form_data = {
    "name": "Q4 Marketing Campaign",
    "description": "Holiday sales planning"
}
```

### 2. Form Filling
The Vision Agent receives the extracted form data and:
- Matches form field labels to the extracted keys (case-insensitive)
- Uses the provided values when filling matching fields
- Falls back to AI-generated values only if no match is found

### 3. Supported Patterns

#### Single Quotes
```
"Create project named 'Website Redesign'"
→ name: "Website Redesign"

"Add task with description 'Bug fixes'"
→ description: "Bug fixes"
```

#### Double Quotes
```
"Create issue titled "Login Bug""
→ title: "Login Bug"

"Add meeting with agenda "Sprint Planning""
→ agenda: "Sprint Planning"
```

#### Key-Value Format
```
"Fill form with name: Mobile App and description: iOS development"
→ name: "Mobile App", description: "iOS development"
```

#### Natural Language
```
"Create project called 'Q4 Campaign'"
→ name: "Q4 Campaign"

"Add task titled 'Code Review'"
→ title: "Code Review"
```

## Supported Field Names

The system recognizes and maps these common field names:

| Pattern in Task | Extracted Key | Common Form Labels |
|----------------|---------------|-------------------|
| `named 'X'` | `name` | Name, Project Name, Task Name |
| `titled 'X'` | `title` | Title, Task Title, Issue Title |
| `called 'X'` | `name` | Name, Project Name |
| `description: 'X'` | `description` | Description, Details, Notes |
| `agenda: 'X'` | `agenda` | Agenda, Topics |
| `details: 'X'` | `details` | Details, Additional Info |

## Usage Examples

### Example 1: Project Creation
```bash
python main.py \
  --task "Create a project named 'Q4 Marketing' with description 'Holiday campaign planning'" \
  --start-url "https://app.yourapp.com"
```

System behavior:
1. Extracts: `{"name": "Q4 Marketing", "description": "Holiday campaign planning"}`
2. Navigates to project creation form
3. Fills "Project Name" field with "Q4 Marketing"
4. Fills "Description" field with "Holiday campaign planning"

### Example 2: Task/Issue Creation
```bash
python main.py \
  --task "Add issue titled 'Login Form Bug' with details 'Password reset not working'" \
  --start-url "https://github.com/user/repo"
```

System behavior:
1. Extracts: `{"title": "Login Form Bug", "details": "Password reset not working"}`
2. Opens issue creation form
3. Uses extracted values for matching fields

### Example 3: Meeting/Event Creation
```bash
python main.py \
  --task "Create meeting called 'Daily Standup' with agenda 'Sprint progress review'" \
  --start-url "https://calendar.google.com"
```

System behavior:
1. Extracts: `{"name": "Daily Standup", "agenda": "Sprint progress review"}`
2. Creates calendar event with specified details

## Benefits

### ✓ Precision
- No more AI-generated placeholder values
- Forms filled with exactly what you specify

### ✓ Consistency
- Same values used across multiple runs
- Reproducible results

### ✓ Control
- You decide the exact content
- No guessing what the AI will type

### ✓ Reliability
- Less prone to errors from AI interpretation
- Predictable form submissions

## Technical Details

### Implementation Files

1. **utils/input_parser.py**
   - `extract_form_data()` function
   - Pattern matching with regex
   - Supports single quotes, double quotes, and key-value formats

2. **workflow/workflow_engine.py**
   - Extracts form data at workflow start
   - Passes form data to Vision Agent
   - Logs extracted values

3. **agent/vision_agent.py**
   - Accepts `form_data` parameter
   - Updated system prompt with form filling rules
   - Matches form fields to provided data

### Logging
The system logs extracted form data:
```
Extracted form data from task: {'name': 'Q4 Marketing', 'description': 'Holiday campaign'}
```

If no specific data found:
```
No specific form data found in task description
```

## Best Practices

### DO ✓
- Use quotes around specific values: `"Create project named 'Marketing'"`
- Be specific with field names: `"with description 'X'"` not just `"description X"`
- Use standard field names: name, title, description, details, agenda

### DON'T ✗
- Mix quotes within values: avoid `'Project "Alpha" Test'`
- Use very long values (keep under 200 characters)
- Assume all fields will be auto-filled (system only fills what it can extract)

## Troubleshooting

### Issue: Values not being filled
**Possible causes:**
- Task doesn't use recognized patterns
- No quotes around values
- Field names don't match (e.g., "label" vs "name")

**Solution:** Use explicit patterns like `"named 'X'"` or `"title: 'X'"`

### Issue: Partial extraction
**Example:** `"Create project Marketing with description 'Campaign'"` only extracts description

**Solution:** Add quotes: `"Create project 'Marketing' with description 'Campaign'"`

### Issue: Wrong values used
**Possible cause:** Multiple matching patterns in task

**Solution:** Be specific with one clear value per field

## Future Enhancements

Potential improvements for this feature:
- Support for date/time fields
- Support for numeric fields (priority, story points)
- Support for dropdown/select options
- Support for multi-line text (textarea fields)
- Support for URL fields
- Custom field mapping configuration

## Testing

Run the test suite to verify form extraction:
```bash
python test_form_extraction.py
```

Expected output: All 6 tests passing with various task patterns.
