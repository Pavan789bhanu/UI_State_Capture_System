"""API endpoints for video-based learning management."""
from typing import List
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.video_learning_service import video_learning_service


router = APIRouter()


class VideoInfo(BaseModel):
    """Information about a training video."""
    name: str
    task: str
    path: str
    size_mb: float


class LearningStats(BaseModel):
    """Statistics about the video learning system."""
    total_videos: int
    total_size_mb: float
    video_list: List[str]
    data_directory: str
    cache_directory: str


class ExampleRequest(BaseModel):
    """Request for few-shot examples."""
    num_examples: int = 3


@router.get("/videos", response_model=List[VideoInfo])
async def list_training_videos():
    """Get list of all available training videos."""
    try:
        videos = video_learning_service.get_available_videos()
        return videos
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error listing videos: {str(e)}")


@router.get("/stats", response_model=LearningStats)
async def get_learning_stats():
    """Get statistics about the video learning system."""
    try:
        stats = video_learning_service.get_learning_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting stats: {str(e)}")


@router.post("/examples")
async def generate_examples(request: ExampleRequest):
    """Generate few-shot learning examples from random videos."""
    try:
        examples = await video_learning_service.create_few_shot_examples(
            num_examples=request.num_examples
        )
        return {
            "examples": examples,
            "count": len(examples) // 2,  # Each example is user + assistant pair
            "message": f"Generated {len(examples) // 2} training examples from demonstration videos"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating examples: {str(e)}")


@router.get("/video/{video_name}/metadata")
async def get_video_metadata(video_name: str):
    """Get metadata for a specific video."""
    try:
        videos = video_learning_service.get_available_videos()
        video = next((v for v in videos if v["name"] == video_name), None)
        
        if not video:
            raise HTTPException(status_code=404, detail=f"Video not found: {video_name}")
        
        metadata = await video_learning_service.extract_video_metadata(video["path"])
        return metadata
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting metadata: {str(e)}")


@router.post("/enhanced-prompt")
async def generate_enhanced_prompt(task: str, num_examples: int = 3):
    """Generate an enhanced prompt with video-based few-shot learning."""
    try:
        enhanced_prompt = await video_learning_service.generate_enhanced_prompt(
            user_task=task,
            num_examples=num_examples
        )
        return {
            "task": task,
            "enhanced_prompt": enhanced_prompt,
            "num_examples_used": num_examples,
            "message": "Enhanced prompt generated with video-based learning examples"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating enhanced prompt: {str(e)}")
