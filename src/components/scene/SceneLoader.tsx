"use client";

import dynamic from "next/dynamic";

/** three.js needs the browser: load the scene client-side only. */
export const SceneLoader = dynamic(() => import("./Scene"), { ssr: false });
