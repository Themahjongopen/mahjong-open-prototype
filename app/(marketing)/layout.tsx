"use client";

import { useState } from "react";
import Nav from "@/components/marketing/Nav";
import Footer from "@/components/marketing/Footer";
import RegisterModal from "@/components/marketing/RegisterModal";
import { usePathname } from "next/navigation";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const [modalOpen, setModalOpen] = useState(false);
  const pathname = usePathname();

  return (
    <>
      <Nav
        activePage={pathname}
        onRegisterClick={() => setModalOpen(true)}
      />
      <main style={{ paddingTop: 64, flex: 1 }}>{children}</main>
      <Footer onRegisterClick={() => setModalOpen(true)} />
      <RegisterModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  );
}
