@echo off
REM Arranca la base de datos y la app (backend + pagina) con doble clic.
cd /d "%~dp0"
echo Levantando base de datos (Docker Desktop tiene que estar abierto)...
docker compose up -d
if errorlevel 1 (
  echo.
  echo No se pudo levantar la base de datos. Abri Docker Desktop y volve a intentar.
  pause
  exit /b 1
)
echo.
echo Iniciando la app. Abri http://localhost:3000 cuando aparezca "Ready".
echo Para detenerla, cerra esta ventana o apreta Ctrl+C.
echo.
call npm run dev
pause
