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
5. Start the server:
   ```
   <plugin>/server/start-board-server.sh <vault-root>/_state/<slug>
   ```
   The script prints JSON with `url`. Share the URL with the user:
   "Canvas live at <url>. Draw freely. Tag text with @idea / @problem / @q.
   Click @ping when you want me to respond."

## Turn loop (each user turn)

1. **Check server alive.** If `<session>/state/server-info` is missing or
   `<session>/state/server-stopped` exists, restart the server and re-load the
   latest board.
2. **Read events:** `cat <session>/state/events.jsonl` (if empty and the user
   just typed in terminal, that's fine; treat their text as the ping message).
3. **Read the latest scene:** `cat <session>/content/latest.excalidraw.json`.
4. **Parse tags:**
   ```
   node <plugin>/bin/wbb.js parse-tags <session>/content/latest.excalidraw.json
   ```
5. **Load the mode prompt:** read `<plugin>/skills/whiteboard-brainstorm/modes/<mode>.md`.
   Substitute `{user_scene}` and `{events}` with the content from steps 2–3.
6. **Produce a response spec** (JSON array of shape specs — see mode file for
   allowed kinds). Max 4 shapes per turn.
7. **Build AI elements:**
   ```
   echo '<spec-json>' | node <plugin>/bin/wbb.js build-scene > /tmp/ai-elements.json
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
    Remind the user the URL is still live.

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
