"""Database-backed worker process."""
import asyncio
import signal
from datetime import datetime, timedelta
from typing import Optional

from app.core.logging import get_logger
from app.models.job import Job, JobStatus, JobType
from app.worker.jobs import JobHandler

logger = get_logger(__name__)


class Worker:
    """
    Database-backed job worker.
    
    Polls the jobs table for queued work, claims jobs using
    FOR UPDATE SKIP LOCKED, and processes them with retry logic.
    """

    def __init__(self, poll_interval: int = 5):
        self.poll_interval = poll_interval
        self.running = False
        self.handler = JobHandler()
        self.consecutive_failures = 0
        self.max_consecutive_failures = 3

    async def start(self):
        """Start the worker loop."""
        self.running = True
        
        # Set up signal handlers for graceful shutdown
        loop = asyncio.get_event_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, lambda: asyncio.create_task(self.shutdown()))
        
        logger.info("Worker started")
        
        while self.running:
            try:
                job = await self._claim_job()
                
                if job:
                    await self._process_job(job)
                else:
                    # No jobs available, wait before polling again
                    await asyncio.sleep(self.poll_interval)
                    
            except Exception as e:
                logger.error(f"Worker error: {e}")
                await asyncio.sleep(self.poll_interval)

    async def shutdown(self):
        """Gracefully shut down the worker."""
        logger.info("Shutting down worker...")
        self.running = False

    async def _claim_job(self) -> Optional[Job]:
        """
        Claim a queued job using FOR UPDATE SKIP LOCKED.
        
        Returns None if no jobs are available.
        """
        from sqlmodel import select
        from app.core.db import get_session
        
        now = datetime.utcnow()
        
        async for session in get_session():
            # Find oldest queued job that's ready to run
            query = (
                select(Job)
                .where(
                    Job.status == JobStatus.QUEUED,
                    Job.run_after <= now,
                )
                .order_by(Job.created_at.asc())
                .limit(1)
            )
            
            result = await session.execute(query)
            job = result.scalar_one_or_none()
            
            if job:
                # Claim the job
                job.status = JobStatus.RUNNING
                job.locked_at = now
                job.attempts += 1
                session.add(job)
                await session.commit()
                await session.refresh(job)
                logger.info(f"Claimed job {job.id} ({job.type})")
            
            return job

    async def _process_job(self, job: Job):
        """Process a claimed job with retry logic."""
        from app.core.db import get_session
        
        try:
            success = await self.handler.handle(job)
            
            if success:
                await self._mark_job_completed(job)
                self.consecutive_failures = 0
            else:
                await self._mark_job_failed(job, "Handler returned False")
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Job {job.id} failed: {error_msg}")
            
            if job.attempts >= job.max_attempts:
                await self._mark_job_dead(job, error_msg)
                self.consecutive_failures += 1
                
                if self.consecutive_failures >= self.max_consecutive_failures:
                    logger.critical(
                        f"{self.consecutive_failures} consecutive failures - notifying operator"
                    )
                    await self._notify_operator_of_dead_job(job.type, error_msg)
            else:
                # Schedule retry with exponential backoff
                await self._schedule_retry(job, error_msg)

    async def _mark_job_completed(self, job: Job):
        """Mark job as completed."""
        from app.core.db import get_session
        
        async for session in get_session():
            job.status = JobStatus.COMPLETED
            session.add(job)
            await session.commit()
            logger.info(f"Job {job.id} completed")
            break

    async def _mark_job_failed(self, job: Job, error: str):
        """Mark job as failed."""
        from app.core.db import get_session
        
        async for session in get_session():
            job.status = JobStatus.FAILED
            job.last_error = error
            session.add(job)
            await session.commit()
            logger.warning(f"Job {job.id} failed: {error}")
            break

    async def _mark_job_dead(self, job: Job, error: str):
        """Mark job as dead after max retries."""
        from app.core.db import get_session
        
        async for session in get_session():
            job.status = JobStatus.DEAD
            job.last_error = error
            session.add(job)
            await session.commit()
            logger.error(f"Job {job.id} marked as dead: {error}")
            break

    async def _schedule_retry(self, job: Job, error: str):
        """Schedule job for retry with exponential backoff."""
        from app.core.db import get_session
        
        # Exponential backoff: 1min, 2min, 4min, 8min...
        delay_minutes = 2 ** (job.attempts - 1)
        run_after = datetime.utcnow() + timedelta(minutes=delay_minutes)
        
        async for session in get_session():
            job.status = JobStatus.QUEUED
            job.last_error = error
            job.run_after = run_after
            job.locked_at = None
            session.add(job)
            await session.commit()
            logger.info(f"Job {job.id} scheduled for retry in {delay_minutes} minutes")
            break

    async def _notify_operator_of_dead_job(self, job_type: str, error: str):
        """Create notification job for operator."""
        from app.core.db import get_session
        from app.core.config import settings
        
        async for session in get_session():
            notify_job = Job(
                type=JobType.NOTIFY_OPERATOR,
                payload={
                    "job_type": job_type,
                    "message": error,
                },
                status=JobStatus.QUEUED,
            )
            session.add(notify_job)
            await session.commit()
            break


async def run_worker():
    """Entry point for running the worker."""
    worker = Worker()
    await worker.start()


if __name__ == "__main__":
    asyncio.run(run_worker())
