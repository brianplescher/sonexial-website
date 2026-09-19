"""Stripe webhook handler."""
import json
from fastapi import APIRouter, HTTPException, Request
from stripe._error import SignatureVerificationError

from app.core.config import settings
from app.core.logging import get_logger
from app.models.client import Client, ClientStatus
from app.models.onboarding import Onboarding, OnboardingStatus
from app.models.job import Job, JobType, JobStatus

router = APIRouter(prefix="/webhooks/stripe", tags=["Webhooks"])
logger = get_logger(__name__)


@router.post("")
async def handle_stripe_webhook(request: Request):
    """
    Handle Stripe webhook events.
    
    Verifies webhook signature and processes events.
    """
    from sqlmodel import Session
    from app.core.db import get_session
    
    body = await request.body()
    sig_header = request.headers.get("stripe-signature")
    
    # Verify webhook signature in production
    if settings.APP_ENV == "production":
        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            event = stripe.Webhook.construct_event(
                payload=body,
                sig_header=sig_header,
                secret=settings.STRIPE_WEBHOOK_SECRET,
            )
        except (SignatureVerificationError, ValueError) as e:
            logger.error(f"Invalid webhook signature: {e}")
            raise HTTPException(status_code=400, detail="Invalid signature")
    else:
        # Skip verification in development
        event = json.loads(body)
    
    event_type = event.get("type")
    data_object = event.get("data", {}).get("object", {})
    
    logger.info(f"Processing Stripe event: {event_type}")
    
    if event_type == "checkout.session.completed":
        await handle_checkout_completed(data_object)
    elif event_type == "customer.subscription.created":
        await handle_subscription_created(data_object)
    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data_object)
    else:
        logger.info(f"Ignoring event type: {event_type}")
    
    return {"status": "ok"}


async def handle_checkout_completed(session_data: dict):
    """Handle successful checkout - create client and onboarding."""
    from sqlmodel import select
    from app.core.db import get_session
    
    customer_email = session_data.get("customer_email")
    customer_id = session_data.get("customer")
    metadata = session_data.get("metadata", {})
    client_id = metadata.get("client_id")  # May be passed from frontend
    
    async for session in get_session():
        # Check if client exists
        result = await session.execute(
            select(Client).where(Client.email == customer_email)
        )
        client = result.scalar_one_or_none()
        
        if not client:
            # Create new client
            client = Client(
                email=customer_email,
                name=metadata.get("name", ""),
                stripe_customer_id=customer_id,
                status=ClientStatus.PAID,
            )
            session.add(client)
            await session.commit()
            await session.refresh(client)
            
            logger.info(f"Created new client: {client.id}")
        
        # Create onboarding record
        onboarding = Onboarding(
            client_id=client.id,
            status=OnboardingStatus.PENDING,
            intake_data={},
            missing_fields=[],
            validation_errors=[],
        )
        session.add(onboarding)
        
        # Create job to send intake email
        job = Job(
            type=JobType.SEND_INTAKE_EMAIL,
            payload={
                "client_id": str(client.id),
                "onboarding_id": str(onboarding.id),
            },
            status=JobStatus.QUEUED,
        )
        session.add(job)
        
        await session.commit()
        logger.info(f"Created onboarding and intake job for client {client.id}")
        break


async def handle_subscription_created(subscription_data: dict):
    """Handle new subscription - update client to retained status."""
    from sqlmodel import select
    from app.core.db import get_session
    
    customer_id = subscription_data.get("customer")
    
    async for session in get_session():
        result = await session.execute(
            select(Client).where(Client.stripe_customer_id == customer_id)
        )
        client = result.scalar_one_or_none()
        
        if client:
            client.status = ClientStatus.RETAINED
            session.add(client)
            await session.commit()
            logger.info(f"Client {client.id} upgraded to retained status")
        break


async def handle_subscription_deleted(subscription_data: dict):
    """Handle subscription cancellation - mark client as churned."""
    from sqlmodel import select
    from app.core.db import get_session
    
    customer_id = subscription_data.get("customer")
    
    async for session in get_session():
        result = await session.execute(
            select(Client).where(Client.stripe_customer_id == customer_id)
        )
        client = result.scalar_one_or_none()
        
        if client:
            client.status = ClientStatus.CHURNED
            session.add(client)
            await session.commit()
            logger.info(f"Client {client.id} marked as churned")
        break
