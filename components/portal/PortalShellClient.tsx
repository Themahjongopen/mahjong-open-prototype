"use client";

import { useState, createContext, useContext } from "react";
import PortalAppBar from "./PortalAppBar";
import BottomTabBar from "./BottomTabBar";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/portal": "Dashboard",
  "/portal/tables": "Open Tables",
  "/portal/tables/create": "Create Table",
  "/portal/my-tables": "My Tables",
  "/portal/standings": "Standings",
  "/portal/scores": "Submit Score",
  "/portal/directory": "Directory",
  "/portal/payment": "Complete Payment",
};

interface ToastContextType {
  showToast: (msg: string) => void;
}
export const ToastContext = createContext<ToastContextType>({ showToast: () => {} });
export function useToast() { return useContext(ToastContext); }

export default function PortalShellClient({
  children,
  userName,
  isAdminRole,
}: {
  children: React.ReactNode;
  userName: string;
  isAdminRole: boolean;
}) {
  const [toast, setToast] = useState<string | null>(null);
  const pathname = usePathname();

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const title = PAGE_TITLES[pathname] ?? "Portal";

  return (
    <ToastContext.Provider value={{ showToast }}>
      <PortalAppBar
        title={title}
        isAdminRole={isAdminRole}
        userName={userName}
      />
      <div className="portal-content">
        {children}
      </div>
      <BottomTabBar />
      {toast && <div className="toast">{toast}</div>}
    </ToastContext.Provider>
  );
}
