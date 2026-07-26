import { Profile } from "@/components/profile";
import { listBanners } from "@/lib/banners-fs";

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  return <Profile username={username} banners={listBanners()} />;
}
