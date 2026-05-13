import {
  Accordion,
  AccordionSummary,
  Box,
  CircularProgress,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfiniteScroll from "react-infinite-scroll-component";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  get,
  limitToFirst,
  orderByKey,
  query,
  ref,
  startAfter,
} from "firebase/database";
import { loadSprites } from "../actions";
import State from "../../stateInterface";
import { db } from "../../firebase-config";
import SidebarSpriteWithVariants from "../../Sprites/SidebarSpriteWithVariants";

interface SpriteInfo {
  id?: string;
  name: string;
  tags?: string[];
  baseImageUrl: string;
  previewImageUrl?: string;
  variants?: string[];
}

const PAGE_SIZE = 10;

async function resolveSpriteImageUrl(id: string, sprite: SpriteInfo): Promise<SpriteInfo> {
  let imageUrl = sprite.baseImageUrl;
  const firstVariant = sprite.variants?.[0];
  if (firstVariant) imageUrl = `${sprite.baseImageUrl} - ${firstVariant}`;
  if (imageUrl) {
    try {
      const res = await fetch(
        `/api/storage?path=${encodeURIComponent(`${imageUrl}.svg`)}`,
      );
      const data = await res.json();
      if (data.url) imageUrl = data.url;
    } catch (error) {
      console.error("Failed to load sprite URL", error);
    }
  }
  return {
    id,
    name: sprite.name,
    tags: Array.isArray(sprite.tags) ? sprite.tags : [],
    baseImageUrl: sprite.baseImageUrl,
    previewImageUrl: imageUrl,
    variants: Array.isArray(sprite.variants) ? sprite.variants : [],
  };
}

export default function SpritesSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SpriteInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dispatch = useDispatch();
  const sprites = useSelector((state: State) => state.sidebars.sprites);
  const isSpritesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isSpritesOpen,
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const hasLoadedOnceRef = useRef(false);
  const lastKeyRef = useRef<string | undefined>(undefined);
  const searchIdRef = useRef(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // When a search term is active, fetch all sprites from the database and filter locally.
  // Firebase RTDB doesn't support substring or multi-field queries, so client-side
  // filtering is applied after fetching all records.
  useEffect(() => {
    if (!debouncedSearchTerm || !isSpritesSidebarOpen || !isExpanded) {
      setSearchResults([]);
      return;
    }

    const currentId = ++searchIdRef.current;
    setIsSearching(true);

    const runSearch = async () => {
      const res = await get(ref(db, "sprites"));
      const data = (res.val() || {}) as Record<string, SpriteInfo>;
      const term = debouncedSearchTerm.toLowerCase();

      const matching = Object.entries(data).filter(([, sprite]) => {
        const nameMatch = sprite.name?.toLowerCase().includes(term);
        const tagsMatch = (sprite.tags || []).some((tag) =>
          tag.toLowerCase().includes(term),
        );
        return nameMatch || tagsMatch;
      });

      const list = await Promise.all(
        matching.map(([id, sprite]) => resolveSpriteImageUrl(id, sprite)),
      );

      if (currentId !== searchIdRef.current) return;
      setSearchResults(list);
      setIsSearching(false);
    };

    runSearch();
  }, [debouncedSearchTerm, isSpritesSidebarOpen, isExpanded]);

  // Paginated fetch — only runs when there is no active search term.
  useEffect(() => {
    if (
      debouncedSearchTerm ||
      !isSpritesSidebarOpen ||
      !isExpanded ||
      sprites.hasEnded ||
      (hasLoadedOnceRef.current && page === 0)
    ) {
      return;
    }

    const getSprites = async () => {
      if (page === 0) hasLoadedOnceRef.current = true;

      const spriteQuery = lastKeyRef.current
        ? query(
            ref(db, "sprites"),
            orderByKey(),
            startAfter(lastKeyRef.current),
            limitToFirst(PAGE_SIZE),
          )
        : query(ref(db, "sprites"), orderByKey(), limitToFirst(PAGE_SIZE));

      const res = await get(spriteQuery);
      const data = (res.val() || {}) as Record<string, SpriteInfo>;
      const entries = Object.entries(data);

      if (entries.length > 0) {
        lastKeyRef.current = entries[entries.length - 1][0];
      }

      const list = await Promise.all(
        entries.map(([id, sprite]) => resolveSpriteImageUrl(id, sprite)),
      );

      dispatch(
        loadSprites({ sprites: list, hasEnded: entries.length < PAGE_SIZE }),
      );
    };

    getSprites();
  }, [dispatch, isSpritesSidebarOpen, isExpanded, sprites.hasEnded, page, debouncedSearchTerm]);

  const handleNext = () => setPage((prev) => prev + 1);

  const displaySprites = debouncedSearchTerm ? searchResults : sprites.list;
  const hasMore = !debouncedSearchTerm && !sprites.hasEnded;

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
      <AccordionSummary
        expandIcon={<ExpandMoreIcon />}
        sx={{
          "&.Mui-expanded": { minHeight: "48px" },
          "& .MuiAccordionSummary-content": {
            margin: 0,
          },
        }}
      >
        Sprites
      </AccordionSummary>
      <Box>
        <Box sx={{ pl: 2, mb: 1 }}>
          <TextField
            fullWidth
            variant="outlined"
            placeholder="Search Sprites"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoComplete="off"
            sx={{
              "& .MuiInputBase-input": {
                fontSize: 13,
                py: 1,
                px: 2,
              },
            }}
          />
        </Box>
        <InfiniteScroll
          dataLength={displaySprites.length}
          next={handleNext}
          hasMore={hasMore}
          loader={null}
          height={400}
        >
          <Box
            sx={{
              width: "100%",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              alignItems: "center",
            }}
          >
            {displaySprites.map((sprite, i) => (
              <SidebarSpriteWithVariants
                key={sprite.id ?? `sprite-${i}`}
                name={sprite.name}
                variants={sprite.variants}
                previewImageUrl={sprite.previewImageUrl}
                baseImageUrl={sprite.baseImageUrl}
              />
            ))}
          </Box>
          {(isSearching || hasMore) && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          )}
        </InfiniteScroll>
      </Box>
    </Accordion>
  );
}
