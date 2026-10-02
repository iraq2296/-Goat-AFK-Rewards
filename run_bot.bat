@echo off
chcp 65001 >nul
title Minecraft Auto-Farm & AFK Bot Launcher
color 0B

set "PATH=C:\Program Files\nodejs;%PATH%"

:start
echo =========================================================
echo    🎮 Minecraft Auto-Farm & AFK Bot (Client Edition)
echo =========================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [!] Node.js غير مثبت على جهازك.
    echo [i] جاري محاولة تثبيت Node.js تلقائيا عبر Winget...
    winget install OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements
    if %errorlevel% neq 0 (
        echo [X] تعذر التثبيت التلقائي. يرجى تحميل وتثبيت Node.js من: https://nodejs.org
        pause
        exit /b
    )
    echo [V] تم تثبيت Node.js بنجاح! يرجى إعادة تشغيل هذا الملف.
    pause
    exit /b
)

:: Check dependencies
if not exist node_modules (
    echo [*] جاري تثبيت حزم ومكتبات البوت (Mineflayer)...
    call npm install
    echo.
)

echo [*] تشغيل البوت الآن...
echo [*] لقراءة الإعدادات أو تعديل السيرفر، عدل ملف: config.json
echo =========================================================
echo.

node bot.js

echo.
echo [!] توقف البوت. اضغط أي زر لإعادة التشغيل...
pause
goto start
