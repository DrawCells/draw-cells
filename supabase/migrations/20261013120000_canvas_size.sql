-- ---------------------------------------------------------------------------
-- Per-presentation canvas size, in canvas units (exports render at 2x). Every
-- existing presentation was drawn on the old fixed 810x540 viewport, so that is
-- the default. Bounds mirror CANVAS_MIN_SIZE / CANVAS_MAX_SIZE in
-- src/constants.tsx.
-- ---------------------------------------------------------------------------
alter table presentations
  add column if not exists canvas_width integer not null default 810
    check (canvas_width between 100 and 2000),
  add column if not exists canvas_height integer not null default 540
    check (canvas_height between 100 and 2000);
