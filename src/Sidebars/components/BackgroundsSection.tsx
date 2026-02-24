import {
  Accordion,
  AccordionSummary,
  Box,
  CircularProgress,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfiniteScroll from "react-infinite-scroll-component";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { setCurrentFrameBackground } from "../../Frames/actions";
import { loadBackgrounds } from "../actions";

function BackgroundsSection() {
  const dispatch = useDispatch();
  const backgrounds = useSelector((state: State) => state.sidebars.backgrounds);
  const isSpritesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isSpritesOpen,
  );

  const pageTokens = useRef<(string | undefined)[]>([]);
  const hasLoadedOnceRef = useRef(false);
  const [page, setPage] = useState<number>(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (
      !isSpritesSidebarOpen ||
      !isExpanded ||
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
        maxResults: "10",
      });
      if (currentToken) params.set("pageToken", currentToken);

      const res = await fetch(`/api/storage?${params}`);
      const data = await res.json();

      pageTokens.current?.push(data.nextPageToken);
      dispatch(
        loadBackgrounds({
          backgrounds: data.urls || [],
          hasEnded: !data.nextPageToken,
        }),
      );
    };

    getBg();
  }, [isSpritesSidebarOpen, isExpanded, dispatch, page]);

  const handleNext = () => {
    setPage(page + 1);
  };

  const handleFrameBackground = (background: string) => {
    dispatch(setCurrentFrameBackground(background));
  };

  return (
    <Accordion
      expanded={isExpanded}
      onChange={(_, expanded) => setIsExpanded(expanded)}
      elevation={0}
      sx={{
        width: "100%",
        boxShadow: "none",
        "&.MuiPaper-rounded": { borderRadius: 0 },
      }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        Background Images
      </AccordionSummary>
      <InfiniteScroll
        dataLength={backgrounds.list.length} //This is important field to render the next data
        next={handleNext}
        hasMore={!backgrounds?.hasEnded}
        loader={<CircularProgress />}
        height={500}
      >
        <Box
          sx={{
            height: "100%",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {backgrounds?.list?.map((bg: any, index: number) => (
            <div
              key={`bg-image-${index}`}
              onClick={() => handleFrameBackground(bg)}
              style={{
                width: "100px",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <img src={bg} alt={bg} style={{ width: "90%" }} />
            </div>
          ))}
        </Box>
      </InfiniteScroll>
    </Accordion>
  );
}

export default BackgroundsSection;
