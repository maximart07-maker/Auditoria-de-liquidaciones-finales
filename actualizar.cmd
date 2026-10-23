@echo off
REM Trae los ultimos cambios del proyecto y deja todo listo para iniciar.
cd /d "%~dp0"
echo Descartando ajustes locales de package-lock.json...
git checkout -- package-lock.json
echo.
echo Bajando cambios...
git pull
if errorlevel 1 (
  echo.
  echo No se pudieron bajar los cambios. Copia el mensaje de arriba y envialo.
  pause
  exit /b 1
)
echo.
echo Instalando dependencias...
rmdir node_modules\@audit\motor-calculo 2>nul
call npm install
echo.
echo Compilando el motor de calculo...
call npm run build --workspace packages/motor-calculo
echo.
echo Aplicando cambios de base de datos (Docker Desktop tiene que estar abierto)...
docker compose up -d
call npx --workspace apps/api prisma migrate deploy
call npx --workspace apps/api prisma generate
echo.
echo Listo. Ahora podes abrir iniciar.cmd
pause
