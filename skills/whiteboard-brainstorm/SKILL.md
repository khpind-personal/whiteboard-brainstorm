---
name: whiteboard-brainstorm
description: Bidirectional whiteboard brainstorming on an Excalidraw canvas. Use when the user invokes `/whiteboard-brainstorm` or asks to brainstorm visually, explore ideas on a canvas, or mindmap.
---

# Whiteboard Brainstorm

You orchestrate a bidirectional brainstorming session between the user and
yourself on an Excalidraw canvas. The user draws and writes; you respond with
shapes (stickies, mind-nodes, annotations, panels) on the same canvas.

## Invocation

User invokes: `/whiteboard-brainstorm [--manual] <mode> [topic]`
Modes: `preimpl`, `general`, `mindmap`.

**Default behavior is auto-poll:** after each turn, Claude issues a
blocking `Bash` command that polls `events.jsonl` for the next ping
(see the "Auto-poll" section below for the exact loop). The user does
NOT need to press Enter in the terminal — only ping from the browser.

Pass `--manual` to opt out. Manual mode waits for the user to return
to the terminal and press Enter between turns.

## Storage model

Sessions live under `$WBB_ROOT` (default `~/Documents/Whiteboard-Brainstorm/`).
Layout:

```
$WBB_ROOT/
  10-Sessions/YYYY/MM/<slug>.md          plain markdown notes
  20-Canvases/<slug>/                    session dir (live + versions + runtime)
    latest.excalidraw.json
    board-v0.excalidraw.json
    board-v1.excalidraw.json
    .state/
      events.jsonl
      server-info
      server.pid
```

The session dir is the single source of truth. The server watches it and the
CLI writes versions there — no duplicate copies anywhere.

The layout is Obsidian-friendly: users who want Obsidian set `WBB_ROOT` to a
path inside their vault and the markdown notes render natively. No plugin
coupling.

## Start of session

1. Create the session (resolves root from `$WBB_ROOT` automatically):
   ```
   node <plugin>/bin/wbb.js new-session <mode> "<topic>"
   ```
   Prints JSON: `{slug, sessionDir, boardPath, notePath, root}`.

2. Start the server on the session dir.

   In Claude Code, the background launcher is usually fine:
   ```
   <plugin>/server/start-board-server.sh <sessionDir>
   ```

   In Codex, prefer a persistent foreground command so the command runner
   does not reap the server after the launch command returns:
   ```
   <plugin>/server/start-board-server.sh <sessionDir> --foreground
   ```
   Keep that foreground command session open. In a second command, read
   `<sessionDir>/.state/server-info` to get the URL.

   Before sharing any URL, verify it is actually reachable:
   ```
   curl -sf <url>/health
   ```
   If health fails, do not share the URL. Start the server with
   `--foreground`, keep that command session open, then read `server-info`
   again. A stale `server-info` with a reaped process causes browser blank /
   refused-load symptoms.

   Share the URL with the user along with:

   > "Canvas live at <url>?mode=<mode>. Draw freely. Tag text with
   > @idea / @problem / @q. Click the @ping button (or write `@ping`
   > in a text element) when you want me to respond. **After pinging,
   > come back to this terminal and press Enter** — I don't watch the
   > canvas live; I respond on the next terminal turn."

## Turn loop (each user turn)

1. **Check server alive.** If `<sessionDir>/.state/server-info` is missing,
   `<sessionDir>/.state/server-stopped` exists, or `curl -sf <url>/health`
   fails, restart the server. In Codex, restart with
   `<plugin>/server/start-board-server.sh <sessionDir> --foreground` and keep
   that command session open.
2. **Atomically read + clear events:** copy the file to a tmp location
   FIRST, then truncate. Guarantees pings that arrive during the turn
   are not lost.
   ```
   EVT=/tmp/wbb-events-$$.jsonl
   cp <sessionDir>/.state/events.jsonl "$EVT" 2>/dev/null || : > "$EVT"
   : > <sessionDir>/.state/events.jsonl
   cat "$EVT"
   ```
   Use the contents of `$EVT` for this turn; any ping that lands after
   the copy remains in `events.jsonl` for the NEXT turn.

   The user can trigger with the `@ping` button OR a text element
   containing `@ping`. Both write to `events.jsonl`. Events with
   `source: 'drawn-shape'` came from a drawn text element — `elementId`
   identifies it.

3. **Read the latest scene:** `cat <sessionDir>/latest.excalidraw.json`.
4. **Parse tags:**
   ```
   node <plugin>/bin/wbb.js parse-tags <sessionDir>/latest.excalidraw.json
   ```
5. **Load the mode prompt:** read
   `<plugin>/skills/whiteboard-brainstorm/modes/<mode>.md`. Substitute
   `{user_scene}` and `{events}` with the content from steps 2–3.
6. **Produce a response spec** (JSON array of shape specs — see mode
   file for allowed kinds). Max 4 shapes per turn.
7. **Build AI elements.** Pass the user scene so `near: <elId>` specs
   are placed next to their referenced element with collision avoidance:
   ```
   echo '<spec-json>' | node <plugin>/bin/wbb.js build-scene \
       --scene <sessionDir>/latest.excalidraw.json > /tmp/ai-elements.json
   ```
8. **Merge into scene:**
   ```
   node <plugin>/bin/wbb.js merge \
       <sessionDir>/latest.excalidraw.json \
       /tmp/ai-elements.json <turn> > /tmp/merged.json
   ```
9. **Write a new version and notify the server.** The CLI updates both
   `board-v<turn>.excalidraw.json` and `latest.excalidraw.json` in the
   session dir. A follow-up `/notify-refresh` bypasses the server's
   self-write suppression window so the browser always gets an SSE
   refresh, even while the user is mid-edit:
   ```
   node <plugin>/bin/wbb.js write-version <slug> <turn> /tmp/merged.json
   PORT=$(node -e "console.log(JSON.parse(require('fs').readFileSync('<sessionDir>/.state/server-info','utf8')).port)")
   curl -s -X POST "http://127.0.0.1:$PORT/notify-refresh" >/dev/null
   ```
10. **Reply in terminal** with a one-line summary of the shapes you
    pushed. Remind the user the URL is still live and to ping again
    when ready. Do NOT auto-loop — wait for the next terminal turn.

### Auto-poll (default) — blocking Bash wait

Unless `--manual` was passed, after step 10 of the turn loop, issue a
**blocking Bash command** that waits for the next ping event:

```bash
PID=$(cat <sessionDir>/.state/server.pid 2>/dev/null)
for i in $(seq 1 110); do
  [ -s <sessionDir>/.state/events.jsonl ] && break
  [ -f <sessionDir>/.state/server-stopped ] && echo SERVER_STOPPED && exit 0
  # PID check catches silent crashes (SIGKILL, OOM) that bypass our
  # uncaughtException handler and never write server-stopped.
  if [ -n "$PID" ] && ! kill -0 "$PID" 2>/dev/null; then
    echo SERVER_DEAD
    exit 0
  fi
  sleep 5
done
cat <sessionDir>/.state/events.jsonl
```

Set the Bash `timeout` to `600000` (10 min). The command returns when:

- `events.jsonl` has content → you get the event payload → run the next
  turn loop (steps 2–10 above), then issue another blocking wait.
- `server-stopped` file appears → print `SERVER_STOPPED`, tell user,
  stop polling.
- 10 min elapses with nothing → command exits empty. Tell the user
  "still idle — ping from the browser when ready" and issue another
  blocking wait.

This mode requires NO terminal input between turns. User just draws +
pings; you respond. The session stays alive in a blocking Bash call
between pings.

### Manual mode (--manual)

If user passed `--manual`, skip the blocking wait and reply in terminal
with a one-line summary + "press Enter to check for new pings". Wait for
the user to return and press Enter to trigger the next turn.

### `/loop` wrapper (rarely needed now)

Before v0.4 the skill required `/loop /whiteboard-brainstorm ...` plus
`ScheduleWakeup` to poll events without user input. The blocking Bash
loop above supersedes that for almost all cases. `/loop` is only useful
when the user wants a broader polling behavior (e.g. multiple scheduled
tasks interleaving the whiteboard turn). For a single brainstorm
session, use plain `/whiteboard-brainstorm <mode>` — the blocking wait
already makes it passive from the user's perspective.

## Tags the user can draw

| Tag prefix | Effect |
|---|---|
| `@idea <text>` | Marks a user idea. Picked up for mode-prompt context. |
| `@problem <text>` | Pain point / constraint. |
| `@q <text>` | Question for Claude. |
| `@pin <text>` | Pinned marker (persists across turns). |
| `@rewrite` on an AI element | Claude replaces that element next turn. |
| `@ping` | Equivalent to clicking the button; also via Cmd/Ctrl+Enter. |
| `@drop` | Pins the AI drop-zone at that text's position. |

## Browser keyboard shortcuts

- `Cmd+Enter` / `Ctrl+Enter` — ping the AI.
- `T` — toggle the Tidy menu.
- `S` — sweep archived (dimmed) AI elements.

All letter shortcuts are suppressed while the user is editing text.

## Scrubber + Tidy + Sweep

- The scrubber pill row (top-right) lists every board version. Click a
  pill to preview; click "live" to return.
- **Tidy** → column/grid layout over AI or all elements. Writes a new
  version for easy undo.
- **Sweep** (appears only when archived elements exist, after an AI
  restructure turn) → removes dimmed elements permanently.
- **Undo dim** (also appears then) → restores archived elements to
  their full-opacity state without deleting anything.

## End of session

When the user says "done" / "finish" / closes the browser:

1. Stop the server:
   ```
   <plugin>/server/stop-board-server.sh <sessionDir>
   ```
2. Optionally export a PNG snapshot:
   ```
   node <plugin>/bin/wbb.js export-png <slug>
   ```

## Resume

If user invokes `/whiteboard-brainstorm resume <slug>`:

1. Compute session dir: `node <plugin>/bin/wbb.js session-dir <slug>`.
2. Verify `latest.excalidraw.json` exists.
3. Start the server on that dir. Resume turn loop.

## Error recovery

- Invalid AI output: `wbb build-scene` fails → retry once with tighter
  prompt. Still fails → tell the user in terminal and skip the AI write.
- Scene corrupted: `wbb validate` exits non-zero → serve previous
  version, log to `.state/edit-log.jsonl`.
- Port conflict: server auto-sweeps range `50000-59999`.
- Browser closed: harmless. Next turn pushes new scene; reconnect
  fetches latest.

## Export a session to PNG

At any time during or after a session:

    node <plugin>/bin/wbb.js export-png <slug> [out-path]

Default output path: `<sessionDir>/latest.png`. Requires Playwright
chromium installed (`npx playwright install chromium`).

## Configuration

- `WBB_ROOT` — override the store root. Default
  `~/Documents/Whiteboard-Brainstorm/`.
- `--root <path>` — per-command override on any wbb subcommand.
