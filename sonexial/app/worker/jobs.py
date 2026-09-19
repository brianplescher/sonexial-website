"""Job type definitions and handlers."""
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from app.core.logging import get_logger
from app.models.job import Job, JobType, JobStatus
from app.models.approval import Approval, ApprovalType, ApprovalStatus

logger = get_logger(__name__)


class JobHandler:
    """Handle different job types."""

    def __init__(self):
        pass

    async def handle(self, job: Job) -> bool:
        """
        Route job to appropriate handler.
        
        Args:
            job: Job record to process
            
        Returns:
            True if successful, False if failed
        """
        handler_map = {
            JobType.SCAN_URL: self._handle_scan_url,
            JobType.GENERATE_PITCH: self._handle_generate_pitch,
            JobType.GENERATE_CONTENT: self._handle_generate_content,
            JobType.GENERATE_SCHEMA: self._handle_generate_schema,
            JobType.SEND_INTAKE_EMAIL: self._handle_send_intake_email,
            JobType.SEND_ASSET_REMINDER: self._handle_send_asset_reminder,
            JobType.CREATE_CLIENT_REPO: self._handle_create_client_repo,
            JobType.BUILD_SITE: self._handle_build_site,
            JobType.DEPLOY_PREVIEW: self._handle_deploy_preview,
            JobType.PREPARE_MONTHLY_REPORT: self._handle_prepare_monthly_report,
            JobType.NOTIFY_OPERATOR: self._handle_notify_operator,
        }
        
        handler = handler_map.get(job.type)
        if not handler:
            logger.error(f"Unknown job type: {job.type}")
            return False
        
        try:
            return await handler(job)
        except Exception as e:
            logger.error(f"Job {job.id} failed: {e}")
            raise  # Re-raise for worker to handle retry logic

    async def _handle_scan_url(self, job: Job) -> bool:
        """Handle URL scan job."""
        from app.services.scanner import GEOScanner
        from app.core.db import get_session
        from sqlmodel import select
        from app.models.scan import Scan, ScanStatus
        
        url = job.payload.get("url")
        if not url:
            logger.error("Scan job missing URL")
            return False
        
        scanner = GEOScanner()
        result = await scanner.scan(url)
        
        # Save scan result
        async for session in get_session():
            scan = Scan(
                url=url,
                normalized_url=result.get("normalized_url", url),
                cache_key=result.get("cache_key", ""),
                status=ScanStatus.SUCCESS,
                score=result.get("score", 0),
                report=result,
            )
            session.add(scan)
            await session.commit()
            break
        
        return True

    async def _handle_generate_pitch(self, job: Job) -> bool:
        """Handle pitch generation job."""
        from app.services.agents import PitchAgent
        from app.core.db import get_session
        from app.models.scan import Scan
        
        scan_id = job.payload.get("scan_id")
        if not scan_id:
            logger.error("Pitch job missing scan_id")
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Scan).where(Scan.id == scan_id)
            )
            scan = result.scalar_one_or_none()
            
            if not scan:
                logger.error(f"Scan {scan_id} not found")
                return False
            
            agent = PitchAgent()
            pitch = await agent.generate(
                author_url=scan.url,
                score=scan.score or 0,
                critical_failures=scan.report.get("critical_failures", []),
                warnings=scan.report.get("warnings", []),
                opportunities=scan.report.get("opportunities", []),
            )
            
            # Create approval record for outbound pitch
            approval = Approval(
                type=ApprovalType.OUTBOUND_PITCH,
                payload={
                    "scan_id": str(scan.id),
                    "pitch_subject": pitch.subject_line,
                    "pitch_body": pitch.body_text,
                    "primary_pain_point": pitch.primary_pain_point,
                },
                status=ApprovalStatus.PENDING,
                expires_at=datetime.utcnow() + timedelta(hours=48),
            )
            session.add(approval)
            await session.commit()
            break
        
        logger.info(f"Generated pitch draft for scan {scan_id}")
        return True

    async def _handle_generate_content(self, job: Job) -> bool:
        """Handle content generation job."""
        from app.services.agents import ContentAgent
        from app.core.db import get_session
        from app.models.onboarding import Onboarding
        
        onboarding_id = job.payload.get("onboarding_id")
        if not onboarding_id:
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Onboarding).where(Onboarding.id == onboarding_id)
            )
            onboarding = result.scalar_one_or_none()
            
            if not onboarding:
                return False
            
            intake_data = onboarding.intake_data
            agent = ContentAgent()
            
            content = await agent.generate(
                author_name=intake_data.get("author_name", ""),
                pen_name=intake_data.get("pen_name"),
                primary_genre=intake_data.get("primary_genre", ""),
                secondary_genres=intake_data.get("secondary_genres", []),
                comparable_authors=intake_data.get("comparable_authors", []),
                target_reader=intake_data.get("target_reader", ""),
                books=intake_data.get("books", []),
                raw_bio=intake_data.get("raw_bio", ""),
            )
            
            # Store content in onboarding
            onboarding.intake_data["generated_content"] = content.model_dump()
            session.add(onboarding)
            await session.commit()
            break
        
        return True

    async def _handle_generate_schema(self, job: Job) -> bool:
        """Handle schema generation job."""
        from app.services.agents import SchemaAgent
        from app.core.db import get_session
        from app.models.onboarding import Onboarding
        
        onboarding_id = job.payload.get("onboarding_id")
        site_url = job.payload.get("site_url")
        
        if not onboarding_id or not site_url:
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Onboarding).where(Onboarding.id == onboarding_id)
            )
            onboarding = result.scalar_one_or_none()
            
            if not onboarding:
                return False
            
            intake_data = onboarding.intake_data
            agent = SchemaAgent()
            
            same_as_links = []
            for url_field in ["amazon_author_page", "goodreads_url", "bookbub_url", "newsletter_url"]:
                if intake_data.get(url_field):
                    same_as_links.append(intake_data[url_field])
            same_as_links.extend(intake_data.get("social_links", []))
            
            schema = await agent.generate(
                author_name=intake_data.get("author_name", ""),
                pen_name=intake_data.get("pen_name"),
                email=intake_data.get("email", ""),
                primary_genre=intake_data.get("primary_genre", ""),
                books=intake_data.get("books", []),
                same_as_links=same_as_links,
                site_url=site_url,
                headshot_url=intake_data.get("headshot"),
            )
            
            # Store schema in onboarding
            onboarding.intake_data["generated_schema"] = schema.model_dump()
            session.add(onboarding)
            await session.commit()
            break
        
        return True

    async def _handle_send_intake_email(self, job: Job) -> bool:
        """Handle intake invitation email."""
        from app.services.intake import ReminderService
        from app.core.db import get_session
        from app.models.client import Client
        from app.core.security import generate_approval_token
        from app.core.config import settings
        
        client_id = job.payload.get("client_id")
        if not client_id:
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Client).where(Client.id == client_id)
            )
            client = result.scalar_one_or_none()
            
            if not client:
                return False
            
            # Generate secure intake link
            token = generate_approval_token()
            intake_link = f"{settings.APP_BASE_URL}/intake/{client_id}?token={token}"
            
            service = ReminderService()
            success = await service.send_intake_invitation(
                client_email=client.email,
                client_name=client.name or "Author",
                intake_link=intake_link,
            )
            
            return success

    async def _handle_send_asset_reminder(self, job: Job) -> bool:
        """Handle asset reminder email."""
        from app.services.intake import ReminderService
        from app.core.db import get_session
        from app.models.client import Client
        from app.models.onboarding import Onboarding
        
        client_id = job.payload.get("client_id")
        attempt = job.payload.get("attempt", 1)
        
        if not client_id:
            return False
        
        async for session in get_session():
            client_result = await session.execute(
                select(Client).where(Client.id == client_id)
            )
            client = client_result.scalar_one_or_none()
            
            onboarding_result = await session.execute(
                select(Onboarding).where(Onboarding.client_id == client_id)
            )
            onboarding = onboarding_result.scalar_one_or_none()
            
            if not client or not onboarding:
                return False
            
            missing_assets = onboarding.missing_fields or []
            if not missing_assets:
                return True  # Nothing to remind about
            
            service = ReminderService()
            success = await service.send_asset_reminder(
                client_email=client.email,
                client_name=client.name or "Author",
                missing_assets=missing_assets,
                attempt_number=attempt,
            )
            
            return success

    async def _handle_create_client_repo(self, job: Job) -> bool:
        """Handle GitHub repo creation."""
        from app.services.sites import GitHubService
        from app.core.db import get_session
        from app.models.client import Client
        from app.models.site import Site
        
        client_id = job.payload.get("client_id")
        if not client_id:
            return False
        
        async for session in get_session():
            client_result = await session.execute(
                select(Client).where(Client.id == client_id)
            )
            client = client_result.scalar_one_or_none()
            
            if not client:
                return False
            
            # Create slug from client name or ID
            client_slug = str(client.id)[:8]
            
            gh_service = GitHubService()
            repo_info = await gh_service.create_client_repo(
                client_id=str(client.id),
                client_slug=client_slug,
            )
            
            if repo_info:
                # Create or update site record
                site_result = await session.execute(
                    select(Site).where(Site.client_id == client.id)
                )
                site = site_result.scalar_one_or_none()
                
                if not site:
                    site = Site(
                        client_id=client.id,
                        slug=client_slug,
                        status="repo_created",
                    )
                    session.add(site)
                
                site.repo_url = repo_info.get("repo_url")
                await session.commit()
                return True
            
            return False

    async def _handle_build_site(self, job: Job) -> bool:
        """Handle site build job."""
        # This would call the site generator
        # Simplified for now
        logger.info(f"Building site for job {job.id}")
        return True

    async def _handle_deploy_preview(self, job: Job) -> bool:
        """Handle preview deployment."""
        from app.services.sites import NetlifyService
        from app.core.db import get_session
        from app.models.site import Site
        
        site_id = job.payload.get("site_id")
        dist_dir = job.payload.get("dist_dir")
        
        if not site_id or not dist_dir:
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Site).where(Site.id == site_id)
            )
            site = result.scalar_one_or_none()
            
            if not site:
                return False
            
            netlify = NetlifyService()
            deploy_info = await netlify.create_site(
                site_name=f"sonexial-site-{site.slug}",
                dist_dir=dist_dir,
            )
            
            if deploy_info:
                site.netlify_site_id = deploy_info.get("site_id")
                site.preview_url = deploy_info.get("ssl_url")
                site.status = "preview_ready"
                await session.commit()
                return True
            
            return False

    async def _handle_prepare_monthly_report(self, job: Job) -> bool:
        """Handle monthly report preparation."""
        from app.services.reporting import MonthlyReportService
        from app.core.db import get_session
        from app.models.client import Client
        
        client_id = job.payload.get("client_id")
        if not client_id:
            return False
        
        async for session in get_session():
            result = await session.execute(
                select(Client).where(Client.id == client_id)
            )
            client = result.scalar_one_or_none()
            
            if not client:
                return False
            
            # Get citations (simplified - would query Citation table)
            service = MonthlyReportService()
            report = await service.generate_report(
                client_id=str(client.id),
                client_name=client.name or "Client",
                client_email=client.email,
                citations=[],  # Would fetch from DB
                queries_run=0,
            )
            
            logger.info(f"Prepared monthly report for client {client_id}")
            return True

    async def _handle_notify_operator(self, job: Job) -> bool:
        """Handle operator notification."""
        from app.services.intake import ReminderService
        from app.core.config import settings
        
        message = job.payload.get("message", "No details provided")
        job_type = job.payload.get("job_type", "unknown")
        client_id = job.payload.get("client_id")
        
        service = ReminderService()
        success = await service.send_dead_job_alert(
            operator_email=settings.OPERATOR_EMAIL,
            job_type=job_type,
            error_message=message,
            client_id=client_id,
        )
        
        return success
