@echo off
cd /d "%~dp0"
echo === Dang deploy len GitHub Pages ===
git add .
git commit -m "update %date% %time%"
git push
echo.
echo === Xong! Cho 1-2 phut roi kiem tra tren iPhone ===
pause
