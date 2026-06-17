"use client";

import React from "react";
import { Text } from "react-konva";

// A text box rendered as a Konva Text node. Double-clicking overlays a native
// <textarea> positioned over the node so the user can edit it in place.
//
// Editing is driven imperatively from the dblclick handler (rather than from a
// useEffect) so React Strict Mode's double-invoked effects can't tear down the
// textarea mid-edit.
const CanvasText = React.forwardRef(
  (
    {
      spriteId,
      text,
      fontSize,
      fontFamily,
      fill,
      align,
      fontStyle,
      width,
      height,
      onCommit,
      onSelect,
      ...shapeProps
    }: any,
    ref: any,
  ) => {
    const textRef = React.useRef<any>(null);
    const editingRef = React.useRef(false);
    const [isEditing, setIsEditing] = React.useState(false);

    // Forward the Konva node to both our internal ref and the parent's ref
    // (the parent attaches it to the Transformer).
    const setRefs = (node: any) => {
      textRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const startEditing = () => {
      const node = textRef.current;
      const stage = node?.getStage();
      if (!node || !stage || editingRef.current) return;
      editingRef.current = true;
      setIsEditing(true);
      node.hide();
      stage.batchDraw();

      const stageScale = stage.scaleX() || 1;
      const stageBox = stage.container().getBoundingClientRect();
      // absolutePosition() is the node's origin, which is the box *center*
      // because we render text with offset = width/2, height/2. Shift back to
      // the top-left corner so the textarea overlays the box exactly.
      const pos = node.absolutePosition();
      const left = stageBox.left + pos.x - node.offsetX() * stageScale;
      const top = stageBox.top + pos.y - node.offsetY() * stageScale;

      const textarea = document.createElement("textarea");
      document.body.appendChild(textarea);
      textarea.value = node.text();
      Object.assign(textarea.style, {
        position: "fixed",
        top: `${top}px`,
        left: `${left}px`,
        width: `${node.width() * stageScale}px`,
        height: `${node.height() * stageScale}px`,
        fontSize: `${node.fontSize() * stageScale}px`,
        lineHeight: String(node.lineHeight()),
        fontFamily: node.fontFamily(),
        fontStyle: node.fontStyle(),
        textAlign: node.align(),
        color: node.fill(),
        border: "1px solid #0096fd",
        padding: "0px",
        margin: "0px",
        overflow: "hidden",
        background: "white",
        outline: "none",
        resize: "none",
        boxSizing: "border-box",
        transformOrigin: "left top",
        zIndex: "1000",
      } as Partial<CSSStyleDeclaration>);
      const rotation = node.rotation();
      if (rotation) textarea.style.transform = `rotate(${rotation}deg)`;

      const autoResize = () => {
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      };
      autoResize();
      textarea.focus();
      textarea.select();

      const finish = (commit: boolean) => {
        if (!editingRef.current) return;
        editingRef.current = false;
        const value = textarea.value;
        const fittedHeight = textarea.scrollHeight / stageScale;
        textarea.removeEventListener("keydown", onKey);
        textarea.removeEventListener("input", autoResize);
        textarea.removeEventListener("blur", onBlur);
        textarea.remove();
        node.show();
        stage.batchDraw();
        setIsEditing(false);
        if (commit) {
          onCommit?.({
            text: value,
            height: Math.max(fittedHeight, node.fontSize()),
          });
        }
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          finish(true);
        } else if (e.key === "Escape") {
          finish(false);
        }
      };
      const onBlur = () => finish(true);

      textarea.addEventListener("keydown", onKey);
      textarea.addEventListener("input", autoResize);
      textarea.addEventListener("blur", onBlur);
    };

    return (
      <Text
        ref={setRefs}
        spriteId={spriteId}
        spriteKind="text"
        text={text}
        fontSize={fontSize}
        fontFamily={fontFamily || "Arial"}
        fontStyle={fontStyle || "normal"}
        fill={fill || "#000000"}
        align={align || "left"}
        verticalAlign="middle"
        wrap="word"
        width={width}
        height={height}
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={startEditing}
        onDblTap={startEditing}
        visible={!isEditing}
        {...shapeProps}
      />
    );
  },
);

CanvasText.displayName = "CanvasText";

export default CanvasText;
