import React from "react";
import {
  removeCurrentSprites,
  removeCurrentSpritesFromAllFrames,
  copySelectedSpriteSIntoFrame,
  sendSpriteToBack,
  bringSpriteToFront,
  groupSprites,
  ungroupSprites,
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
        <MenuItem onClick={() => dispatch(removeCurrentSprites())}>
          Remove from crt. frame
        </MenuItem>
        <MenuItem onClick={() => dispatch(removeCurrentSpritesFromAllFrames())}>
          Remove from all frames
        </MenuItem>
        <MenuItem
          disabled={framesList.length < 1}
          onClick={(e) => setAnchorEl(e.currentTarget)}
        >
          Copy to frame
        </MenuItem>
        <MenuItem onClick={() => dispatch(sendSpriteToBack())}>
          Send to Back
        </MenuItem>
        <MenuItem onClick={() => dispatch(bringSpriteToFront())}>
          Bring to Front
        </MenuItem>
        <MenuItem
          disabled={!canGroup}
          onClick={() => { dispatch(groupSprites()); handleClose(); }}
        >
          Group (⌘G)
        </MenuItem>
        <MenuItem
          disabled={!canUngroup}
          onClick={() => { dispatch(ungroupSprites()); handleClose(); }}
        >
          Ungroup (⌘⇧G)
        </MenuItem>
      </Menu>
      <Menu open={!!anchorEl} anchorEl={anchorEl}>
        {framesList.map((f) => (
          <MenuItem
            key={`copy-selected-into-${f.id}`}
            onClick={() => dispatch(copySelectedSpriteSIntoFrame(f.id || ""))}
          >
            Frame {f.id}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
