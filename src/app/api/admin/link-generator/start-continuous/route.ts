import { NextResponse } from "next/server";
import {
  generateMixedLinks,
  LinkGeneratorAvailabilityError,
  sanitizeContentTypes,
  sanitizeMixedBucketCounts,
} from "@/lib/admin-link-generator";
import {
  LINK_GENERATOR_BUCKETS,
  linkGeneratorBucketForDuration,
  type LinkGeneratorBucket,
  type LinkGeneratorBucketCounts,
  type LinkGeneratorContentType,
  type LinkGeneratorItem,
} from "@/lib/link-generator-types";

export const dynamic = "force-dynamic";

type ViewerTarget = "VIEWER_01" | "VIEWER_02" | "BOTH";

type StartBody = {
  bucketCounts?: unknown;
  types?: unknown;
  items?: unknown;
  target?: unknown;
};

type ViewerPlan = {
  id: Exclude<ViewerTarget, "BOTH">;
  label: string;
  controllerBase: string;
  items: LinkGeneratorItem[];
};

function isGeneratedItem(value: unknown): value is LinkGeneratorItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.url === "string" &&
    typeof item.duration === "number" &&
    typeof item.type === "string"
  );
}

function sanitizeTarget(value: unknown): ViewerTarget | null {
  return value === "VIEWER_01" || value === "VIEWER_02" || value === "BOTH"
    ? value
    : null;
}

function controllerBase(target: Exclude<ViewerTarget, "BOTH">) {
  const raw = target === "VIEWER_01"
    ? process.env.VIEWER_CONTROL_01_API_URL ||
      process.env.VIEWER_CONTROL_API_URL ||
      "http://169.58.110.224:8080"
    : process.env.VIEWER_CONTROL_02_API_URL ||
      "http://169.58.120.30:8080";

  return raw.replace(/\/+$/, "");
}

function groupAndValidateItems(
  items: LinkGeneratorItem[],
  bucketCounts: LinkGeneratorBucketCounts,
) {
  const initialByBucket: Record<LinkGeneratorBucket, LinkGeneratorItem[]> = {
    MIN_1_10: [],
    MIN_11_30: [],
    MIN_31_60: [],
    MIN_61_PLUS: [],
  };

  for (const item of items) {
    const bucket = linkGeneratorBucketForDuration(item.duration);
    if (bucket) initialByBucket[bucket].push(item);
  }

  for (const bucket of LINK_GENERATOR_BUCKETS) {
    if (initialByBucket[bucket].length !== bucketCounts[bucket]) {
      throw new Error(
        `Набор не совпадает с распределением: ${bucket} — ${initialByBucket[bucket].length} вместо ${bucketCounts[bucket]}. Сгенерируй набор заново.`,
      );
    }
  }

  return initialByBucket;
}

async function sendPlan(params: {
  plan: ViewerPlan;
  bucketCounts: LinkGeneratorBucketCounts;
  types: LinkGeneratorContentType[];
  token: string;
}) {
  const initialByBucket = groupAndValidateItems(params.plan.items, params.bucketCounts);
  const payload = {
    mode: "continuous-duration-buckets",
    nodeId: params.plan.id,
    viewerCount: 40,
    distribution: params.bucketCounts,
    types: params.types,
    nextLinkApiUrl: "https://www.redfilm.win/api/internal/viewer-links/next",
    initialByBucket,
  };

  const response = await fetch(
    `${params.plan.controllerBase}/api/integrations/redfilm/continuous`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  );

  const responseText = await response.text();
  let result: unknown = null;
  try {
    result = responseText ? JSON.parse(responseText) : null;
  } catch {
    result = { raw: responseText };
  }

  if (!response.ok) {
    const message =
      result && typeof result === "object" && "error" in result
        ? String((result as { error?: unknown }).error || "Viewer Control отклонил запуск")
        : `Viewer Control вернул HTTP ${response.status}`;
    throw new Error(`${params.plan.label}: ${message}`);
  }

  return {
    id: params.plan.id,
    label: params.plan.label,
    controllerBase: params.plan.controllerBase,
    result,
  };
}

export async function POST(request: Request) {
  let body: StartBody;
  try {
    body = (await request.json()) as StartBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON запроса" }, { status: 400 });
  }

  const token = process.env.REDFILM_VIEWER_BRIDGE_TOKEN?.trim();
  if (!token) {
    return NextResponse.json(
      { error: "REDFILM_VIEWER_BRIDGE_TOKEN не настроен на production REDFILM" },
      { status: 503 },
    );
  }

  const target = sanitizeTarget(body.target);
  if (!target) {
    return NextResponse.json({ error: "Выбери Viewer 01, Viewer 02 или обе ноды" }, { status: 400 });
  }

  const bucketCounts = sanitizeMixedBucketCounts(body.bucketCounts);
  const total = LINK_GENERATOR_BUCKETS.reduce((sum, bucket) => sum + bucketCounts[bucket], 0);
  if (total !== 40) {
    return NextResponse.json(
      { error: `Для постоянного теста сумма диапазонов должна быть равна 40. Сейчас: ${total}.` },
      { status: 400 },
    );
  }

  const items = Array.isArray(body.items) ? body.items.filter(isGeneratedItem) : [];
  if (items.length !== 40) {
    return NextResponse.json(
      { error: "Сначала сгенерируй полный набор из 40 ссылок" },
      { status: 400 },
    );
  }

  try {
    groupAndValidateItems(items, bucketCounts);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Набор ссылок не прошёл проверку" },
      { status: 409 },
    );
  }

  const types = sanitizeContentTypes(body.types);
  let viewer02Items = items;

  if (target === "BOTH") {
    try {
      viewer02Items = await generateMixedLinks({
        types,
        bucketCounts,
        excludeIds: items.map((item) => item.id),
      });
    } catch (error) {
      if (error instanceof LinkGeneratorAvailabilityError) {
        return NextResponse.json(
          {
            error: `Для Viewer 02 не удалось собрать отдельный набор без повторов. ${error.message}`,
          },
          { status: 409 },
        );
      }
      throw error;
    }
  }

  const plans: ViewerPlan[] = [];
  if (target === "VIEWER_01" || target === "BOTH") {
    plans.push({
      id: "VIEWER_01",
      label: "Viewer 01",
      controllerBase: controllerBase("VIEWER_01"),
      items,
    });
  }
  if (target === "VIEWER_02" || target === "BOTH") {
    plans.push({
      id: "VIEWER_02",
      label: "Viewer 02",
      controllerBase: controllerBase("VIEWER_02"),
      items: viewer02Items,
    });
  }

  const settled = await Promise.allSettled(
    plans.map((plan) => sendPlan({ plan, bucketCounts, types, token })),
  );

  const successful = settled.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = settled.flatMap((result, index) =>
    result.status === "rejected"
      ? [{
          id: plans[index].id,
          label: plans[index].label,
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        }]
      : [],
  );

  if (failed.length) {
    console.error("[LinkGenerator] Some Viewer Control nodes rejected the start", failed);
    return NextResponse.json(
      {
        error: failed.map((item) => item.error).join("; "),
        successful,
        failed,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    target,
    viewerCount: plans.length * 40,
    distribution: bucketCounts,
    initialSetsAreDistinct: target === "BOTH",
    targets: successful,
  });
}
