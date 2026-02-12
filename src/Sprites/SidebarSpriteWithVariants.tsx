import { Box, Popover, Typography } from "@mui/material";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import SidebarSprite from "./SidebarSprite";
import { resolveSpriteUrl } from "../helpers";
import { storage } from "../firebase-config";

interface SidebarSpriteWithVariantsProps {
  name: string;
  baseImageUrl: string;
  previewImageUrl: string;
  variants?: string[];
}

export default function SidebarSpriteWithVariants({
  name,
  baseImageUrl,
  previewImageUrl,
  variants,
}: SidebarSpriteWithVariantsProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [variantUrls, setVariantUrls] = useState<Record<string, string>>({});
  const [isLoadingVariants, setIsLoadingVariants] = useState(false);

  const variantList = useMemo(
    () => (variants && variants.length > 0 ? variants : [undefined]),
    [variants],
  );

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
  const basePath = useMemo(() => {
    if (!baseImageUrl) return "";
    return baseImageUrl.endsWith(".svg")
      ? baseImageUrl.slice(0, -4)
      : baseImageUrl;
  }, [baseImageUrl]);

  useEffect(() => {
    if (!open || !variants || variants.length === 0 || !basePath) return;

    const missingVariants = variants.filter(
      (variant) => !variantUrls[variant],
    );
    if (missingVariants.length === 0) return;

    const loadVariantUrls = async () => {
      setIsLoadingVariants(true);
      const entries = await Promise.all(
        missingVariants.map(async (variant) => {
          const imagePath = `${basePath} - ${variant}.svg`;
          try {
            const url = await getDownloadURL(storageRef(storage, imagePath));
            return [variant, url] as const;
          } catch (error) {
            console.error("Failed to load variant URL", error);
            return [variant, ""] as const;
          }
        }),
      );
      setVariantUrls((prev) => ({
        ...prev,
        ...Object.fromEntries(entries),
      }));
      setIsLoadingVariants(false);
    };

    loadVariantUrls();
  }, [open, variants, basePath, variantUrls]);

  if (!hasVariants) {
    return (
      <SidebarSprite
        name={name}
        backgroundUrl={baseImageUrl}
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
          src={resolveSpriteUrl(previewImageUrl)}
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
            const url = variant ? variantUrls[variant] : "";
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
        {isLoadingVariants ? (
          <Typography variant="caption" sx={{ mt: 1, display: "block" }}>
            Loading variants...
          </Typography>
        ) : null}
      </Popover>
    </Box>
  );
}
