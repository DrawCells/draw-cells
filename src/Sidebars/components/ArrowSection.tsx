import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ArrowRightAltIcon from "@mui/icons-material/ArrowRightAlt";
import { useEffect, useState } from "react";
import { useDrag } from "react-dnd";
import { getEmptyImage } from "react-dnd-html5-backend";

// The single draggable item that creates an arrow when dropped on the canvas.
function SidebarArrow() {
  const [{ isDragging }, drag, preview] = useDrag(() => ({
    type: "SPRITE",
    item: { type: "SIDEBAR_ARROW" },
    collect: (monitor) => ({ isDragging: !!monitor.isDragging() }),
  }));

  useEffect(() => {
    preview(getEmptyImage(), { captureDraggingState: true });
  }, [preview]);

  return (
    <Box
      ref={drag as any}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.5,
        py: 1,
        border: "1px dashed #bbb",
        borderRadius: 1,
        cursor: "grab",
        userSelect: "none",
      }}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      <ArrowRightAltIcon fontSize="small" />
      <Typography variant="body2">Arrow</Typography>
    </Box>
  );
}

export default function ArrowSection() {
  const [isExpanded, setIsExpanded] = useState(false);

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
          "& .MuiAccordionSummary-content": { margin: 0 },
        }}
      >
        Arrows
      </AccordionSummary>
      <AccordionDetails sx={{ px: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: "block" }}>
          Drag onto the canvas, then resize or rotate it.
        </Typography>
        <SidebarArrow />
      </AccordionDetails>
    </Accordion>
  );
}
