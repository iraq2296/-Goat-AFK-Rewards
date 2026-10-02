@echo off
chcp 65001 >nul
title Goat AFK Rewards - Discord Bot Launcher
color 05

set "PATH=C:\Program Files\nodejs;%PATH%"

echo =========================================================
echo    🐺 Goat AFK Rewards - Discord Bot Online Launcher
echo =========================================================
echo.

node discord_bot.js

echo.
echo [!] توقف البوت. اضغط أي زر لإعادة التشغيل...
pause
