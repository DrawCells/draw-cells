import React from "react";
import {
  removeSpritesByIds,
  removeSpritesByIdsFromAllFrames,
  copySpritesIntoFrame,
  sendSpritesToBack,
  bringSpritesToFront,
  groupSpritesByIds,
  ungroupSpritesByIds,
} from "../../Frames/actions";
import { Menu, MenuItem } from "@mui/material";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";

const initialMenuState: any = {
  mouseX: null,
  mouseY: null,
};

export default function ContextMenu({ menuState, setMenuState }: any) {
  const handleClose = () => {
    setMenuState(initialMenuState);
  };
  const dispatch = useDispatch();
  const framesList = useSelector((state: State) => state.frames.frames);
  const currentSprites = useSelector((state: State) => state.frames.currentSprites);
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  // Sprite mutations are id-addressed, so the menu passes the selection in
  // explicitly rather than the reducer reaching into it.
  const selectedIds = currentSprites.map((s) => s.id);
  const canGroup = currentSprites.length >= 2;
  const canUngroup = currentSprites.some((s) => !!s.groupId);

  return (
    <>
      <Menu
        id="simple-menu"
        open={menuState.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          menuState.mouseY !== null && menuState.mouseX !== null
            ? { top: menuState.mouseY, left: menuState.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => dispatch(removeSpritesByIds(selectedIds))}>
          Remove from crt. frame
        </MenuItem>
        <MenuItem
          onClick={() => dispatch(removeSpritesByIdsFromAllFrames(selectedIds))}
        >
          Remove from all frames
        </MenuItem>
        <MenuItem
          disabled={framesList.length < 1}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          Copy to frame
        </MenuItem>
        <MenuItem onClick={() => dispatch(sendSpritesToBack(selectedIds))}>
          Send to Back
        </MenuItem>
        <MenuItem onClick={() => dispatch(bringSpritesToFront(selectedIds))}>
          Bring to Front
        </MenuItem>
        <MenuItem
          disabled={!canGroup}
          onClick={() => { dispatch(groupSpritesByIds(selectedIds)); handleClose(); }}
        >
          Group (⌘G)
        </MenuItem>
        <MenuItem
          disabled={!canUngroup}
          onClick={() => { dispatch(ungroupSpritesByIds(selectedIds)); handleClose(); }}
        >
          Ungroup (⌘⇧G)
        </MenuItem>
      </Menu>
      <Menu open={!!anchorEl} anchorEl={anchorEl}>
        {framesList.map((f) => (
          <MenuItem
            key={`copy-selected-into-${f.id}`}
            onClick={() => dispatch(copySpritesIntoFrame(selectedIds, f.id || ""))}
          >
            Frame {f.id}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
