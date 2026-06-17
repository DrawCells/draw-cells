import { useDragLayer } from "react-dnd";
import { useSelector } from "react-redux";
import BaseSpritePreview from "../../Sprites/BaseSpritePreview";
import State from "../../stateInterface";

const layerStyles: any = {
  position: "fixed",
  pointerEvents: "none",
  zIndex: 100,
  left: 0,
  top: 0,
  width: "100%",
  height: "100%",
};

function getItemStyles(
  initialOffset: any,
  currentOffset: any,
  item: any,
  canvasScale: number
) {
  if (!initialOffset || !currentOffset) {
    return {
      display: "none",
    };
  }
  let { x, y } = currentOffset;
  const translateX = x + 30 * ((item.scale || 1) * canvasScale - 1);
  const translateY = y + 30 * ((item.scale || 1) * canvasScale - 1);
  const transform = `translate(${translateX}px, ${translateY}px)`;
  return {
    transform,
    WebkitTransform: transform,
  };
}
export const CustomDragLayer = () => {
  const canvasScale = useSelector((state: State) => state.canvas.scale);
  const { itemType, isDragging, item, initialOffset, currentOffset } =
    useDragLayer((monitor) => ({
      item: monitor.getItem(),
      itemType: monitor.getItemType(),
      initialOffset: monitor.getInitialSourceClientOffset(),
      currentOffset: monitor.getSourceClientOffset(),
      isDragging: monitor.isDragging(),
    }));
  function renderItem() {
    switch (itemType) {
      case "SPRITE":
        if (item.type === "SIDEBAR_TEXT") {
          return (
            <div
              style={{
                display: "inline-block",
                padding: "1px 4px",
                border: "1px dashed #0096fd",
                background: "rgba(255,255,255,0.8)",
                color: "#333",
                fontSize: 12,
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              Text
            </div>
          );
        }
        if (item.type === "SIDEBAR_ARROW") {
          return (
            <div
              style={{
                display: "inline-block",
                padding: "1px 4px",
                border: "1px dashed #0096fd",
                background: "rgba(255,255,255,0.8)",
                color: "#333",
                fontSize: 18,
                lineHeight: 1,
                whiteSpace: "nowrap",
              }}
            >
              →
            </div>
          );
        }
        return (
          <BaseSpritePreview
            id={item.id}
            position={{ x: item.x, y: item.y }}
            backgroundUrl={item.backgroundUrl}
            scale={item.scale * canvasScale}
            zIndex={item.zIndex}
            width={item.width}
            height={item.height}
            rotation={item.rotation}
            name={item.name}
            ratio={item.ratio}
          />
        );
      default:
        return null;
    }
  }

  if (!isDragging) return null;

  return (
    <div style={layerStyles}>
      <div
        style={getItemStyles(initialOffset, currentOffset, item, canvasScale)}
      >
        {renderItem()}
      </div>
    </div>
  );
};
