# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Throwaway probe for the Bradbury non-deterministic budget.

Round one established the shape of the problem:

    gl.nondet.web.request   HTTP GET       settled in 12s
    gl.nondet.web.render    text mode      still unsettled at 355s
    gl.nondet.web.render    screenshot     still unsettled at 424s

So the headless browser is the expensive part, not the model. This round tests
whether the audit can be rebuilt on plain HTTP: fetch the page HTML, pull the
embedded image out of it deterministically, fetch that image, and compare it
against the reference frame with one vision call. No browser anywhere.

Not part of the protocol. Deploy, call, read, discard.
"""

from genlayer import *

ERROR_EXTERNAL = "[EXTERNAL]"


def _body_of(url: str) -> bytes:
    response = gl.nondet.web.request(url, method="GET")
    body = getattr(response, "body", None)
    if not body:
        raise gl.vm.UserError(f"{ERROR_EXTERNAL} empty body from {url}")
    return body


def _first_image_src(html: str) -> str:
    """Deterministic scrape of the first <img src>. No parser, no model."""
    lowered = html.lower()
    cursor = 0
    while True:
        tag = lowered.find("<img", cursor)
        if tag == -1:
            return ""
        end = lowered.find(">", tag)
        if end == -1:
            return ""
        chunk = html[tag:end]
        lowered_chunk = lowered[tag:end]
        pos = lowered_chunk.find("src=")
        if pos != -1:
            rest = chunk[pos + 4:].strip()
            if rest[:1] in ('"', "'"):
                quote = rest[0]
                closing = rest.find(quote, 1)
                if closing != -1:
                    return rest[1:closing]
        cursor = end + 1


class Probe(gl.Contract):
    last: str

    def __init__(self):
        self.last = ""

    @gl.public.view
    def get_last(self) -> str:
        return str(self.last)

    @gl.public.write
    def probe_html(self, url: str) -> str:
        """Fetch a page over HTTP and find its first image without a browser."""

        def run():
            html = _body_of(url).decode("utf-8", errors="replace")
            src = _first_image_src(html)
            text_ish = len(html)
            return f"html_chars={text_ish} first_img={src}"

        self.last = gl.eq_principle.strict_eq(run)
        return str(self.last)

    @gl.public.write
    def probe_vision_bytes(self, frame_url: str, image_url: str) -> str:
        """Two images, both over plain HTTP, one vision call. The real target."""

        def leader_fn():
            frame = _body_of(frame_url)
            other = _body_of(image_url)
            answer = gl.nondet.exec_prompt(
                "IMAGE 1 and IMAGE 2 are photographs. Do they show the same scene, "
                "meaning the same place from a similar camera position? "
                'Reply with JSON only: {"same_scene": true or false}',
                images=[frame, other],
                response_format="json",
            )
            if not isinstance(answer, dict):
                raise gl.vm.UserError(f"{ERROR_EXTERNAL} model returned {type(answer).__name__}")
            return "same_scene=" + str(bool(answer.get("same_scene")))

        def validator_fn(leaders_res: gl.vm.Result) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            return leader_fn() == leaders_res.calldata

        self.last = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
        return str(self.last)
