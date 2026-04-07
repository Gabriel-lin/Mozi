from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from shared.models.workflow import Workflow, WorkflowVersion, WorkflowRun


async def create_workflow(db: AsyncSession, created_by: str, data: dict) -> Workflow:
    workflow = Workflow(created_by=created_by, **data)
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return workflow


async def list_workflows(
    db: AsyncSession, workspace_id: str, page: int = 1, page_size: int = 20
):
    offset = (page - 1) * page_size
    query = (
        select(Workflow)
        .where(Workflow.workspace_id == workspace_id)
        .order_by(desc(Workflow.created_at))
    )
    count_q = (
        select(func.count())
        .select_from(Workflow)
        .where(Workflow.workspace_id == workspace_id)
    )

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size


async def get_workflow(db: AsyncSession, workflow_id: str) -> Workflow | None:
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    return result.scalar_one_or_none()


async def update_workflow(db: AsyncSession, workflow_id: str, data: dict) -> Workflow | None:
    workflow = await get_workflow(db, workflow_id)
    if not workflow:
        return None
    for k, v in data.items():
        if v is not None:
            setattr(workflow, k, v)
    await db.commit()
    await db.refresh(workflow)
    return workflow


async def delete_workflow(db: AsyncSession, workflow_id: str):
    workflow = await get_workflow(db, workflow_id)
    if workflow:
        await db.delete(workflow)
        await db.commit()


# ── Versions ──


async def create_version(
    db: AsyncSession, workflow_id: str, created_by: str, data: dict
) -> WorkflowVersion:
    count_q = (
        select(func.count())
        .select_from(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
    )
    total = (await db.execute(count_q)).scalar_one()

    version = WorkflowVersion(
        workflow_id=workflow_id,
        version=total + 1,
        created_by=created_by,
        **data,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


async def list_versions(
    db: AsyncSession, workflow_id: str, page: int = 1, page_size: int = 20
):
    offset = (page - 1) * page_size
    query = (
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(desc(WorkflowVersion.version))
    )
    count_q = (
        select(func.count())
        .select_from(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
    )

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size


async def get_version(db: AsyncSession, version_id: str) -> WorkflowVersion | None:
    result = await db.execute(
        select(WorkflowVersion).where(WorkflowVersion.id == version_id)
    )
    return result.scalar_one_or_none()


# ── Runs ──


async def get_latest_version(
    db: AsyncSession, workflow_id: str
) -> WorkflowVersion | None:
    result = await db.execute(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(desc(WorkflowVersion.version))
        .limit(1)
    )
    return result.scalar_one_or_none()


async def create_run(
    db: AsyncSession, workflow_id: str, triggered_by: str, data: dict
) -> WorkflowRun:
    from datetime import datetime, timezone

    run = WorkflowRun(
        workflow_id=workflow_id,
        status="pending",
        triggered_by=triggered_by,
        started_at=datetime.now(timezone.utc),
        **data,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    return run


async def update_run_status(
    db: AsyncSession, run_id: str, status: str, **kwargs
) -> WorkflowRun | None:
    run = await get_run(db, run_id)
    if not run:
        return None
    run.status = status
    for k, v in kwargs.items():
        if hasattr(run, k):
            setattr(run, k, v)
    await db.commit()
    await db.refresh(run)
    return run


async def get_run(db: AsyncSession, run_id: str) -> WorkflowRun | None:
    result = await db.execute(select(WorkflowRun).where(WorkflowRun.id == run_id))
    return result.scalar_one_or_none()


async def list_runs(
    db: AsyncSession, workflow_id: str, page: int = 1, page_size: int = 20
):
    offset = (page - 1) * page_size
    query = (
        select(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
        .order_by(desc(WorkflowRun.created_at))
    )
    count_q = (
        select(func.count())
        .select_from(WorkflowRun)
        .where(WorkflowRun.workflow_id == workflow_id)
    )

    result = await db.execute(query.offset(offset).limit(page_size))
    total = (await db.execute(count_q)).scalar_one()
    return result.scalars().all(), total, page, page_size
