#!/bin/bash
# اول تغییرات لوکال رو میفرسته روی گیت
git add .
git commit -m "auto: update code"
git push origin main

# بعد با SSH میره روی VPS و deploy رو اجرا میکنه
ssh root@185.213.164.74 "cd /root/-hamgamplastic/Back-end && deploy"
