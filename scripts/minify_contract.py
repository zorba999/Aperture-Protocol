"""
Strip comments and docstrings from a contract before deploying it.

Bradbury rejects large deploy payloads. The exact ceiling moves: a 51KB build
of this contract deployed fine in the morning and was refused with
`intrinsic gas too low` in the evening, while a 3.5KB contract went through in
the same minute. Comments and docstrings are pure payload, so they are removed
from what goes on chain and kept in the repository, where they are useful.

This is not a rewrite. It uses Python's own tokenizer, so string literals that
happen to contain a `#` are untouched, and the result is byte for byte
reproducible:

    python scripts/minify_contract.py contracts/aperture.py build/aperture.min.py

The generated file is committed so anyone can diff what was deployed against
the readable source without having to trust this script.
"""

import ast
import io
import os
import sys
import tokenize


def strip_docstrings(source: str) -> str:
    """Blank out every module, class and function docstring."""
    tree = ast.parse(source)
    lines = source.split("\n")
    kill = []

    for node in ast.walk(tree):
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        body = getattr(node, "body", None)
        if not body:
            continue
        first = body[0]
        if not isinstance(first, ast.Expr):
            continue
        value = first.value
        if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
            continue
        # A module docstring is the only statement that may legally vanish; a
        # function whose body is only a docstring needs a `pass` in its place.
        replacement = None
        if not isinstance(node, ast.Module) and len(body) == 1:
            replacement = " " * (first.col_offset) + "pass"
        kill.append((first.lineno - 1, first.end_lineno - 1, replacement))

    for start, end, replacement in sorted(kill, reverse=True):
        lines[start:end + 1] = [replacement] if replacement is not None else []

    return "\n".join(lines)


def strip_comments(source: str) -> str:
    """
    Cut comment spans out of the original text.

    An earlier version reassembled the file token by token from column offsets.
    That silently mangled f-strings: Python 3.12 splits them into FSTRING_START,
    MIDDLE and END tokens, and rebuilding them turned an escaped `{{` into
    `{ `, which only surfaced as a ValueError from inside a deployed contract.
    Deleting spans from the original leaves every other byte exactly as written.
    """
    lines = source.split("\n")
    starts = []
    offset = 0
    for line in lines:
        starts.append(offset)
        offset += len(line) + 1

    def absolute(row, col):
        return starts[row - 1] + col

    spans = []
    for tok in tokenize.generate_tokens(io.StringIO(source).readline):
        if tok.type == tokenize.COMMENT:
            spans.append((absolute(*tok.start), absolute(*tok.end)))

    out = source
    for start, end in reversed(spans):
        out = out[:start] + out[end:]
    return out


def tidy(source: str) -> str:
    """Drop trailing whitespace and runs of blank lines."""
    kept = []
    blank = False
    for line in source.split("\n"):
        stripped = line.rstrip()
        if not stripped.strip():
            if blank:
                continue
            blank = True
            kept.append("")
        else:
            blank = False
            kept.append(stripped)
    return "\n".join(kept).strip() + "\n"


def main() -> int:
    src_path = sys.argv[1] if len(sys.argv) > 1 else "contracts/aperture.py"
    out_path = sys.argv[2] if len(sys.argv) > 2 else "build/aperture.min.py"

    source = io.open(src_path, encoding="utf-8").read()

    # The runner header is a comment and must survive. Lift it off, then put it
    # back on top of the stripped body.
    lines = source.split("\n")
    header = lines[0]
    if not header.startswith("# {"):
        print(f"error: {src_path} does not start with a pinned runner comment")
        return 1

    body = "\n".join(lines[1:])
    body = strip_docstrings(body)
    body = strip_comments(body)
    minified = header + "\n" + tidy(body)

    # The guard that matters. Stripping comments must not change behaviour, so
    # compare the two syntax trees with docstrings removed from both. The first
    # version of this script passed a parse check and still shipped a contract
    # whose f-string braces had been rewritten; a parse check cannot see that,
    # a tree comparison can.
    def normalised(text: str) -> str:
        tree = ast.parse(text)
        for node in ast.walk(tree):
            body = getattr(node, "body", None)
            if not isinstance(body, list) or not body:
                continue
            first = body[0]
            if (
                isinstance(first, ast.Expr)
                and isinstance(first.value, ast.Constant)
                and isinstance(first.value.value, str)
            ):
                body.pop(0)
                if not body:
                    body.append(ast.Pass())
        return ast.dump(ast.fix_missing_locations(tree))

    if normalised(source) != normalised(minified):
        print("error: the stripped contract does not match the source tree")
        return 1
    assert minified.split("\n")[0].startswith('# { "Depends": "py-genlayer:')

    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    io.open(out_path, "w", encoding="utf-8", newline="\n").write(minified)

    before = len(source.encode("utf-8"))
    after = len(minified.encode("utf-8"))
    print(f"  {src_path}  {before}B -> {out_path}  {after}B  ({100 - after * 100 // before}% smaller)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
