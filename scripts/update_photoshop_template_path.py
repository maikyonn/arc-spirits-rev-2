#!/usr/bin/env python3
"""Update the Photoshop JSX template path with an absolute location.

Usage:
    python scripts/update_photoshop_template_path.py [--template /path/to/spirit_hex_grey.psd]

If --template is omitted, the script tries to find `spirit_hex_grey.psd` in the current
working directory or at the repository root. Once a file is found, the
`scripts/hex-spirit-game-print.jsx` file is rewritten so that the
`templateFile = new File('...')` line points to that absolute path.
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path
import sys

REPLACEMENT_PATTERN = re.compile(r"var templateFile = new File\('.*?'\);")


def resolve_template_path(cli_value: str | None, repo_root: Path) -> Path:
    candidates = []
    if cli_value:
        candidates.append(Path(cli_value).expanduser())
    else:
        cwd_candidate = Path.cwd() / 'spirit_hex_grey.psd'
        repo_candidate = repo_root / 'spirit_hex_grey.psd'
        candidates.extend([cwd_candidate, repo_candidate])

    for candidate in candidates:
        if candidate.is_file():
            return candidate.resolve()

    raise FileNotFoundError(
        'Unable to locate spirit_hex_grey.psd. Pass --template /full/path/to/file.psd'
    )


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    parser = argparse.ArgumentParser(description="Update JSX template path")
    parser.add_argument(
        '--template',
        help='Path to spirit_hex_grey.psd (defaults to checking CWD and repo root).'
    )
    parser.add_argument(
        '--jsx',
        default=repo_root / 'scripts' / 'hex-spirit-game-print.jsx',
        type=Path,
        help='Path to the JSX file to update.'
    )
    args = parser.parse_args()

    template_path = resolve_template_path(args.template, repo_root)
    jsx_path: Path = args.jsx
    if not jsx_path.is_file():
        raise FileNotFoundError(f'Could not find JSX file at {jsx_path}')

    text = jsx_path.read_text()
    replacement_line = f"var templateFile = new File('{template_path.as_posix()}');"

    if not REPLACEMENT_PATTERN.search(text):
        raise RuntimeError('Could not find templateFile line to update in the JSX file.')

    updated = REPLACEMENT_PATTERN.sub(replacement_line, text, count=1)
    jsx_path.write_text(updated)
    print(f'Updated template path in {jsx_path} to {template_path}')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as exc:  # pylint: disable=broad-except
        print(f'Error: {exc}', file=sys.stderr)
        raise SystemExit(1)
