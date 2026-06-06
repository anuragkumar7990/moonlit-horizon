import sys
import paramiko
import time

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.126.30', username='root', password='Clawdbotanupass@123')

_, stdout, stderr = ssh.exec_command('cd /root/moonlit-horizon && git pull origin main')
print(stdout.read().decode('utf-8', errors='replace'))

time.sleep(2)

_, stdout, stderr = ssh.exec_command('cd /root/moonlit-horizon/discord-bot && node test-p0.js')
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err.strip():
    print('STDERR:', err)

ssh.close()
