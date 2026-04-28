import os
import subprocess

with open('.env', 'r') as f:
    for line in f:
        line = line.strip()
        if not line or line.startswith('#'):
            continue
        key, value = line.split('=', 1)
        print(f"Adding {key} to Vercel...")
        for env in ['production', 'preview', 'development']:
            # we ignore errors for duplicates as we are just setting secrets
            subprocess.run(['npx', 'vercel', 'env', 'add', key, env, '--value', value, '--yes', '--force'], stderr=subprocess.DEVNULL)
