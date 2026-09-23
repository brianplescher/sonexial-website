"""Static site generator using Jinja2 templates."""
import os
import json
from pathlib import Path
from datetime import datetime
from typing import Any

from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.core.logging import get_logger
from app.core.config import settings

logger = get_logger(__name__)


class SiteGenerator:
    """Generate static author websites from validated onboarding data."""

    def __init__(self, template_dir: str | None = None):
        self.template_dir = template_dir or settings.SITE_TEMPLATE_DIR
        self.env = Environment(
            loader=FileSystemLoader(self.template_dir),
            autoescape=select_autoescape(["html", "xml"]),
            trim_blocks=True,
            lstrip_blocks=True,
        )

    async def generate(
        self,
        client_id: str,
        onboarding_data: dict[str, Any],
        schema_output: dict[str, Any],
        content_output: dict[str, Any],
        output_dir: str,
    ) -> list[str]:
        """
        Generate complete static site.
        
        Args:
            client_id: Client UUID
            onboarding_data: Validated intake data
            schema_output: Generated JSON-LD and llms.txt content
            content_output: Generated author content
            output_dir: Output directory for generated files
            
        Returns:
            List of generated file paths
        """
        os.makedirs(output_dir, exist_ok=True)
        os.makedirs(os.path.join(output_dir, "static", "css"), exist_ok=True)
        
        # Build context for all templates
        base_url = f"https://{onboarding_data.get('primary_domain', 'example.com')}"
        
        context = {
            "client_id": client_id,
            "site_url": base_url,
            "generated_at": datetime.utcnow().isoformat(),
            **onboarding_data,
            **content_output,
            "person_jsonld": schema_output.get("person_jsonld", {}),
            "book_jsonld_list": schema_output.get("book_jsonld_list", []),
        }
        
        generated_files = []
        
        # Generate each page
        pages = [
            ("base.html", "base.html"),  # Base template (not rendered standalone)
            ("home.html", "index.html"),
            ("about.html", "about/index.html"),
            ("books.html", "books/index.html"),
            ("book.html", "books/{slug}/index.html"),
            ("qa.html", "reader-qa/index.html"),
            ("contact.html", "contact/index.html"),
            ("error.html", "404.html"),
        ]
        
        for template_name, output_name in pages:
            if template_name == "base.html":
                continue  # Skip base template
                
            try:
                # Handle book pages specially (one per book)
                if template_name == "book.html":
                    books = onboarding_data.get("books", [])
                    for i, book in enumerate(books):
                        book_context = {**context, "book": book, "slug": self._slugify(book.get("title", ""))}
                        output_path = os.path.join(output_dir, f"books/{i}/index.html")
                        os.makedirs(os.path.dirname(output_path), exist_ok=True)
                        self._render_template(template_name, book_context, output_path)
                        generated_files.append(output_path)
                else:
                    output_path = os.path.join(output_dir, output_name)
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    self._render_template(template_name, context, output_path)
                    generated_files.append(output_path)
                    
            except Exception as e:
                logger.error(f"Failed to generate {template_name}: {e}")
                raise
        
        # Generate llms.txt
        llms_path = os.path.join(output_dir, "llms.txt")
        with open(llms_path, "w") as f:
            f.write(schema_output.get("llms_txt", self._generate_default_llms(context)))
        generated_files.append(llms_path)
        
        # Generate robots.txt
        robots_path = os.path.join(output_dir, "robots.txt")
        with open(robots_path, "w") as f:
            f.write(self._generate_robots(base_url))
        generated_files.append(robots_path)
        
        # Generate sitemap.xml
        sitemap_path = os.path.join(output_dir, "sitemap.xml")
        with open(sitemap_path, "w") as f:
            f.write(self._generate_sitemap(context, base_url))
        generated_files.append(sitemap_path)
        
        # Copy static assets
        static_src = os.path.join(self.template_dir, "static")
        if os.path.exists(static_src):
            for root, dirs, files in os.walk(static_src):
                for file in files:
                    src_file = os.path.join(root, file)
                    rel_path = os.path.relpath(src_file, static_src)
                    dst_file = os.path.join(output_dir, "static", rel_path)
                    os.makedirs(os.path.dirname(dst_file), exist_ok=True)
                    with open(src_file, "rb") as sf:
                        with open(dst_file, "wb") as df:
                            df.write(sf.read())
                    generated_files.append(dst_file)
        
        logger.info(f"Generated {len(generated_files)} files for client {client_id}")
        return generated_files

    def _render_template(self, template_name: str, context: dict, output_path: str):
        """Render a single template to file."""
        template = self.env.get_template(template_name)
        html = template.render(**context)
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(html)

    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug."""
        import re
        text = text.lower().strip()
        text = re.sub(r"[^\w\s-]", "", text)
        text = re.sub(r"[-\s]+", "-", text)
        return text[:50]  # Limit length

    def _generate_default_llms(self, context: dict) -> str:
        """Generate default llms.txt if not provided by agent."""
        author_name = context.get("author_name", "Unknown Author")
        primary_genre = context.get("primary_genre", "Fiction")
        books = context.get("books", [])
        
        lines = [
            f"# AI Roadmap for {author_name}",
            f"",
            f"Author: {author_name}",
            f"Genre: {primary_genre}",
            f"",
            f"# Books",
        ]
        
        for book in books:
            title = book.get("title", "Untitled")
            lines.append(f"- {title}")
        
        lines.extend([
            f"",
            f"# Key Pages",
            f"- About: /about/",
            f"- Books: /books/",
            f"- Reader Q&A: /reader-qa/",
            f"- Contact: /contact/",
        ])
        
        return "\n".join(lines)

    def _generate_robots(self, base_url: str) -> str:
        """Generate robots.txt allowing AI crawlers."""
        return f"""User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: {base_url}/sitemap.xml
"""

    def _generate_sitemap(self, context: dict, base_url: str) -> str:
        """Generate sitemap.xml."""
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        urls = [
            "/",
            "/about/",
            "/books/",
            "/reader-qa/",
            "/contact/",
        ]
        
        # Add book URLs
        books = context.get("books", [])
        for i, book in enumerate(books):
            urls.append(f"/books/{i}/")
        
        xml_urls = []
        for url in urls:
            xml_urls.append(f"""  <url>
    <loc>{base_url}{url}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>""")
        
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(xml_urls)}
</urlset>
"""
