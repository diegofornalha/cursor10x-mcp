#!/usr/bin/env python3
import subprocess
import sys
import os

# Set environment variables
os.environ['TURSO_DATABASE_URL'] = 'libsql://127.0.0.1:8080'
os.environ['TURSO_LOCAL_URL'] = 'libsql://127.0.0.1:8080'
os.environ['TURSO_MODE'] = 'local'

# Change to script directory
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Run the Node.js server
subprocess.run([sys.executable.replace('python', 'node'), 'turso-mcp-clean.js'])