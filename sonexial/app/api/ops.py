"""Operations endpoints for internal use."""
from fastapi import APIRouter, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.logging import get_logger
from app.core.config import settings

router = APIRouter(prefix="/ops", tags=["Operations"])
logger = get_logger(__name__)
security = HTTPBearer()


async def verify_ops_token(
    credentials: HTTPAuthorizationCredentials = Security(security),
):
    """Verify ops bearer token."""
    if credentials.credentials != settings.OPS_BEARER_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid ops token")
    return True


@router.get("/approvals")
async def list_approvals_ops(verified: bool = Depends(verify_ops_token)):
    """List all approvals (internal ops endpoint)."""
    from sqlmodel import select
    from app.core.db import get_session
    from app.models.approval import Approval
    
    async for session in get_session():
        result = await session.execute(select(Approval))
        approvals = result.scalars().all()
        
        return {
            "approvals": [
                {
                    "id": str(a.id),
                    "type": a.type,
                    "status": a.status,
                    "payload": a.payload,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                    "decided_at": a.decided_at.isoformat() if a.decided_at else None,
                }
                for a in approvals
            ],
            "count": len(approvals),
        }


@router.post("/jobs/requeue/{job_id}")
async def requeue_job(job_id: str, verified: bool = Depends(verify_ops_token)):
    """Manually requeue a failed or dead job."""
    from sqlmodel import select
    from app.core.db import get_session
    from app.models.job import Job, JobStatus
    
    async for session in get_session():
        result = await session.execute(
            select(Job).where(Job.id == job_id)
        )
        job = result.scalar_one_or_none()
        
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        
        # Reset job status
        job.status = JobStatus.QUEUED
        job.attempts = 0
        job.last_error = None
        session.add(job)
        await session.commit()
        
        logger.info(f"Manually requeued job {job_id}")
        
        return {
            "job_id": str(job.id),
            "status": "requeued",
            "type": job.type,
        }


@router.get("/jobs")
async def list_jobs_ops(
    status: str | None = None,
    verified: bool = Depends(verify_ops_token),
):
    """List jobs with optional status filter."""
    from sqlmodel import select
    from app.core.db import get_session
    from app.models.job import Job, JobStatus
    
    async for session in get_session():
        query = select(Job)
        if status:
            try:
                job_status = JobStatus(status)
                query = query.where(Job.status == job_status)
            except ValueError:
                pass
        
        result = await session.execute(query.order_by(Job.created_at.desc()).limit(50))
        jobs = result.scalars().all()
        
        return {
            "jobs": [
                {
                    "id": str(j.id),
                    "type": j.type,
                    "status": j.status,
                    "attempts": j.attempts,
                    "last_error": j.last_error,
                    "created_at": j.created_at.isoformat() if j.created_at else None,
                }
                for j in jobs
            ],
            "count": len(jobs),
        }


@router.get("/llm-usage")
async def get_llm_usage(verified: bool = Depends(verify_ops_token)):
    """Get LLM usage and cost summary."""
    from sqlmodel import select, func
    from datetime import datetime
    from app.core.db import get_session
    from app.models.llm_call import LLMCall
    
    now = datetime.utcnow()
    first_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    
    async for session in get_session():
        # Total cost this month
        cost_result = await session.execute(
            select(func.sum(LLMCall.estimated_cost_usd)).where(
                LLMCall.created_at >= first_of_month
            )
        )
        total_cost = cost_result.scalar() or 0
        
        # Calls by model
        model_result = await session.execute(
            select(LLMCall.model, func.count(LLMCall.id), func.sum(LLMCall.estimated_cost_usd))
            .where(LLMCall.created_at >= first_of_month)
            .group_by(LLMCall.model)
        )
        by_model = [
            {"model": row[0], "calls": row[1], "cost": float(row[2]) if row[2] else 0}
            for row in model_result.all()
        ]
        
        # Total calls
        calls_result = await session.execute(
            select(func.count(LLMCall.id)).where(
                LLMCall.created_at >= first_of_month
            )
        )
        total_calls = calls_result.scalar() or 0
        
        return {
            "period": first_of_month.strftime("%Y-%m"),
            "total_cost_usd": float(total_cost),
            "total_calls": total_calls,
            "budget_usd": settings.LLM_MONTHLY_BUDGET_USD,
            "remaining_budget": settings.LLM_MONTHLY_BUDGET_USD - float(total_cost),
            "by_model": by_model,
        }
