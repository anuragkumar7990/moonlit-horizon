import sys, os, tempfile
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('72.61.126.30', username='root', password='Clawdbotanupass@123')

# Run script from the discord-bot directory so dotenv/node_modules are available
script = """require('dotenv').config()
const VERCEL_URL = process.env.VERCEL_URL
const BASIC_AUTH = 'Basic ' + Buffer.from(':' + process.env.DASHBOARD_PASSWORD).toString('base64')
fetch(VERCEL_URL + '/api/p0-tasks', { headers: { Authorization: BASIC_AUTH } })
  .then(r => r.json())
  .then(d => {
    console.log('newCount:', d.newCount)
    if (!d.tasks || d.tasks.length === 0) { console.log('No P0 tasks found'); return }
    d.tasks.forEach(t => console.log('[' + t.category + '] ' + t.task + ' | ' + t.detail))
  })
  .catch(e => console.error('Error:', e.message))
"""

tmpfile = os.path.join(tempfile.gettempdir(), 'test_p0.js')
with open(tmpfile, 'w', encoding='utf-8') as f:
    f.write(script)

sftp = ssh.open_sftp()
sftp.put(tmpfile, '/root/moonlit-horizon/discord-bot/test_p0.js')
sftp.close()

_, stdout, stderr = ssh.exec_command('cd /root/moonlit-horizon/discord-bot && node test_p0.js')
out = stdout.read().decode('utf-8', errors='replace')
err = stderr.read().decode('utf-8', errors='replace')
print(out)
if err.strip():
    print('STDERR:', err)

ssh.close()
