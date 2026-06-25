"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/Toast";

// Liest nach einer Server-Redirect-Navigation den ?flash=…-Parameter aus,
// zeigt ihn als Toast und putzt die URL wieder. In <Suspense> im Layout.
export default function FlashToast() {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const toast = useToast();
  const flash = sp.get("flash");

  useEffect(() => {
    if (!flash) return;
    toast(flash, "success");
    const params = new URLSearchParams(Array.from(sp.entries()));
    params.delete("flash");
    const qs = params.toString();
    router.replace(qs ? `${path}?${qs}` : path, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flash]);

  return null;
}
