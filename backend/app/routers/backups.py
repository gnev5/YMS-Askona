import os
import subprocess
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from typing import List

router = APIRouter(
    prefix="/api/backups",
    tags=["backups"],
)

BACKUP_DIR = "backups"

@router.get("/", response_model=List[str])
async def get_backups():
    """
    Получение списка всех файлов из папки `backups/`.
    """
    if not os.path.isdir(BACKUP_DIR):
        return []
    return sorted(os.listdir(BACKUP_DIR), reverse=True)

@router.post("/create")
async def create_backup():
    """
    Запуск скрипта `backup_database.py` для создания нового бэкапа.
    """
    script_path = "backup_database.py"
    if not os.path.exists(script_path):
        raise HTTPException(status_code=404, detail="backup_database.py not found")

    try:
        # We need to run this with python3, as python might not be in PATH
        process = subprocess.Popen(
            ["python3", script_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        # Running this asynchronously might be better, but for now, we'll wait
        # stdout, stderr = process.communicate()
        # if process.returncode != 0:
        #     raise HTTPException(status_code=500, detail=stderr.decode())
        return {"message": "Backup creation started. Note: this is a long-running process."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{filename}")
async def delete_backup(filename: str):
    """
    Удаление указанного файла бэкапа из папки `backups/`.
    """
    file_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    try:
        os.remove(file_path)
        return {"message": f"Backup {filename} deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/restore/{filename}")
async def restore_backup(filename: str):
    """
    Запуск скрипта `restore_database.py` для восстановления из указанного бэкапа.
    """
    script_path = "restore_database.py"
    if not os.path.exists(script_path):
        raise HTTPException(status_code=404, detail="restore_database.py not found")
    
    backup_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup file not found")

    try:
        process = subprocess.Popen(
            ["python3", script_path, backup_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        return {"message": f"Restoration from {filename} started. This may take a while."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload")
async def upload_backup(file: UploadFile = File(...)):
    """
    Загрузка файла бэкапа в папку `backups/`.
    """
    if not os.path.isdir(BACKUP_DIR):
        os.makedirs(BACKUP_DIR)
        
    file_path = os.path.join(BACKUP_DIR, file.filename)
    
    try:
        with open(file_path, "wb") as buffer:
            buffer.write(await file.read())
        return {"message": f"File {file.filename} uploaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/download/{filename}")
async def download_backup(filename: str):
    """
    Скачивание указанного файла бэкапа.
    """
    file_path = os.path.join(BACKUP_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(path=file_path, filename=filename)
