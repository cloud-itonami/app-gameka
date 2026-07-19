# gameka kotoba

Phase E Option B reference implementation of gameka (game generation + publishing platform) on the etzhayyim substrate.

Per [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md), gameka migrates from vendor's `createKyselyDb` pattern to **Option B** — PDS XRPC writes via `@etzhayyim/sdk e.write()`.

Coverage: **9 of 9 (100%)** gameka lexicons ported. Scaffold-ready for Worker/LangServer wiring.

| Tier | Commands | Slice |
|---|---|---|
| Proposal | proposeGame | 1 |
| Generation | generateGame, getSpec | 1 |
| Build | buildArtifact (auto-derived from generateGame) | 1 |
| Testing | playtestGame, gameQa | 2 |
| Publishing | publishGame, gameTitle | 2 |
| Automation | tickStudio (async timer-driven) | 3 |

All 9 canonical gameka lexicons now have kotoba reference impl.

## Authority-chain DIDs (per gameka design)

```
did:web:gameka.etzhayyim.com                    — controller
did:web:gameka.etzhayyim.com:spec:{specId-slug}       — GameSpec
did:web:gameka.etzhayyim.com:artifact:{artifactId}    — BuildArtifact
did:web:gameka.etzhayyim.com:qa:{qaId}                — GameQa
did:web:gameka.etzhayyim.com:title:{titleId-slug}     — GameTitle (published)
did:web:gameka.etzhayyim.com:game:{title-slug}        — Per-game sub-DID (minted in publishGame)
```

## Game Lifecycle

1. **proposeGame**: LLM studio generates game brief → creates GameSpec
2. **generateGame**: kami-codegen builds WASM artifacts → creates BuildArtifact
3. **playtestGame**: Headless WebGPU test of artifact → creates GameQa (pass/revise/exhausted)
4. **publishGame**: On pass, mints per-game sub-DID, posts launch announcement → creates GameTitle
5. **tickStudio**: Autonomous 2-hour timer scans trends, calls proposeGame in live mode

## Collections

- `com.etzhayyim.gameka.spec` — GameSpec records (proposal + iteration chain)
- `com.etzhayyim.gameka.buildArtifact` — BuildArtifact records (source tree or WASM CID)
- `com.etzhayyim.gameka.gameQa` — GameQa records (playtest metrics + outcome)
- `com.etzhayyim.gameka.gameTitle` — GameTitle records (published games with sub-DID)

## Pattern translation (Option B)

| Vendor (`gameka.etzhayyim.com`) | etzhayyim (this PR) |
|---|---|
| `const db = createKyselyDb();` | `import type { Etzhayyim } from "@etzhayyim/sdk"` |
| `db.insertInto("vertex_gameka_spec").values({...}).execute()` | `e.write({ collection: "com.etzhayyim.gameka.spec", record, rkey })` |
| `db.selectFrom("vertex_gameka_spec").where("spec_id","=",id).execute()` | `e.read({ collection, rkey: \`spec-${specSlug(id)}\` })` |

## Usage

```ts
import { Etzhayyim } from "@etzhayyim/sdk";
import { proposeGame, getGameSpec, publishGame } from "@etzhayyim/gameka-kotoba";

const e = new Etzhayyim({
  did: "did:web:gameka.etzhayyim.com",
  pdsUrl: "https://pds.etzhayyim.com",
  l2RpcUrl: "https://mainnet.base.org",
});

// Propose
const r = await proposeGame(e, {
  brief: "A roguelike puzzle platformer with procedural dungeons",
});
// → { status: "registered", specId: "...", uri: "at://...", score: 0.5 }

// Generate
const gen = await generateGame(e, { specId: r.specId });
// → { status: "registered", artifactId: "...", wasmCid: "bafy...", buildStatus: "sources_ready" }

// Playtest
const qa = await playtestGame(e, { specId: r.specId });
// → { status: "registered", qaId: "...", combinedScore: 0.75, outcome: "pass", publish: true }

// Publish (on pass)
if (qa.publish) {
  const title = await publishGame(e, {
    specId: r.specId,
    artifactId: gen.artifactId,
    qaId: qa.qaId,
  });
  // → { status: "registered", titleId: "...", playUrl: "https://game-play.etzhayyim.com/..." }
}
```

## Why Option B for gameka

Per ADR-2605203000 Phase E decision matrix:
- **Catalog**: structured game metadata + WASM artifacts + playtest metrics (open standards)
- **Write cadence**: low-to-moderate — proposals + QA cycles (not high-frequency streaming)
- **Query pattern**: by specId / iteration / outcome / published titles

Option A (vendor RW mirror) rejected — ADR-2605172000 mandates kotoba.
Option C (IPFS-only) hybrid: WASM → presigned B2 URLs, metadata → PDS (this PR).

## What this package IS / ISN'T

**IS**:
- Reference impl of 9 gameka commands on Option B (PDS XRPC + B2 artifact URL pattern).
- Documentation of the createKyselyDb → e.write() translation.
- Complete lexicon coverage ready for edge/pod wiring.

**ISN'T**:
- A deployed Worker (scaffold-only).
- LangGraph kami-codegen integration (separate operator concern).
- WebGPU playtest harness (headless testing infrastructure, separate).

## Related

- [ADR-2605203000](../../../90-docs/adr/2605203000-kotoba-write-target-options.md) — Phase E write-target options
- [kiyo kotoba](../../etzhayyim-project-kiyo/kotoba/) — sibling Option B reference (12/12 ✓)
- [sbom kotoba](../../etzhayyim-project-sbom/kotoba/) — Option B reference (17/17 ✓)
