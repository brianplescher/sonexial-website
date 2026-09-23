"""Approval system endpoints."""
import hashlib
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.logging import get_logger
from app.models.approval import Approval, ApprovalType, ApprovalStatus

router = APIRouter(prefix="/approvals", tags=["Approvals"])
logger = get_logger(__name__)


class ApprovalResponse(BaseModel):
    """Response model for approval operations."""
    approval_id: str
    status: str
    message: str


@router.get("/list")
async def list_approvals():
    """List all pending approvals (ops endpoint)."""
    from sqlmodel import select
    from app.core.db import get_session
    
    async for session in get_session():
        result = await session.execute(
            select(Approval).where(Approval.status == ApprovalStatus.PENDING)
        )
        approvals = result.scalars().all()
        
        return {
            "pending_approvals": [
                {
                    "id": str(a.id),
                    "type": a.type,
                    "payload": a.payload,
                    "expires_at": a.expires_at.isoformat() if a.expires_at else None,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in approvals
            ],
            "count": len(approvals),
        }


@router.post("/{token}/approve", response_model=ApprovalResponse)
async def approve(token: str):
    """Approve a pending item using magic link token."""
    from sqlmodel import select
    from app.core.db import get_session
    
    # Hash the token for lookup
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    async for session in get_session():
        result = await session.execute(
            select(Approval).where(
                Approval.token_hash == token_hash,
                Approval.status == ApprovalStatus.PENDING,
            )
        )
        approval = result.scalar_one_or_none()
        
        if not approval:
            raise HTTPException(status_code=404, detail="Invalid or expired approval token")
        
        # Check expiration
        if approval.expires_at and approval.expires_at < datetime.utcnow():
            approval.status = ApprovalStatus.EXPIRED
            session.add(approval)
            await session.commit()
            raise HTTPException(status_code=410, detail="Approval token has expired")
        
        # Mark as approved
        approval.status = ApprovalStatus.APPROVED
        approval.decided_at = datetime.utcnow()
        session.add(approval)
        await session.commit()
        
        logger.info(f"Approval {approval.id} approved via token")
        
        # Trigger next action based on type
        await _handle_approval_action(approval)
        
        break
    
    return ApprovalResponse(
        approval_id=str(approval.id),
        status="approved",
        message=f"{approval.type} approved successfully",
    )


@router.post("/{token}/reject", response_model=ApprovalResponse)
async def reject(token: str):
    """Reject a pending item using magic link token."""
    from sqlmodel import select
    from app.core.db import get_session
    
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    
    async for session in get_session():
        result = await session.execute(
            select(Approval).where(
                Approval.token_hash == token_hash,
                Approval.status == ApprovalStatus.PENDING,
            )
        )
        approval = result.scalar_one_or_none()
        
        if not approval:
            raise HTTPException(status_code=404, detail="Invalid or expired approval token")
        
        # Check expiration
        if approval.expires_at and approval.expires_at < datetime.utcnow():
            approval.status = ApprovalStatus.EXPIRED
            session.add(approval)
            await session.commit()
            raise HTTPException(status_code=410, detail="Approval token has expired")
        
        # Mark as rejected
        approval.status = ApprovalStatus.REJECTED
        approval.decided_at = datetime.utcnow()
        session.add(approval)
        await session.commit()
        
        logger.info(f"Approval {approval.id} rejected via token")
        
        break
    
    return ApprovalResponse(
        approval_id=str(approval.id),
        status="rejected",
        message=f"{approval.type} rejected",
    )


async def _handle_approval_action(approval: Approval):
    """Trigger next action after approval."""
    from app.models.job import Job, JobStatus
    from app.core.db import get_session
    
    job_type_map = {
        ApprovalType.OUTBOUND_PITCH: JobType.GENERATE_PITCH,
        ApprovalType.CLIENT_BUILD: JobType.BUILD_SITE,
        ApprovalType.PRODUCTION_DEPLOY: JobType.DEPLOY_PREVIEW,
        ApprovalType.MONTHLY_REPORT: JobType.PREPARE_MONTHLY_REPORT,
    }
    
    target_job_type = job_type_map.get(approval.type)
    if not target_job_type:
        return
    
    async for session in get_session():
        # Create job to proceed with approved action
        job = Job(
            type=target_job_type,
            payload={**approval.payload, "approval_id": str(approval.id)},
            status=JobStatus.QUEUED,
        )
        session.add(job)
        await session.commit()
        logger.info(f"Created {target_job_type} job after approval")
        break
