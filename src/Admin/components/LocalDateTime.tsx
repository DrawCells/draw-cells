"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// Formats in the viewer's locale and timezone. The server can't know either,
// so it renders nothing and the client fills the text in after hydration —
// formatting on both sides makes the markup mismatch.
const LocalDateTime = ({ value }: { value: string | null }) => {
  const isClient = useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
  if (!value) return <>—</>;
  if (!isClient) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>—</>;
  return (
    <>
      {date.toLocaleString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}
    </>
  );
};

export default LocalDateTime;
