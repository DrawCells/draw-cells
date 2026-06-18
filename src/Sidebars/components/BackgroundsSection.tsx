import { Box, CircularProgress, Typography } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { setCurrentFrameBackground } from "../../Frames/actions";
import { loadBackgrounds } from "../actions";

function BackgroundsSection({ active }: { active: boolean }) {
  const dispatch = useDispatch();
  const backgrounds = useSelector((state: State) => state.sidebars.backgrounds);

  const pageTokens = useRef<(string | undefined)[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const [page, setPage] = useState<number>(0);

  useEffect(() => {
    if (
      !active ||
      backgrounds.hasEnded ||
      (hasLoadedOnceRef.current && page === 0)
    )
      return;

    const getBg = async () => {
      if (page === 0) {
        hasLoadedOnceRef.current = true;
      }
      const currentToken = pageTokens.current?.shift();
      const params = new URLSearchParams({
        prefix: "backgrounds",
        maxResults: "20",
      });
      if (currentToken) params.set("pageToken", currentToken);

      const res = await fetch(`/api/storage?${params}`);
      const data = await res.json();

      pageTokens.current?.push(data.nextPageToken);
      dispatch(
        loadBackgrounds({
          backgrounds: data.files || [],
          hasEnded: !data.nextPageToken,
        }),
      );
    };

    getBg();
  }, [active, dispatch, page, backgrounds.hasEnded]);

  const handleNext = () => {
    setPage(page + 1);
  };

  const handleFrameBackground = (path: string) => {
    dispatch(setCurrentFrameBackground(path));
  };

  return (
    <Box id="backgrounds-scroll" sx={{ height: "100%", overflowY: "auto" }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 1 }}>
        Background Images
      </Typography>
      <InfiniteScroll
        dataLength={backgrounds.list.length}
        next={handleNext}
        hasMore={!backgrounds?.hasEnded}
        loader={
          <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        }
        scrollableTarget="backgrounds-scroll"
      >
        <Box
          sx={{
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            px: 1,
          }}
        >
          {backgrounds?.list?.map((bg: any, index: number) => (
            <div
              key={`bg-image-${index}`}
              onClick={() => handleFrameBackground(bg.path)}
              style={{
                width: "100%",
                display: "flex",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <img src={bg.url} alt={bg.path} style={{ width: "90%" }} />
            </div>
          ))}
        </Box>
      </InfiniteScroll>
    </Box>
  );
}

export default BackgroundsSection;
