from datetime import datetime, timezone

import httpx
import structlog
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.user import User, _nanoid
from shared.models.session import Session
from shared.security import create_access_token, hash_password, verify_password
from shared.config import get_settings

logger = structlog.get_logger()
settings = get_settings()

_github_http_timeout = httpx.Timeout(30.0, connect=15.0)


async def authenticate_by_email(
    db: AsyncSession, email: str, password: str
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash:
        raise ValueError("user_not_found")
    if not verify_password(password, user.password_hash):
        raise ValueError("wrong_password")
    if not user.is_active:
        raise ValueError("account_disabled")

    user.last_login_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)
    return user


async def register_by_email(
    db: AsyncSession, email: str, password: str, name: str | None = None
) -> tuple[User, bool]:
    result = await db.execute(select(User).where(User.email == email))
    existing = result.scalar_one_or_none()

    if existing:
        if existing.password_hash:
            raise ValueError("email_already_registered")
        existing.password_hash = hash_password(password)
        if name:
            existing.name = name
        existing.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing, False

    user = User(
        email=email,
        name=name or email.split("@")[0],
        password_hash=hash_password(password),
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, True


async def _github_get(url: str, headers: dict, *, retries: int = 2) -> httpx.Response:
    last_exc: Exception | None = None
    for attempt in range(1 + retries):
        try:
            async with httpx.AsyncClient(timeout=_github_http_timeout) as client:
                resp = await client.get(url, headers=headers)
                resp.raise_for_status()
                return resp
        except (httpx.ConnectTimeout, httpx.ReadTimeout, httpx.ConnectError) as exc:
            last_exc = exc
            logger.warning("github_api_retry", url=url, attempt=attempt + 1, error=str(exc))
            if attempt < retries:
                import asyncio
                await asyncio.sleep(1.0 * (attempt + 1))
    raise last_exc  # type: ignore[misc]


async def exchange_github_code(code: str) -> dict:
    async with httpx.AsyncClient(timeout=_github_http_timeout) as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            json={
                "client_id": settings.github_client_id,
                "client_secret": settings.github_client_secret,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        resp.raise_for_status()
        data = resp.json()
        if "error" in data:
            raise ValueError(f"GitHub OAuth error: {data['error']}")
        return data


async def fetch_github_user(access_token: str) -> dict:
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    resp = await _github_get("https://api.github.com/user", headers)
    user = resp.json()

    if not user.get("email"):
        try:
            email_resp = await _github_get("https://api.github.com/user/emails", headers)
            emails = email_resp.json()
            primary = next((e for e in emails if e["primary"] and e["verified"]), None)
            if primary:
                user["email"] = primary["email"]
        except Exception:
            pass

    return user


async def upsert_user_from_github(
    db: AsyncSession, gh_user: dict, provider_access_token: str
) -> tuple[User, bool]:
    result = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    existing = result.scalar_one_or_none()

    if existing:
        existing.name = gh_user.get("name") or gh_user["login"]
        existing.avatar = gh_user.get("avatar_url")
        existing.email = gh_user.get("email") or existing.email
        existing.github_login = gh_user["login"]
        existing.last_login_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(existing)
        return existing, False

    user = User(
        email=gh_user.get("email") or f"{gh_user['login']}@github.placeholder",
        name=gh_user.get("name") or gh_user["login"],
        avatar=gh_user.get("avatar_url"),
        github_id=gh_user["id"],
        github_login=gh_user["login"],
        last_login_at=datetime.now(timezone.utc),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, True


async def create_session(
    db: AsyncSession,
    user_id: str,
    provider: str,
    provider_access_token: str,
    user_agent: str | None = None,
    ip: str | None = None,
) -> Session:
    from datetime import timedelta

    token = create_access_token(user_id)
    refresh_token = _nanoid() + _nanoid()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)

    session = Session(
        user_id=user_id,
        token=token,
        refresh_token=refresh_token,
        provider=provider,
        provider_access_token=provider_access_token,
        user_agent=user_agent,
        ip=ip,
        expires_at=expires_at,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def link_github(db: AsyncSession, user: User, access_token: str) -> User:
    gh_user = await fetch_github_user(access_token)

    conflict = await db.execute(select(User).where(User.github_id == gh_user["id"]))
    existing = conflict.scalar_one_or_none()
    if existing and existing.id != user.id:
        raise ValueError("github_already_linked")

    user.github_id = gh_user["id"]
    user.github_login = gh_user["login"]
    user.avatar = gh_user.get("avatar_url") or user.avatar
    await db.commit()
    await db.refresh(user)
    return user


async def unlink_github(db: AsyncSession, user: User) -> User:
    if not user.github_id:
        raise ValueError("github_not_linked")
    user.github_id = None
    user.github_login = None
    await db.commit()
    await db.refresh(user)
    return user


async def revoke_session(db: AsyncSession, token: str) -> None:
    result = await db.execute(select(Session).where(Session.token == token))
    session = result.scalar_one_or_none()
    if session:
        await db.delete(session)
        await db.commit()
