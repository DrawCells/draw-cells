# AI Chat — Build Presentations by Describing Them

> **Status:** Phase 0 complete · Phase 1 complete · Phase 2 complete · Phase 3 mostly done (streaming deferred, effort sweep waits on Phase 4 evals) · **Last updated:** 2026-10-09
>
> Living document — update statuses and check items off as we progress.
>
> **Where things stand:** Phase 1 (search, place sprites and text) works in
> real use. Phase 2 adds the rest of the editing surface — move/resize/restyle,
> delete, animation, frames, z-order, grouping, variants, backgrounds — and is
> covered by a scratchpad script driving the real reducer and executor, but has
> not yet been exercised by the model end to end.

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

### Phase 1 — Vertical slice (done)

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
- [x] **Run it against the live API.** Search and placement work in real use.

### Phase 2 — Full tool surface (done)

Target: *"make a 3-frame animation of a virus entering a cell."*

- [x] Editing → `update_sprites` (move / resize / rotate / opacity / text /
      font size / colour, many sprites per call) and `delete_sprites` (current
      frame or `from_all_frames`). **One tool instead of the four planned**
      (`move_sprite`, `resize_sprite`, `style_text`): a rearrangement touches
      several sprites at once, and one call is one `UPDATE_SPRITES` — one
      recompute, one undo step. Giving an image only `width` or `height` keeps
      its aspect ratio; changing a text sprite's wording or size refits its box.
- [x] `set_animation` — type, duration, CHAOTIC range/iterations, CIRCULAR arc
      angle/direction, clamped to the properties sidebar's ranges. Set on the
      sprite in the **earlier** frame, because that is what playback reads.
      Warns when a sprite has no twin in the next frame (nothing will move).
- [x] Frames: `add_frame` (inserts after current; copies sprites with their ids
      by default — the sidebar's "clone"), `switch_frame` (handle or 1-based
      number), `copy_sprites_to_frame`, `list_backgrounds` +
      `set_frame_background` (clear with `''`).
- [x] `arrange_sprites` (front/back), `group_sprites`, `ungroup_sprites`.
- [x] Sprite `variants` — search rows list them; `add_sprite` takes `variant`.
      The executor keeps an index of search results by `image_url` to rebuild
      the variant's storage key, since variant and base names can both contain
      `" - "`.
- [x] Persist the catalogue **name** on AI-added image sprites (`name?` on
      `ImageSprite`, optional and additive). The projection prefers it over the
      filename-derived label.
- [x] Every sprite tool checks handles against the current frame up front and
      fails the **whole** call with "it is on frame N, call switch_frame"
      otherwise — the reducer cases silently ignore off-frame ids, which would
      read to the model as success.
- [x] System prompt: "Editing" and "Animation" sections explaining that motion
      comes from the same handle in adjacent frames.
- [x] Client iteration cap 12 → 20, sized for a multi-frame build.
- [x] Reducer fix, `COPY_SPRITES_INTO_FRAME` (also used by the canvas context
      menu): now recomputes motion — it didn't, so copied sprites didn't animate
      until some later edit — and skips sprites the target already has instead
      of duplicating an id within a frame.
- [x] **Run the target prompt against the live API.** The 3-frame build ran; it surfaced the video-export bugs fixed separately (last frame missing, captions clipped mid-transition).

Known issues found along the way, not yet fixed (both are covered by
[the animation refactor plan](animation-refactor-plan.md), a separate PR):

- **Playback direction uses `parseInt` on frame ids** (`AnimationSprite.jsx`,
  `crtFrameId > prevFrameId`). Ids are UUIDs, so this compares `NaN`s or a
  leading hex digit, and forward/reverse is effectively arbitrary — including
  whether the earlier frame's `animationType` / `duration` is the one used.
  This undermines `set_animation` directly; worth fixing before judging it.
- `computeNewFrames` computes the next frame's `reverseAnimationProps` on a
  clone it then discards, so reverse playback into an edited frame can be
  stale until a full recompute.

### Phase 3 — Production quality

- [x] **Undo grouping** — one AI turn is one undo step.
      `beginUndoGroup` / `endUndoGroup` bracket the turn in `useAiChat`; inside
      a group only the first change saves a snapshot. An undo or redo inside an
      open group re-arms it, so later edits still have a way back. Side effect
      for everyone: a tracked action whose reducer case returns `state`
      untouched no longer leaves an empty undo entry.
- [x] **Concurrency** — chose locking over last-write-wins. `isAiBusy` (sidebars
      reducer) puts a veil over the editor workspace — canvas, sidebars,
      drag-and-drop — and disables undo/redo and the group shortcuts while a
      turn runs. Without it, a user edit mid-turn would also fold into the
      turn's undo step. The chat panel stays outside the veil so Stop works.
- [x] **Cost/latency telemetry** — the route logs one `ai_chat_request` JSON
      line per model request: user, `turnId` + `iteration` (sent by the
      client), model, whether the fallback ran, stop reason, latency, token
      counts, and `cacheHitRate`. From iteration 1 onward the hit rate should be
      high; near 0 means the prefix is being invalidated.
- [ ] **Streaming** — deferred. Only buys a typing indicator, and changes the
      route's response protocol (plus mid-stream fallback handling).
- [ ] Sweep `output_config.effort` — `low`/`medium` may be faster and cheaper
      for this many-small-tool-calls workload. Needs the Phase 4 evals to judge.

### Phase 4 — Evals + guardrails

- [ ] A dozen fixed prompts asserted against the resulting `frames` array.
      Without this there is no way to tell whether a prompt change helped.
- [ ] Log every `search_sprites` call that returns nothing — that log is the
      tag-curation backlog.
- [x] **Per-user daily token limit** on `/api/chat` (`lib/aiUsage.ts`,
      `ai_usage_daily` + `record_ai_usage`, migration
      `20261009120100_ai_usage_daily`). Counted in
      input-token equivalents weighted by Opus 5 prices (output ×5, cache
      write ×1.25, cache read ×0.1) so it tracks cost; default 2M/day (≈ $10),
      override with `AI_DAILY_TOKEN_LIMIT`. Checked before every request —
      a turn stops at the limit, and can overshoot it by one request. Fails
      closed if the usage table can't be read. Resets at midnight UTC.
      Revisit the weights if the model changes.
- [ ] Confirmation for destructive operations once Phase 2 adds them.

## Setup

The chat is inert until an API key is present:

```
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
```

Optionally, per environment:

```
AI_DAILY_TOKEN_LIMIT=250000   # input-equivalent tokens per user per day; default 2000000
```

The daily limit also needs the `20261009120100_ai_usage_daily` migration
applied to each Supabase project (see `supabase/README.md`) — until then every
chat request returns 503, because the limit check fails closed.

Without the API key `/api/chat` returns **503** with an explanatory message rather than
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
- Phase 2: variant lookup (including names containing " - ") and its error
  paths; `update_sprites` aspect ratio, clamping, text refit, all-or-nothing
  rejection, single undo entry; off-frame handles refused with the frame
  number; `set_animation` clamping and no-next-frame warning; `add_frame` id
  sharing and derived CHAOTIC path; copy-to-frame skip + recompute +
  `currentFrame` identity; delete current vs all frames; grouping, z-order,
  backgrounds.
- Phase 3: undo groups — a multi-frame turn undoes and redoes as one step; an
  empty turn records nothing; undo mid-group re-arms; ungrouped edits stay
  one step each.
- Phase 1: system prompt assembles with real constants; tool schemas well formed
  with every parameter documented; `search_sprites` hits the real endpoint, caps
  and reports truncation, encodes queries; executor errors always return as tool
  results and never throw.
