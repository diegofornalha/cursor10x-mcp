#!/usr/bin/env python3
"""
Turso MCP Wrapper for Claude Code
A Python wrapper to ensure proper stdio communication
"""

import subprocess
import sys
import os

# Set up environment
os.environ['TURSO_DATABASE_URL'] = 'libsql://127.0.0.1:8080'
os.environ['TURSO_MODE'] = 'local'

# Change to script directory
script_dir = os.path.dirname(os.path.abspath(__file__))
os.chdir(script_dir)

# Run the Node.js server
try:
    subprocess.run(['node', 'turso-mcp-final.js'], check=True)
except KeyboardInterrupt:
    sys.exit(0)
except Exception as e:
    sys.exit(1)