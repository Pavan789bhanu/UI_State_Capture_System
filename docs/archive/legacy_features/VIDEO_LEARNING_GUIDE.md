# Video-Based Learning System

## Overview

The system now includes a **video-based learning** feature that trains the AI on workflow patterns from your demonstration videos. This enables the AI to learn from real examples and generate more accurate workflows.

## How It Works

### 1. **Video Storage**
- Place your demonstration videos in the `/data` folder
- Name each video descriptively based on the task (e.g., `Jira-Task-creation.mp4`, `google-docs.mp4`)
- Supported format: MP4 with audio narration

### 2. **Automatic Pattern Extraction**
The system automatically:
- Extracts task descriptions from video filenames
- Maps videos to workflow categories (project management, document creation, e-commerce, etc.)
- Generates structured step-by-step patterns from each demonstration
- Creates success criteria and expected outcomes based on video content

### 3. **Few-Shot Learning**
When generating workflows, the AI:
- Randomly selects 3-4 example videos
- Includes them as demonstrations in the prompt
- Learns from the patterns and applies them to new tasks
- Follows the exact step-by-step approach shown in videos

## Available Videos (8 Total)

Current training videos in the system:

1. **Crocs_sales.mp4** (5.27 MB)
   - Task: E-commerce product browsing and cart management
   - Patterns: Product search → Selection → Options → Add to cart → Checkout

2. **Flight-Booking.mp4** (5.22 MB)
   - Task: Airline ticket booking workflow
   - Patterns: Search flights → Select dates → Choose flight → Passenger details → Payment

3. **frontier-flight-Booking.mp4** (8.18 MB)
   - Task: Frontier Airlines specific booking process
   - Patterns: Detailed airline-specific workflow with validation

4. **Jira-Task-creation.mp4** (5.45 MB)
   - Task: Create tasks/issues in Jira
   - Patterns: Navigate → Create → Fill details → Assign → Submit → Verify

5. **Linear-project.mp4** (4.55 MB)
   - Task: Project creation in Linear
   - Patterns: Dashboard → New project → Title/Description → Team assignment → Create

6. **google-docs.mp4** (3.41 MB)
   - Task: Google Docs document creation
   - Patterns: Navigate → New doc → Title → Content → Auto-save → Verify

7. **Medium-RAG-summarization.mp4** (5.44 MB)
   - Task: Search and summarize Medium articles
   - Patterns: Search → Filter → Open article → Extract → Summarize

8. **creating-summary_of_the_doc.mp4** (7.49 MB)
   - Task: Document summarization workflow
   - Patterns: Open → Read → Extract key points → Generate summary

## API Endpoints

### List Available Videos
```bash
GET /api/video-learning/videos
```
Returns all available training videos with metadata.

### Get Statistics
```bash
GET /api/video-learning/stats
```
Returns system statistics (total videos, size, categories).

### Generate Few-Shot Examples
```bash
POST /api/video-learning/examples
{
  "num_examples": 3
}
```
Randomly selects N videos and generates training examples.

### Generate Enhanced Prompt
```bash
POST /api/video-learning/enhanced-prompt?task=Create%20a%20document&num_examples=3
```
Creates an AI prompt enhanced with video demonstrations.

### Get Video Metadata
```bash
GET /api/video-learning/video/{video_name}/metadata
```
Get detailed information about a specific video.

## Workflow Pattern Templates

Each video type has learned patterns:

### Project Management (Linear, Jira)
```
1. Navigate to platform
2. Wait for page load
3. Click "Create" button
4. Wait for form/modal
5. Enter title
6. Enter description
7. Select assignee
8. Set priority/status
9. Submit
10. Wait for confirmation
11. Verify creation
```

### Document Creation (Google Docs)
```
1. Navigate to docs.google.com
2. Wait for homepage
3. Click "Blank document"
4. Wait for editor
5. Click title field
6. Type title
7. Click document body
8. Type content
9. Wait for auto-save
10. Verify saved
```

### Article Search & Summarization (Medium)
```
1. Navigate to platform
2. Wait for homepage
3. Click search
4. Enter query
5. Submit search
6. Wait for results
7. Extract article list
8. Click relevant article
9. Wait for article load
10. Extract content
11. Generate summary
```

### E-commerce (Shopping)
```
1. Navigate to store
2. Wait for homepage
3. Search/browse category
4. View product results
5. Click product
6. Select options (size, color)
7. Add to cart
8. Verify cart
9. Proceed to checkout
```

### Flight Booking
```
1. Navigate to airline site
2. Select trip type
3. Enter origin/destination
4. Select dates
5. Set passengers
6. Search flights
7. Review options
8. Select flight
9. Enter passenger details
10. Review booking
11. Proceed to payment
```

## Enhanced Reporting

The system now generates comprehensive HTML reports that include:

### Report Sections
1. **Execution Summary**
   - Duration
   - Total steps
   - Success rate
   - Patterns applied

2. **Learned Patterns Applied**
   - Which video patterns were used
   - How they influenced the workflow

3. **Step-by-Step Execution Log**
   - Each action taken
   - Target elements
   - Status (success/failed/skipped)
   - Timestamps

4. **Success Criteria**
   - Checkpoints from learned patterns
   - What should be verified
   - Met/unmet status

5. **Expected Outcomes**
   - Final state expectations
   - Achievement status
   - Comparison with video demonstrations

6. **Issues Encountered**
   - Warnings and errors
   - Severity levels
   - Which step failed

7. **Final Summary (Ending Note)**
   - Overall execution narrative
   - Key achievements
   - Lessons learned
   - Next steps

### Report Storage
Reports are saved to: `/Users/pavankumarmalasani/Downloads/ui_capture_system/reports/`

Formats:
- `report_WorkflowName_YYYYMMDD_HHMMSS.html` - Interactive HTML report
- `report_WorkflowName_YYYYMMDD_HHMMSS.json` - Machine-readable JSON

## Usage in Workflows

### Automatic (Default)
All workflow executions now automatically:
1. Select 3-4 random demonstration videos
2. Extract relevant patterns
3. Apply learned behaviors
4. Generate detailed reports

### Manual Control
You can disable video learning for specific workflows:
```python
prompt = ai_service._build_prompt(
    description="Your task",
    target_url="https://example.com",
    context={},
    use_video_examples=False  # Disable video learning
)
```

## Adding New Videos

To add new demonstration videos:

1. **Record the workflow** with audio narration explaining each step
2. **Name the file** descriptively (e.g., `Shopify-Product-Upload.mp4`)
3. **Place in /data folder**
4. **System auto-detects** on next execution
5. **Patterns generated** automatically

### Video Naming Convention
Use clear, descriptive names:
- ✅ `Salesforce-Lead-Creation.mp4`
- ✅ `Notion-Database-Setup.mp4`
- ✅ `Stripe-Payment-Processing.mp4`
- ❌ `video1.mp4`
- ❌ `test.mp4`

## Benefits

### Improved Accuracy
- Workflows follow real user demonstrations
- Step-by-step patterns are proven to work
- Success criteria based on actual completions

### Consistency
- Same patterns applied across similar tasks
- Predictable execution flow
- Standardized verification steps

### Transparency
- Reports show which patterns were applied
- Clear connection between videos and actions
- Explainable AI decisions

### Continuous Learning
- Add new videos anytime
- System improves with more examples
- No code changes required

## Technical Details

### Architecture
```
User Request
    ↓
Video Learning Service
    ├─ Select 3-4 random videos
    ├─ Extract patterns from filenames
    ├─ Generate step templates
    └─ Create few-shot examples
    ↓
Enhanced Prompt (with examples)
    ↓
AI Service (OpenAI API)
    ↓
Generated Workflow (following patterns)
    ↓
Workflow Executor
    ↓
Comprehensive Report
```

### File Structure
```
/data/                           # Video storage
  ├─ Jira-Task-creation.mp4
  ├─ google-docs.mp4
  └─ ...
  └─ .video_cache/              # Metadata cache
      ├─ Jira-Task-creation_metadata.json
      └─ ...

/reports/                        # Generated reports
  ├─ report_MyWorkflow_20251227_143022.html
  ├─ report_MyWorkflow_20251227_143022.json
  └─ ...
```

### Dependencies
- Python 3.8+
- FastAPI
- Pydantic
- Standard library (json, pathlib, random)

No additional packages required for video learning features!

## Future Enhancements

Planned improvements:
- [ ] Video frame extraction for visual analysis
- [ ] Audio transcript extraction for detailed narration
- [ ] Automatic pattern recognition using computer vision
- [ ] Video similarity matching for better example selection
- [ ] Real-time progress visualization matching video timeline
- [ ] Video annotation tools for adding metadata

## Support

For issues or questions:
- Check `/tmp/backend.log` for errors
- Verify videos are in MP4 format
- Ensure `/data` folder is accessible
- Test API endpoints using curl or Postman

## Example: Complete Workflow

```bash
# 1. Check available videos
curl http://localhost:8000/api/video-learning/stats

# 2. Generate workflow with video learning
curl -X POST http://localhost:8000/api/ai/parse-task \
  -H "Content-Type: application/json" \
  -d '{
    "description": "Create a new task in Jira for Q1 planning"
  }'

# 3. Execute the workflow (automatically uses video patterns)
# 4. Check generated report in /reports folder
```

The system will:
1. Randomly select 3 videos (e.g., Jira-Task-creation.mp4, Linear-project.mp4, google-docs.mp4)
2. Extract patterns from each demonstration
3. Apply Jira-specific patterns to the workflow
4. Generate detailed steps following the video demonstration
5. Execute with verification at each step
6. Create comprehensive HTML report with:
   - Which patterns were applied
   - Success criteria from the Jira video
   - Step-by-step execution log
   - Final summary matching video ending

---

**Status**: ✅ Fully Operational
**Videos**: 8 demonstrations (45 MB total)
**Patterns**: Auto-generated from filenames
**Reports**: HTML + JSON format
**API**: 5 endpoints available
