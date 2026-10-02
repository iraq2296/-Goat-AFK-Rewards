@echo off
title Upload Goat AFK Rewards to GitHub
echo ===================================================
echo   Uploading Goat AFK Rewards to GitHub...
echo ===================================================
echo.
git push -u origin main
echo.
if errorlevel 1 goto on_error

echo ===================================================
echo   Upload SUCCESSFUL!
echo   https://github.com/iraq2296/-Goat-AFK-Rewards
echo ===================================================
goto on_exit

:on_error
echo ===================================================
echo   Upload FAILED! See the error message above.
echo ===================================================

:on_exit
echo.
pause
