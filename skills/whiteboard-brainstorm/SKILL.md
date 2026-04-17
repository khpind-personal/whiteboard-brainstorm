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

## Start of session

1. Resolve vault root: `WHITEBOARD_VAULT_PATH` env var, else
   `~/Documents/Whiteboard-Brainstorm-Vault`.
2. Scaffold vault if missing:
   ```
   node ~/.claude/plugins/whiteboard-brainstorm/bin/wbb.js vault-init <vault-root>
   ```
3. Create a new board session:
   ```
   node ~/.claude/plugins/whiteboard-brainstorm/bin/wbb.js new-board \
       <vault-root> <mode> <template-path> "<topic>"
   ```
   Template path:
   - `preimpl` → `<plugin>/skills/whiteboard-brainstorm/templates/preimpl/purpose-constraints.excalidraw.json`
   - `general` → `<plugin>/skills/whiteboard-brainstorm/templates/general/blank-with-ping.excalidraw.json`
   - `mindmap` → `<plugin>/skills/whiteboard-brainstorm/templates/mindmap/center-node.excalidraw.json`

   Capture the returned `slug` and `boardPath`.

4. Create session dir for server:
   ```
   mkdir -p <vault-root>/_state/<slug>/content
   cp <boardPath> <vault-root>/_state/<slug>/content/latest.excalidraw.json
   ```
5. Start the server (pass `--vault-root` + `--slug` so the history scrubber can
   list versioned boards from the vault):
   ```
   <plugin>/server/start-board-server.sh <vault-root>/_state/<slug> \
       --vault-root <vault-root> --slug <slug>
   ```
   The script prints JSON with `url` and the session `mode`. Share the URL with
   the user AND the terminal-continue instruction:

   "Canvas live at <url>?mode=<mode>. Draw freely. Tag text with @idea / @problem / @q.
   Click the @ping button (or write `@ping` in a text element) when you want me
   to respond. **After pinging, come back to this terminal and press Enter** —
   I don't watch the canvas live; I respond on the next terminal turn."

## Turn loop (each user turn)

1. **Check server alive.** If `<session>/state/server-info` is missing or
   `<session>/state/server-stopped` exists, restart the server and re-load the
   latest board.
2. **Read events:** `cat <session>/state/events.jsonl` (if empty and the user
   just typed in terminal, that's fine; treat their text as the ping message).

   **Note on trigger sources.** The user can click the `@ping` button OR place a
   text element on the canvas containing `@ping`. Both produce a `ping` event in
   `events.jsonl`. Events with `source: 'drawn-shape'` were triggered by a drawn
   text element; check `elementId` to see which one.

3. **Read the latest scene:** `cat <session>/content/latest.excalidraw.json`.
4. **Parse tags:**
   ```
   node <plugin>/bin/wbb.js parse-tags <session>/content/latest.excalidraw.json
   ```
5. **Load the mode prompt:** read `<plugin>/skills/whiteboard-brainstorm/modes/<mode>.md`.
   Substitute `{user_scene}` and `{events}` with the content from steps 2–3.
6. **Produce a response spec** (JSON array of shape specs — see mode file for
   allowed kinds). Max 4 shapes per turn.
7. **Build AI elements.** Pass the user scene so `near: <elId>` specs are
   placed next to their referenced element with collision avoidance:
   ```
   echo '<spec-json>' | node <plugin>/bin/wbb.js build-scene \
       --scene <session>/content/latest.excalidraw.json > /tmp/ai-elements.json
   ```
8. **Merge into scene:**
   ```
   node <plugin>/bin/wbb.js merge \
       <session>/content/latest.excalidraw.json \
       /tmp/ai-elements.json <turn> > /tmp/merged.json
   ```
9. **Write a new version to the vault:**
   ```
   node <plugin>/bin/wbb.js write-version <vault-root> <slug> <turn> /tmp/merged.json
   ```
   Copy it into the active session dir too so the server + browser see it:
   ```
   cp <vault-root>/20-Canvases/<slug>/board-v<turn>.excalidraw.json \
      <session>/content/latest.excalidraw.json
   ```
10. **Clear the events file** so the next turn starts clean:
    ```
    : > <session>/state/events.jsonl
    ```
11. **Reply in terminal** with a one-line summary of the shapes you pushed.
    Remind the user the URL is still live and to ping again when ready for the
    next turn. Do NOT auto-loop — wait for the next terminal turn from the user.

### Auto-poll option (dynamic loop)

If the user invoked the skill via `/loop /whiteboard-brainstorm <mode> [topic]`
(dynamic mode), you may call `ScheduleWakeup` at the end of each turn with
`delaySeconds: 60` to poll `events.jsonl` for new pings without requiring the
user to press Enter. On wake: read events; if new ping, run the turn loop; if
not, reschedule. Keep polling until the user stops the loop.

Otherwise (no `/loop` wrapper), wait for the user to return to terminal and
press Enter to trigger the next turn.

## End of session

When the user says "done" / "finish" / closes the browser:

1. Append a MOC entry:
   ```
   node <plugin>/bin/wbb.js moc-append <vault-root> <slug> <mode> <N> "<topic>"
   ```
2. Stop the server:
   ```
   <plugin>/server/stop-board-server.sh <vault-root>/_state/<slug>
   ```

## Resume

If user invokes `/whiteboard-brainstorm resume <slug>`:

1. Resolve vault root.
2. Restore session dir content from the vault:
   ```
   mkdir -p <vault-root>/_state/<slug>/content
   cp <vault-root>/20-Canvases/<slug>/latest.excalidraw.json \
      <vault-root>/_state/<slug>/content/latest.excalidraw.json
   ```
3. Start server. Resume turn loop.

## Error recovery

- Invalid AI output: `wbb build-scene` fails → retry once with tighter prompt. Still fails → tell the user in terminal and skip the AI write.
- Scene corrupted: `wbb validate` exits non-zero → serve previous version, log to `state/edit-log.jsonl`.
- Port conflict: server auto-sweeps range `50000-59999`.
- Browser closed: harmless. Next turn pushes new scene; reconnect fetches latest.

## Export a session to PNG

At any time during or after a session:

    node <plugin>/bin/wbb.js export-png <vault-root> <slug> [out-path]

Default output path: `<vault>/20-Canvases/<slug>/latest.png`. Requires Playwright
chromium installed (`npx playwright install chromium`).
