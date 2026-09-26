import Image from "next/image";
import { cx } from "@/lib/classes";
import { splitWordmark, type SiteSettings } from "@/lib/settings";

/**
 * Logo + shop name. The logo is the SVG the settings page produced from the admin's upload;
 * its URL carries the logo version, so a new logo shows at once and an unchanged one caches.
 */
export default function Brand({ settings, className }: { settings: Pick<SiteSettings, "shop_name" | "logo_version">; className?: string }) {
  const [first, second] = splitWordmark(settings.shop_name);
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <Image
        src={`/api/settings/logo?v=${settings.logo_version}`}
        alt=""
        width={72}
        height={36}
        unoptimized
        className="h-9 w-auto transition group-hover:scale-105"
        style={{ width: "auto" }} // the logo's aspect ratio changes with each upload: keep the height, let the width follow
        data-testid="brand-logo"
      />
      <span className="font-mono text-sm font-semibold tracking-[0.28em] text-ink uppercase" data-testid="brand-name">
        {first}
        <span className="text-cyan">{second}</span>
      </span>
    </span>
  );
}
