"""Enhanced reporting system with video-learned patterns and detailed execution logs."""

import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional


class WorkflowReport:
    """Generate comprehensive workflow execution reports with learned patterns."""
    
    def __init__(self):
        self.start_time = datetime.now()
        self.steps_executed: List[Dict[str, Any]] = []
        self.learned_patterns: List[str] = []
        self.success_criteria_met: List[str] = []
        self.expected_outcomes: List[str] = []
        self.issues_encountered: List[Dict[str, str]] = []
        self.screenshots: List[str] = []
        self.ending_note: Optional[str] = None
        
    def add_step(
        self,
        step_number: int,
        action: str,
        target: str,
        description: str,
        status: str,
        timestamp: datetime = None,
        details: Optional[Dict[str, Any]] = None
    ):
        """Add an executed step to the report."""
        step_info = {
            "step": step_number,
            "action": action,
            "target": target,
            "description": description,
            "status": status,  # success, failed, skipped
            "timestamp": (timestamp or datetime.now()).isoformat(),
            "duration_ms": None
        }
        
        if details:
            step_info.update(details)
        
        self.steps_executed.append(step_info)
    
    def add_learned_pattern(self, pattern: str):
        """Add a learned pattern that was applied during execution."""
        self.learned_patterns.append(pattern)
    
    def add_success_criterion(self, criterion: str, met: bool = True):
        """Add a success criterion and whether it was met."""
        if met:
            self.success_criteria_met.append(f"✅ {criterion}")
        else:
            self.success_criteria_met.append(f"❌ {criterion}")
    
    def add_expected_outcome(self, outcome: str, achieved: bool = True):
        """Add an expected outcome and whether it was achieved."""
        if achieved:
            self.expected_outcomes.append(f"✅ {outcome}")
        else:
            self.expected_outcomes.append(f"❌ {outcome}")
    
    def add_issue(self, severity: str, message: str, step: Optional[int] = None):
        """Add an issue encountered during execution."""
        self.issues_encountered.append({
            "severity": severity,  # info, warning, error, critical
            "message": message,
            "step": step,
            "timestamp": datetime.now().isoformat()
        })
    
    def add_screenshot(self, screenshot_path: str, description: str = ""):
        """Add a screenshot reference to the report."""
        self.screenshots.append({
            "path": screenshot_path,
            "description": description,
            "timestamp": datetime.now().isoformat()
        })
    
    def set_ending_note(self, note: str):
        """Set the final ending note summarizing the execution."""
        self.ending_note = note
    
    def get_execution_summary(self) -> Dict[str, Any]:
        """Get a summary of the execution."""
        end_time = datetime.now()
        duration = (end_time - self.start_time).total_seconds()
        
        total_steps = len(self.steps_executed)
        successful_steps = sum(1 for s in self.steps_executed if s["status"] == "success")
        failed_steps = sum(1 for s in self.steps_executed if s["status"] == "failed")
        skipped_steps = sum(1 for s in self.steps_executed if s["status"] == "skipped")
        
        return {
            "start_time": self.start_time.isoformat(),
            "end_time": end_time.isoformat(),
            "duration_seconds": round(duration, 2),
            "total_steps": total_steps,
            "successful_steps": successful_steps,
            "failed_steps": failed_steps,
            "skipped_steps": skipped_steps,
            "success_rate": round((successful_steps / total_steps * 100) if total_steps > 0 else 0, 2),
            "patterns_applied": len(self.learned_patterns),
            "issues_count": len(self.issues_encountered),
            "critical_issues": sum(1 for i in self.issues_encountered if i["severity"] == "critical"),
            "screenshots_captured": len(self.screenshots)
        }
    
    def generate_html_report(self, workflow_name: str, task_description: str) -> str:
        """Generate a comprehensive HTML report."""
        summary = self.get_execution_summary()
        
        # Build HTML
        html = f"""
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Execution Report - {workflow_name}</title>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
        }}
        .container {{
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}
        .header {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }}
        .header h1 {{
            font-size: 2.5em;
            margin-bottom: 10px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
        }}
        .header .task {{
            font-size: 1.2em;
            opacity: 0.95;
            margin-top: 10px;
        }}
        .summary {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            padding: 30px;
            background: #f8f9fa;
        }}
        .summary-card {{
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            text-align: center;
        }}
        .summary-card .value {{
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
            margin: 10px 0;
        }}
        .summary-card .label {{
            color: #666;
            font-size: 0.9em;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}
        .section {{
            padding: 30px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .section:last-child {{
            border-bottom: none;
        }}
        .section h2 {{
            color: #667eea;
            margin-bottom: 20px;
            font-size: 1.8em;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }}
        .steps-table {{
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }}
        .steps-table th {{
            background: #667eea;
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
        }}
        .steps-table td {{
            padding: 12px;
            border-bottom: 1px solid #e0e0e0;
        }}
        .steps-table tr:hover {{
            background: #f5f5f5;
        }}
        .status-badge {{
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 600;
            display: inline-block;
        }}
        .status-success {{
            background: #4caf50;
            color: white;
        }}
        .status-failed {{
            background: #f44336;
            color: white;
        }}
        .status-skipped {{
            background: #ff9800;
            color: white;
        }}
        .list-item {{
            padding: 10px;
            margin: 8px 0;
            background: #f9f9f9;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }}
        .pattern-item {{
            background: #e3f2fd;
            border-left-color: #2196f3;
        }}
        .success-item {{
            background: #e8f5e9;
            border-left-color: #4caf50;
        }}
        .issue-item {{
            background: #ffebee;
            border-left-color: #f44336;
        }}
        .ending-note {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 8px;
            margin-top: 20px;
            font-size: 1.1em;
            line-height: 1.8;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        }}
        .ending-note h3 {{
            margin-bottom: 15px;
            font-size: 1.4em;
        }}
        .timestamp {{
            color: #999;
            font-size: 0.85em;
        }}
        .screenshot-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        .screenshot-card {{
            border: 1px solid #ddd;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }}
        .screenshot-card img {{
            width: 100%;
            height: 200px;
            object-fit: cover;
        }}
        .screenshot-card .caption {{
            padding: 10px;
            background: #f5f5f5;
            font-size: 0.9em;
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Workflow Execution Report</h1>
            <div class="task"><strong>Workflow:</strong> {workflow_name}</div>
            <div class="task"><strong>Task:</strong> {task_description}</div>
            <div class="timestamp">Generated: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</div>
        </div>
        
        <div class="summary">
            <div class="summary-card">
                <div class="label">Duration</div>
                <div class="value">{summary['duration_seconds']}s</div>
            </div>
            <div class="summary-card">
                <div class="label">Total Steps</div>
                <div class="value">{summary['total_steps']}</div>
            </div>
            <div class="summary-card">
                <div class="label">Success Rate</div>
                <div class="value">{summary['success_rate']}%</div>
            </div>
            <div class="summary-card">
                <div class="label">Patterns Applied</div>
                <div class="value">{summary['patterns_applied']}</div>
            </div>
        </div>
"""
        
        # Learned Patterns Section
        if self.learned_patterns:
            html += """
        <div class="section">
            <h2>📚 Learned Patterns Applied</h2>
            <p>These patterns were learned from demonstration videos and applied during execution:</p>
"""
            for pattern in self.learned_patterns:
                html += f'            <div class="list-item pattern-item">{pattern}</div>\n'
            html += "        </div>\n"
        
        # Steps Execution Section
        html += """
        <div class="section">
            <h2>📋 Execution Steps</h2>
            <table class="steps-table">
                <thead>
                    <tr>
                        <th>Step</th>
                        <th>Action</th>
                        <th>Target</th>
                        <th>Description</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
"""
        
        for step in self.steps_executed:
            status_class = f"status-{step['status']}"
            html += f"""
                    <tr>
                        <td><strong>#{step['step']}</strong></td>
                        <td>{step['action']}</td>
                        <td><code>{step['target']}</code></td>
                        <td>{step['description']}</td>
                        <td><span class="status-badge {status_class}">{step['status'].upper()}</span></td>
                    </tr>
"""
        
        html += """
                </tbody>
            </table>
        </div>
"""
        
        # Success Criteria Section
        if self.success_criteria_met:
            html += """
        <div class="section">
            <h2>✅ Success Criteria</h2>
"""
            for criterion in self.success_criteria_met:
                html += f'            <div class="list-item success-item">{criterion}</div>\n'
            html += "        </div>\n"
        
        # Expected Outcomes Section
        if self.expected_outcomes:
            html += """
        <div class="section">
            <h2>🎯 Expected Outcomes</h2>
"""
            for outcome in self.expected_outcomes:
                html += f'            <div class="list-item success-item">{outcome}</div>\n'
            html += "        </div>\n"
        
        # Issues Section
        if self.issues_encountered:
            html += """
        <div class="section">
            <h2>⚠️ Issues Encountered</h2>
"""
            for issue in self.issues_encountered:
                html += f'''            <div class="list-item issue-item">
                <strong>[{issue['severity'].upper()}]</strong> {issue['message']}
                {f"<span class='timestamp'>(Step {issue['step']})</span>" if issue.get('step') else ""}
            </div>\n'''
            html += "        </div>\n"
        
        # Ending Note Section
        if self.ending_note:
            html += f"""
        <div class="section">
            <div class="ending-note">
                <h3>📝 Final Summary</h3>
                <p>{self.ending_note}</p>
            </div>
        </div>
"""
        
        html += """
    </div>
</body>
</html>
"""
        
        return html
    
    def save_report(self, output_dir: str, workflow_name: str, task_description: str) -> str:
        """Save the HTML report to a file and return the path."""
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        safe_workflow_name = "".join(c if c.isalnum() else "_" for c in workflow_name)
        filename = f"report_{safe_workflow_name}_{timestamp}.html"
        report_path = output_path / filename
        
        # Generate and save HTML
        html_content = self.generate_html_report(workflow_name, task_description)
        
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        # Also save JSON version
        json_filename = f"report_{safe_workflow_name}_{timestamp}.json"
        json_path = output_path / json_filename
        
        json_data = {
            "workflow_name": workflow_name,
            "task_description": task_description,
            "summary": self.get_execution_summary(),
            "steps": self.steps_executed,
            "learned_patterns": self.learned_patterns,
            "success_criteria": self.success_criteria_met,
            "expected_outcomes": self.expected_outcomes,
            "issues": self.issues_encountered,
            "screenshots": self.screenshots,
            "ending_note": self.ending_note
        }
        
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, indent=2)
        
        return str(report_path)
