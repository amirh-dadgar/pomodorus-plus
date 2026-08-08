import { Profile } from "@/components/profile";
import { listBanners } from "@/lib/banners-fs";

// The local-first profile: a device's own focus chart and day detail, read
// from LocalState with no login and no network. Sessions earned before sign-in
// live under an anonymous key and are merged into the account on login
// (see claimOrphaned), so this page is where that time first becomes visible.
export default function LocalProfilePage() {
  return <Profile username="مهمان" banners={listBanners()} offline />;
}
