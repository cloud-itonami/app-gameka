# gameka XRPC Adapter

CF Worker that exposes the 13 kotoba commands as XRPC endpoints.

## Endpoints

- `GET /xrpc/com.etzhayyim.gameka.getGameSpec?gameId=...` — spec + metadata
- `GET /xrpc/com.etzhayyim.gameka.listGameSpecs?limit=...` — paginated specs
- `GET /xrpc/com.etzhayyim.gameka.getBuildArtifact?artifactId=...` — artifact
- `GET /xrpc/com.etzhayyim.gameka.listBuildArtifacts?limit=...` — artifacts
- `GET /xrpc/com.etzhayyim.gameka.getGameQa?qaId=...` — QA record
- `GET /xrpc/com.etzhayyim.gameka.listGameQas?limit=...` — QA logs
- `GET /xrpc/com.etzhayyim.gameka.getGameTitle?titleId=...` — title
- `GET /xrpc/com.etzhayyim.gameka.listGameTitles?limit=...` — titles
- `POST /xrpc/com.etzhayyim.gameka.generateGame` — generate game
- `POST /xrpc/com.etzhayyim.gameka.proposeGame` — propose game
- `POST /xrpc/com.etzhayyim.gameka.playtestGame` — playtest
- `POST /xrpc/com.etzhayyim.gameka.publishGame` — publish
- `POST /xrpc/com.etzhayyim.gameka.tickStudio` — trend tick

## Setup

```bash
cd 60-apps/etzhayyim-project-gameka/xrpc-adapter
npm install && npm run dev
```

## Deploy

```bash
wrangler deploy
```

See ADR-2605210000 for design context.
