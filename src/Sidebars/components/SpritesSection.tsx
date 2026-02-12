import {
  Accordion,
  AccordionSummary,
  Box,
  CircularProgress,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { get, ref } from "firebase/database";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import SidebarSprite from "../../Sprites/SidebarSprite";
import { loadSprites } from "../actions";
import State from "../../stateInterface";
import { db, storage } from "../../firebase-config";

interface SpriteInfo {
  id?: string;
  name: string;
  tags?: string[];
  imageUrl: string;
}

export default function SpritesSection() {
  const [searchTerm, setSearchTerm] = useState("");
  const dispatch = useDispatch();
  const sprites = useSelector((state: State) => state.sidebars.sprites);
  const isSpritesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isSpritesOpen,
  );
  const [isSpritesListLoading, setIsSpritesListLoading] = useState(false);
  const hasLoadedSpritesRef = useRef(false);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (
      !isSpritesSidebarOpen ||
      !isExpanded ||
      sprites.hasEnded ||
      hasLoadedSpritesRef.current
    ) {
      return;
    }

    const getSprites = async () => {
      hasLoadedSpritesRef.current = true;
      setIsSpritesListLoading(true);

      const res = await get(ref(db, "sprites"));
      const data = (res.val() || {}) as Record<string, SpriteInfo>;
      const list = await Promise.all(
        Object.entries(data).map(async ([id, sprite]) => {
          let imageUrl = sprite.imageUrl;
          if (imageUrl) {
            try {
              imageUrl = await getDownloadURL(storageRef(storage, imageUrl));
            } catch (error) {
              console.error("Failed to load sprite URL", error);
            }
          }
          return {
            id,
            name: sprite.name,
            tags: Array.isArray(sprite.tags) ? sprite.tags : [],
            imageUrl,
          };
        }),
      );

      dispatch(
        loadSprites({
          sprites: list,
          hasEnded: true,
        }),
      );
      setIsSpritesListLoading(false);
    };

    getSprites();
  }, [dispatch, isSpritesSidebarOpen, isExpanded, sprites.hasEnded]);

  const filteredSprites = useMemo(() => {
    return (sprites.list || []).filter((sprite: SpriteInfo) => {
      const nameMatch = sprite.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());
      const tagsMatch = (sprite.tags || []).some((tag) =>
        tag.toLowerCase().includes(searchTerm.toLowerCase()),
      );
      return nameMatch || tagsMatch;
    });
  }, [searchTerm, sprites.list]);

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
        <Box
          sx={{
            height: "100%",
            width: "100%",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            alignItems: "center",
            maxHeight: "calc(50vh)",
            overflowY: "auto",
          }}
        >
          {isSpritesListLoading ? <CircularProgress /> : null}
          {filteredSprites.map((sprite, i) => (
            <SidebarSprite
              key={sprite.id ?? `sprite-${i}`}
              name={sprite.name}
              backgroundUrl={sprite.imageUrl}
            />
          ))}
        </Box>
      </Box>
    </Accordion>
  );
}
