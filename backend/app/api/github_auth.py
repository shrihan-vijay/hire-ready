import base64
import hashlib
import hmac
import urllib.parse
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse

from app.core.auth import require_user
from app.core.config import (
    BACKEND_URL,
    FRONTEND_URL,
    FRONTEND_URLS,
    GITHUB_CLIENT_ID,
    GITHUB_CLIENT_SECRET,
)
from app.services.github_connection_service import (
    delete_github_connection,
    get_github_connection,
    save_github_connection,
)

router = APIRouter()

_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
_TOKEN_URL = "https://github.com/login/oauth/access_token"
_USER_URL = "https://api.github.com/user"


def _make_state(user_id: str, origin: str) -> str:
    payload = f"{user_id}|{origin}"
    sig = hmac.new(GITHUB_CLIENT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
    encoded = base64.urlsafe_b64encode(payload.encode()).decode().rstrip("=")
    return f"{encoded}.{sig}"


def _parse_state(state: str) -> Optional[tuple[str, str]]:
    try:
        encoded, sig = state.rsplit(".", 1)
        padding = (4 - len(encoded) % 4) % 4
        payload = base64.urlsafe_b64decode(encoded + "=" * padding).decode()
        expected = hmac.new(GITHUB_CLIENT_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()[:24]
        if hmac.compare_digest(sig, expected):
            user_id, origin = payload.split("|", 1)
            return user_id, origin
    except Exception:
        pass
    return None


@router.get("/connect")
async def github_connect(request: Request, user: dict = Depends(require_user)):
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="GitHub OAuth is not configured on this server.")

    origin = request.headers.get("origin", FRONTEND_URL)
    if origin not in FRONTEND_URLS:
        origin = FRONTEND_URL

    callback_url = f"{BACKEND_URL}/api/auth/github/callback"
    params = urllib.parse.urlencode({
        "client_id": GITHUB_CLIENT_ID,
        "redirect_uri": callback_url,
        "scope": "public_repo read:user",
        "state": _make_state(user["id"], origin),
    })
    return {"url": f"{_AUTHORIZE_URL}?{params}"}


@router.get("/callback")
async def github_callback(
    code: str = Query(...),
    state: str = Query(...),
):
    parsed = _parse_state(state)
    if not parsed:
        return RedirectResponse(f"{FRONTEND_URL}/home?github=error")
    user_id, origin = parsed

    callback_url = f"{BACKEND_URL}/api/auth/github/callback"

    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            _TOKEN_URL,
            json={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": callback_url,
            },
            headers={"Accept": "application/json"},
            timeout=10.0,
        )
        token_data = token_res.json()

    access_token = token_data.get("access_token")
    if not access_token:
        return RedirectResponse(f"{origin}/home?github=error")

    async with httpx.AsyncClient() as client:
        user_res = await client.get(
            _USER_URL,
            headers={
                "Authorization": f"Bearer {access_token}",
                "Accept": "application/vnd.github+json",
            },
            timeout=10.0,
        )
        github_user = user_res.json()

    username = github_user.get("login")
    if not username:
        return RedirectResponse(f"{origin}/home?github=error")

    save_github_connection(user_id, username, access_token)
    return RedirectResponse(f"{origin}/home?github=connected")


@router.get("/status")
async def github_status(user: dict = Depends(require_user)):
    connection = get_github_connection(user["id"])
    if connection:
        return {"connected": True, "username": connection["github_username"]}
    return {"connected": False, "username": None}


@router.delete("/disconnect")
async def github_disconnect(user: dict = Depends(require_user)):
    delete_github_connection(user["id"])
    return {"ok": True}
