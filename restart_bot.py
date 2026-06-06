import sys
import paramiko
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.126.30', username='root', password='Clawdbotanupass@123')

_, stdout, stderr = ssh.exec_command('pm2 restart moonlit-bot')
stdout.read()
stderr.read()

time.sleep(4)

_, stdout, stderr = ssh.exec_command('pm2 logs moonlit-bot --lines 25 --nostream')
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
print(err)

ssh.close()
