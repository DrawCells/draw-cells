"use client";

import { CircularProgress, useTheme } from "@mui/material";
import { get, ref, update } from "firebase/database";
import React, { useEffect, useRef, useState } from "react";
import { DndProvider, useDrop, XYCoord } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { Layer, Rect, Stage, Transformer } from "react-konva";
import { useDispatch, useSelector } from "react-redux";
import {
  leftDrawerWidth,
  OFFSET,
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
} from "../../constants";
import { db } from "../../firebase-config";
import {
  addCurrentSprite,
  addSprite,
  loadInitialData,
  setCurrentSprite,
  setFramePreview,
  setIsFramesSaving,
  unselectAllSprites,
  updateSprite,
} from "../../Frames/actions";
import { Sprite } from "../../Frames/reducers/frames";
import Header from "../../Header/components/CanvasHeader";
import PresentationModal from "../../Presentation/components/PresentationModal";
import FramesSidebar from "../../Sidebars/components/FramesSidebar";
import PropertiesSidebar from "../../Sidebars/components/PropertiesSidebar";
import SpritesSidebar from "../../Sidebars/components/SpritesSidebar";
import CanvasSprite from "../../Sprites/CanvasSprite";
import State from "../../stateInterface";
import { zoomIn, zoomOut } from "../actions";
import AnimationCanvasPreview from "./AnimationCanvasPreview";
import ContextMenu from "./ContextMenu";
import { CustomDragLayer } from "./CustomDragLayer";
import { useParams } from "next/navigation";

export default function AnimationCanvasContainer() {
  return (
    <DndProvider backend={HTML5Backend}>
      <Header />
      <div className="App">
        <CustomDragLayer />
        <AnimationCanvas />
        <SpritesSidebar />
        <FramesSidebar />
        <PropertiesSidebar />
      </div>
      <PresentationModal />
    </DndProvider>
  );
}
interface StateProps {
  mouseX: number | null;
  mouseY: number | null;
}

const initialMenuState: StateProps = {
  mouseX: null,
  mouseY: null,
};

function AnimationCanvas() {
  const dispatch = useDispatch();

  const sprites = useSelector(
    (state: State) => state.frames.currentFrame.sprites,
  );
  const selectedSprites = useSelector(
    (state: State) => state.frames.currentSprites,
  );
  const lastSpriteId = useSelector((state: State) => state.frames.lastSpriteId);
  const isSpritesSidebarOpen = useSelector(
    (state: State) => state.sidebars.isSpritesOpen,
  );
  const scale = useSelector((state: State) => state.canvas.scale);
  const canvasContainer = useRef<any>(null);
  const dndContainerRef = useRef<any>(null);

  const currentFrameId = useSelector(
    (state: State) => state.frames.currentFrame.id,
  );
  const currentFrameBgUrl = useSelector(
    (state: State) => state.frames.currentFrame.backgroundUrl,
  );
  const framesList = useSelector((state: State) => state.frames.frames);
  const nextFrame = useSelector((state: State) => state.frames.nextFrame);

  const isAnimationPreviewModalOpen = useSelector(
    (state: State) => state.presentations.isModalOpen,
  );

  const theme = useTheme();
  const smallDrawerWidth: number = parseInt(theme.spacing(6).replace("px", ""));
  const headerHeight: number = parseInt(theme.spacing(8).replace("px", ""));

  const { id: presentationId } = useParams();

  const viewportRef: any = React.useRef();

  // LOADING FROM DB
  const [isLoading, setIsLoading] = useState(false);
  useEffect(() => {
    setIsLoading(true);
    const getData = async () => {
      const res = await get(ref(db, `presentations/${presentationId}`));
      dispatch(loadInitialData(res.val()));
      setIsLoading(false);

      const scrollX =
        (VIEWPORT_WIDTH * 2 +
          OFFSET * 2 -
          (window.innerWidth - smallDrawerWidth * 2)) /
        2;
      const scrollY =
        (VIEWPORT_HEIGHT * 2 +
          OFFSET * 2 -
          (window.innerHeight - smallDrawerWidth - headerHeight)) /
        2;
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo(scrollX, scrollY);
      }
    };
    getData();
  }, [presentationId, headerHeight, smallDrawerWidth, dispatch]);

  // DEBOUNCED SAVE TO DB
  useEffect(() => {
    dispatch(setIsFramesSaving(true));
    const t = setTimeout(async () => {
      const res = await update(ref(db), {
        [`presentations/${presentationId}/frames`]: framesList,
      });
      dispatch(setIsFramesSaving(false));
    }, 2000);
    return () => {
      clearTimeout(t);
    };
  }, [framesList, presentationId, dispatch]);

  // Get bg from db
  useEffect(() => {
    if (currentFrameBgUrl) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = currentFrameBgUrl;
      img.onload = () => {
        viewportRef.current.fillPatternImage(img);
        viewportRef.current.fillPatternScale({
          x: VIEWPORT_WIDTH / img.width,
          y: VIEWPORT_HEIGHT / img.height,
        });
      };
    }
  }, [currentFrameBgUrl]);

  // SAVE FRAME PREVIEW
  useEffect(() => {
    if (isAnimationPreviewModalOpen) return;
    const t = setTimeout(async () => {
      if (!stageRef.current) return;

      const viewportImg = await stageRef.current.toDataURL({
        pixelRatio: 3,
        x: VIEWPORT_WIDTH - OFFSET - 5,
        y: VIEWPORT_HEIGHT - OFFSET / 2 + 30,
        width: VIEWPORT_WIDTH,
        height: VIEWPORT_HEIGHT,
      });
      if (currentFrameId)
        dispatch(setFramePreview(currentFrameId, viewportImg));
    }, 200);
    return () => {
      clearTimeout(t);
    };
  }, [sprites, currentFrameId, isAnimationPreviewModalOpen, dispatch]);

  // STYLING
  const canvasWidth = `calc(100vw - ${
    smallDrawerWidth +
    (isSpritesSidebarOpen ? leftDrawerWidth : smallDrawerWidth)
  }px)`;

  const containerStyle: any = {
    flexGrow: 1,
    height: `calc(100vh - ${headerHeight + smallDrawerWidth}px)`,
    display: "flex",
    flexDirection: "column",
    marginLeft: isSpritesSidebarOpen ? leftDrawerWidth : smallDrawerWidth,
    marginRight: smallDrawerWidth,
    width: canvasWidth,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  };

  const largeContainerStyle = {
    width: 2 * VIEWPORT_WIDTH + 2 * OFFSET,
    height: 2 * VIEWPORT_HEIGHT + 2 * OFFSET,
    overflow: "hidden",
    backgroundColor: "#f0f0f0",
  };

  const scrollContainerStyle = {
    width: "calc(100%)",
    height: "calc(100%)",
    overflow: "auto",
  };

  // DRAG AND DROP FROM SIDEBAR
  function createSprite(
    pos: XYCoord | null,
    backgroundUrl: string,
    ratio: number,
  ) {
    if (pos) {
      dispatch(
        addSprite({
          id: lastSpriteId,
          position: pos,
          backgroundUrl,
          height: 50 / ratio,
          width: 50,
          rotation: 0,
        }),
      );
    }
  }

  const [, drop] = useDrop({
    accept: "SPRITE",
    drop: (item: any, monitor) => {
      if (item.type === "SIDEBAR_SPRITE") {
        console.log("Dropped item:", item);
        const offsetX =
          (VIEWPORT_WIDTH / 2 + OFFSET + leftDrawerWidth - 30) * (1 / scale);
        const offsetY =
          (VIEWPORT_HEIGHT / 2 + OFFSET + smallDrawerWidth - 15) * (1 / scale);
        createSprite(
          {
            x:
              (monitor.getSourceClientOffset()?.x || 0) -
              offsetX +
              scrollContainerRef.current.scrollLeft,
            y:
              (monitor.getSourceClientOffset()?.y || 0) -
              offsetY +
              scrollContainerRef.current.scrollTop,
          },
          item.backgroundUrl,
          item.ratio,
        );
      }
    },
  });
  drop(dndContainerRef);

  // RESIZE BY CMD + SCROLL
  const [prevDelta, setPrevDelta] = useState(0);
  useEffect(() => {
    window.addEventListener(
      "wheel",
      function (event) {
        if (event.metaKey) {
          event.preventDefault();
          if (event.deltaY !== prevDelta) {
            setPrevDelta((currentPrevDelta) => {
              if (event.deltaY < 0 && event.deltaY !== currentPrevDelta) {
                dispatch(zoomIn());
              }
              if (event.deltaY > 0 && event.deltaY !== currentPrevDelta) {
                dispatch(zoomOut());
              }
              return event.deltaY;
            });
          }
        }
      },
      { passive: false },
    );
  }, [dispatch, prevDelta]);

  // SPRITE SELECTION
  const handleSelectSprite = (e: any, id: number | string) => {
    if (e.evt.metaKey || e.evt.shiftKey || e.evt.ctrlKey) {
      dispatch(addCurrentSprite(id));
    } else {
      dispatch(setCurrentSprite(id));
    }
  };

  const trRef: any = React.useRef();
  const shapeRefs: any = React.useRef({});

  useEffect(() => {
    if (selectedSprites.length > 0) {
      // we need to attach transformer manually
      trRef.current.nodes(
        selectedSprites.map((s) => shapeRefs.current[s.id].current),
      );
      trRef.current.getLayer().batchDraw();
    }
  }, [selectedSprites]);

  // CANVAS SCROLLING
  const scrollContainerRef: any = React.useRef();
  const [stagePosition, setStagePosition] = useState({ x: 0, y: 0 });
  useEffect(() => {
    function repositionStage() {
      var dx = scrollContainerRef.current.scrollLeft;
      var dy = scrollContainerRef.current.scrollTop;

      setStagePosition({ x: dx, y: dy });
    }
    scrollContainerRef.current.addEventListener("scroll", repositionStage);
    repositionStage();
  }, []);

  // CONTEXT MENU
  const stageRef: any = React.useRef();
  const [menuState, setMenuState] = useState(initialMenuState);
  const handleContextMenu = (e: any) => {
    // prevent default behavior
    e.evt.preventDefault();
    if (e.target === stageRef.current) {
      // if we are on empty place of the stage we will do nothing
      return;
    }
    // show menu
    setMenuState({
      mouseX:
        e.target.getStage().getPointerPosition().x -
        scrollContainerRef.current.scrollLeft +
        50,
      mouseY:
        e.target.getStage().getPointerPosition().y -
        scrollContainerRef.current.scrollTop +
        50,
    });
  };

  // SPRITE TRANSFORMATIONS
  const handleTransform = (e: any) => {
    const transformerNode = e.currentTarget;
    for (let n of transformerNode.nodes()) {
      const commonDetails = { id: n.attrs.spriteId };

      const scaleX = n.scaleX();
      const scaleY = n.scaleY();
      n.scaleX(1);
      n.scaleY(1);

      dispatch(
        updateSprite({ field: "positionX", value: n.x(), ...commonDetails }),
      );
      dispatch(
        updateSprite({ field: "positionY", value: n.y(), ...commonDetails }),
      );
      dispatch(
        updateSprite({
          field: "width",
          value: Math.max(5, n.width() * scaleX),
          ...commonDetails,
        }),
      );
      dispatch(
        updateSprite({
          field: "height",
          value: Math.max(5, n.height() * scaleY),
          ...commonDetails,
        }),
      );
      dispatch(
        updateSprite({
          field: "rotation",
          value: n.rotation(),
          ...commonDetails,
        }),
      );
    }
  };

  // SPRITE DRAG AND DROP INSIDE CANVAS
  const handleDrag = (e: any) => {
    for (let n of e.target.nodes()) {
      const commonDetails = { id: n.attrs.spriteId };
      dispatch(
        updateSprite({ field: "positionX", value: n.x(), ...commonDetails }),
      );
      dispatch(
        updateSprite({ field: "positionY", value: n.y(), ...commonDetails }),
      );
    }
  };

  // SET CURSOR
  const [cursor, setCursor] = useState("default");

  // LOADING SCREEN
  if (isLoading) {
    return <CircularProgress />;
  }

  // CANVAS COMPONENT
  return (
    <div
      ref={canvasContainer}
      style={{ ...containerStyle, transition: "all 0.3s ease-out" }}
      id="main-canvas"
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "scroll",
        }}
      >
        <ContextMenu menuState={menuState} setMenuState={setMenuState} />
        <div
          id="scroll-container"
          style={scrollContainerStyle}
          ref={scrollContainerRef}
        >
          <div
            id="large-container"
            style={largeContainerStyle}
            ref={dndContainerRef}
          >
            <div
              id="container"
              style={{
                transform: `translate(${stagePosition.x}px, ${stagePosition.y}px)`,
                cursor: cursor,
              }}
            >
              <React.Suspense>
                <Stage
                  width={2 * VIEWPORT_WIDTH + 2 * OFFSET}
                  height={2 * VIEWPORT_HEIGHT + 2 * OFFSET}
                  ref={stageRef}
                  onClick={(e: any) => {
                    const emptySpace =
                      e.target === e.target.getStage() ||
                      e.target === viewportRef.current;
                    if (!emptySpace) return;

                    dispatch(unselectAllSprites());
                  }}
                  onContextMenu={handleContextMenu}
                  scale={{ x: scale, y: scale }}
                  x={stagePosition.x}
                  y={stagePosition.y}
                  offsetX={-(VIEWPORT_WIDTH / 2 + OFFSET) * (1 / scale)}
                  offsetY={-(VIEWPORT_HEIGHT / 2 + OFFSET) * (1 / scale)}
                  // style={{backgroundColor: 'white'}}
                >
                  <Layer>
                    <Rect
                      ref={viewportRef}
                      x={0}
                      y={0}
                      stroke={"#eaeaea"}
                      strokeWidth={1}
                      width={VIEWPORT_WIDTH}
                      height={VIEWPORT_HEIGHT}
                      shadowColor="#555"
                      shadowBlur={90}
                      shadowOffset={{ x: 10, y: 10 }}
                      shadowOpacity={0.1}
                      fillPatternRepeat="no-repeat"
                      fill={currentFrameBgUrl ? undefined : "white"}
                    />
                    {sprites?.map((s: Sprite) => {
                      shapeRefs.current[s.id] = React.createRef();
                      const nextFrameSprite = nextFrame?.sprites.find(
                        (s2) => s2.id.toString() === s.id.toString(),
                      );
                      const isSelected = selectedSprites.find(
                        (s2) => s2.id.toString() === s.id.toString(),
                      );
                      return (
                        <React.Fragment key={s.id}>
                          {isSelected && nextFrameSprite && (
                            <AnimationCanvasPreview
                              x1={s.position.x}
                              y1={s.position.y}
                              animationProps={s.animationProps}
                              animationType={s.animationType}
                              width1={s.width}
                              height1={s.height}
                              width2={nextFrameSprite.width}
                              height2={nextFrameSprite.height}
                            />
                          )}
                          <CanvasSprite
                            backgroundUrl={s.backgroundUrl}
                            x={s.position.x}
                            y={s.position.y}
                            width={s.width}
                            height={s.height}
                            rotation={s.rotation}
                            onSelect={(e: MouseEvent) => {
                              handleSelectSprite(e, s.id);
                            }}
                            ref={shapeRefs.current[s.id]}
                            spriteId={s.id}
                            onMouseEnter={() => setCursor("pointer")}
                            onMouseLeave={() => setCursor("default")}
                            offsetX={s.width / 2}
                            offsetY={s.height / 2}
                          />
                        </React.Fragment>
                      );
                    })}
                    {selectedSprites.length > 0 && (
                      <Transformer
                        ref={trRef}
                        boundBoxFunc={(oldBox, newBox) => {
                          // limit resize
                          if (newBox.width < 5 || newBox.height < 5) {
                            return oldBox;
                          }
                          return newBox;
                        }}
                        draggable
                        shouldOverdrawWholeArea
                        onDragEnd={handleDrag}
                        onTransformEnd={handleTransform}
                        onMouseEnter={() => setCursor("move")}
                        onMouseLeave={() => setCursor("default")}
                      />
                    )}
                  </Layer>
                </Stage>
              </React.Suspense>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
