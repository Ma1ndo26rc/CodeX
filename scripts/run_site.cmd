@echo off
cd /d E:\CodeX_File
python main.py --site
start "" /min cmd /c "cd /d E:\CodeX_File\frontend && npm run preview -- --host 127.0.0.1 --port 4173"
timeout /t 3 /nobreak >nul
start "" http://127.0.0.1:4173/
