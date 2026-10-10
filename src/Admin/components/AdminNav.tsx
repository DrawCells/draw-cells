"use client";

import { Container, Tab, Tabs } from "@mui/material";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React from "react";

const TABS = [
  { href: "/admin", label: "Users" },
  { href: "/admin/feedback", label: "Feedback" },
];

export default function AdminNav() {
  const pathname = usePathname();
  const current = TABS.find((t) => t.href === pathname)?.href ?? false;

  return (
    <Container maxWidth={false} sx={{ mt: 2 }}>
      <Tabs value={current} sx={{ borderBottom: 1, borderColor: "divider" }}>
        {TABS.map((t) => (
          <Tab key={t.href} value={t.href} label={t.label} component={Link} href={t.href} />
        ))}
      </Tabs>
    </Container>
  );
}
