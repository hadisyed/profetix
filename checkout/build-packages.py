#!/usr/bin/env python3
"""Build paid ZIPs from the product source folders. Run from repository root.
Archives are written to checkout/private/ (gitignored); never commit or serve publicly.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"checkout"/"private"
OUT.mkdir(parents=True,exist_ok=True)
for name,folder in [("starter-kit","starter-kit"),("automation-toolkit","automation-toolkit")]:
    source=ROOT/"products"/folder
    required=list(source.glob("*"))
    if not required or not all(p.is_file() for p in required):
        raise SystemExit(f"Missing files for {name}")
    dest=OUT/f"{name}.zip"
    with ZipFile(dest,"w",ZIP_DEFLATED) as z:
        for p in sorted(required):
            z.write(p,arcname=f"{name}/{p.name}")
    print(f"Prepared {dest} ({dest.stat().st_size} bytes)")
print("Keep ZIPs private. Test purchases before selling.")
