# etzhayyim-project-gameka — Game Studio Actor (BPMN-as-actor)

`gameka.etzhayyim.com` — autonomous game studio that ideates, generates, plays and publishes browser games on the kami-engine substrate. **No CF Worker** — this is a BPMN-as-actor (ADR-0056) running on `bpmn.etzhayyim.com`.

Authoritative ADR: `90-docs/adr/2604250900-gameka-bpmn-langgraph-game-studio.md`.

## Topology

| 項目 | 値 |
|---|---|
| Layer (ADR-2604231811) | Actor Worker (Layer 10 etzhayyim ext.) |
| Worker host | `bpmn.etzhayyim.com` (LangServer + LangServer) — no dedicated Worker |
| Primary DID | `did:web:gameka.etzhayyim.com` |
| Sub-DID per game | `did:web:gameka.etzhayyim.com:game:{slug}` |
| NSID prefix | `com.etzhayyim.gameka.*` |
| Persistence (ADR-0036) | domain → Worker-direct Hyperdrive (Kysely), social → `sdk.pds.dispatch` |
| Inference | Murakumo MLX → RunPod fallback |
| Game build | `kami-engine` `kami-app-{slug}` Rust crate + `wasm-pack` |
| Hosting | `game-play-uploader` Worker (`game-play.etzhayyim.com/{slug}`) |
| Playtest | `playwright` actor headless WebGPU runner |

## Pipeline (target, 5 BPMN)

| Phase | BPMN | Status |
|---|---|---|
| Ideate  | `proposeGame.bpmn` (LangGraph deliberation)         | ✅ P1 live |
| Generate (sources) | `generateGame.bpmn` Task_RenderScaffold | ✅ P2 sources_ready |
| Build (wasm)   | `generateGame.bpmn` Task_BuildWasm + `gameka-build-runner` pod | ✅ P3 contract; pod deploy pending |
| QA      | `playtestGame.bpmn` (visual + perf critic, revise loop) | ✅ P4 contract complete |
| Playtest shell | `gameka-playtest-shell` Worker + `js_url` migration | ✅ P5 contract complete |
| Publish | `publishGame.bpmn` (sub-DID + title row + social post) | ✅ P6 contract complete |
| Tick    | `tickStudio.bpmn` (R/PT2H autonomous, 14-day soak)  | ✅ P7 contract complete |
| Avatar  | `gameka.avatar.render` + `vertex_gameka_title.avatar_data_uri` | ✅ P10 contract complete |
| In-game social UI | shell `__playtest__.html` social-bar + URL injection | ✅ P11 contract complete |
| Rollout lint | `70-tools/scripts/lint/lint-gameka-rollout.mjs` | ✅ P12 |
| Merge mechanics | per-spec `mechanic.rs` (grid_2048 / drop_suika / field_triple) | ✅ P13 |
| Mechanic DOM overlay | shell `MECHANIC_RENDERERS` (3 renderers, polled at 60Hz) | ✅ P14 |
| CI workflow | `.github/workflows/gameka-rollout-lint.yml` (lint + AST + tests + HTML) | ✅ |

## Visual-test QA loop (closes the inner ideate loop)

```
                     ┌────────────────────────────────────────┐
                     │  proposeGame  (LangGraph studio)       │
priorSpecs[0..N] ───►│   planner   ─→ researcher ─→ critic    │
(issues from prior   │     ▲                              │   │
 iterations)         │     └─── revise (score < 0.8) ─────┘   │
                     │             ↓ finalize                 │
                     │     spec → INSERT vertex_gameka_spec   │
                     └──────────────┬─────────────────────────┘
                                    ▼ derive
                     ┌──────────────────────────────────────────┐
                     │  generateGame                            │
                     │   render kami-app sources (det.)         │
                     │   wasm-pack build (gameka-build-runner)  │
                     │   2 rows: -sources / -built or -failed   │
                     └──────────────┬───────────────────────────┘
                                    ▼ derive (build_status == built)
                     ┌──────────────────────────────────────────┐
                     │  playtestGame  (this loop)               │
                     │   open headless WebGPU session           │
                     │   goto game-play.etzhayyim.com/__playtest__/   │
                     │   evaluate __etzhayyimProbe(5000) → metrics   │
                     │   3 × screenshot to B2  ─────────►  CIDs │
                     │   ─────────────────────────────────────  │
                     │   visualCritic LangGraph:                │
                     │     analyze_render — pure-fn signals     │
                     │       ├─ blocker / major / minor issues  │
                     │       └─ renderScore                     │
                     │     analyze_match — vision LLM (degraded │
                     │     fallback when tier unavailable)      │
                     │       ├─ scene_fidelity (0.40)           │
                     │       ├─ genre_signature (0.30)          │
                     │       ├─ craft_quality (0.20)            │
                     │       └─ no_artifacts (0.10) → matchScore│
                     │     synthesize:                          │
                     │       visualScore = 0.5R + 0.5M          │
                     │       perfScore = scale(fps,sceneLoad)   │
                     │       combinedScore = 0.7V + 0.3P        │
                     │       publish = (≥0.7 AND no blocker)    │
                     │       outcome = pass/revise/exhausted    │
                     │   ─────────────────────────────────────  │
                     │   INSERT vertex_gameka_qa                │
                     │   audit gameka.qa.{outcome}              │
                     │   exclusiveGateway outcome:              │
                     │     pass      → derive publishGame ──────┼──► publish
                     │     revise    → derive proposeGame ──────┼──► loop (iter+1)
                     │                with priorSpecs[0]={..,   │
                     │                issuesJson:<from critic>} │
                     │     exhausted → END (no derive, iter≥3)  │
                     └──────────────────────────────────────────┘
```

**Loop closure**: the critic's `issuesJson` (structured `[{category, severity,
description}]`) flows back through `proposeGame`'s `priorSpecs` array, which
the LangGraph studio's planner reads as an avoid-list. The next 3 candidates
explicitly dodge the categorised failure modes (e.g. "wrong biome" →
planner picks a different scene preset; "5+ console errors at runtime" →
planner reduces complexity).

**Bounded**: `MAX_ITERATION = 3` inside the critic. After 3 fails the chain
ends with `outcome = exhausted`; no derive, no publish. The full lineage
stays in graph (`vertex_gameka_spec.lineage_parent` + `vertex_gameka_qa.iteration`)
for post-mortem.

**Degraded mode**: when `kotodama.llm` `tier="vision"` is unavailable
(no multimodal LLM wired up), `analyze_match` returns `matchScore=0.5`
and tags the spec with a minor `art_quality` issue noting the degraded
state. Builds with strong render + perf still publish; ambiguous builds
go to revise. When vision lands at the LLM tier, the same prompt gets
image attachments — no contract change.

**Visual signals (`analyze_render`, pure-function)**:
| Signal | Threshold | Severity |
|---|---|---|
| capture failed | always | blocker |
| 0 screenshots | always | blocker |
| 1-2 screenshots (expected 3) | always | major |
| 5+ console errors | always | blocker |
| 1-4 console errors | always | major |
| fps_p50 < 25 | always | major |
| sceneLoad > 4000ms | always | minor |

**Perf scaling** (`_scale_perf`):
- fps component: linear from 25 fps (0.0) to 55 fps (1.0)
- load component: linear from 4000ms (0.0) to 0ms (1.0)
- weighted: 0.75 × fps + 0.25 × load

## Lexicons (`00-contracts/lexicons/com/etzhayyim/apps/gameka/`)

| NSID | type | P1 |
|---|---|---|
| `com.etzhayyim.gameka.proposeGame`   | procedure | ✅ P1 (now accepts `priorSpecs[]`) |
| `com.etzhayyim.gameka.generateGame`  | procedure | ✅ P2 / chains to playtestGame on built |
| `com.etzhayyim.gameka.playtestGame`  | procedure | ✅ P4 |
| `com.etzhayyim.gameka.gameSpec`      | record    | ✅ P1 |
| `com.etzhayyim.gameka.buildArtifact` | record    | ✅ P2 |
| `com.etzhayyim.gameka.gameQa`        | record    | ✅ P4 |
| `com.etzhayyim.gameka.publishGame`/`tickStudio`/`respondToPlaytest` | procedure | P5-P6 |
| `com.etzhayyim.gameka.gameTitle`     | record    | P5 |

## RisingWave schema (`30-graph/graph-schema/migrations/20260425090000_vertex_gameka_studio.ts`)

- `vertex_gameka_spec` — LangGraph deliberation output (P1 wired)
- `vertex_gameka_artifact` — kami-codegen build (P2 wired)
- `vertex_gameka_qa` — playtest verdict (P3 wired)
- `vertex_gameka_title` — published title + sub-DID (P4 wired)
- `edge_gameka_spec_revises` — LangGraph iteration lineage
- `edge_gameka_title_published_by` — actor publication graph

`pnpm db:gen` after apply regenerates `src/database.ts`.

## LangGraph deliberation graph

`40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/agents/gameka_studio.py` — 5 nodes:

```
START → planner → researcher → critic → should_loop?
                                          ├ planner_revise → researcher (iter+1)
                                          └ finalizer → END
```

Iteration cap: 3. Score threshold: 0.8.

**Task type (transitional)**: `com.etzhayyim.agent.gameka.studio`. Mirrors `com.etzhayyim.agent.plan` pattern. Will migrate to `generic.langgraph.run` (ADR-2604250836 step 2) by changing the BPMN `taskDefinition type` and providing `graph_id="gameka.studio.v1"` + `mode="oneshot"` ioMapping inputs. The graph definition itself is unchanged.

## Autonomous loop (`tickStudio.bpmn`)

Timer-started **R/PT2H** (12 ticks/day). Closes the outer loop —
`tickStudio` → `proposeGame` → ... → `publishGame` runs without a
human caller. β2 lesson from yoro: ship with a 14-day silent log.

```
Start (R/PT2H, no XRPC caller)
  │
  ├─ Task_LoadConfig         vertex_gameka_studio_config.tick_live_mode
  ├─ Task_LoadPriorSpecs     vertex_gameka_spec  (last 10 → planner avoid-list)
  ├─ Task_TrendScan          vertex_repo_record  (24h media-gamers feed posts)
  ├─ Task_BuildTrendCorpus   FEEL flatten rows → string corpus
  ├─ Task_BuildBrief         generic.llm.json → { brief, themes }
  └─ ExclusiveGateway tick_live_mode?
       │ true              │ false (default)
       ▼                   ▼
   derive proposeGame   audit gameka.tick.dryRun
       │                   │
   audit gameka.tick.live  │
       │                   │
       └────► End ◄────────┘
```

**Soak workflow** (operator owns the flip):

| Day | What | How |
|---|---|---|
| 0 | Apply migration `20260425110000_vertex_gameka_studio_config.ts` (seeds `tick_live_mode=false`) | `pnpm db:migrate latest` |
| 0 | Sync BPMN registry (`tickStudio.bpmn` becomes the 5th gameka actor) | `python3 70-tools/scripts/contract/sync-bpmn-actors.py --apply --only gameka` |
| 0–13 | Soak — 12 dry-run ticks/day. Tail audit. Look for: degenerate briefs, LLM cost spikes, trendCount=0 every tick (media-gamers ingest broken) | `psql "$ROOT_URL" -c "SELECT created_at, value_json FROM vertex_repo_commit WHERE collection='com.etzhayyim.bpmn.audit' AND value_json LIKE '%gameka.tick.%' ORDER BY created_at DESC LIMIT 50;"` |
| 14 | Flip live | `psql "$ROOT_URL" <<'SQL'`<br>`INSERT INTO vertex_gameka_studio_config (vertex_id, owner_did, rkey, repo, config_id, tick_live_mode, max_iterations, score_threshold, note, created_at) VALUES ('at://did:web:gameka.etzhayyim.com/com.etzhayyim.gameka.studioConfig/global', 'did:web:gameka.etzhayyim.com', 'global', 'did:web:gameka.etzhayyim.com', 'global', true, 3, 0.8, 'P7 live cutover', '2026-05-09T00:00:00Z');`<br>`SQL` |
| 14+ | Live — every R/PT2H derive lands a fresh spec. Steady state ≈ 12 specs/day; many will revise; the planner's `priorSpecs` avoid-list keeps them diverse. | watch `vertex_gameka_title.published_at` time-density |

**Hard rollback**: re-INSERT the same `vertex_id` with `tick_live_mode=false`. Next tick (within ≤2h) reverts to dry-run. RW PK-upsert means no UPDATE primitive needed.

**Failure semantics**:
- LLM unavailable → BPMN incident on `Task_BuildBrief`. No spurious dry-run / live audit. Operator sees LangServer Operate UI red.
- `trendCount=0` (media-gamers ingest stalled) → LLM still composes a brief from "no recent media-gamers posts" placeholder. Continues normally. Operator can detect via 24h trendCount=0 streak in audit.
- Audit emit fails → tick lost (no graph row). Acceptable; next tick fires in ≤2h.

**Bounded blast radius**: Each tick is one BPMN process instance. Tick N+1 runs even if tick N is still in `playtestGame` revise loops. The LangGraph studio's `priorSpecs` makes overlapping ticks emit different spec lineages.

## P12 — rollout sanity lint

`70-tools/scripts/lint/lint-gameka-rollout.mjs` — single-shot pure-stdlib
node script that gates the 7 invariants the gameka chain depends on:

1. 9 lexicons present + parse + correct `id` + correct `defs.main.type`
2. 5 BPMNs present + each `<bpmn:documentation>` carries the right NSID JSON
3. 5 migrations present in expected timestamp order, each with `up()` + `down()`
4. PDS routing-table contains an exact-match entry for every gameka XRPC NSID
5. langserver-worker registers all 4 gameka task types
6. `gameka-build-runner` Dockerfile COPY srcs all exist
7. `gameka-playtest-shell` Worker SELECTs match the columns publishGame writes

Run: `node 70-tools/scripts/lint/lint-gameka-rollout.mjs` (no deps).
CI: add to `.github/workflows/*.yml` once the gameka rollout lands.
Local: re-run after any contract surgery to catch drift before deploy.

## P13 — merge mechanics (per-spec `src/mechanic.rs`)

The 3 seed specs (`grid_2048` / `drop_suika` / `field_triple`) now
generate **real playable mechanic state machines**, not just biome
scaffolds. `gameka_codegen.py` emits a 4th file in each kami-app crate
(`src/mechanic.rs`) selected by `mechanic.kind`, falls back to keyword
scan of `coreVerb`/`description`, default `grid_2048`.

| `mechanic.kind` | Module | wasm-bindgen exports | LOC |
|---|---|---|---|
| `grid_2048`    | 4×4 swipe-merge state machine | `mechanic_init` / `mechanic_swipe(dir)` / `mechanic_score()` / `mechanic_status()` | ~6.8 KB |
| `drop_suika`   | Vec<Ball> physics drop with circle-circle merge | `mechanic_init` / `mechanic_drop_at(x)` / `mechanic_step(dt)` / `mechanic_score()` / `mechanic_status()` | ~7.5 KB |
| `field_triple` | 5×5 place-and-cluster with BFS cascade | `mechanic_init` / `mechanic_place(r,c)` / `mechanic_score()` / `mechanic_status()` / `mechanic_preview()` | ~6.2 KB |

Each module:
- pure Rust state machine (no kami-* deps; can `cargo test` standalone)
- thread-local state (`thread_local!{ static MECH: RefCell<State> }`) since wasm is single-threaded
- calls `crate::play_sfx(name)` on merge events (coin / pop / click)
- calls `crate::share_score(score, msg)` on first-win (subDid posts the achievement)
- `#[cfg(test)] mod tests` covers core invariants (merge / win / lose / cascade)
- mechanic seed deterministically derived from `spec.spec_id` (sha256 → first 4 bytes)

Visual rendering of the mechanic state is **deferred to P14** (kami-ui-gpu
overlay). The kami-pipelines biome scene is still the visual; mechanic
state surfaces audibly via SFX + socially via share posts.



`kotodama/handlers/gameka_avatar.py` renders a deterministic 256×256
identicon from `slug` + biome:

- pure-stdlib (`hashlib` / `zlib` / `struct` / `base64`) — no Pillow / canvas
- sha256(slug) → 8×8 mirror-symmetric grid, 4-tone Splatoon-pastel palette per biome
- output is a `data:image/png;base64,…` URI stored on `vertex_gameka_title.avatar_data_uri`
- typical size 1-5 KB after zlib level 9 — fits in the 302 redirect URL
- 900 KB hard cap in the task wrapper protects RW row size + AT firehose

`publishGame.bpmn` Task_RenderAvatar runs after sub-DID provision + before
the title row insert. Failure path returns `buildStatus="failed"` + empty
URI; the publish chain continues and the shell falls back to the default
cream-pastel icon.

| Biome  | Palette dark→light                                            |
|---|---|
| Quarry | (90,70,50) (140,110,80) (200,180,150) (244,234,214)           |
| Tundra | (90,130,180) (150,180,210) (210,225,240) (245,245,255)         |
| Plains | (70,130,70) (120,180,100) (190,215,160) (245,235,210)         |
| Desert | (180,130,60) (220,170,80) (245,210,140) (255,235,200)         |

The shell installs the avatar as `<link rel="icon">`, `apple-touch-icon`,
and `og:image` so atproto / iMessage / Slack share embeds get the right
preview.

Migration: `30-graph/graph-schema/migrations/20260425130000_vertex_gameka_title_avatar_data_uri.ts`

## P11 — in-game share / follow UI overlay

`__playtest__.html` exposes a Splatoon-pastel pill row (bottom-right)
that's revealed only after the wasm boots cleanly:

- avatar (28 px circle from `?a=` data URI)
- **share** pill (#ffd24d Splatoon yolk) → `__kamiSocialShare(text)`
- **follow** pill (#b6e2ff sky → #b6f0c8 mint when toggled) → `__kamiSocialFollow()`
- ephemeral toast (1.8s fade) for confirmation

The bar listens to `__kamiPlay` for click feedback (`click` / `select`
SFX) so the audio bridge gets exercised from UI even before the game
emits its first milestone.

Hidden in QA mode (`?qa=1` → `body[data-qa="1"]` CSS rule) so playwright
screenshots stay free of the overlay.

`gameka-playtest-shell` Worker injects the per-title context as URL params:

| Param | Source |
|---|---|
| `c` | `vertex_gameka_artifact.wasm_cid` |
| `w` | presigned wasm URL |
| `j` | presigned glue URL |
| `e` | `run_<slug-with-underscores>` |
| `d` | `vertex_gameka_title.sub_did` (P11 — used by `__kamiSocialFollow`) |
| `t` | `vertex_gameka_title.title_id` (P11 — share text citation) |
| `a` | `vertex_gameka_title.avatar_data_uri` (P10 — avatar + og:image) |

The shell sets `window.__gamekaSubDid` / `__gamekaTitle` / `__gamekaAvatar`
from these so the wasm bridges in `kami-app-{slug}` lib.rs read them at
call-time without re-fetching.

## Per-game integration matrix (PDS profile + kami social + audio)

Every published title gets a fully-populated AT Protocol presence
plus in-game social + audio bridges:

| Concern | Where | Contract |
|---|---|---|
| `app.bsky.actor.profile` (rkey="self") AS subDid | `publishGame.bpmn` Task_RegisterProfile | displayName=spec.title; description=brief + playUrl + binary cid + AI-Agent disclaimer |
| `app.bsky.feed.post` launch announcement | `publishGame.bpmn` Task_PostLaunch | repo=subDid → per-title timeline |
| Per-title sub-DID `did:web:gameka.etzhayyim.com:game:{slug}` | ADR-0023 host-sdk did.json auto-serve | one provisioning hook (`Task_ProvisionSubDid`) |
| In-game **share** (`window.__kamiSocialShare`) | `lib.rs` extern + shell `__socialPost("app.bsky.feed.post")` | game logic calls `share_score(score, msg)` |
| In-game **follow** (`window.__kamiSocialFollow`) | `lib.rs` extern + shell `__socialPost("app.bsky.graph.follow")` | game logic calls `follow_creator()` |
| **BGM** drone (4 biome presets, kami-engine §UI no-files rule) | shell `BGM_PRESETS` + `lib.rs::start_bgm()` on entry | spec.scene.audioPalette.bgm name picked from `{ambient-default, ambient-quarry-low, tundra-wind-soft, plains-pastoral}` |
| **SFX** (13 kami-sound presets) | shell `SFX_PRESETS` + `lib.rs::play_sfx(name)` | spec.scene.audioPalette.sfx[] (≤12, deduped, normalised) |
| QA-mode silence (no firehose pollution, no AudioContext) | shell `?qa=1` URL flag | playtest sets it; production /play/{slug} omits it |

### Spec → audio plumbing

`scene.audioPalette` is the SSoT. Codegen reads it (helpers
`_audio_from_scene` + `_normalise_sfx_name` in
`kotodama/handlers/gameka_codegen.py`) and emits:

```rust
pub const BGM_HINT: &str = "<spec.scene.audioPalette.bgm>";
pub const SFX_PALETTE: &[&str] = &["<...>", ...];
```

The 3 merge seeds prove three distinct biome × audio pairings:

| Spec | Biome | BGM | SFX |
|---|---|---|---|
| `spec-merge-grid-2048`    | Quarry  | `ambient-quarry-low`  | click / success / coin / tick / select / loaded |
| `spec-merge-drop-suika`   | Tundra  | `tundra-wind-soft`    | pop / whoosh / success / loaded / warning / coin |
| `spec-merge-field-triple` | Plains  | `plains-pastoral`     | click / coin / success / loaded / select / navigate |

### lib.rs bridge contract

```rust
extern "C" {
    #[wasm_bindgen(js_namespace = window, js_name = __kamiPlay,         catch)] fn __kami_play(name: &str)         -> Result<(), JsValue>;
    #[wasm_bindgen(js_namespace = window, js_name = __kamiPlayBgm,      catch)] fn __kami_play_bgm(name: &str)     -> Result<(), JsValue>;
    #[wasm_bindgen(js_namespace = window, js_name = __kamiSocialShare,  catch)] fn __kami_social_share(text: &str) -> Result<(), JsValue>;
    #[wasm_bindgen(js_namespace = window, js_name = __kamiSocialFollow, catch)] fn __kami_social_follow()          -> Result<(), JsValue>;
}
pub fn play_sfx(name: &str)            // safe wrapper, drops on missing host fn
pub fn start_bgm()                     // calls __kamiPlayBgm(BGM_HINT)
#[wasm_bindgen] pub fn share_score(score: u32, message: &str)
#[wasm_bindgen] pub fn follow_creator()
```

Every bridge is `catch`-wrapped — running the wasm under `cargo test`
or any host that doesn't expose the window globals is a silent no-op,
not a panic. The QA loop's `analyze_render` in the visual critic
correctly captures any uncaught console.error.

### Honored rules

- **kami-engine §Prohibitions: 音声ファイル禁止** — all audio is Web Audio
  synthesis (`AudioContext` + oscillators + noise buffer). Zero asset bytes.
- **kami-engine §UI/UX**: cream `#f0ead6` background, Splatoon-pastel palette
  per biome, BGM is detuned-sine drone (no melodies, no looped samples).
- **ADR-0036**: profile + launch post both via PDS dispatch (federable).
  In-game share/follow goes through the user's own PDS session, not the
  game's signing key — host-side enforcement matches Bluesky semantics.
- **60-apps Profile Registration mandate**: displayName + description +
  AI-Agent disclaimer all set; isBot is implicit since the actor type
  is a generated game (no human author).

## Publish flow (`publishGame.bpmn`)

Closes the loop. Triggered by `playtestGame.bpmn` on `outcome="pass"`.

```
playtestGame (pass)
  └─ derive publishGame
        ├─ load spec (slug/title/brief/genre)
        ├─ load artifact (binary wasm_cid)
        ├─ compute subDid  = did:web:gameka.etzhayyim.com:game:{slug}
        ├─ compute playUrl = https://game-play.etzhayyim.com/{slug}
        ├─ provisionSubDid (operator-wired NSID)         ◀── only blocking dep
        ├─ INSERT vertex_gameka_title       (sub_did, play_url, parent_*)
        ├─ INSERT edge_gameka_title_published_by (title → primary)
        ├─ app.bsky.feed.post AS subDid     (launch announcement)
        └─ audit gameka.title.published
```

**Sub-DID convention** (matches media-gamers): `did:web:gameka.etzhayyim.com:game:{slug}`. Once the signing key is provisioned in PDS `SIGNING_KEYS_D1` custody (ADR-0023), host-sdk auto-serves `did.json` at the path — no Worker code, no per-title key distribution.

**Launch post owner**: `repo: subDid` so the post lands on the per-title timeline. Followers of the gameka primary DID see nothing (intentional — they already chose the studio); fans follow the sub-DID directly. Mirrors media-gamers' per-title author pattern.

**Operator-wired step** (one place):

| Task | NSID (convention) | What you wire |
|---|---|---|
| `Task_ProvisionSubDid` | `com.etzhayyim.authz.provisionSubDid` | The authn.etzhayyim.com endpoint that mints + custodies a sub-DID's signing key. Input `{ parentDid, path, displayName, description }`, output `{ did, signingKeyId? }`. If your auth surface uses a different NSID, swap it here — the rest of the chain only needs the deterministic `subDid` string. |

**Failure semantics**: provisioning failure aborts before any title row is written → graph stays consistent (no title without a key). The launch post failing leaves a written title row + a populated `launchPostUri=""` in the audit payload — operator can retry the post manually without re-minting.

**Domain `game-play.etzhayyim.com/{slug}` resolution**: separate operator concern. The simplest live wiring is a CF Worker route (or a static SPA route in `game-play-uploader`) that:
1. SELECTs `vertex_gameka_title WHERE slug=$1` → `parent_artifact_id`
2. SELECTs `vertex_gameka_artifact WHERE artifact_id=$1 AND build_status='built' ORDER BY created_at DESC LIMIT 1` → `wasm_url, js_url, wasm_cid`
3. 302 → `/__playtest__.html?c=<cid>&w=<wasmUrl>&j=<jsUrl>&e=run_<slug-with-underscores>`

This means the same shell that the QA loop uses also serves end-users. One contract, two callers (playwright + browser).

## Playtest shell (`gameka-playtest-shell` Worker)

CF Worker at `50-infra/cloudflare/workers/gameka-playtest-shell/` owns
`game-play.etzhayyim.com/play/*` (slug → latest -built artifact resolver, 302)
and `game-play.etzhayyim.com/__playtest__.html` (canonical static shell). One
shell HTML, two callers — headless QA (`playtestGame.bpmn` Task_Goto)
and end-user browsers via `/play/{slug}` redirect from `publishGame.bpmn`.
Runbook: `50-infra/cloudflare/workers/gameka-playtest-shell/README.md`.

**URL contract** (set by `playtestGame.bpmn` Task_Goto):

```
https://game-play.etzhayyim.com/__playtest__.html?c={cid}&w={wasmUrl}&j={jsUrl}&e={entryFn}
```

| Param | Source |
|---|---|
| `c` | `vertex_gameka_artifact.wasm_cid` (informational, e.g. `bafkrei…`) |
| `w` | `vertex_gameka_artifact.wasm_url`  (presigned B2 binary URL) |
| `j` | `vertex_gameka_artifact.js_url`    (presigned B2 wasm-bindgen glue URL) |
| `e` | `run_<slug-with-underscores>` derived from `vertex_gameka_spec.slug` |

**Probe contract** (`window.__etzhayyimProbe(durationMs)` matches the
`gameka_visual_critic` ioMapping):

```ts
{ fpsP50: number, fpsP95: number, sceneLoadMs: integer,
  consoleErrorCount: integer, captureSucceeded: boolean }
```

**Failure modes** (all leave a usable JSON for the BPMN evaluate task):

| Cause | Probe response |
|---|---|
| Missing query params | `captureSucceeded=false`, `fpsP50=0`, `consoleErrorCount=0` |
| `import(jsUrl)` 4xx/5xx | `captureSucceeded=false`, `consoleErrorCount≥1` |
| `init(wasmUrl)` panic | same as above |
| `run_<slug>` throws | same as above |
| Tab throttled / device loss | sample deltas filtered (>500ms gaps dropped) |

**Deploy**: `cd 50-infra/cloudflare/workers/gameka-playtest-shell && pnpm install && pnpm deploy`.
The HTML lives at `./static/__playtest__.html` and is bound as a Workers
Asset. There is no second copy elsewhere in the repo; hand-edit + git-commit
that file is the canonical workflow.

**No build-time dependency for the HTML**: pure HTML+JS, no bundler, no
transpiler. The Worker itself bundles the redirect logic via wrangler.

## wasm-pack runner (`gameka.build.wasmPack`)

`50-infra/vultr/gameka-build-runner/` — separate pod-side LangServer handler pod
(rust:1.81-slim + wasm-pack 0.13.1 + sccache + boto3) that re-derives the
`kami-app-{slug}` sources from `specId` (deterministic, vendored
`gameka_codegen`), runs `wasm-pack build --target web --release` against
the `kami-engine` workspace baked into the image, and uploads
`pkg/*.wasm` + `pkg/*.js` to `b2://etzhayyim-gameka/builds/{wasmCid}.wasm`.

**Event-sourced rows**: `generateGame.bpmn` emits two `vertex_gameka_artifact`
rows per call — `vertex_id` ends with `-sources` (sources_ready) then
`-built` (or `-failed`). Same `artifact_id` joins them; readers select
ORDER BY `created_at` DESC LIMIT 1 to get the latest state. RW PK upsert
semantics keep the rows distinct without UPDATE.

| Input | Output |
|---|---|
| `specId, title, slug, genre, mechanicJson, sceneJson, sourcesCid` | `{ wasmCid (binary), wasmSize, wasmUrl, buildLogUrl, buildStatus="built"\|"failed" }` |

Runbook: `50-infra/vultr/gameka-build-runner/README.md`.

## Seed merge-game specs (3 patterns)

Migration `20260425120000_seed_gameka_merge_specs.ts` pre-populates
`vertex_gameka_spec` with 3 hand-authored merge-game specs. Each is
a real `gameSpec` row (score=0.85, iteration=0, lineage_parent='') —
indistinguishable from a tickStudio-driven proposal — so the rest of
the chain (`generateGame` → `playtestGame` → `publishGame`) can be
exercised end-to-end **without** running proposeGame's LangGraph
deliberation first.

| `spec_id` | Sub-genre | Slug | Biome | Camera | Input | Budget |
|---|---|---|---|---|---|---|
| `spec-merge-grid-2048`  | 2048 swipe-merge       | `grid-merge-quarry`  | Quarry  | Orbit  | PointerOrbit | $80 |
| `spec-merge-drop-suika` | Suika physics drop     | `drop-merge-tundra`  | Tundra  | Orbit  | PointerOrbit | $120 |
| `spec-merge-field-triple` | Triple Town cluster | `field-merge-plains` | Plains  | Orbit  | PointerOrbit | $100 |

Camera + Input are derived by `gameka_codegen.py` from `genre="puzzle"`
across all three (Orbit + PointerOrbit). The visual differentiation
comes from `scene.biomeHint` → `kami_terrain::Biome::{Quarry|Tundra|Plains}`
in the generated `kami-app-{slug}` lib.rs.

Smoke per spec (run any one or all three):

```bash
SPEC=spec-merge-grid-2048   # or -drop-suika / -field-triple
curl -X POST https://atproto.etzhayyim.com/xrpc/com.etzhayyim.gameka.generateGame \
  -H "authorization: Bearer $etzhayyim_TOKEN" \
  -H "content-type: application/json" \
  -d "{\"specId\":\"$SPEC\"}"

# expect within ~5 min (cold sccache):
#  vertex_gameka_artifact -sources row (build_status=sources_ready)
#  vertex_gameka_artifact -built  row (build_status=built, wasm_url presigned)
psql "$ROOT_URL" -c "
  SELECT vertex_id, build_status, wasm_size, wasm_cid
    FROM vertex_gameka_artifact
    WHERE artifact_id IN (
      SELECT artifact_id FROM vertex_gameka_artifact
        WHERE spec_id LIKE 'spec-merge-%' ORDER BY created_at DESC LIMIT 6)
    ORDER BY created_at;"
```

The mechanic + scene JSON in each spec describes a fully-formed merge
game; the current P2 codegen template renders a Sky+Terrain+Water
scaffold (no merge logic yet). Implementing the merge mechanic itself
is a `kami-game` crate addition tracked separately — the seed specs
intentionally over-spec so the future codegen can plug logic in
without re-running the LLM.

## Codegen contract (`gameka.codegen.renderKamiApp`)

`40-engine/kotoba/crates/kotoba-kotodama/py/src/kotodama/handlers/gameka_codegen.py` — pure-function
Python that renders a `kami-app-{slug}` Rust source tree from a `gameSpec`:

| Input | Output |
|---|---|
| `specId, title, slug, genre, mechanicJson, sceneJson` | `{ wasmCid, wasmSize, entryFn, fileCount, buildStatus="sources_ready" }` |

- **Deterministic**: same spec → byte-identical sources → same `wasmCid`
- **wasmCid**: CIDv1 (`b` base32 + raw codec + sha2-256 multihash) of the canonical sources blob (path + `\0` + content + `\x1f`, sorted). ADR-0029 wire-format. Becomes the wasm binary CID once the P3 wasm-pack runner overwrites it.
- **Templates** mirror `kami-app-isekai`: `Cargo.toml`, `src/lib.rs`, `README.md`. Camera + input mode + biome are picked from the spec via lookup tables (no LLM, no randomness).
- **No disk I/O** at this layer — the build runner (P3) re-derives the tree from the same `specId` and pipes it into `wasm-pack build`.

Genre → camera + input lookup:
| Genre | Camera | Input |
|---|---|---|
| platformer | ThirdPerson | Wasd |
| puzzle | Orbit | PointerOrbit |
| shmup | TopDown | Wasd |
| runner | ThirdPerson | ArrowsOnly |
| sandbox | Fps | WasdMouseLook |
| rhythm | Static | BeatTap |
| rogue-lite | TopDown | Wasd |
| tower-defense | TopDown | PointerSelect |

Scene-text → biome keyword scan (plains / quarry / desert / tundra), default `Plains`.

## Smoke test

### Offline (no infra required)

```bash
# Pure-function codegen + LangGraph deliberation against stubbed LLM.
# Skips silently if langgraph isn't installed in the venv.
cd 40-engine/kotoba/crates/kotoba-kotodama/py
python3 -m pytest tests/test_gameka_codegen.py -q
```

### End-to-end (requires RW + LangServer + LLM tier)

```bash
# 1. Apply migration
cd 30-graph/graph-schema
DATABASE_URL=$(security find-generic-password -s etzhayyim.rw -a ROOT_URL -w) pnpm db:migrate latest
pnpm db:gen
pnpm db:drift

# 2. Sync BPMN registry rows (vertex_bpmn_process_def + vertex_bpmn_lexicon_binding)
python3 70-tools/scripts/contract/sync-bpmn-actors.py --apply --only gameka

# 3. Rebuild + roll the langserver-worker so the new task handlers are live
#    (build + Helm rollout per etzhayyim-root/50-infra/vultr/zeebe runbook).
#    Registers com.etzhayyim.agent.gameka.studio + gameka.codegen.renderKamiApp.

# 4. proposeGame → spec lands
curl -X POST https://atproto.etzhayyim.com/xrpc/com.etzhayyim.gameka.proposeGame \
  -H "content-type: application/json" \
  -H "authorization: Bearer $etzhayyim_TOKEN" \
  -d '{"brief":"a cozy quarry-walk roguelike with one weather rune"}'

psql "$ROOT_URL" -c "SELECT spec_id, title, slug, score, iteration \
  FROM vertex_gameka_spec ORDER BY created_at DESC LIMIT 5;"

# 5. generateGame → kami-app sources hash lands
SPEC_ID=$(psql "$ROOT_URL" -At -c "SELECT spec_id FROM vertex_gameka_spec \
  ORDER BY created_at DESC LIMIT 1;")
curl -X POST https://atproto.etzhayyim.com/xrpc/com.etzhayyim.gameka.generateGame \
  -H "content-type: application/json" \
  -H "authorization: Bearer $etzhayyim_TOKEN" \
  -d "{\"specId\":\"$SPEC_ID\"}"

psql "$ROOT_URL" -c "SELECT artifact_id, spec_id, wasm_cid, wasm_size, build_status \
  FROM vertex_gameka_artifact ORDER BY created_at DESC LIMIT 5;"
# Expect: build_status='sources_ready', wasm_cid starting with 'b'.
```

## Prohibitions

- Do **not** create a CF Worker for gameka. ADR-0056 BPMN-as-actor is the contract.
- Do **not** add a per-game DID until P4 (`publishGame`) lands. P1 spec rows are owned by the primary `did:web:gameka.etzhayyim.com`.
- Do **not** include kami-codegen / wasm build in `proposeGame`. That's P2's `generateGame` BPMN.
- Do **not** use Canvas 2D / `<canvas>.getContext('2d')` in any generated game (CRITICAL, `kami-engine` rule). All generated games target wgpu via `kami-app-{slug}` crate.
