import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

import { getAdminSession } from "@/lib/auth/admin";
import { createHelpMedia } from "@/lib/data/help-admin-mutations";
import {
  HELP_MEDIA_MAX_BYTES,
  HELP_MEDIA_TYPES,
  mediaPublicUrl,
  storeHelpMediaFile,
} from "@/lib/help/media";

/**
 * Media upload for the admin library. A Route Handler rather than a Server
 * Action so an 8 MB screenshot does not have to squeeze through the action
 * body limit. Admin-only: the session is resolved here, exactly as the
 * actions do, because this URL is reachable without any page.
 *
 * The browser measures the image and sends its dimensions; the server only
 * trusts the bytes and the declared type, both checked before storing.
 */
export async function POST(request: NextRequest) {
  if (!(await getAdminSession())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "body" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file" }, { status: 400 });
  if (!(file.type in HELP_MEDIA_TYPES)) {
    return NextResponse.json({ error: "type" }, { status: 415 });
  }
  if (file.size === 0 || file.size > HELP_MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "size" }, { status: 413 });
  }

  const dimension = (key: string) => {
    const n = Number(form.get(key));
    return Number.isFinite(n) && n > 0 && n < 20000 ? Math.round(n) : null;
  };
  const altText = (key: string) => {
    const v = form.get(key);
    return typeof v === "string" && v.trim() ? v.trim().slice(0, 300) : null;
  };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storagePath = await storeHelpMediaFile(bytes, file.type);
    const row = await createHelpMedia({
      storage_path: storagePath,
      alt_ar: altText("alt_ar"),
      alt_en: altText("alt_en"),
      width: dimension("width"),
      height: dimension("height"),
    });
    revalidatePath("/[locale]/admin/help", "layout");
    return NextResponse.json({ media: row, url: mediaPublicUrl(row.storage_path) });
  } catch (error) {
    console.error("[flovoo] media upload failed", error);
    return NextResponse.json({ error: "upload" }, { status: 500 });
  }
}
