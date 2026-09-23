"""Reporting services for monthly citation reports."""
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Any

from app.core.config import settings
from app.core.logging import get_logger
from app.core.email import send_email

logger = get_logger(__name__)


class MonthlyReportService:
    """Generate and send monthly GEO reports to clients."""

    def __init__(self):
        pass

    async def generate_report(
        self,
        client_id: str,
        client_name: str,
        client_email: str,
        citations: list[dict],
        queries_run: int,
    ) -> dict[str, Any]:
        """
        Generate monthly report data.
        
        Args:
            client_id: Client UUID
            client_name: Client name
            client_email: Client email
            citations: List of citation records
            queries_run: Number of queries run this month
            
        Returns:
            Report data dict
        """
        # Count citations by engine
        engine_counts: dict[str, int] = {}
        for citation in citations:
            engine = citation.get("engine", "unknown")
            engine_counts[engine] = engine_counts.get(engine, 0) + 1
        
        # Get sample citations
        sample_citations = []
        for citation in citations[:5]:  # Top 5 examples
            sample_citations.append({
                "query": citation.get("query", ""),
                "engine": citation.get("engine", ""),
                "matched_text": citation.get("response", {}).get("matched_text", "")[:200],
                "detected_at": citation.get("detected_at", "").isoformat() if hasattr(citation.get("detected_at"), "isoformat") else str(citation.get("detected_at")),
            })
        
        report = {
            "client_id": client_id,
            "client_name": client_name,
            "report_period": self._get_current_period(),
            "total_citations": len(citations),
            "queries_run": queries_run,
            "citations_by_engine": engine_counts,
            "sample_citations": sample_citations,
            "generated_at": datetime.utcnow().isoformat(),
        }
        
        return report

    async def send_report_email(
        self,
        client_email: str,
        client_name: str,
        report: dict[str, Any],
        approval_link: str | None = None,
    ) -> bool:
        """
        Send monthly report via email.
        
        Args:
            client_email: Client email
            client_name: Client name
            report: Report data from generate_report
            approval_link: Link to approve/reject report (if needed)
            
        Returns:
            True if sent successfully
        """
        total_citations = report.get("total_citations", 0)
        queries_run = report.get("queries_run", 0)
        period = report.get("report_period", "this month")
        
        subject = f"Your Sonexial GEO Report for {period}"
        
        # Build citation summary
        citations_summary = ""
        for engine, count in report.get("citations_by_engine", {}).items():
            citations_summary += f"- {engine}: {count} citation(s)\n"
        
        if not citations_summary:
            citations_summary = "No citations detected this period.\n"
        
        # Build sample section
        samples_section = ""
        for i, sample in enumerate(report.get("sample_citations", [])[:3], 1):
            samples_section += f"""
{i}. Query: "{sample.get('query', 'N/A')}"
   Engine: {sample.get('engine', 'N/A')}
   Match: {sample.get('matched_text', 'N/A')[:100]}...
"""
        
        body = f"""Hi {client_name},

Here's your Sonexial GEO performance report for {period}.

SUMMARY
-------
Total Citations: {total_citations}
Queries Run: {queries_run}

CITATIONS BY ENGINE
-------------------
{citations_summary}

EXAMPLE CITATIONS
-----------------
{samples_section if samples_section else "No examples available."}

WHAT THIS MEANS
---------------
Each citation represents a moment when an AI recommendation engine mentioned you or your work to a reader. This is the new frontier of book discovery.

NEXT STEPS
----------
Your site continues to be optimized for AI visibility. If you'd like to discuss these results or adjust your strategy, reply to this email.

Best regards,
The Sonexial Team

---
Questions? Contact us at {settings.SUPPORT_EMAIL}
"""
        
        if approval_link:
            body += f"\n\nApprove this report for sending: {approval_link}"
        
        try:
            await send_email(
                to_email=client_email,
                subject=subject,
                body=body,
            )
            logger.info(f"Sent monthly report to {client_email}")
            return True
        except Exception as e:
            logger.error(f"Failed to send monthly report: {e}")
            return False

    def _get_current_period(self) -> str:
        """Get human-readable current period."""
        now = datetime.utcnow()
        return now.strftime("%B %Y")

    async def prepare_monthly_reports(self) -> list[dict]:
        """
        Prepare all monthly reports for operator review.
        
        This is called by the worker to batch-prepare reports.
        
        Returns:
            List of report preparation tasks
        """
        from sqlmodel import select
        from app.core.db import get_session
        from app.models.client import Client
        from app.models.citation import Citation
        
        async for session in get_session():
            # Get all retained clients
            result = await session.execute(
                select(Client).where(Client.status == "retained")
            )
            clients = result.scalars().all()
            
            tasks = []
            for client in clients:
                # Get citations for this month
                first_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                
                cit_result = await session.execute(
                    select(Citation).where(
                        Citation.client_id == client.id,
                        Citation.detected_at >= first_of_month,
                    )
                )
                citations = cit_result.scalars().all()
                
                # Skip if no activity and no citations (don't spam inactive clients)
                if len(citations) == 0:
                    continue
                
                tasks.append({
                    "client_id": str(client.id),
                    "client_name": client.name,
                    "client_email": client.email,
                    "citations": [
                        {
                            "engine": c.engine,
                            "query": c.query,
                            "cited": c.cited,
                            "response": c.response,
                            "detected_at": c.detected_at,
                        }
                        for c in citations
                    ],
                    "queries_run": len(citations),  # Simplified; would track separately in production
                })
            
            return tasks
