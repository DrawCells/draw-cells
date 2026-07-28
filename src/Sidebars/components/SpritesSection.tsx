import { Box, CircularProgress, TextField, Typography } from "@mui/material";
import InfiniteScroll from "react-infinite-scroll-component";
import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { loadSprites } from "../actions";
import State from "../../stateInterface";
import SidebarSpriteWithVariants from "../../Sprites/SidebarSpriteWithVariants";

interface SpriteInfo {
  id?: string;
  name: string;
  tags?: string[];
  baseImageUrl: string;
  previewImageUrl?: string;
  variants?: string[];
}

const PAGE_SIZE = 20;

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

export default function SpritesSection({ active }: { active: boolean }) {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SpriteInfo[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const dispatch = useDispatch();
  const sprites = useSelector((state: State) => state.sidebars.sprites);
  const hasLoadedOnceRef = useRef(false);
  const searchIdRef = useRef(0);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // When a search term is active, query the server route. Substring filtering
  // (name/tags) and tag-weighted ordering both happen server-side in Postgres.
  useEffect(() => {
    if (!debouncedSearchTerm || !active) {
      setSearchResults([]);
      return;
    }

    const currentId = ++searchIdRef.current;
    setIsSearching(true);

    const runSearch = async () => {
      const res = await fetch(
        `/api/sprites?search=${encodeURIComponent(debouncedSearchTerm)}`,
      );
      const data = await res.json();
      const matching = (data.sprites || []) as SpriteInfo[];

      const list = await Promise.all(
        matching.map((sprite) => resolveSpriteImageUrl(sprite.id ?? "", sprite)),
      );

      if (currentId !== searchIdRef.current) return;
      setSearchResults(list);
      setIsSearching(false);
    };

    runSearch();
  }, [debouncedSearchTerm, active]);

  // Paginated fetch — only runs when there is no active search term.
  useEffect(() => {
    if (
      debouncedSearchTerm ||
      !active ||
      sprites.hasEnded ||
      (hasLoadedOnceRef.current && page === 0)
    ) {
      return;
    }

    const getSprites = async () => {
      if (page === 0) hasLoadedOnceRef.current = true;

      const res = await fetch(
        `/api/sprites?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`,
      );
      const data = await res.json();
      const entries = (data.sprites || []) as SpriteInfo[];

      const list = await Promise.all(
        entries.map((sprite) => resolveSpriteImageUrl(sprite.id ?? "", sprite)),
      );

      dispatch(
        loadSprites({
          sprites: list,
          hasEnded: data.hasEnded ?? entries.length < PAGE_SIZE,
        }),
      );
    };

    getSprites();
  }, [dispatch, active, sprites.hasEnded, page, debouncedSearchTerm]);

  const handleNext = () => setPage((prev) => prev + 1);

  const displaySprites = debouncedSearchTerm ? searchResults : sprites.list;
  const hasMore = !debouncedSearchTerm && !sprites.hasEnded;

  return (
    <Box id="sprites-scroll" sx={{ height: "100%", overflowY: "auto" }}>
      <Typography variant="subtitle2" sx={{ px: 2, pt: 1.5, pb: 1 }}>
        Library
      </Typography>
      <Box sx={{ px: 2, mb: 1 }}>
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Search Library"
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
        scrollableTarget="sprites-scroll"
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
  );
}
