import base64
import json
import os
import re
from typing import Optional

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def fetch_github_profile(username: str, token: str) -> Optional[dict]:
    """
    Connects to the GitHub MCP server via stdio, fetches the user's top public
    repos and README excerpts, and returns structured profile data.
    Returns None if the token is missing, the user isn't found, or MCP fails.
    """
    if not token:
        return None

    server_params = StdioServerParameters(
        command="npx",
        args=["-y", "@modelcontextprotocol/server-github"],
        env={**os.environ, "GITHUB_PERSONAL_ACCESS_TOKEN": token},
    )

    try:
        async with stdio_client(server_params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                return await _collect_profile(session, username)
    except Exception as exc:
        print(f"[github_service] MCP error for '{username}': {exc}")
        return None


async def _collect_profile(session: ClientSession, username: str) -> Optional[dict]:
    search = await session.call_tool(
        "search_repositories",
        {"query": f"user:{username} sort:stars", "perPage": 8},
    )

    if not search.content or getattr(search, "isError", False):
        return None

    try:
        data = json.loads(search.content[0].text)
    except (json.JSONDecodeError, IndexError):
        return None

    items = data.get("items", [])
    if not items:
        return None  # username not found or no public repos

    repos = []
    for item in items[:5]:
        if item.get("fork"):
            continue  # skip forks — original work only

        repo: dict = {
            "name": item.get("name", ""),
            "description": item.get("description") or "",
            "language": item.get("language") or "",
            "stars": item.get("stargazers_count", 0),
            "topics": item.get("topics", []),
            "readme": await _get_readme(session, username, item.get("name", "")),
        }
        repos.append(repo)

    return {"username": username, "repos": repos} if repos else None


async def _get_readme(session: ClientSession, owner: str, repo: str) -> Optional[str]:
    try:
        result = await session.call_tool(
            "get_file_contents",
            {"owner": owner, "repo": repo, "path": "README.md"},
        )
        if not result.content or getattr(result, "isError", False):
            return None

        data = json.loads(result.content[0].text)
        raw_b64 = data.get("content", "").replace("\n", "")
        if not raw_b64:
            return None

        decoded = base64.b64decode(raw_b64).decode("utf-8", errors="ignore")
        # Strip markdown syntax, URLs, keep first 250 words
        clean = re.sub(r"https?://\S+", "", decoded)
        clean = re.sub(r"[#*`\[\]<>(){}|!_~]", " ", clean)
        clean = re.sub(r"\s+", " ", clean).strip()
        return " ".join(clean.split()[:250])
    except Exception:
        return None
