import re
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import HTTPException


_NOISE_TAGS = ["script", "style", "nav", "header", "footer", "aside", "noscript", "iframe", "svg"]

_DIRECT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
    "Sec-Ch-Ua": '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
    "Sec-Ch-Ua-Mobile": "?0",
    "Sec-Ch-Ua-Platform": '"macOS"',
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Sec-Fetch-User": "?1",
    "Upgrade-Insecure-Requests": "1",
}


def _extract_text(html: str) -> tuple[str, Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")

    title: Optional[str] = None
    if soup.title and soup.title.string:
        title = soup.title.string.strip()[:200]

    for tag in soup.select(", ".join(_NOISE_TAGS)):
        tag.decompose()

    content = (
        soup.find("main")
        or soup.find("article")
        or soup.find(id=re.compile(r"job|content|description|posting|detail", re.I))
        or soup.find(class_=re.compile(r"job|content|description|posting|detail", re.I))
        or soup.body
        or soup
    )

    raw = content.get_text(separator=" ", strip=True)
    return re.sub(r"\s+", " ", raw).strip(), title


async def _fetch_via_jina(url: str) -> str:
    jina_url = f"https://r.jina.ai/{url}"
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        r = await client.get(
            jina_url,
            headers={"Accept": "text/plain", "X-Return-Format": "text"},
        )
        r.raise_for_status()
        return r.text.strip()


async def fetch_jd_from_url(url: str) -> dict:
    if not url.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=422,
            detail="Please enter a valid URL starting with http:// or https://",
        )

    text = ""
    title: Optional[str] = None

    # Try a direct browser-like fetch first
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(url, headers=_DIRECT_HEADERS)
            r.raise_for_status()
        text, title = _extract_text(r.text)
    except httpx.InvalidURL:
        raise HTTPException(status_code=422, detail="Invalid URL — please check the link and try again.")
    except (httpx.HTTPStatusError, httpx.RequestError, httpx.TimeoutException):
        pass  # fall through to Jina

    # Fall back to Jina Reader if direct fetch failed or returned suspiciously little
    # content (JS-rendered pages often return near-empty HTML without a real browser)
    if len(text.split()) < 40:
        try:
            text = await _fetch_via_jina(url)
        except Exception:
            if not text:
                raise HTTPException(
                    status_code=422,
                    detail=(
                        "Could not access this page. Some sites (LinkedIn, Indeed) "
                        "block all automated access — please copy and paste the job description directly."
                    ),
                )

    if len(text.split()) < 20:
        raise HTTPException(
            status_code=422,
            detail="This page doesn't have enough content. Try pasting the job description directly.",
        )

    return {"text": text[:10_000], "title": title}
