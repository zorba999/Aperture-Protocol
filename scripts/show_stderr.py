"""
Pull the contract's Python traceback out of a captured run log.

GenLayer returns execution failures as a JSON blob with the traceback buried in
a `stderr` string. Reading it by eye is miserable, and grepping it out keeps
tripping over escapes, so this does it properly.

    python scripts/show_stderr.py adv.log
"""

import io
import json
import sys

BACKSLASH = chr(92)
QUOTE = chr(34)
KEY = QUOTE + "stderr" + QUOTE + ":" + QUOTE


def extract(log: str):
    """Yield every decoded stderr value in the log, longest first."""
    found = []
    cursor = 0
    while True:
        start = log.find(KEY, cursor)
        if start == -1:
            break
        i = start + len(KEY)
        chars = []
        while i < len(log):
            ch = log[i]
            if ch == BACKSLASH:
                chars.append(log[i:i + 2])
                i += 2
                continue
            if ch == QUOTE:
                break
            chars.append(ch)
            i += 1
        raw = "".join(chars)
        try:
            found.append(json.loads(QUOTE + raw + QUOTE))
        except Exception:
            pass
        cursor = i + 1
    return found


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "adv.log"
    log = io.open(path, encoding="utf-8", errors="replace").read()
    values = [v for v in extract(log) if v.strip()]
    if not values:
        print("no contract stderr in this log")
        return 0
    seen = set()
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        print(value)
        print("-" * 60)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
