#!/usr/bin/env python3
"""Outside-in HTTPS and TLS probe for the public website. Standard library only.

Internal systems and backups are monitored privately by the aidecis-app monitor workflow;
nothing about them belongs in this public repository.
"""

import http.client
import socket
import ssl
from urllib.parse import urljoin, urlsplit


TIMEOUT = 20
DAY = 86400
TARGETS = (("https://aidecis.com", "website"),)


def http_probe(url):
    """GET without following redirects, so a redirect cannot hide a broken endpoint."""
    parsed = urlsplit(url)
    connection = http.client.HTTPSConnection(parsed.hostname, timeout=TIMEOUT)
    try:
        connection.request("GET", parsed.path or "/", headers={"User-Agent": "Aidecis-monitor/1"})
        response = connection.getresponse()
        body = response.read(65536)
        return response.status, response.getheader("Location", ""), body
    finally:
        connection.close()


def http_health(url, kind, status, location, body):
    healthy = status == 200
    # Drop query strings, which can include tokens; publish only status and destination.
    measured = f"HTTP {status}"
    if location:
        target = urlsplit(urljoin(url, location))
        measured += f", Location={target.scheme}://{target.hostname}{target.path}"
    return healthy, measured, "HTTP 200"


def tls_expiry(host):
    context = ssl.create_default_context()
    with socket.create_connection((host, 443), timeout=TIMEOUT) as tcp:
        with context.wrap_socket(tcp, server_hostname=host) as tls:
            return ssl.cert_time_to_seconds(tls.getpeercert()["notAfter"])
