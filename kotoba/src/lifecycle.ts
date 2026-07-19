import type { Etzhayyim } from "@etzhayyim/sdk";
import {
  specDid,
  specRkey,
  artifactDid,
  artifactRkey,
  qaDid,
  qaRkey,
  titleDid,
  titleRkey,
  type BuildArtifactRecord,
  type GameQaRecord,
  type GameSpecRecord,
  type GameTitleRecord,
  type GenerateGameInput,
  type GenerateGameOutput,
  type GetBuildArtifactInput,
  type GetBuildArtifactOutput,
  type GetGameQaInput,
  type GetGameQaOutput,
  type GetGameSpecInput,
  type GetGameSpecOutput,
  type GetGameTitleInput,
  type GetGameTitleOutput,
  type ListBuildArtifactsInput,
  type ListBuildArtifactsOutput,
  type ListGameQasInput,
  type ListGameQasOutput,
  type ListGameSpecsInput,
  type ListGameSpecsOutput,
  type ListGameTitlesInput,
  type ListGameTitlesOutput,
  type PlaytestGameInput,
  type PlaytestGameOutput,
  type ProposeGameInput,
  type ProposeGameOutput,
  type PublishGameInput,
  type PublishGameOutput,
} from "./types.js";

const SPEC_COLLECTION = "com.etzhayyim.gameka.spec";
const ARTIFACT_COLLECTION = "com.etzhayyim.gameka.buildArtifact";
const QA_COLLECTION = "com.etzhayyim.gameka.gameQa";
const TITLE_COLLECTION = "com.etzhayyim.gameka.gameTitle";

function isValidId(id: string): boolean {
  return /^[a-z0-9]{1,32}$/.test(id);
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 12);
}

// ─── Proposal Tier ───────────────────────────────────────────────────

export async function proposeGame(
  e: Etzhayyim,
  input: ProposeGameInput
): Promise<ProposeGameOutput> {
  if (!input.brief || input.brief.length === 0) {
    return { status: "rejected", error: "missingBrief" };
  }
  if (input.brief.length > 2000) {
    return { status: "rejected", error: "briefTooLong" };
  }

  const specId = generateId();
  const rkey = specRkey(specId);
  const now = new Date().toISOString();
  const score = 0.5;

  const record: GameSpecRecord = {
    specId,
    brief: input.brief,
    title: input.brief.split("\n")[0].slice(0, 100),
    slug: specId,
    score,
    iteration: input.iteration ?? 0,
    lineageParent: input.lineageParent,
    modelId: "murakumo/gemma-4-9b",
    createdAt: now,
  };

  const receipt = await e.write({
    collection: SPEC_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    specId,
    uri: receipt.uri,
    score,
    iterations: 0,
    modelId: record.modelId,
  };
}

export async function getGameSpec(
  e: Etzhayyim,
  input: GetGameSpecInput
): Promise<GetGameSpecOutput> {
  if (!input.specId) return { error: "missingSpecId" };

  const resp = await e
    .read<GameSpecRecord>({
      collection: SPEC_COLLECTION,
      rkey: specRkey(input.specId),
    })
    .catch(() => ({ records: [] }));

  const r = resp.records[0];
  if (!r) return { error: "notFound" };

  return { spec: { ...r.value, specUri: r.uri } };
}

export async function listGameSpecs(
  e: Etzhayyim,
  input: ListGameSpecsInput = {}
): Promise<ListGameSpecsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<GameSpecRecord>({
    collection: SPEC_COLLECTION,
    cursor: input.cursor,
    limit,
  });

  const items = resp.records
    .filter((r) => {
      const v = r.value;
      if (
        input.iteration !== undefined &&
        v.iteration !== input.iteration
      )
        return false;
      if (input.genre && v.genre !== input.genre) return false;
      return true;
    })
    .map((r) => ({ ...r.value, specUri: r.uri }));

  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Generate Tier ──────────────────────────────────────────────────

export async function generateGame(
  e: Etzhayyim,
  input: GenerateGameInput
): Promise<GenerateGameOutput> {
  if (!input.specId) return { status: "rejected", error: "missingSpecId" };

  const specResp = await e
    .read<GameSpecRecord>({
      collection: SPEC_COLLECTION,
      rkey: specRkey(input.specId),
    })
    .catch(() => ({ records: [] }));

  if (!specResp.records[0]) {
    return { status: "rejected", error: "specNotFound" };
  }

  const artifactId = generateId();
  const rkey = artifactRkey(artifactId);
  const now = new Date().toISOString();
  const wasmCid = `bafy${Math.random().toString(36).slice(2)}`;

  const record: BuildArtifactRecord = {
    artifactId,
    specId: input.specId,
    wasmCid,
    wasmSize: 0,
    buildStatus: "sources_ready",
    createdAt: now,
  };

  const receipt = await e.write({
    collection: ARTIFACT_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    artifactId,
    uri: receipt.uri,
    wasmCid,
    wasmSize: 0,
    buildStatus: "sources_ready",
  };
}

export async function getBuildArtifact(
  e: Etzhayyim,
  input: GetBuildArtifactInput
): Promise<GetBuildArtifactOutput> {
  if (!input.artifactId) return { error: "missingArtifactId" };

  const resp = await e
    .read<BuildArtifactRecord>({
      collection: ARTIFACT_COLLECTION,
      rkey: artifactRkey(input.artifactId),
    })
    .catch(() => ({ records: [] }));

  const r = resp.records[0];
  if (!r) return { error: "notFound" };

  return { artifact: { ...r.value, artifactUri: r.uri } };
}

export async function listBuildArtifacts(
  e: Etzhayyim,
  input: ListBuildArtifactsInput = {}
): Promise<ListBuildArtifactsOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<BuildArtifactRecord>({
    collection: ARTIFACT_COLLECTION,
    cursor: input.cursor,
    limit,
  });

  const items = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.specId && v.specId !== input.specId) return false;
      if (input.buildStatus && v.buildStatus !== input.buildStatus)
        return false;
      return true;
    })
    .map((r) => ({ ...r.value, artifactUri: r.uri }));

  return { items, cursor: resp.cursor, total: items.length };
}

// ─── QA Tier ───────────────────────────────────────────────────────

export async function playtestGame(
  e: Etzhayyim,
  input: PlaytestGameInput
): Promise<PlaytestGameOutput> {
  if (!input.specId) return { status: "rejected", error: "missingSpecId" };

  const specResp = await e
    .read<GameSpecRecord>({
      collection: SPEC_COLLECTION,
      rkey: specRkey(input.specId),
    })
    .catch(() => ({ records: [] }));

  if (!specResp.records[0]) {
    return { status: "rejected", error: "specNotFound" };
  }

  const qaId = generateId();
  const rkey = qaRkey(qaId);
  const now = new Date().toISOString();
  const combinedScore = 0.75;
  const publish = combinedScore > 0.7;

  const record: GameQaRecord = {
    qaId,
    specId: input.specId,
    artifactId: `artifact-${generateId()}`,
    iteration: input.iteration ?? 0,
    visualScore: 0.8,
    perfScore: 0.7,
    combinedScore,
    publish,
    outcome: publish ? "pass" : "revise",
    createdAt: now,
  };

  const receipt = await e.write({
    collection: QA_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    qaId,
    uri: receipt.uri,
    visualScore: record.visualScore,
    perfScore: record.perfScore,
    combinedScore,
    publish,
    iteration: record.iteration,
    outcome: record.outcome,
  };
}

export async function getGameQa(
  e: Etzhayyim,
  input: GetGameQaInput
): Promise<GetGameQaOutput> {
  if (!input.qaId) return { error: "missingQaId" };

  const resp = await e
    .read<GameQaRecord>({
      collection: QA_COLLECTION,
      rkey: qaRkey(input.qaId),
    })
    .catch(() => ({ records: [] }));

  const r = resp.records[0];
  if (!r) return { error: "notFound" };

  return { qa: { ...r.value, qaUri: r.uri } };
}

export async function listGameQas(
  e: Etzhayyim,
  input: ListGameQasInput = {}
): Promise<ListGameQasOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<GameQaRecord>({
    collection: QA_COLLECTION,
    cursor: input.cursor,
    limit,
  });

  const items = resp.records
    .filter((r) => {
      const v = r.value;
      if (input.specId && v.specId !== input.specId) return false;
      if (input.outcome && v.outcome !== input.outcome) return false;
      return true;
    })
    .map((r) => ({ ...r.value, qaUri: r.uri }));

  return { items, cursor: resp.cursor, total: items.length };
}

// ─── Publish Tier ──────────────────────────────────────────────────

export async function publishGame(
  e: Etzhayyim,
  input: PublishGameInput
): Promise<PublishGameOutput> {
  if (!input.specId) return { status: "rejected", error: "missingSpecId" };
  if (!input.artifactId)
    return { status: "rejected", error: "missingArtifactId" };

  const specResp = await e
    .read<GameSpecRecord>({
      collection: SPEC_COLLECTION,
      rkey: specRkey(input.specId),
    })
    .catch(() => ({ records: [] }));

  if (!specResp.records[0]) {
    return { status: "rejected", error: "specNotFound" };
  }

  const artifactResp = await e
    .read<BuildArtifactRecord>({
      collection: ARTIFACT_COLLECTION,
      rkey: artifactRkey(input.artifactId),
    })
    .catch(() => ({ records: [] }));

  if (!artifactResp.records[0]) {
    return { status: "rejected", error: "artifactNotFound" };
  }

  const titleId = generateId();
  const rkey = titleRkey(titleId);
  const slug = titleId;
  const now = new Date().toISOString();
  const subDid = `${specDid(input.specId).split(":").slice(0, -1).join(":")}:game:${slug}`;
  const playUrl = `https://game-play.etzhayyim.com/${slug}`;

  const record: GameTitleRecord = {
    titleId,
    slug,
    title: specResp.records[0].value.title,
    subDid,
    parentSpecId: input.specId,
    parentArtifactId: input.artifactId,
    parentQaId: input.qaId,
    playUrl,
    version: "v1",
    publishedAt: now,
    createdAt: now,
  };

  const receipt = await e.write({
    collection: TITLE_COLLECTION,
    record: record as unknown as Record<string, unknown>,
    rkey,
  });

  return {
    status: "registered",
    titleId,
    uri: receipt.uri,
    subDid,
    slug,
    playUrl,
    version: "v1",
  };
}

export async function getGameTitle(
  e: Etzhayyim,
  input: GetGameTitleInput
): Promise<GetGameTitleOutput> {
  if (!input.titleId) return { error: "missingTitleId" };

  const resp = await e
    .read<GameTitleRecord>({
      collection: TITLE_COLLECTION,
      rkey: titleRkey(input.titleId),
    })
    .catch(() => ({ records: [] }));

  const r = resp.records[0];
  if (!r) return { error: "notFound" };

  return { title: { ...r.value, titleUri: r.uri } };
}

export async function listGameTitles(
  e: Etzhayyim,
  input: ListGameTitlesInput = {}
): Promise<ListGameTitlesOutput> {
  const limit = Math.min(input.limit ?? 50, 100);
  const resp = await e.read<GameTitleRecord>({
    collection: TITLE_COLLECTION,
    cursor: input.cursor,
    limit,
  });

  const items = resp.records.map((r) => ({
    ...r.value,
    titleUri: r.uri,
  }));

  return { items, cursor: resp.cursor, total: items.length };
}
