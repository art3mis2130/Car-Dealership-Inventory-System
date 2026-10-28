"""Mechanically render the exported session transcript into readable markdown.

Nothing is reworded or summarised: every user message, assistant message and
assistant reasoning block is copied verbatim. Only tool *payloads* are
truncated (at a fixed character budget, with the cut marked inline), because
they contain whole file contents and would run to megabytes.
"""
import io, json, os, sys

SRC = sys.argv[1]
OUT = sys.argv[2]

TOOL_INPUT_LIMIT = 1500
TOOL_RESULT_LIMIT = 600

def clip(text, limit):
    text = text if isinstance(text, str) else json.dumps(text, indent=2, ensure_ascii=False)
    if len(text) <= limit:
        return text, False
    return text[:limit], True

def fence(text, lang=''):
    # Avoid breaking out of the code fence on content containing backticks.
    f = '```'
    while f in text:
        f += '`'
    return '%s%s\n%s\n%s' % (f, lang, text, f)

out = []
rows = []

with io.open(SRC, encoding='utf-8') as fh:
    for line in fh:
        line = line.strip()
        if not line:
            continue
        d = json.loads(line)
        if d.get('type') in ('user', 'assistant'):
            rows.append(d)

turn = 0
for d in rows:
    role = d['type']
    msg = d.get('message') or {}
    content = msg.get('content')
    ts = (d.get('timestamp') or '')[:19].replace('T', ' ')

    if isinstance(content, str):
        turn += 1
        out.append('\n---\n')
        out.append('## Turn %d — human  \n`%s`\n' % (turn, ts))
        out.append(fence(content))
        continue

    if not isinstance(content, list):
        continue

    for block in content:
        kind = block.get('type')

        if kind == 'text':
            text = block.get('text', '').strip()
            if text:
                out.append('\n**Claude** · `%s`\n' % ts)
                out.append(text + '\n')

        elif kind == 'thinking':
            text = (block.get('thinking') or '').strip()
            if text:
                out.append('\n<details><summary><em>Claude — reasoning</em> · <code>%s</code></summary>\n\n' % ts)
                out.append(fence(text))
                out.append('\n</details>\n')

        elif kind == 'tool_use':
            name = block.get('name', '?')
            body, cut = clip(block.get('input', {}), TOOL_INPUT_LIMIT)
            out.append('\n> **Tool call — `%s`** · `%s`\n' % (name, ts))
            out.append(fence(body + ('\n... [truncated at %d chars]' % TOOL_INPUT_LIMIT if cut else ''), 'json'))

        elif kind == 'tool_result':
            raw = block.get('content')
            if isinstance(raw, list):
                parts = []
                for part in raw:
                    if part.get('type') == 'text':
                        parts.append(part.get('text', ''))
                    elif part.get('type') == 'image':
                        parts.append('[image omitted - see docs/screenshots/]')
                raw = '\n'.join(parts)
            body, cut = clip(raw if raw is not None else '', TOOL_RESULT_LIMIT)
            body = body.strip()
            if not body:
                continue
            out.append('\n> *Result:*\n')
            out.append(fence(body + ('\n... [truncated at %d chars]' % TOOL_RESULT_LIMIT if cut else '')))

header = """# PROMPTS.md — raw AI session log

The kata asks for the raw, unedited AI chat log, so this is it: the complete
session in which this project was built, start to finish, with Claude
(Claude Code, Anthropic's CLI/desktop agent).

**Nothing here has been reworded, reordered or summarised.** Every human
message, every assistant message and every assistant reasoning block is
reproduced verbatim from the session export. The only change is mechanical
truncation of tool *payloads*: tool inputs are cut at %d characters and tool
results at %d, because they contain entire file contents and would otherwise
run to several megabytes. Each cut is marked inline where it happens.

The completely untouched export — every byte, nothing truncated — is committed
alongside this file as **[`docs/ai-session-transcript.jsonl`](docs/ai-session-transcript.jsonl)**
(JSON Lines, one message per line). This markdown file is a rendering of that
file and nothing else; the script that produced it is
[`docs/render-transcript.py`](docs/render-transcript.py), so the rendering is
reproducible and checkable against the source.

One caveat about that raw export, since it is genuinely unedited: alongside the
conversation it also carries the session's own system and environment context —
the agent's tool catalogue, local paths, and the git identity the commits were
made with. Nothing secret, but it is more than the conversation itself. If you
only want the conversation, read this file.

A note on how it reads: this was a long agent session rather than a rapid
back-and-forth chat, so there are %d human turns with a great deal of agent work
between them. The reasoning blocks are the interesting part if you want to see
how decisions were actually made; they are collapsed by default.

Tool calls appear as `> **Tool call**` blocks. `Bash`, `Write` and `Edit` are
file and command operations; `mcp__Claude_Browser__*` calls are the agent
driving a real browser against the running app, which is how the disabled-button
bug described in the README was found.

""" % (TOOL_INPUT_LIMIT, TOOL_RESULT_LIMIT, turn)

io.open(OUT, 'w', encoding='utf-8', newline='\n').write(header + ''.join(out) + '\n')
print('wrote', OUT, os.path.getsize(OUT), 'bytes,', turn, 'human turn(s),', len(rows), 'messages')
