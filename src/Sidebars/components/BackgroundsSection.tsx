import { Box, Button, CircularProgress, Typography } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { setCurrentFrameBackground } from "../../Frames/actions";
import { loadBackgrounds } from "../actions";
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from "../../constants";

const SCROLL_ID = "backgrounds-scroll";

// Tiles use the viewport's aspect ratio (backgrounds are stretched to fill it),
// so each tile previews the result and has a fixed height before its image loads.
const tileSx = (selected: boolean) => ({
  width: "100%",
  aspectRatio: `${VIEWPORT_WIDTH} / ${VIEWPORT_HEIGHT}`,
  borderRadius: 1,
  overflow: "hidden",
  cursor: "pointer",
  outline: "2px solid",
  outlineColor: selected ? "primary.main" : "transparent",
  outlineOffset: 2,
});

function BackgroundsSection({ active }: { active: boolean }) {
  const dispatch = useDispatch();
  const backgrounds = useSelector((state: State) => state.sidebars.backgrounds);
  const currentBackground = useSelector(
    (state: State) => state.frames.currentFrame.backgroundUrl,
  );

  const inFlightRef = useRef(false);
  const [error, setError] = useState(false);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || backgrounds.hasEnded) return;
    inFlightRef.current = true;
    setError(false);
    try {
      const params = new URLSearchParams({
        prefix: "backgrounds/",
        maxResults: "20",
      });
      if (backgrounds.nextPageToken) {
        params.set("pageToken", backgrounds.nextPageToken);
      }

      const res = await fetch(`/api/storage?${params}`);
      if (!res.ok) throw new Error(`Listing backgrounds failed: ${res.status}`);
      const data = await res.json();

      dispatch(
        loadBackgrounds({
          backgrounds: data.files || [],
          nextPageToken: data.nextPageToken ?? null,
        }),
      );
    } catch (err) {
      console.error(err);
      setError(true);
    } finally {
      inFlightRef.current = false;
    }
  }, [dispatch, backgrounds.hasEnded, backgrounds.nextPageToken]);

  // InfiniteScroll only asks for more on scroll, so load while the panel is
  // open and the list is too short to scroll: the first page, plus more on tall
  // screens. A remounted sidebar resumes from the stored page token.
  useEffect(() => {
    if (!active || error || backgrounds.hasEnded) return;
    const el = document.getElementById(SCROLL_ID);
    if (el && el.scrollHeight <= el.clientHeight) loadMore();
  }, [active, error, backgrounds.hasEnded, backgrounds.list.length, loadMore]);

  const handleFrameBackground = (path: string | undefined) => {
    dispatch(setCurrentFrameBackground(path));
  };

  return (
    <Box id={SCROLL_ID} sx={{ height: "100%", overflowY: "auto" }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 1 }}>
        Background Images
      </Typography>
      <InfiniteScroll
        dataLength={backgrounds.list.length}
        next={loadMore}
        hasMore={!backgrounds.hasEnded && !error}
        loader={
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        }
        scrollableTarget={SCROLL_ID}
      >
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 2,
            px: 2,
            py: 1,
          }}
        >
          <Box
            onClick={() => handleFrameBackground(undefined)}
            sx={{
              ...tileSx(!currentBackground),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px dashed",
              borderColor: "divider",
              bgcolor: "#fff",
            }}
          >
            <Typography variant="caption" color="text.secondary">
              None
            </Typography>
          </Box>
          {backgrounds.list.map((bg: any) => (
            <Box
              key={bg.path}
              onClick={() => handleFrameBackground(bg.path)}
              sx={tileSx(currentBackground === bg.path)}
            >
              <img
                src={bg.thumbUrl || bg.url}
                alt={bg.path}
                loading="lazy"
                decoding="async"
                // No thumbnail generated yet: fall back to the full image.
                onError={(e) => {
                  if (e.currentTarget.src !== bg.url) {
                    e.currentTarget.src = bg.url;
                  }
                }}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "fill",
                  display: "block",
                }}
              />
            </Box>
          ))}
        </Box>
      </InfiniteScroll>
      {error && (
        <Box sx={{ textAlign: "center", py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Couldn&apos;t load backgrounds.
          </Typography>
          <Button size="small" variant="outlined" onClick={loadMore}>
            Retry
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default BackgroundsSection;
