import { Box, Popover, Typography } from "@mui/material";
import React, { useMemo, useRef, useState } from "react";
import SidebarSprite from "./SidebarSprite";

interface SidebarSpriteWithVariantsProps {
  name: string;
  category: string;
  variants?: string[];
}

export default function SidebarSpriteWithVariants({
  name,
  category,
  variants,
}: SidebarSpriteWithVariantsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const variantList = useMemo(
    () => (variants && variants.length > 0 ? variants : [undefined]),
    [variants],
  );

  const previewBackgroundUrl = useMemo(() => {
    const firstVariant = variantList[0];
    return `${category}/${name}${firstVariant ? ` - ${firstVariant}` : ""}.svg`;
  }, [category, name, variantList]);

  const handleOpen = (target: HTMLElement) => {
    setAnchorEl(target);
  };

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    if (anchorEl) {
      setAnchorEl(null);
      return;
    }
    handleOpen(event.currentTarget);
  };

  const handleVariantDragStart = () => {
    setAnchorEl(null);
  };

  const open = Boolean(anchorEl);
  const hasVariants = Boolean(variants && variants.length > 0);
  const variantsCount = variants?.length ?? 0;

  if (!hasVariants) {
    return (
      <SidebarSprite
        name={name}
        backgroundUrl={`${category}/${name}.svg`}
        onDragStart={handleVariantDragStart}
      />
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        marginBottom: 1,
        flexDirection: "column",
      }}
      onClick={handleClick}
    >
      <Box
        sx={{
          width: 50,
          height: 50,
          cursor: "pointer",
          bgcolor: "background.paper",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 0.5,
          position: "relative",
        }}
      >
        <img
          src={`/assets/cells/${previewBackgroundUrl}`}
          alt={name}
          width={50}
          height={50}
        />
        {hasVariants && (
          <Box
            sx={{
              position: "absolute",
              bottom: 2,
              right: 2,
              minWidth: 20,
              height: 16,
              borderRadius: "999px",
              bgcolor: "background.paper",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: 1,
              pointerEvents: "none",
              px: 0.5,
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontSize: 10, color: "text.secondary", lineHeight: 1 }}
            >
              +{variantsCount}
            </Typography>
          </Box>
        )}
      </Box>
      <Typography variant="caption" sx={{ textAlign: "center" }}>
        {name}
      </Typography>
      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "center", horizontal: "right" }}
        transformOrigin={{ vertical: "center", horizontal: "left" }}
        disableRestoreFocus
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              maxWidth: 260,
            },
          },
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {name} variants
        </Typography>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 1,
          }}
        >
          {variantList.map((variant, index) => {
            const label = variant || "Default";
            const url = `${category}/${name}${variant ? ` - ${variant}` : ""}.svg`;
            return (
              <SidebarSprite
                key={`variant-${index}-${label}`}
                name={name}
                backgroundUrl={url}
                onDragStart={handleVariantDragStart}
              />
            );
          })}
        </Box>
      </Popover>
    </Box>
  );
}
