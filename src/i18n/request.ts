import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

const locales = ["es", "en"] as const;

export default getRequestConfig(async () => {
  let locale = "es";

  try {
    const store = await cookies();
    const cookie = store.get("locale")?.value;
    if (cookie && (locales as readonly string[]).includes(cookie)) {
      locale = cookie;
    }
  } catch {}

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
