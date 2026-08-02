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
  "/portal/register-city": "Register Another City",
};

interface ToastContextType {
  showToast: (msg: string) => void;
}
export const ToastContext = createContext<ToastContextType>({ showToast: () => {} });
export function useToast() { return useContext(ToastContext); }

export default function PortalShellClient({
  children,
  userId,
  userName,
  isAdminRole,
  adminCities = [],
  activeCityId = null,
  activeCityName = null,
  playerCities = [],
  playerActiveCityId = null,
  playerActiveCityName = null,
}: {
  children: React.ReactNode;
  userId: string;
  userName: string;
  isAdminRole: boolean;
  adminCities?: { id: string; name: string }[];
  activeCityId?: string | null;
  activeCityName?: string | null;
  playerCities?: { id: string; name: string }[];
  playerActiveCityId?: string | null;
  playerActiveCityName?: string | null;
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
        userId={userId}
        isAdminRole={isAdminRole}
        userName={userName}
        adminCities={adminCities}
        activeCityId={activeCityId}
        activeCityName={activeCityName}
        playerCities={playerCities}
        playerActiveCityId={playerActiveCityId}
        playerActiveCityName={playerActiveCityName}
      />
      <div className="portal-content">
        {children}
      </div>
      <BottomTabBar />
      {toast && <div className="toast">{toast}</div>}
    </ToastContext.Provider>
  );
}
