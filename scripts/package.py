#!/usr/bin/env python3
"""
Package AgentMolt skill for distribution
"""

import os
import zipfile
from pathlib import Path

def package_skill():
    skill_dir = Path(__file__).parent.parent
    dist_dir = skill_dir / "dist"
    dist_dir.mkdir(exist_ok=True)
    
    output_file = dist_dir / "agentmolt.skill"
    
    files = [
        "skill/SKILL.md",
        "skill/agentmolt.py",
        "database/schema.sql",
        "api/server.js",
        "api/package.json",
        "app/index.html",
    ]
    
    with zipfile.ZipFile(output_file, 'w', zipfile.ZIP_DEFLATED) as zf:
        for file_path in files:
            full_path = skill_dir / file_path
            if full_path.exists():
                zf.write(full_path, file_path)
                print(f"  ✓ {file_path}")
            else:
                print(f"  ✗ {file_path} (missing)")
    
    size_kb = output_file.stat().st_size / 1024
    print(f"\n📦 Packaged: {output_file}")
    print(f"   Size: {size_kb:.1f} KB")
    print(f"\n🚀 Ready to distribute!")
    print(f"   Install: npx clawhub@latest install agentmolt")
    print(f"   Manual:  cp agentmolt.skill ~/.openclaw/skills/")

if __name__ == "__main__":
    package_skill()
