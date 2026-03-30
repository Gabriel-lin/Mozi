import structlog
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_db
from shared.dependencies import get_current_user
from shared.models.user import User
from shared.schemas.auth import (
    AuthResponse,
    DeviceTokenRequest,
    EmailLoginRequest,
    EmailRegisterRequest,
    GitHubCallbackRequest,
    GitHubLinkRequest,
    UserBrief,
)
from . import service

logger = structlog.get_logger()
router = APIRouter(prefix="/auth", tags=["auth"])


def _user_brief(user: User) -> UserBrief:
    return UserBrief(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar=user.avatar,
        github_id=user.github_id,
        github_login=user.github_login,
    )


def _auth_response(session, user: User) -> AuthResponse:
    return AuthResponse(
        token=session.token,
        refresh_token=session.refresh_token,
        expires_at=session.expires_at.isoformat(),
        user=_user_brief(user),
    )


@router.post("/login", response_model=AuthResponse)
async def email_login(body: EmailLoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        user = await service.authenticate_by_email(db, body.email, body.password)
        session = await service.create_session(
            db, user.id, "email", "",
            user_agent=request.headers.get("user-agent"),
            ip=request.headers.get("x-forwarded-for", request.client.host if request.client else None),
        )
        logger.info("email_login", user_id=user.id)
        return _auth_response(session, user)
    except ValueError as e:
        code = str(e)
        status = 404 if code == "user_not_found" else 401
        logger.warning("email_login_failed", error=code)
        raise HTTPException(status_code=status, detail=code)


@router.post("/register", response_model=AuthResponse)
async def email_register(body: EmailRegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        user, is_new = await service.register_by_email(db, body.email, body.password, body.name)
        session = await service.create_session(
            db, user.id, "email", "",
            user_agent=request.headers.get("user-agent"),
            ip=request.headers.get("x-forwarded-for", request.client.host if request.client else None),
        )
        logger.info("email_register", user_id=user.id, is_new=is_new)
        return _auth_response(session, user)
    except ValueError as e:
        code = str(e)
        status = 409 if code == "email_already_registered" else 400
        logger.warning("email_register_failed", error=code)
        raise HTTPException(status_code=status, detail=code)


@router.post("/github/callback", response_model=AuthResponse)
async def github_callback(body: GitHubCallbackRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        token_data = await service.exchange_github_code(body.code)
        gh_user = await service.fetch_github_user(token_data["access_token"])
        user, is_new = await service.upsert_user_from_github(db, gh_user, token_data["access_token"])
        session = await service.create_session(
            db, user.id, "github", token_data["access_token"],
            user_agent=request.headers.get("user-agent"),
            ip=request.headers.get("x-forwarded-for", request.client.host if request.client else None),
        )
        logger.info("github_login", user_id=user.id, is_new=is_new)
        return _auth_response(session, user)
    except Exception as e:
        logger.error("github_login_failed", error=str(e))
        raise HTTPException(status_code=401, detail="GitHub authentication failed")


@router.post("/github/device", response_model=AuthResponse)
async def github_device(body: DeviceTokenRequest, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        gh_user = await service.fetch_github_user(body.access_token)
        user, is_new = await service.upsert_user_from_github(db, gh_user, body.access_token)
        session = await service.create_session(
            db, user.id, "github", body.access_token,
            user_agent=request.headers.get("user-agent"),
            ip=request.headers.get("x-forwarded-for", request.client.host if request.client else None),
        )
        logger.info("github_device_login", user_id=user.id, is_new=is_new)
        return _auth_response(session, user)
    except Exception as e:
        logger.error("github_device_login_failed", error=str(e))
        raise HTTPException(status_code=401, detail="GitHub authentication failed")


@router.post("/github/link", response_model=UserBrief)
async def github_link(
    body: GitHubLinkRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated = await service.link_github(db, user, body.access_token)
        logger.info("github_linked", user_id=user.id, github_login=updated.github_login)
        return _user_brief(updated)
    except ValueError as e:
        code = str(e)
        status = 409 if code == "github_already_linked" else 400
        raise HTTPException(status_code=status, detail=code)
    except Exception as e:
        logger.error("github_link_failed", user_id=user.id, error=str(e))
        raise HTTPException(status_code=502, detail="github_api_unavailable")


@router.post("/github/unlink", response_model=UserBrief)
async def github_unlink(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        updated = await service.unlink_github(db, user)
        logger.info("github_unlinked", user_id=user.id)
        return _user_brief(updated)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/me", response_model=UserBrief)
async def get_me(user: User = Depends(get_current_user)):
    return _user_brief(user)


@router.post("/logout")
async def logout(request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    token = request.headers.get("authorization", "").removeprefix("Bearer ")
    await service.revoke_session(db, token)
    return {"success": True}
