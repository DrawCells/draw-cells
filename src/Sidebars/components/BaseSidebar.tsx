import { IconButton, Typography, useTheme } from '@mui/material';
import React, { ReactElement } from 'react';
import { useSelector } from 'react-redux';
import { bottomDrawerHeight, leftDrawerWidth, rightDrawerWidth } from '../../constants';
import State from '../../stateInterface';

interface BaseSidebarProps {
  isOpen: boolean,
  toggleOpen: () => void,
  children: any,
  iconRenderer: () => any,
  anchor: 'bottom' | 'right' | 'left',
  additionalTitle?: string | ReactElement | undefined
}

export default function BaseSidebar({isOpen, toggleOpen, children, iconRenderer, anchor, additionalTitle}: BaseSidebarProps) {
  const theme = useTheme()
  const isSpritesSidebarOpen: boolean = useSelector((state: State) => state.sidebars.isSpritesOpen)
  const isPropertiesSidebarOpen: boolean = useSelector((state: State) => state.sidebars.isPropertiesOpen)

  const leftIconStyle = {
    right: 0,
    top: 0,
  }
  const rightIconStyle = {
    left: 0,
    top: 0,
  }

  let styles = {}
  const smallDrawerWidth = parseInt(theme.spacing(6).replace("px", ""))
  // Positioned against #editor-workspace, which spans the card below the header,
  // so these fill their container rather than offsetting from the viewport.
  if (anchor === 'left') {
    styles = {
      top: 0,
      left: 0,
      height: '100%',
      width: isOpen ? leftDrawerWidth : smallDrawerWidth,
      borderRight: 'solid 1px #ddd',
      transition: 'width 0.3s ease-out',
      zIndex: 5,
    }
  } else if (anchor === 'right') {
    styles = {
      top: 0,
      right: 0,
      height: '100%',
      width: isOpen ? rightDrawerWidth : smallDrawerWidth,
      borderLeft: 'solid 1px #ddd',
      transition: 'width 0.3s ease-out',
      zIndex: 5,
    }
  } else if (anchor === 'bottom') {
    styles = {
      bottom: 0,
      left: 0,
      right: 20,
      height: isOpen ? bottomDrawerHeight : smallDrawerWidth,
      width: `calc(100% - ${(isPropertiesSidebarOpen ? rightDrawerWidth : smallDrawerWidth) + (isSpritesSidebarOpen ? leftDrawerWidth : smallDrawerWidth)}px)`,
      marginLeft: (isSpritesSidebarOpen ? leftDrawerWidth : smallDrawerWidth),
      borderTop: 'solid 1px #ddd',
      transition: 'height 0.3s ease-out, margin 0.3s ease-out, width 0.3s ease-out',
      zIndex: 1,
    }
  }

  const marginStyle = anchor === 'left' ? {marginRight: 40} : (anchor === 'right' ? {marginLeft: 40} : {marginTop: 0})

  return <>
    <div
      style={{
        position: 'absolute',
        background: "#fff",
        ...styles
      }}
    >
      <div style={{position: 'absolute', ...(anchor === "left" || anchor === "bottom" ? leftIconStyle : rightIconStyle)}}>
        <IconButton onClick={toggleOpen} size="large">
          {iconRenderer()}
        </IconButton>
        {anchor === 'right' && (<Typography variant="subtitle1" style={{transform: 'rotate(-90deg)', position: 'absolute', top: 70, left: -14}}>Properties</Typography>)}
        {anchor === 'left' && (<Typography variant="subtitle1" style={{transform: 'rotate(-90deg)', position: 'absolute', top: 60, left: -1}}>Sprites</Typography>)}
        {anchor === 'bottom' && (<Typography variant="subtitle1" style={{position: 'absolute', top: 10, right: 60, whiteSpace: 'nowrap'}}>Frames {additionalTitle}</Typography>)}
      </div>
      <div style={{...marginStyle, height: 'calc(100% - 25px)'}}>
        {isOpen && children}
      </div>
    </div>
  </>;
}
