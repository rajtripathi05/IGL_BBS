@echo off
REM ============================================================
REM  IGL BBS - push this folder to GitHub
REM  Double-click this file, or run it from a command prompt.
REM  Repo: https://github.com/rajtripathi05/IGL_BBS
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo  IGL BBS - GitHub setup
echo  ======================
echo  Folder: %CD%
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo  [X] Git is not installed or not on PATH.
  echo      Install it from https://git-scm.com/download/win then run this again.
  echo.
  pause
  exit /b 1
)

if not exist ".git" (
  echo  [1/4] Initialising repository...
  git init -b main
  git add -A
  git -c user.name="IGL BBS" -c user.email="ai@indiaglycols.com" commit -m "IGL BBS v1.0.0 - Behaviour Based Safety observation system"
) else (
  echo  [1/4] Repository already initialised - committing any local changes...
  git add -A
  git diff --cached --quiet || git commit -m "Update IGL BBS"
)

echo  [2/4] Setting remote...
git remote remove origin >nul 2>nul
git remote add origin https://github.com/rajtripathi05/IGL_BBS.git

echo  [3/4] Making sure the branch is named main...
git branch -M main

echo  [4/4] Pushing to GitHub...
echo.
echo  If you are asked to sign in, use your GitHub account or a
echo  Personal Access Token as the password.
echo.
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Push failed. If the repo already has commits, run these two lines:
  echo      git pull --rebase origin main
  echo      git push -u origin main
  echo.
  pause
  exit /b 1
)

echo.
echo  Done. Code is on https://github.com/rajtripathi05/IGL_BBS
echo  Next: connect the repo in Netlify (see docs\DEPLOY.md).
echo.
pause
