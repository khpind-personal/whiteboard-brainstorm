---
name: whiteboard-brainstorm
description: Bidirectional whiteboard brainstorming on an Excalidraw canvas. Use when the user invokes `/whiteboard-brainstorm` or asks to brainstorm visually, explore ideas on a canvas, or mindmap.
---

# Whiteboard Brainstorm

You orchestrate a bidirectional brainstorming session between the user and
yourself on an Excalidraw canvas. The user draws and writes; you respond with
shapes (stickies, mind-nodes, annotations, panels) on the same canvas.

## Invocation

User invokes: `/whiteboard-brainstorm <mode> [topic]`
Modes: `preimpl`, `general`, `mindmap`.

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

2. Start the server on the session dir:
   ```
   <plugin>/server/start-board-server.sh <sessionDir>
   ```
   Prints JSON with `url`. Share the URL with the user along with:

   > "Canvas live at <url>?mode=<mode>. Draw freely. Tag text with
   > @idea / @problem / @q. Click the @ping button (or write `@ping`
   > in a text element) when you want me to respond. **After pinging,
   > come back to this terminal and press Enter** — I don't watch the
   > canvas live; I respond on the next terminal turn."

## Turn loop (each user turn)

1. **Check server alive.** If `<sessionDir>/.state/server-info` is missing
   or `<sessionDir>/.state/server-stopped` exists, restart the server.
2. **Read events:** `cat <sessionDir>/.state/events.jsonl`. Empty? Treat
   the user's terminal text as the ping message.

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
9. **Write a new version.** This updates both `board-v<turn>.excalidraw.json`
   and `latest.excalidraw.json` in the session dir. The server's chokidar
   watcher sees the change and broadcasts an SSE refresh:
   ```
   node <plugin>/bin/wbb.js write-version <slug> <turn> /tmp/merged.json
   ```
10. **Clear the events file** so the next turn starts clean:
    ```
    : > <sessionDir>/.state/events.jsonl
    ```
11. **Reply in terminal** with a one-line summary of the shapes you
    pushed. Remind the user the URL is still live and to ping again
    when ready. Do NOT auto-loop — wait for the next terminal turn.

### Auto-poll option (dynamic loop)

If the user invoked the skill via `/loop /whiteboard-brainstorm <mode> [topic]`
(dynamic mode), you may call `ScheduleWakeup` at the end of each turn with
`delaySeconds: 60` to poll `events.jsonl` for new pings without requiring the
user to press Enter. On wake: read events; if new ping, run the turn loop;
if not, reschedule. Keep polling until the user stops the loop.

Otherwise (no `/loop` wrapper), wait for the user to return to terminal
and press Enter to trigger the next turn.

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
