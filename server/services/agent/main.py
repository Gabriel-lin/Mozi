from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from shared.config import get_settings
from .router import router

settings = get_settings()

app = FastAPI(title="Mozi Agent Service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "agent"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("services.agent.main:app", host="0.0.0.0", port=3003, reload=settings.debug)
