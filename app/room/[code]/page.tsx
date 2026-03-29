"use client";

import { useParams } from "next/navigation";

import { RoomPage } from "@/components/room-page";

export default function Page() {
  const params = useParams<{ code: string }>();
  return <RoomPage code={params.code} />;
}
