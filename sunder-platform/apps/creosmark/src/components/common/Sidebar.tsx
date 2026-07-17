import React from "react";
import SideTray from "./SideTray";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children?: React.ReactNode;
  width?: string;
  modal?: boolean;
};

export default function Sidebar({
  open,
  onClose,
  title,
  children,
  width = "360px",
  modal = true,
}: SidebarProps) {
  return (
    <SideTray
      open={open}
      onClose={onClose}
      title={title ?? "Side panel"}
      width={width}
      modal={modal}
    >
      {children}
    </SideTray>
  );
}
