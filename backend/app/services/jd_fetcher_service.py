import json
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
    "Accept-Encoding": "gzip, deflate",
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


def _collect_strings(obj: object, results: list[str], min_len: int = 80) -> None:
    if isinstance(obj, str):
        cleaned = re.sub(r"<[^>]+>", " ", obj)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        if len(cleaned) >= min_len:
            results.append(cleaned)
    elif isinstance(obj, dict):
        for v in obj.values():
            _collect_strings(v, results, min_len)
    elif isinstance(obj, list):
        for item in obj:
            _collect_strings(item, results, min_len)


def _extract_next_data(soup: BeautifulSoup) -> str:
    """Pull text from a Next.js __NEXT_DATA__ JSON blob before script tags are stripped."""
    script = soup.find("script", id="__NEXT_DATA__")
    if not script or not script.string:
        return ""
    try:
        data = json.loads(script.string)
    except (json.JSONDecodeError, ValueError):
        return ""
    texts: list[str] = []
    _collect_strings(data, texts)
    return " ".join(texts)


def _extract_text(html: str) -> tuple[str, Optional[str]]:
    soup = BeautifulSoup(html, "html.parser")

    title: Optional[str] = None
    if soup.title and soup.title.string:
        title = soup.title.string.strip()[:200]

    # Check for Next.js data blob before stripping script tags — many job boards
    # (e.g. Amazon Jobs) embed the full job description inside __NEXT_DATA__ JSON
    # rather than in the visible HTML, so stripping scripts first would lose it.
    next_text = _extract_next_data(soup)
    if len(next_text.split()) >= 40:
        return re.sub(r"\s+", " ", next_text).strip(), title

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


_ASHBY_RE = re.compile(r"^https://jobs\.ashbyhq\.com/([^/]+)/([a-f0-9-]{36})", re.I)


async def _fetch_ashby(org: str, job_id: str) -> Optional[dict]:
    """Call Ashby's public posting API — avoids JS rendering entirely."""
    api_url = f"https://api.ashbyhq.com/posting-api/job-board/{org}/published"
    try:
        async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
            r = await client.get(api_url, headers={"Accept": "application/json"})
            r.raise_for_status()
            data = r.json()
        for job in data.get("jobs", []):
            if job.get("id") == job_id:
                title = job.get("title", "")
                desc_html = job.get("descriptionHtml", "")
                if desc_html:
                    soup = BeautifulSoup(desc_html, "html.parser")
                    desc = soup.get_text(separator=" ", strip=True)
                else:
                    desc = job.get("descriptionPlain", "") or ""
                if desc.strip():
                    return {"text": desc[:10_000], "title": title}
    except Exception:
        pass
    return None


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

    # Ashby-specific: their pages are JS-rendered and /application goes to a form,
    # not the JD. Try their public API first; if that fails (private boards return 401),
    # go straight to Jina on the clean job URL — skip the useless direct fetch.
    ashby_match = _ASHBY_RE.match(url)
    if ashby_match:
        result = await _fetch_ashby(ashby_match.group(1), ashby_match.group(2))
        if result:
            return result
        clean_url = f"https://jobs.ashbyhq.com/{ashby_match.group(1)}/{ashby_match.group(2)}"
        try:
            text = await _fetch_via_jina(clean_url)
        except Exception:
            text = ""
        if len(text.split()) >= 50:
            return {"text": text[:10_000], "title": None}
        raise HTTPException(
            status_code=422,
            detail="Could not extract this Ashby job posting. The board may be private. Try copying and pasting the job description directly.",
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
