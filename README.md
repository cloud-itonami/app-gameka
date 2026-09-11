# app-gameka

**ゲーム生成パイプラインの型と受け渡しを TypeScript で書き下ろした参照実装。**
`kotoba/` が 13 の関数、`xrpc-adapter/` がそれを XRPC として並べる Cloudflare
Worker のソース。この 2 つで全部である。

名前が機能を示さない repo は README の冒頭で名乗る（CLAUDE.md「無い」と言う前に
索引を引く）。**gameka = ゲーム化**、cloud-itonami の app 面に属する。

## この repo に無いもの（先に読むこと）

同梱の `CLAUDE.md`（35 KB）は 5 本の BPMN プロセス・RisingWave のマイグレーション・
Rust の `kami-app-*` crate・playtest shell Worker・LangGraph の Python studio・
`70-tools/scripts/lint/` の lint を、あたかもここに在るかのように記述している。
**どれもこの repo には無い。** あれは抽出前の `etzhayyim/root` モノレポ全体を
説明した文書で、抽出時にそのまま付いてきた。

実際に在るのは 17 ファイルだけである:

```
README.edn  migration.edn  CLAUDE.md          ← 記録
kotoba/       src/{index,types,lifecycle,automation}.ts + test/gameka.test.ts
xrpc-adapter/ src/index.ts + wrangler.jsonc
```

`CLAUDE.md` を仕様として読まないこと。設計の意図を読む資料としては有効だが、
**現状の説明としては誤りである。**

## 出所

`etzhayyim/root` の `60-apps/etzhayyim-project-gameka` を revision `57d57fc4` で
切り出したもの。切り出し後に足したのは `README.edn` / `migration.edn` と
この `README.md` / `docs/` だけで、**残り 15 ファイル 72,071 バイトは出所と
バイト単位で同一**。機械で確かめられる:

```bash
kbb --backend sci docs/verify-custody.cljk --origin
```

## 何が動いて、何が動かないか

`kotoba/` の 13 関数は **決定的なスカフォールド**であって、名前が示す処理は
していない。読む前に知っておくべき具体:

| 関数 | 名前が示唆すること | 実際にしていること |
|---|---|---|
| `proposeGame` | LLM が企画を練る | `score` を `0.5` に固定。`title` は brief の 1 行目を 100 字で切る。`modelId` は文字列として書かれるだけで推論は呼ばない |
| `generateGame` | wasm をビルドする | `bafy` + `Math.random()` の CID を作り `buildStatus: "sources_ready"` を書く |
| `playtestGame` | ブラウザで実測する | `visualScore 0.8` / `perfScore 0.7` / `combinedScore 0.75` を固定で書く |
| `publishGame` | 公開する | sub-DID 文字列と `playUrl` を組み立てて書く |
| `tickStudio` | 傾向を見て起動する | ローカル時刻が 2–4 時か 14–16 時かだけを見る。`trendCount` は乱数 |

本物なのは **記録の形・検証・親子関係**である —— 存在しない spec を参照した
`generateGame` は `specNotFound` で断り、`publishGame` は spec と artifact の
両方が在ることを確かめ、brief の長さに上限がある。テストが押さえているのは
そこで、そこは実際に通る。

`get*` / `list*` は SDK の read をそのまま引き、フィルタとページングを被せる。

### 配備されていない

`xrpc-adapter/wrangler.jsonc` は `gameka.etzhayyim.com/xrpc/*` を主張するが、
**`gameka.etzhayyim.com` も `game-play.etzhayyim.com` も NXDOMAIN**（実測
2026-08-18）。`etzhayyim.com` 自体は解決する。つまりこの Worker は書かれている
が、出ていない。

## 使う

```bash
kbb --backend sci docs/verify-tests.cljk      # 10 テストを実際に走らせる（PASS/FAIL/3=判定不能）
kbb --backend sci docs/verify-custody.cljk    # 出所と一致しているか
```

**`kotoba/` で `npm install` は今日通らない。** 理由 3 つと、その回避が
なぜテストの正しさを損なわないかは
[`docs/operator-quickstart.md`](docs/operator-quickstart.md) に書いてある。

## 依存

`@etzhayyim/sdk`（write/read の面）と `@etzhayyim/sdk-auth`（Worker の認証）は
`etzhayyim/*` の git 依存として commit で pin されている。`kotoba/` は SDK を
**型としてしか使わない** —— `import type` は実行時に消えるので、テストは SDK の
ビルドを必要としない。
