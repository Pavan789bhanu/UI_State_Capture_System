from fastapi import APIRouter
from app.api.v1.endpoints import auth, workflows, executions, analytics, ai, playground, video_learning

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(workflows.router, prefix="/workflows", tags=["workflows"])
api_router.include_router(executions.router, prefix="/executions", tags=["executions"])
api_router.include_router(analytics.router, prefix="/analytics", tags=["analytics"])
api_router.include_router(ai.router, prefix="/ai", tags=["ai"])
api_router.include_router(playground.router, prefix="/playground", tags=["playground"])
api_router.include_router(video_learning.router, prefix="/video-learning", tags=["video-learning"])
