"use client";

import dynamic from 'next/dynamic';

const GlobalBackground = dynamic(() => import('./GlobalBackground'), { ssr: false });

export default function GlobalBackgroundWrapper() {
    return <GlobalBackground />;
}
