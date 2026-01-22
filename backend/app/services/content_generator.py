"""Content generator for document creation tasks.

This module generates appropriate content for documents based on topics and keywords
extracted from task descriptions.
"""

from typing import Dict, List, Optional


class ContentGenerator:
    """Generates content for document creation workflows."""
    
    def __init__(self):
        self.content_templates = self._build_content_templates()
    
    def _build_content_templates(self) -> Dict[str, Dict[str, str]]:
        """Build content templates for common topics."""
        return {
            "rag": {
                "title": "Retrieval Augmented Generation (RAG)",
                "content": """# Retrieval Augmented Generation (RAG)

## Overview
Retrieval Augmented Generation (RAG) is an AI framework that combines information retrieval with large language models to provide more accurate and contextually relevant responses.

## Key Components

### 1. Retrieval System
The retrieval system searches through a knowledge base or document collection to find relevant information based on the user's query. Common approaches include:
- Dense vector search using embeddings
- Sparse retrieval methods (BM25, TF-IDF)
- Hybrid search combining multiple strategies

### 2. Language Model
A large language model (LLM) like GPT-4 or Claude that generates responses based on the retrieved context. The LLM:
- Reads and understands the retrieved documents
- Synthesizes information from multiple sources
- Generates coherent, contextually appropriate responses

### 3. Integration Layer
The integration layer orchestrates the workflow:
- Processes user queries
- Retrieves relevant documents
- Formats context for the LLM
- Combines retrieval and generation

## Benefits of RAG

### Reduces Hallucinations
By grounding responses in actual documents, RAG significantly reduces the model's tendency to generate false or misleading information.

### No Retraining Required
Update your knowledge base without fine-tuning or retraining the language model. Simply add new documents to your retrieval system.

### Domain-Specific Accuracy
RAG excels at domain-specific questions by retrieving specialized knowledge that may not be in the model's training data.

### Cost-Effective
More economical than fine-tuning large models for specific use cases.

## Common Use Cases

1. **Enterprise Knowledge Bases**: Answer employee questions using internal documentation
2. **Customer Support**: Provide accurate responses based on product manuals and FAQs
3. **Research Assistants**: Help researchers find and synthesize information from papers
4. **Documentation Search**: Quickly find relevant information in large documentation sets
5. **Legal and Compliance**: Navigate complex legal documents and regulations

## Implementation Considerations

### Chunking Strategy
- Split documents into meaningful chunks (typically 200-1000 tokens)
- Preserve context at chunk boundaries
- Consider semantic chunking based on document structure

### Embedding Quality
- Choose appropriate embedding models for your domain
- Consider fine-tuning embeddings on domain-specific data
- Balance between embedding dimension and retrieval speed

### Retrieval Optimization
- Tune the number of retrieved documents (k)
- Implement re-ranking for better relevance
- Use metadata filtering when applicable

### Prompt Engineering
- Craft prompts that effectively use retrieved context
- Handle cases where retrieval returns no relevant results
- Instruct the model to cite sources when appropriate

## Conclusion
RAG represents a powerful approach to building AI applications that require accurate, up-to-date information. By combining retrieval and generation, it offers the best of both worlds: the knowledge coverage of large language models and the precision of information retrieval systems."""
            },
            
            "api": {
                "title": "API Documentation",
                "content": """# API Documentation

## Introduction
This document provides comprehensive information about our RESTful API endpoints, authentication methods, and best practices.

## Authentication

### API Keys
All API requests require authentication using an API key. Include your key in the request header:

```
Authorization: Bearer YOUR_API_KEY
```

### Getting Your API Key
1. Log in to your account dashboard
2. Navigate to Settings > API Keys
3. Click "Generate New Key"
4. Store your key securely (it won't be shown again)

## Base URL
```
https://api.example.com/v1
```

## Endpoints

### Users

#### GET /users
Retrieve a list of users.

**Parameters:**
- `page` (integer, optional): Page number for pagination (default: 1)
- `limit` (integer, optional): Number of results per page (default: 20, max: 100)
- `sort` (string, optional): Sort field (default: 'created_at')

**Response:**
```json
{
  "data": [
    {
      "id": "user_123",
      "name": "John Doe",
      "email": "john@example.com",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
}
```

#### POST /users
Create a new user.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "user"
}
```

**Response:** (201 Created)
```json
{
  "id": "user_124",
  "name": "Jane Smith",
  "email": "jane@example.com",
  "role": "user",
  "created_at": "2024-01-15T10:35:00Z"
}
```

## Error Handling

### Error Response Format
```json
{
  "error": {
    "code": "INVALID_REQUEST",
    "message": "The request body is invalid",
    "details": {
      "field": "email",
      "issue": "Email format is invalid"
    }
  }
}
```

### Common Error Codes
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid API key
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: Server error

## Rate Limiting
- Standard tier: 1000 requests per hour
- Pro tier: 10000 requests per hour
- Enterprise tier: Custom limits

## Best Practices
1. Always handle errors gracefully
2. Implement exponential backoff for retries
3. Cache responses when appropriate
4. Use pagination for large datasets
5. Keep API keys secure"""
            },
            
            "project_plan": {
                "title": "Project Planning Document",
                "content": """# Project Planning Document

## Executive Summary
This document outlines the project scope, objectives, timeline, and resource allocation for successful project delivery.

## Project Overview

### Objectives
- Define clear, measurable goals
- Establish success criteria
- Align stakeholder expectations
- Create actionable roadmap

### Scope
**In Scope:**
- Feature development and testing
- Documentation and training materials
- Deployment and monitoring setup
- Post-launch support (30 days)

**Out of Scope:**
- Integration with legacy systems
- Custom reporting features
- Mobile application development

## Timeline

### Phase 1: Planning (Weeks 1-2)
- Requirements gathering
- Technical design
- Resource allocation
- Risk assessment

### Phase 2: Development (Weeks 3-8)
- Sprint 1: Core functionality
- Sprint 2: Integration layer
- Sprint 3: UI/UX implementation
- Sprint 4: Testing and refinement

### Phase 3: Testing (Weeks 9-10)
- Unit testing
- Integration testing
- User acceptance testing (UAT)
- Performance testing

### Phase 4: Deployment (Weeks 11-12)
- Staging environment setup
- Production deployment
- Monitoring configuration
- Documentation finalization

## Team Structure

### Core Team
- **Project Manager**: Sarah Johnson
- **Tech Lead**: Michael Chen
- **Backend Developers**: 3 engineers
- **Frontend Developers**: 2 engineers
- **QA Engineer**: Emily Davis
- **DevOps Engineer**: Robert Kim

### Stakeholders
- **Product Owner**: Jennifer Williams
- **Business Analyst**: David Brown
- **UI/UX Designer**: Alexandra Martinez

## Resources

### Budget
- Development: $150,000
- Infrastructure: $20,000
- Tools and licenses: $10,000
- Contingency (10%): $18,000
- **Total**: $198,000

### Infrastructure
- Cloud hosting (AWS/GCP)
- CI/CD pipeline
- Monitoring and logging tools
- Development and staging environments

## Risk Management

### Identified Risks
1. **Technical Complexity** (High)
   - Mitigation: Early prototyping, technical spikes
   
2. **Resource Availability** (Medium)
   - Mitigation: Cross-training, backup resources
   
3. **Scope Creep** (Medium)
   - Mitigation: Strict change control process

4. **Third-party Dependencies** (Low)
   - Mitigation: Vendor SLAs, backup providers

## Success Metrics
- On-time delivery within 12 weeks
- Budget adherence (±5%)
- Zero critical bugs in production
- 95% test coverage
- Positive stakeholder feedback

## Communication Plan
- **Daily**: Team standups (15 min)
- **Weekly**: Sprint planning and retrospectives
- **Bi-weekly**: Stakeholder updates
- **Monthly**: Executive steering committee

## Next Steps
1. Finalize technical architecture
2. Set up development environment
3. Begin Sprint 1 development
4. Schedule weekly check-ins"""
            },
            
            "meeting_notes": {
                "title": "Meeting Notes Template",
                "content": """# Meeting Notes

## Meeting Details
- **Date**: [Date]
- **Time**: [Start Time] - [End Time]
- **Location**: [Physical/Virtual]
- **Facilitator**: [Name]
- **Note Taker**: [Name]

## Attendees
- [Name 1] - [Role]
- [Name 2] - [Role]
- [Name 3] - [Role]

## Agenda
1. Review previous action items
2. Project status update
3. Technical discussion
4. Resource allocation
5. Next steps and action items

## Discussion Summary

### 1. Previous Action Items Review
- **Item 1**: [Status] - [Owner]
- **Item 2**: [Status] - [Owner]
- **Item 3**: [Status] - [Owner]

### 2. Project Status Update
[Summary of current project status, progress, and any blockers]

Key points:
- Progress on [Feature/Task]
- Challenges encountered
- Upcoming milestones

### 3. Technical Discussion
[Details of technical decisions, architecture discussions, or implementation plans]

Decisions made:
- [Decision 1]: [Rationale]
- [Decision 2]: [Rationale]

### 4. Resource Allocation
[Discussion of team capacity, resource needs, and allocation]

### 5. Concerns and Risks
- [Risk/Concern 1]: [Mitigation strategy]
- [Risk/Concern 2]: [Mitigation strategy]

## Action Items
| Action Item | Owner | Due Date | Priority |
|-------------|-------|----------|----------|
| [Task description] | [Name] | [Date] | High |
| [Task description] | [Name] | [Date] | Medium |
| [Task description] | [Name] | [Date] | Low |

## Decisions Made
1. [Decision 1 with context]
2. [Decision 2 with context]
3. [Decision 3 with context]

## Next Meeting
- **Date**: [Date]
- **Agenda**: [Brief description of next meeting topics]

## Additional Notes
[Any other relevant information, parking lot items, or follow-up discussions needed]"""
            }
        }
    
    def generate_content(self, topic: str, keywords: Optional[List[str]] = None) -> Dict[str, str]:
        """Generate content based on topic and keywords.
        
        Args:
            topic: The main topic for content generation
            keywords: Optional list of keywords to focus on
            
        Returns:
            Dictionary with 'title' and 'content' keys
        """
        topic_lower = topic.lower()
        
        # Check for exact matches in templates
        for key, template in self.content_templates.items():
            if key in topic_lower or any(kw in topic_lower for kw in key.split('_')):
                return template
        
        # Check keywords if provided
        if keywords:
            for key, template in self.content_templates.items():
                if any(kw in key for kw in keywords):
                    return template
        
        # Generate generic content based on topic
        return self._generate_generic_content(topic)
    
    def _generate_generic_content(self, topic: str) -> Dict[str, str]:
        """Generate generic content when no template matches."""
        title = topic.title()
        content = f"""# {title}

## Introduction
This document provides an overview of {topic}.

## Key Concepts
- Concept 1: [Description]
- Concept 2: [Description]
- Concept 3: [Description]

## Main Content
[Detailed information about {topic}]

### Section 1
Content for section 1 discussing various aspects of {topic}.

### Section 2
Content for section 2 with additional details and examples.

### Section 3
Content for section 3 covering best practices and recommendations.

## Best Practices
1. Best practice 1
2. Best practice 2
3. Best practice 3

## Conclusion
Summary of the main points about {topic} and next steps for implementation.

## References
- Reference 1
- Reference 2
- Reference 3"""
        
        return {
            "title": title,
            "content": content
        }
    
    def get_available_topics(self) -> List[str]:
        """Get list of topics with pre-built templates."""
        return list(self.content_templates.keys())
