"""
Local checks for the deterministic half of the audit.

These functions decide whether a reported page is the licence holder's to
answer for. They run identically on every validator and never touch a model,
so they are the part of the patrol that has to be exactly right. Running them
here costs nothing, unlike finding out on chain.

    python tests/test_url_gates.py
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(ROOT, "contracts", "aperture.py")


def load_pure_helpers():
    """Pull the deterministic helpers out of the contract without a GenVM."""
    src = io.open(SOURCE, encoding="utf-8").read()
    start = src.index("def _normalise_url")
    end = src.index("def _taxonomy_block")
    ns = {}
    preamble = (
        "def _coerce_str(value):\n"
        "    return '' if value is None else str(value).strip()\n"
    )
    exec(preamble + src[start:end], ns)
    return ns


H = load_pure_helpers()
normalise = H["_normalise_url"]
match_prefix = H["_match_prefix"]

FAILURES = []


def check(label, got, want):
    if got != want:
        FAILURES.append(f"{label}\n    got  {got!r}\n    want {want!r}")


# ---------------------------------------------------------------------------
# Normalisation. This is the replay key, so anything that is the same page has
# to collapse to the same string.
# ---------------------------------------------------------------------------

check("scheme stripped", normalise("https://nike.com/air"), "nike.com/air")
check("http too", normalise("http://nike.com/air"), "nike.com/air")
check("host lowercased", normalise("https://NIKE.com/Air"), "nike.com/Air")
check("www dropped", normalise("https://www.nike.com/air"), "nike.com/air")
check("query dropped", normalise("https://nike.com/air?utm=x"), "nike.com/air")
check("fragment dropped", normalise("https://nike.com/air#top"), "nike.com/air")
check("trailing slash dropped", normalise("https://nike.com/air/"), "nike.com/air")
check("bare host", normalise("https://nike.com/"), "nike.com")
check("whitespace", normalise("  https://nike.com/air  "), "nike.com/air")

# The four spellings a griefer would try in order to file the same page again.
same = {
    normalise("https://nike.com/air"),
    normalise("http://www.NIKE.com/air/"),
    normalise("https://nike.com/air?ref=twitter"),
    normalise("https://www.nike.com/air#hero"),
}
check("replay variants collapse to one key", len(same), 1)


# ---------------------------------------------------------------------------
# Prefix matching. A holder declares where the footage will run. Anything
# outside that is somebody else's page until the model says otherwise.
# ---------------------------------------------------------------------------

DECLARED = ["nike.com", "youtube.com/@nike"]

check("own site matches", match_prefix("https://nike.com/campaign", DECLARED), "nike.com")
check("own root matches", match_prefix("https://nike.com", DECLARED), "nike.com")
check("declared channel matches", match_prefix("https://youtube.com/@nike/videos", DECLARED), "youtube.com/@nike")

# The whole point of the gate.
check("stranger site does not match", match_prefix("https://evil.example/fake", DECLARED), "")
check("other channel same platform does not match", match_prefix("https://youtube.com/@adidas", DECLARED), "")
check("lookalike host does not match", match_prefix("https://nike.com.evil.example/x", DECLARED), "")
check("suffix trick does not match", match_prefix("https://notnike.com/air", DECLARED), "")
check("prefix must end on a path boundary", match_prefix("https://youtube.com/@nikefake", DECLARED), "")
check("no declarations means no match", match_prefix("https://nike.com/air", []), "")

# Longest declaration wins so the most specific one is reported.
check(
    "most specific prefix reported",
    match_prefix("https://youtube.com/@nike/videos", ["youtube.com", "youtube.com/@nike"]),
    "youtube.com/@nike",
)


# ---------------------------------------------------------------------------
# Verdict derivation. Mirrors the contract's derive() so the ordering of the
# gates is pinned by a test rather than by memory.
# ---------------------------------------------------------------------------

RANK = {"EDU_NONCOMMERCIAL": 0, "INDIE_DOC": 1, "BRANDED_WEB": 2,
        "BRANDED_PAID_MEDIA": 3, "BROADCAST_NATIONAL": 4, "RESTRICTED": 99}


def derive(confident, media_match, holder_shown, observed, licensed, declared_prefix):
    if not confident:
        return "NO_MEDIA_MATCH"
    if not media_match:
        return "NO_MEDIA_MATCH"
    if declared_prefix == "" and not holder_shown:
        return "UNATTRIBUTED"
    if RANK[observed] > RANK[licensed]:
        return "ALLEGED_OUT_OF_SCOPE:" + observed
    return "WITHIN_SCOPE"


LICENSED = "BRANDED_WEB"

# The attack the steward described: a page the reporter wrote themselves that
# only names the clip. No footage on it, so the media gate stops it dead.
check(
    "text only page cannot breach",
    derive(True, False, True, "BROADCAST_NATIONAL", LICENSED, ""),
    "NO_MEDIA_MATCH",
)

# Real footage, but on a site the holder never declared and that does not name
# them. Possibly real infringement, definitely not this holder's.
check(
    "third party page cannot breach the holder",
    derive(True, True, False, "BROADCAST_NATIONAL", LICENSED, ""),
    "UNATTRIBUTED",
)

# Same page, but the holder declared it. Now it sticks.
check(
    "declared page with footage escalates",
    derive(True, True, False, "BROADCAST_NATIONAL", LICENSED, "nike.com"),
    "ALLEGED_OUT_OF_SCOPE:BROADCAST_NATIONAL",
)

# Undeclared page that names the holder as the advertiser also sticks.
check(
    "page naming the holder escalates",
    derive(True, True, True, "BROADCAST_NATIONAL", LICENSED, ""),
    "ALLEGED_OUT_OF_SCOPE:BROADCAST_NATIONAL",
)

check(
    "usage inside the licence is not a breach",
    derive(True, True, True, "EDU_NONCOMMERCIAL", LICENSED, "nike.com"),
    "WITHIN_SCOPE",
)
check(
    "same tier is not a breach",
    derive(True, True, True, LICENSED, LICENSED, "nike.com"),
    "WITHIN_SCOPE",
)

# A blocked or empty page must never escalate.
check(
    "no confidence never escalates",
    derive(False, True, True, "BROADCAST_NATIONAL", LICENSED, "nike.com"),
    "NO_MEDIA_MATCH",
)

# Media gate runs before attribution, so a declared page still needs the
# footage to actually be on it.
check(
    "declared prefix does not bypass the media gate",
    derive(True, False, True, "BROADCAST_NATIONAL", LICENSED, "nike.com"),
    "NO_MEDIA_MATCH",
)


# ---------------------------------------------------------------------------

total = 26
if FAILURES:
    print(f"\n  {len(FAILURES)} of {total} checks FAILED\n")
    for f in FAILURES:
        print("  " + f)
    sys.exit(1)

print(f"\n  all {total} deterministic gate checks passed\n")
