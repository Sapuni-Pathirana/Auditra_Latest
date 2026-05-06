# Starts ASGI server, Celery worker, and Celery beat in separate windows.
# Run from the backend folder.

$backendDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $backendDir

$venvActivate = Join-Path $backendDir "venv\Scripts\Activate.ps1"
if (-not (Test-Path $venvActivate)) {
  Write-Host "Virtual environment not found at $venvActivate" -ForegroundColor Red
  Write-Host "Create it with: python -m venv venv" -ForegroundColor Yellow
  exit 1
}

$common = ".\venv\Scripts\Activate.ps1"

Start-Process powershell -ArgumentList "-NoExit", "-Command", "$common; daphne auditra_backend.asgi:application"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$common; celery -A auditra_backend worker -l info --pool=solo"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "$common; celery -A auditra_backend beat -l info"

Write-Host "Started ASGI, Celery worker, and Celery beat." -ForegroundColor Green
