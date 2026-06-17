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

export const CustomDragLayer = () => {
  const canvasScale = useSelector((state: State) => state.canvas.scale);
  const { itemType, isDragging, item, pointerOffset } = useDragLayer(
    (monitor) => ({
      item: monitor.getItem(),
      itemType: monitor.getItemType(),
      pointerOffset: monitor.getClientOffset(),
      isDragging: monitor.isDragging(),
    }),
  );
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

  if (!isDragging || !pointerOffset) return null;

  // Anchor every preview to the actual mouse pointer, centered on it via the
  // element's own box, rather than the dragged source element's top-left (which
  // floats the ghost away from the cursor). The drop handler maps the same
  // pointer to canvas coords, so preview and dropped item land together.
  const transform = `translate(${pointerOffset.x}px, ${pointerOffset.y}px) translate(-50%, -50%)`;

  return (
    <div style={layerStyles}>
      <div style={{ display: "inline-block", transform, WebkitTransform: transform }}>
        {renderItem()}
      </div>
    </div>
  );
};
