"""Sonexial Scanner - SSRF Protection."""
import socket
import ipaddress
from urllib.parse import urlparse
from typing import Optional
import asyncio

from app.core.logging import StructuredLogger

logger = StructuredLogger("scanner.ssrf")


# Private IP ranges that should be blocked
PRIVATE_RANGES = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),  # Loopback
    ipaddress.ip_network("169.254.0.0/16"),  # Link-local
    ipaddress.ip_network("0.0.0.0/8"),  # Unspecified
    ipaddress.ip_network("::1/128"),  # IPv6 loopback
    ipaddress.ip_network("fc00::/7"),  # IPv6 unique local
    ipaddress.ip_network("fe80::/10"),  # IPv6 link-local
]


def is_private_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    """Check if an IP address is in a private/reserved range."""
    for network in PRIVATE_RANGES:
        if ip in network:
            return True
    return False


async def resolve_hostname(hostname: str) -> Optional[list[str]]:
    """Resolve hostname to IP addresses, returning None if resolution fails."""
    try:
        # Use getaddrinfo for async-compatible DNS resolution
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None,
            socket.getaddrinfo,
            hostname,
            None,
            socket.AF_UNSPEC,
            socket.SOCK_STREAM,
        )
        
        ips = []
        for res in result:
            family, _, _, _, addr = res
            ip_str = addr[0]
            try:
                ip = ipaddress.ip_address(ip_str)
                ips.append(str(ip))
            except ValueError:
                continue
        
        return ips if ips else None
    except socket.gaierror as e:
        logger.warning(f"DNS resolution failed for {hostname}: {e}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error resolving {hostname}: {e}")
        return None


async def is_safe_url(url: str) -> bool:
    """
    Validate URL is safe to fetch (not pointing to private/internal IPs).
    
    Args:
        url: URL to validate
    
    Returns:
        True if safe, False if blocked by SSRF protection
    """
    try:
        parsed = urlparse(url)
        
        # Check scheme
        if parsed.scheme not in ["http", "https"]:
            logger.warning(f"Invalid scheme: {parsed.scheme}")
            return False
        
        hostname = parsed.hostname
        if not hostname:
            logger.warning("No hostname found")
            return False
        
        # Resolve hostname to IP(s)
        ips = await resolve_hostname(hostname)
        if not ips:
            logger.warning(f"Could not resolve hostname: {hostname}")
            return False
        
        # Check all resolved IPs
        for ip_str in ips:
            try:
                ip = ipaddress.ip_address(ip_str)
                if is_private_ip(ip):
                    logger.warning(f"SSRF blocked: {hostname} resolves to private IP {ip}")
                    return False
            except ValueError:
                continue
        
        return True
        
    except Exception as e:
        logger.error(f"SSRF validation error for {url}: {e}")
        return False
