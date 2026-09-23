"""Intake form endpoints."""
import uuid
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.logging import get_logger
from app.models.onboarding import Onboarding, OnboardingStatus
from app.models.asset import Asset, AssetType, AssetStatus

router = APIRouter(prefix="/intake", tags=["Intake"])
logger = get_logger(__name__)


class IntakeSubmitRequest(BaseModel):
    """Request model for intake submission."""
    intake_data: dict


@router.get("/{client_id}")
async def get_intake_status(client_id: str):
    """Get onboarding/intake status for a client."""
    from sqlmodel import select
    from app.core.db import get_session
    
    async for session in get_session():
        result = await session.execute(
            select(Onboarding).where(Onboarding.client_id == client_id)
        )
        onboarding = result.scalar_one_or_none()
        
        if not onboarding:
            raise HTTPException(status_code=404, detail="Onboarding not found")
        
        return {
            "client_id": str(onboarding.client_id),
            "status": onboarding.status,
            "missing_fields": onboarding.missing_fields,
            "validation_errors": onboarding.validation_errors,
            "intake_data": onboarding.intake_data,
        }


@router.post("/{client_id}/submit")
async def submit_intake(client_id: str, request: IntakeSubmitRequest):
    """Submit completed intake form data."""
    from sqlmodel import select
    from app.core.db import get_session
    from app.services.intake import IntakeValidator
    
    validator = IntakeValidator()
    
    # Validate intake data
    validation_result = await validator.validate(request.intake_data)
    
    if not validation_result.is_valid:
        # Update onboarding with errors
        async for session in get_session():
            result = await session.execute(
                select(Onboarding).where(Onboarding.client_id == client_id)
            )
            onboarding = result.scalar_one_or_none()
            
            if onboarding:
                onboarding.status = OnboardingStatus.ASSETS_MISSING
                onboarding.validation_errors = validation_result.validation_errors
                onboarding.missing_fields = validation_result.missing_fields
                session.add(onboarding)
                await session.commit()
            
            break
        
        return {
            "status": "invalid",
            "missing_fields": validation_result.missing_fields,
            "errors": validation_result.validation_errors,
        }
    
    # Save validated data
    async for session in get_session():
        result = await session.execute(
            select(Onboarding).where(Onboarding.client_id == client_id)
        )
        onboarding = result.scalar_one_or_none()
        
        if not onboarding:
            raise HTTPException(status_code=404, detail="Onboarding not found")
        
        onboarding.intake_data = request.intake_data
        onboarding.status = OnboardingStatus.READY_TO_BUILD
        session.add(onboarding)
        await session.commit()
        
        logger.info(f"Intake submitted successfully for client {client_id}")
        break
    
    return {"status": "success", "message": "Intake data saved"}


@router.post("/{client_id}/assets/upload")
async def upload_asset(client_id: str, request: Request):
    """
    Upload an asset (headshot, book cover, etc.).
    
    In production, this would handle multipart file uploads.
    For now, returns placeholder response.
    """
    # This is a simplified version - full implementation would:
    # 1. Parse multipart form data
    # 2. Validate file type and size with Pillow
    # 3. Store file via storage service
    # 4. Create Asset record
    # 5. Update onboarding missing_fields
    
    return {
        "status": "placeholder",
        "message": "Asset upload endpoint - implement with actual file handling",
    }
