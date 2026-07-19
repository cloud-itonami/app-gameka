export const GAMEKA_DID_PREFIX = "did:web:gameka.etzhayyim.com:" as const;

export type GameStatus =
  | "proposed"
  | "generating"
  | "building"
  | "testing"
  | "published"
  | "archived";

// ─── Game Spec (proposal tier) ───────────────────────────────────────

export interface GameSpecRecord {
  specId: string;
  brief: string;
  title: string;
  slug: string;
  genre?: string;
  mechanic?: string;
  scene?: string;
  budgetUsd?: number;
  score: number;
  rationale?: string;
  iteration: number;
  lineageParent?: string;
  modelId?: string;
  createdAt: string;
}

export interface GameSpecView extends GameSpecRecord {
  specUri: string;
}

export interface ProposeGameInput {
  brief: string;
  iteration?: number;
  lineageParent?: string;
  priorSpecs?: Array<{
    slug: string;
    title: string;
    score: number;
    outcome: string;
    issuesJson: string;
  }>;
}

export interface ProposeGameOutput {
  status: "registered" | "rejected";
  specId?: string;
  uri?: string;
  score?: number;
  iterations?: number;
  modelId?: string;
  error?: string;
}

export interface GetGameSpecInput {
  specId: string;
}

export interface GetGameSpecOutput {
  spec?: GameSpecView;
  error?: string;
}

export interface ListGameSpecsInput {
  iteration?: number;
  genre?: string;
  limit?: number;
  cursor?: string;
}

export interface ListGameSpecsOutput {
  items: GameSpecView[];
  cursor?: string;
  total: number;
}

// ─── Build Artifact ───────────────────────────────────────────────────

export interface BuildArtifactRecord {
  artifactId: string;
  specId: string;
  wasmCid: string;
  wasmSize: number;
  wasmUrl?: string;
  jsUrl?: string;
  buildLogUrl?: string;
  buildStatus: string;
  createdAt: string;
}

export interface BuildArtifactView extends BuildArtifactRecord {
  artifactUri: string;
}

export interface GenerateGameInput {
  specId: string;
}

export interface GenerateGameOutput {
  status: "registered" | "rejected";
  artifactId?: string;
  uri?: string;
  wasmCid?: string;
  wasmSize?: number;
  buildStatus?: string;
  error?: string;
}

export interface GetBuildArtifactInput {
  artifactId: string;
}

export interface GetBuildArtifactOutput {
  artifact?: BuildArtifactView;
  error?: string;
}

export interface ListBuildArtifactsInput {
  specId?: string;
  buildStatus?: string;
  limit?: number;
  cursor?: string;
}

export interface ListBuildArtifactsOutput {
  items: BuildArtifactView[];
  cursor?: string;
  total: number;
}

// ─── Game QA ────────────────────────────────────────────────────────

export interface GameQaRecord {
  qaId: string;
  specId: string;
  artifactId: string;
  iteration: number;
  screenshotCidsJson?: string;
  consoleErrorCount?: number;
  fpsP50?: number;
  fpsP95?: number;
  sceneLoadMs?: number;
  visualScore: number;
  perfScore: number;
  combinedScore: number;
  publish: boolean;
  outcome: string;
  issuesJson?: string;
  criticModelId?: string;
  createdAt: string;
}

export interface GameQaView extends GameQaRecord {
  qaUri: string;
}

export interface PlaytestGameInput {
  specId: string;
  iteration?: number;
}

export interface PlaytestGameOutput {
  status: "registered" | "rejected";
  qaId?: string;
  uri?: string;
  visualScore?: number;
  perfScore?: number;
  combinedScore?: number;
  publish?: boolean;
  iteration?: number;
  outcome?: string;
  error?: string;
}

export interface GetGameQaInput {
  qaId: string;
}

export interface GetGameQaOutput {
  qa?: GameQaView;
  error?: string;
}

export interface ListGameQasInput {
  specId?: string;
  outcome?: string;
  limit?: number;
  cursor?: string;
}

export interface ListGameQasOutput {
  items: GameQaView[];
  cursor?: string;
  total: number;
}

// ─── Game Title (published tier) ────────────────────────────────────

export interface GameTitleRecord {
  titleId: string;
  slug: string;
  title: string;
  subDid: string;
  parentSpecId: string;
  parentArtifactId: string;
  parentQaId?: string;
  playUrl: string;
  version?: string;
  profileUri?: string;
  publishPostUri?: string;
  avatarDataUri?: string;
  publishedAt: string;
  createdAt: string;
}

export interface GameTitleView extends GameTitleRecord {
  titleUri: string;
}

export interface PublishGameInput {
  specId: string;
  artifactId: string;
  qaId?: string;
}

export interface PublishGameOutput {
  status: "registered" | "rejected";
  titleId?: string;
  uri?: string;
  subDid?: string;
  slug?: string;
  playUrl?: string;
  postUri?: string;
  version?: string;
  error?: string;
}

export interface GetGameTitleInput {
  titleId: string;
}

export interface GetGameTitleOutput {
  title?: GameTitleView;
  error?: string;
}

export interface ListGameTitlesInput {
  limit?: number;
  cursor?: string;
}

export interface ListGameTitlesOutput {
  items: GameTitleView[];
  cursor?: string;
  total: number;
}

// ─── Studio Automation ──────────────────────────────────────────────

export interface TickStudioInput {}

export interface TickStudioOutput {
  status: "completed" | "skipped";
  outcome?: string;
  brief?: string;
  trendCount?: number;
  error?: string;
}

// ─── Slug helpers ──────────────────────────────────────────────────

export function gameSlug(id: string): string {
  return id.toLowerCase().replace(/[^a-z0-9]/g, "-");
}

export function specDid(specId: string): string {
  return `${GAMEKA_DID_PREFIX}spec:${gameSlug(specId)}`;
}

export function specRkey(specId: string): string {
  return `spec-${gameSlug(specId)}`;
}

export function artifactDid(artifactId: string): string {
  return `${GAMEKA_DID_PREFIX}artifact:${gameSlug(artifactId)}`;
}

export function artifactRkey(artifactId: string): string {
  return `artifact-${gameSlug(artifactId)}`;
}

export function qaDid(qaId: string): string {
  return `${GAMEKA_DID_PREFIX}qa:${gameSlug(qaId)}`;
}

export function qaRkey(qaId: string): string {
  return `qa-${gameSlug(qaId)}`;
}

export function titleDid(titleId: string): string {
  return `${GAMEKA_DID_PREFIX}title:${gameSlug(titleId)}`;
}

export function titleRkey(titleId: string): string {
  return `title-${gameSlug(titleId)}`;
}
