# AI Chat — Build Presentations by Describing Them

> **Status:** Phase 0 complete · Phase 1 complete (unverified against the live API) · Phase 2 next · **Last updated:** 2026-08-08
>
> Living document — update statuses and check items off as we progress.
>
> **Where things stand:** the chat panel is wired into the editor and the full
> loop is implemented — the model can search the sprite catalogue and place
> sprites and text on the current frame. **It has never made a real API call:**
> `ANTHROPIC_API_KEY` is not set in `.env`, so the route returns 503 until it is.
> Everything below the API boundary (prompt assembly, tool schemas, executor
> error handling, reducer behaviour) is covered by checks; the request shape
> itself is only typechecked against the SDK, not exercised.

## Context

DrawCells presentations are built by dragging sprites from a catalogue of
several hundred scientific illustrations onto a Konva canvas, one frame at a
time, with motion derived between adjacent frames. That is precise but slow, and
it requires knowing the catalogue well enough to find the right sprite.

The goal is to let a user describe a frame — "a neuron in the middle, labelled" —
and have it built for them, without taking control away: every AI edit is an
ordinary store mutation, so it appears live on the canvas, is undoable, and
autosaves through the existing path.

## The core decision

**The model calls the app's existing Redux actions; it does not write frames JSON.**

The action creators in `src/Frames/actions/index.ts` were already almost exactly
the right granularity for a tool surface. Routing the model through them rather
than having it emit a `frames` document buys three things for free:

- **Animation stays correct.** `computeNewFrames` runs on every mutation, so the
  derived `animationProps` between adjacent frames are recomputed. A model
  writing raw JSON would produce stale motion data.
- **Undo works.** The new action types are registered in `TRACKED_ACTIONS`.
- **Autosave works.** The existing effect in `AnimationCanvas` fires on frame
  changes; nothing AI-specific was needed.

## Architecture

The loop runs **in the browser**, because that is where the store is. The server
route exists to hold the API key and to own the system prompt and tool
definitions — neither of which the client may supply.

```
Browser (owns the Redux store)          Server (owns the API key)
  │                                       │
  ├─ POST /api/chat ─────────────────────►│  auth → beta.messages.create(
  │   { messages, presentationState }     │      system + tools + fallbacks )
  │◄──────────── content, stop_reason ────┤
  ├─ dispatch each tool_use into store    │
  ├─ append ALL tool_results as ONE msg ─►│  (repeat until stop_reason ≠ tool_use)
```

The alternative — a server-side loop mutating a JSON copy and returning the whole
`frames` array — is easier to write (the SDK's tool runner would drive it) but
loses live canvas feedback, collides with concurrent user edits, and needs a
`RECOMPUTE_FRAMES` afterwards to repair animation. Rejected.

### Where state goes in the prompt

| Content | Where | Why |
|---|---|---|
| Role, canvas geometry, placement rules, projection format | `system`, with `cache_control` | Static. Renders first, carries the cache breakpoint, read on every later turn. |
| Conversation + tool results | `messages` | Grows; sits behind the cached prefix. |
| Current canvas state | trailing `{role:"system"}` message | Changes every iteration. Appended **last** so it cannot invalidate the cached prefix — rebuilding the system prompt each turn would re-bill it. |

The state projection is re-rendered on **every loop iteration**, not captured
once per turn, so the model sees its own edits and anything the user changed
mid-turn.

## Model configuration

| Setting | Value | Note |
|---|---|---|
| Model | `claude-opus-5` | |
| `max_tokens` | 16000 | Shared with adaptive thinking; non-streaming is fine at this size. |
| Thinking | adaptive (default) | On by default on Opus 5; not set explicitly. |
| `fallbacks` | `"default"` (beta `server-side-fallback-2026-07-01`) | Life-sciences wording occasionally trips safety classifiers. Re-runs server-side on Anthropic's recommended fallback instead of failing the turn. `stop_reason: "refusal"` is checked **before** reading `content`, which can be empty. |
| Prompt caching | one breakpoint on the system block | Tools + system cache together; system prompt is ~2.7k chars, above the 512-token minimum. |

## Phases

### Phase 0 — Prerequisites (done)

Sprite mutations used to resolve their target through `state.currentSprites` —
the user's selection — so any caller that wasn't the properties sidebar had to
hijack the selection to edit a sprite. That was the blocker.

- [x] Replace every selection-scoped mutation with an id-addressed one.
      `UPDATE_SPRITES` (a list of per-sprite patches) is now the single editing
      primitive, with `updateSpriteById` / `updateSpritesByIds` as sugar; plus
      `removeSpritesByIds`, `removeSpritesByIdsFromAllFrames`,
      `copySpritesIntoFrame`, `groupSpritesByIds`, `ungroupSpritesByIds`,
      `sendSpritesToBack`, `bringSpritesToFront`.
      Selection and navigation actions are unchanged.
- [x] Delete dead actions found during the sweep: `UPDATE_SPRITE`,
      `UPDATE_CURRENT_SPRITE_POSITION`, `REMOVE_SPRITE`,
      `REMOVE_SPRITE_FROM_ALL_FRAMES`, `COPY_SPRITE_INTO_FRAME`.
- [x] `addSpriteAndGetId` (`src/Ai/dispatch.ts`) — the reducer is the sole id
      authority and the action creator returns nothing, so the id is recovered by
      diffing the sprite list.
- [x] State projection (`src/Ai/stateProjection.ts`) — compact text rendering
      that strips `preview` (base64 thumbnails) and `animationProps` (a CHAOTIC
      sprite's is a 30-point array), omits fields at their defaults, and
      addresses sprites by **8-character handles** instead of full UUIDs.
      `resolveSpriteHandle` maps them back, accepting full ids too.

Side effects worth knowing (all improvements, all user-visible):

- Multi-select drag and resize are now **one** undo step. Both dispatched once
  per sprite before, so undo moved them back one at a time.
- Send-to-back no longer reverses the relative order of the moved sprites.
- Ungrouping via one member now dissolves the whole group.

### Phase 1 — Vertical slice (done, unverified live)

Target: *"add a neuron in the middle and label it"* works end to end.

- [x] `app/api/chat/route.ts` — authenticated proxy (`getSessionUser`), owns the
      system prompt and tool definitions, appends the trailing state message,
      handles refusals and rate limits.
- [x] `src/Ai/tools.ts` — `search_sprites`, `add_sprite`, `add_text`.
- [x] `src/Ai/systemPrompt.ts` — canvas geometry from the real constants,
      placement guidance, embedded projection-format guide.
- [x] `src/Ai/executor.ts` — dispatches tool calls into the store. Mirrors the
      drag-and-drop sizing path, sizes text boxes from content, clamps
      coordinates to the canvas, and **returns errors as tool results rather
      than throwing** so the model can recover instead of aborting the turn.
- [x] `src/Ai/useAiChat.ts` — the loop. Caps at 12 iterations, re-projects state
      each iteration, returns all tool results in a **single** user message.
- [x] `src/Ai/components/ChatPanel.tsx` — a resizable card docked beside the
      editor, opened from the header's "Build with AI" button (`isAiChatOpen` in
      the sidebars reducer). Opening it switches the editor into a card layout on
      a dark page; closed, the editor is full-bleed as before. The panel stays
      mounted while closed so the conversation survives reopening.
- [ ] **Run it against the live API.** Needs `ANTHROPIC_API_KEY` (see Setup).

### Phase 2 — Full tool surface

- [ ] `move_sprite`, `resize_sprite`, `style_text`, `delete_sprites` → the
      id-addressed actions from Phase 0.
- [ ] `set_animation` (type, duration, and the CHAOTIC/CIRCULAR parameters) —
      the app's actual differentiator, and untouched so far.
- [ ] Frames: `add_frame`, `switch_frame`, `copy_sprites_to_frame`,
      `set_frame_background`.
- [ ] Grouping and z-order.
- [ ] Sprite `variants` — the catalogue has them; Phase 1 ignores them.
- [ ] Consider persisting the catalogue **name** on AI-added sprites. Sprites
      store only `backgroundUrl`, so the projection currently derives labels from
      the filename ("corona virus" from `corona-virus.svg`). Workable, but a
      stored name would read better across long conversations. Changes the
      persisted sprite shape.
- Target: *"make a 3-frame animation of a virus entering a cell."*

### Phase 3 — Production quality

- [ ] **Streaming** (`client.beta.messages.stream`) — for the typing indicator,
      not for timeout headroom.
- [ ] **Undo grouping** — one AI turn should be one undo step. It is currently
      one per tool call, which is better than it was but still not right.
- [ ] **Concurrency** — the user can drag a sprite mid-turn. Either lock canvas
      interaction while busy or accept last-write-wins; the projection is already
      re-read per iteration, which is the load-bearing half.
- [ ] Cost/latency telemetry from `usage` (already returned by the route),
      including cache hit rate. If `cache_read_input_tokens` is 0 across turns,
      something is invalidating the prefix.
- [ ] Sweep `output_config.effort` — `low`/`medium` are strong on Opus 5 and this
      is a many-small-tool-calls workload.

### Phase 4 — Evals + guardrails

- [ ] A dozen fixed prompts asserted against the resulting `frames` array.
      Without this there is no way to tell whether a prompt change helped.
- [ ] Log every `search_sprites` call that returns nothing — that log is the
      tag-curation backlog.
- [ ] Per-user rate limiting on `/api/chat`.
- [ ] Confirmation for destructive operations once Phase 2 adds them.

## Setup

The chat is inert until an API key is present:

```
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Without it `/api/chat` returns **503** with an explanatory message rather than
failing opaquely. `@anthropic-ai/sdk` is a runtime dependency; it is imported
only by the route, never by client code.

## Risks

| Risk | Mitigation |
|---|---|
| **Sprite retrieval quality** — the feature is only as good as `search_sprites`. A miss reads as "the AI is broken". | The tool description forbids inventing an `image_url` and pushes toward broader terms on a miss. Phase 4 logs empty searches as a tag backlog. |
| **Spatial reasoning** — models are mediocre at "arrange six things without overlap". | System prompt carries explicit margin/spacing/label-offset rules. If that proves insufficient, add a `layout` tool (grid/row/circle) rather than expecting per-sprite coordinate maths. |
| **Cost per turn** — the projection is re-sent every iteration. | Prompt caching on the static prefix; 8-char handles instead of 36-char UUIDs; search results capped at 8; frames outside the current one and its neighbours collapse to a summary line. |
| **Runaway loops** — a confused model spawning 200 sprites. | 12-iteration cap client-side; `max_tokens` bound server-side. |
| **Prompt injection** via presentation content (sprite names, text sprites) landing in the projection. | System prompt and tool definitions are server-owned; the client cannot supply them. Canvas state rides in an operator-authority `system` message rather than being interpolated into instructions. Worth revisiting in Phase 2 when the tool surface can delete and overwrite. |

## Verification

No test runner is configured in this repo (`@types/jest` is present, but jest is
not installed and there is no `test` script), so the checks below live as
scratchpad scripts driving the real reducer and executor. **Worth promoting to a
real suite** — see Phase 4.

- Reducer: batch update = one undo entry reverting all N; per-sprite differing
  fields in one dispatch; `positionX/Y` coercion (sidebar strings vs canvas
  floats); editing an unselected sprite leaves the selection alone; remove from
  frame vs all frames; `currentFrame` staying object-identical with its entry in
  `frames`; grouping needing 2+; z-order preserving relative order.
- Projection: excludes base64 and derived motion data; omits defaults; handles
  resolve from short form, full id, and report not-found.
- Phase 1: system prompt assembles with real constants; tool schemas well formed
  with every parameter documented; `search_sprites` hits the real endpoint, caps
  and reports truncation, encodes queries; executor errors always return as tool
  results and never throw.
