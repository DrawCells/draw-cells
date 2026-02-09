import { Accordion, AccordionSummary, Box, TextField } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { SPRITE_TO_SVG_ELEMENT_MAP } from "../../constants";
import SidebarSpriteWithVariants from "../../Sprites/SidebarSpriteWithVariants";
import { useMemo, useState } from "react";

export default function SpritesSection() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSprites = useMemo(() => {
    return Object.entries(SPRITE_TO_SVG_ELEMENT_MAP)
      .filter(
        ([key, sprite]) =>
          sprite.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          sprite.tags.some((tag) =>
            tag.toLowerCase().includes(searchTerm.toLowerCase()),
          ),
      )
      .map(([key, sprite]) => key as keyof typeof SPRITE_TO_SVG_ELEMENT_MAP);
  }, [searchTerm]);

  return (
    <Accordion
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
          {filteredSprites.map((s, i) => {
            const sprite = SPRITE_TO_SVG_ELEMENT_MAP[s];
            return (
              <SidebarSpriteWithVariants
                key={`sprite-${i}`}
                name={sprite.name}
                category={sprite.category}
                variants={sprite.variants}
              />
            );
          })}
        </Box>
      </Box>
    </Accordion>
  );
}
