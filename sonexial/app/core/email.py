"""Sonexial Core Email Service."""
import aiosmtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
import logging

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """
    Send an email using Resend API or SMTP fallback.
    
    Args:
        to: Recipient email address
        subject: Email subject
        body_html: HTML body content
        body_text: Plain text body (optional)
    
    Returns:
        True if sent successfully, False otherwise
    """
    if settings.resend_api_key:
        return await _send_via_resend(to, subject, body_html, body_text)
    else:
        logger.warning("No email provider configured. Email not sent.")
        logger.info(f"Email would be sent to {to}: {subject}")
        return False


async def _send_via_resend(
    to: str,
    subject: str,
    body_html: str,
    body_text: Optional[str] = None,
) -> bool:
    """Send email via Resend API."""
    import httpx
    
    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {settings.resend_api_key}",
        "Content-Type": "application/json",
    }
    
    payload = {
        "from": settings.email_from,
        "to": [to],
        "subject": subject,
        "html": body_html,
    }
    
    if body_text:
        payload["text"] = body_text
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload, headers=headers)
            response.raise_for_status()
            logger.info(f"Email sent to {to}: {subject}")
            return True
    except Exception as e:
        logger.error(f"Failed to send email via Resend: {e}")
        return False


def create_intake_email(client_name: str, intake_link: str) -> tuple[str, str]:
    """Create intake invitation email content."""
    subject = "Welcome to Sonexial - Complete Your Author Profile"
    
    html = f"""
    <html>
    <body>
        <p>Hi {client_name},</p>
        
        <p>Thank you for choosing Sonexial! To get started building your AI-ready author website, 
        please complete your profile by providing the following information:</p>
        
        <ul>
            <li>Author name and pen name (if applicable)</li>
            <li>Book details (titles, covers, descriptions)</li>
            <li>Genre and target reader information</li>
            <li>Social media and retailer links</li>
            <li>Author headshot</li>
        </ul>
        
        <p><a href="{intake_link}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Complete Your Profile</a></p>
        
        <p>This link expires in 48 hours.</p>
        
        <p>Best regards,<br>
        The Sonexial Team</p>
        
        <hr>
        <p style="font-size: 12px; color: #666;">
        {settings.physical_mailing_address}<br>
        Reply to this email or contact us at {settings.support_email}
        </p>
    </body>
    </html>
    """
    
    text = f"""
    Hi {client_name},
    
    Thank you for choosing Sonexial! To get started building your AI-ready author website,
    please complete your profile by visiting:
    
    {intake_link}
    
    This link expires in 48 hours.
    
    Best regards,
    The Sonexial Team
    
    ---
    {settings.physical_mailing_address}
    Contact: {settings.support_email}
    """
    
    return subject, html, text


def create_approval_email(
    approval_type: str,
    entity_info: str,
    approve_link: str,
    reject_link: str,
) -> tuple[str, str, str]:
    """Create approval request email content for operator."""
    subject = f"[Action Required] {approval_type.replace('_', ' ').title()} Approval"
    
    html = f"""
    <html>
    <body>
        <h2>Approval Required: {approval_type.replace('_', ' ').title()}</h2>
        
        <p>{entity_info}</p>
        
        <p>
            <a href="{approve_link}" style="background-color: #4CAF50; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px; margin-right: 10px;">Approve</a>
            <a href="{reject_link}" style="background-color: #f44336; color: white; padding: 14px 20px; text-decoration: none; border-radius: 4px;">Reject</a>
        </p>
        
        <p>This approval link expires in 48 hours.</p>
    </body>
    </html>
    """
    
    text = f"""
    Approval Required: {approval_type.replace('_', ' ').title()}
    
    {entity_info}
    
    Approve: {approve_link}
    Reject: {reject_link}
    
    This approval link expires in 48 hours.
    """
    
    return subject, html, text
