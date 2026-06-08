@echo off
set TSCONFIG=%~dp0..\tsconfig.json
set SRC=%~dp0..\src\index.ts
if exist "%~dp0..\lib\node_modules\spica-cli\tsconfig.json" (
  set TSCONFIG=%~dp0..\lib\node_modules\spica-cli\tsconfig.json
  set SRC=%~dp0..\lib\node_modules\spica-cli\src\index.ts
)
node "%~dp0..\node_modules\tsx\dist\cli.mjs" --tsconfig "%TSCONFIG%" "%SRC%" %*
