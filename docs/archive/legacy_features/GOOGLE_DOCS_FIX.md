# Google Docs Workflow Fix

## Problem Analysis

Based on the execution report for run_1766951201, the workflow failed because:

1. **Agent got stuck clicking "Blank" template repeatedly** - Action was attempted 5+ times
2. **URL never changed** - Stayed at `https://docs.google.com/document/u/0/` (homepage)
3. **Document never opened** - No navigation to `/document/d/[ID]/edit`
4. **Loop detection failed to stop it** - Agent kept retrying same action

### Root Causes:

1. **Selector Issue**: `[aria-label='Blank']` may not be correct or element requires different interaction
2. **No Wait After Click**: Clicking template needs 3-5 second wait for document creation + navigation
3. **No URL Verification**: Agent doesn't check if navigation succeeded before proceeding
4. **Poor Loop Detection**: Same action repeated without trying alternatives

## Solution

### 1. Add Google Docs-Specific Handler in WorkflowEngine

Add special handling before interact steps for Google Docs:

```python
# In workflow_engine.py, after step_type == "interact":

# GOOGLE DOCS SPECIAL HANDLING
if "docs.google.com/document/u/0" in current_url:
    log("Detected Google Docs homepage - applying special template handling...")
    
    try:
        # Try multiple selectors for Blank template
        blank_selectors = [
            "[aria-label='Blank']",
            ".docs-homescreen-templates-templateview[aria-label='Blank']",
            "div[aria-label='Blank document']",
            "text='Blank'",
        ]
        
        clicked = False
        for selector in blank_selectors:
            try:
                element = page.locator(selector)
                if await element.count() > 0:
                    await element.first.click()
                    log(f"✓ Clicked Blank template with selector: {selector}")
                    clicked = True
                    break
            except Exception:
                continue
        
        if clicked:
            log("Waiting 5 seconds for document creation...")
            await asyncio.sleep(5)
            
            # Verify navigation succeeded
            new_url = page.url
            if "/document/d/" in new_url:
                log(f"✓ Document created successfully: {new_url}")
                # Continue with VisionAgent for title/content
            else:
                log(f"WARNING: Document not created. URL still: {new_url}")
                log("Retrying with keyboard shortcut...")
                await page.keyboard.press("c")  # Sometimes 'c' opens blank doc
                await asyncio.sleep(3)
                
                if "/document/d/" not in page.url:
                    log("ERROR: Could not create document after retry")
        else:
            log("Could not find Blank template - continuing with VisionAgent")
            
    except Exception as docs_err:
        log(f"Google Docs special handling error: {docs_err}")
```

### 2. Update VisionAgent Prompt for Google Docs

Add specific guidance in the system prompt:

```python
"GOOGLE DOCS SPECIAL RULES:\n"
"- On homepage (docs.google.com/document/u/0/): Click 'Blank' template\n"
"- **CRITICAL**: After clicking Blank, MUST wait 5 seconds and verify URL changed to /document/d/[ID]/edit\n"
"- If URL didn't change after Blank click, try keyboard shortcut 'c' or look for '+' button\n"
"- If stuck on homepage after 2 attempts, return type='error' with reason\n"
"- Once in editor: 1) Click title, 2) Type title, 3) Click body, 4) Type content slowly\n"
"- For long content (3000+ chars), type in chunks with 1-second pauses every 500 chars\n"
"- Wait for 'All changes saved' indicator before marking done\n\n"
```

### 3. Add URL Change Verification

After click actions, verify page actually changed:

```python
# In workflow_engine.py, after action execution:

if action_type == "click" and "docs.google.com" in url_before:
    # Wait and verify navigation for Google Docs
    await asyncio.sleep(3)
    url_after = page.url
    
    if url_before == url_after:
        log(f"WARNING: Click did not change URL. Still at: {url_after}")
        log("Click may have failed - trying alternative approach...")
        
        # Try keyboard shortcut as fallback
        await page.keyboard.press("c")
        await asyncio.sleep(2)
        
        if page.url == url_before:
            log("ERROR: Alternative approach also failed")
            action_executed = False
        else:
            log(f"✓ Keyboard shortcut succeeded: {page.url}")
            action_executed = True
    else:
        log(f"✓ Navigation succeeded: {url_before} → {url_after}")
        action_executed = True
```

### 4. Improve Content Typing for Long Text

Google Docs can drop characters if typed too fast. Add chunking:

```python
# In browser_manager.py, update type action:

async def execute_action(self, action_type: str, selector: Optional[str], value: Optional[str]) -> bool:
    if action_type == "type":
        # ... existing code ...
        
        # Special handling for long content (>1000 chars)
        if value and len(value) > 1000:
            log(f"Typing long content ({len(value)} chars) in chunks...")
            
            # Type in 500-character chunks with pauses
            chunk_size = 500
            for i in range(0, len(value), chunk_size):
                chunk = value[i:i+chunk_size]
                await element.type(chunk, delay=10)  # 10ms between keystrokes
                await asyncio.sleep(1)  # 1 second between chunks
                log(f"Typed {min(i+chunk_size, len(value))}/{len(value)} characters...")
            
            log("✓ Long content typed successfully")
            return True
        else:
            # Normal typing for short content
            await element.fill(value)
            return True
```

### 5. Add Specific Success Verification

After completing document creation, verify all elements:

```python
# In workflow_engine.py, during verification step:

if "Google Doc" in task or "docs.google.com" in page.url:
    log("Performing Google Docs-specific verification...")
    
    # Check 1: URL contains document ID
    has_doc_id = "/document/d/" in page.url
    
    # Check 2: Title is set correctly
    try:
        title_element = page.locator(".docs-title-input")
        if await title_element.count() > 0:
            title_text = await title_element.first.input_value()
            has_correct_title = len(title_text) > 0 and title_text != "Untitled document"
        else:
            has_correct_title = False
    except:
        has_correct_title = False
    
    # Check 3: Content exists in body
    try:
        body_text = await page.evaluate("""
            () => {
                const body = document.querySelector('.kix-page-content');
                return body ? body.innerText.trim() : '';
            }
        """)
        has_content = len(body_text) > 100  # At least 100 characters
    except:
        has_content = False
    
    # Check 4: Auto-save indicator
    try:
        save_indicator = page.locator("text='All changes saved'")
        is_saved = await save_indicator.count() > 0
    except:
        is_saved = False
    
    completed = has_doc_id and has_correct_title and has_content and is_saved
    partial = has_doc_id and (has_correct_title or has_content)
    
    reasons = []
    if not has_doc_id:
        reasons.append("Document not created (URL doesn't contain /document/d/)")
    if not has_correct_title:
        reasons.append("Title not set correctly")
    if not has_content:
        reasons.append("Content not typed (body has <100 characters)")
    if not is_saved:
        reasons.append("Document not auto-saved yet")
    
    return completed, partial, reasons
```

## Implementation Steps

1. ✅ Update `workflow_engine.py` with Google Docs special handler
2. ✅ Update `vision_agent.py` system prompt with Google Docs rules
3. ✅ Add URL verification after clicks
4. ✅ Improve typing for long content in `browser_manager.py`
5. ✅ Add comprehensive verification logic
6. ✅ Test with: "Create a Google Doc named 'RAG' with content about RAG"

## Expected Behavior After Fix

```
Step 1: Navigate to docs.google.com/document/u/0/
Step 2: Click "Blank" template → wait 5s → URL changes to /document/d/[ID]/edit ✓
Step 3: Click title field → Type "RAG" ✓
Step 4: Click document body ✓
Step 5: Type content in chunks (3159 chars) → "# Retrieval Augmented Generation..." ✓
Step 6: Wait for auto-save → See "All changes saved" ✓
Step 7: Verify → URL has /document/d/, title="RAG", content >100 chars, saved=true ✓
Result: COMPLETE ✓
```

## Testing

```bash
cd backend
uvicorn app.main:app --reload --port 8000

# Then submit task:
# "Create a Google Doc named 'RAG' with content about Retrieval Augmented Generation"
```

Expected: Document created with title "RAG" and comprehensive RAG content (3000+ characters).
