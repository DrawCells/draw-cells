"use client";

import React from "react";
import dynamic from "next/dynamic";

const AnimationCanvasContainer = dynamic(
  () => import("../../../src/Canvas/components/AnimationCanvas"),
  { ssr: false },
);

const CanvasPage = ({ params }: { params: { id: string } }) => {
  return <AnimationCanvasContainer />;
};

export default CanvasPage;
