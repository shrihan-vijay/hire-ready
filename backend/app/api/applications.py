from fastapi import APIRouter, Depends, HTTPException

from app.core.auth import get_current_user
from app.models.application import Application, CreateApplicationRequest, UpdateApplicationRequest
from app.services.application_service import create_application, delete_application, list_applications, update_application

router = APIRouter()


@router.post("/", response_model=Application)
async def create(body: CreateApplicationRequest, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return create_application(user["id"], body.model_dump())


@router.get("/", response_model=list[Application])
async def list_all(user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    return list_applications(user["id"])


@router.patch("/{application_id}", response_model=Application)
async def update(application_id: str, body: UpdateApplicationRequest, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    fields = body.model_dump(exclude_none=True)
    if not fields:
        raise HTTPException(status_code=422, detail="No fields to update.")
    return update_application(user["id"], application_id, fields)


@router.delete("/{application_id}", status_code=204)
async def delete(application_id: str, user: dict = Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    delete_application(user["id"], application_id)
