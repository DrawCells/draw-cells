import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { useDispatch, useSelector } from "react-redux";
import State from "../../stateInterface";
import { toggleSprites } from "../actions";
import BaseSidebar from "./BaseSidebar";

import SpritesSection from "./SpritesSection";
import BackgroundsSection from "./BackgroundsSection";
import TextSection from "./TextSection";
import ArrowSection from "./ArrowSection";

export default function SpritesSidebar() {
  const dispatch = useDispatch();
  const isSpritesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isSpritesOpen,
  );

  return (
    <>
      <BaseSidebar
        isOpen={isSpritesSidebarOpen}
        toggleOpen={() => dispatch(toggleSprites())}
        iconRenderer={() =>
          isSpritesSidebarOpen ? <ChevronLeftIcon /> : <ChevronRightIcon />
        }
        anchor="left"
      >
        <SpritesSection />
        <BackgroundsSection />
        <TextSection />
        <ArrowSection />
      </BaseSidebar>
    </>
  );
}
