"""Intake reminder service."""
from datetime import datetime, timedelta

from app.core.logging import get_logger
from app.core.email import send_email

logger = get_logger(__name__)


class ReminderService:
    """Send automated intake reminders to clients."""

    def __init__(self):
        pass

    async def send_intake_invitation(
        self,
        client_email: str,
        client_name: str,
        intake_link: str,
    ) -> bool:
        """
        Send initial intake invitation email.
        
        Args:
            client_email: Client's email address
            client_name: Client's name
            intake_link: Secure link to intake form
            
        Returns:
            True if sent successfully
        """
        subject = "Welcome to Sonexial - Complete Your Author Profile"
        
        body = f"""Hi {client_name},

Thank you for choosing Sonexial for your author website.

To get started, please complete your author profile using this secure link:

{intake_link}

This form will take approximately 15-20 minutes. Have the following ready:
- Your author biography
- Book titles and descriptions
- Author headshot (minimum 1200x1200px)
- Book cover images (minimum 1600x2400px)
- Links to your Amazon, Goodreads, or BookBub profiles

If you have any questions, reply to this email.

Best regards,
The Sonexial Team
"""
        
        try:
            await send_email(
                to_email=client_email,
                subject=subject,
                body=body,
            )
            logger.info(f"Sent intake invitation to {client_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send intake invitation: {e}")
            return False

    async def send_asset_reminder(
        self,
        client_email: str,
        client_name: str,
        missing_assets: list[str],
        attempt_number: int,
    ) -> bool:
        """
        Send reminder about missing assets.
        
        Args:
            client_email: Client's email
            client_name: Client's name
            missing_assets: List of missing asset types
            attempt_number: Which reminder attempt (1-3)
            
        Returns:
            True if sent successfully
        """
        if attempt_number > 3:
            logger.warning(f"Max reminder attempts reached for {client_email}")
            return False
        
        # Human-readable asset names
        asset_names = {
            "headshot": "Author headshot photo",
            "book_0_cover": "Cover for your first book",
            "book_1_cover": "Cover for your second book",
            "book_2_cover": "Cover for your third book",
        }
        
        missing_readable = [
            asset_names.get(asset, asset.replace("_", " ").title())
            for asset in missing_assets
        ]
        
        subject = f"Action Required: Missing Assets for Your Sonexial Site (Reminder {attempt_number})"
        
        body = f"""Hi {client_name},

We're still missing the following items needed to build your author website:

{chr(10).join(f"- {item}" for item in missing_readable)}

Please upload these assets as soon as possible to avoid delays.

Requirements:
- Headshot: Minimum 1200x1200px, JPG or PNG
- Book covers: Minimum 1600x2400px, JPG or PNG

If you've already uploaded these files, please ignore this message.

Best regards,
The Sonexial Team
"""
        
        try:
            await send_email(
                to_email=client_email,
                subject=subject,
                body=body,
            )
            logger.info(f"Sent asset reminder #{attempt_number} to {client_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send asset reminder: {e}")
            return False

    async def send_dead_job_alert(
        self,
        operator_email: str,
        job_type: str,
        error_message: str,
        client_id: str | None = None,
    ) -> bool:
        """
        Alert operator about a dead job.
        
        Args:
            operator_email: Operator's email
            job_type: Type of job that failed
            error_message: Error details
            client_id: Related client ID if applicable
            
        Returns:
            True if sent successfully
        """
        subject = f"[ALERT] Dead Job: {job_type}"
        
        body = f"""A job has failed after maximum retry attempts.

Job Type: {job_type}
Client ID: {client_id or "N/A"}
Error: {error_message}

Please investigate and manually requeue if needed.

-- 
Sonexial Operations
"""
        
        try:
            await send_email(
                to_email=operator_email,
                subject=subject,
                body=body,
            )
            logger.warning(f"Sent dead job alert for {job_type}")
            return True
        except Exception as e:
            logger.error(f"Failed to send dead job alert: {e}")
            return False
