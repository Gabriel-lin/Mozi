from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

async_engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_size=20 if settings.env == "production" else 5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)

async_session = async_sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

async_session_factory = async_session


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
