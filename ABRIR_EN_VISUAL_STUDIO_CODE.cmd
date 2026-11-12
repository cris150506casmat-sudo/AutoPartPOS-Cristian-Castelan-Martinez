@echo off
cd /d "%~dp0"
where code >nul 2>nul
if errorlevel 1 (
 echo Abre Visual Studio Code y selecciona Archivo - Abrir carpeta.
 echo Selecciona esta carpeta: %~dp0
 pause
 exit /b
)
code .
