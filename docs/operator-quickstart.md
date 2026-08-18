# operator quickstart — app-gameka

**この文書の手順は 2026-08-18 に上から順に実行して確認した。** 踏めない手順は
書いていない。踏めないと分かったものは「踏めない」と、その理由の実測とともに
書いてある。

## 0. 要るもの

実行に使った版（`--version` の実測値。ここに書いた版でなければ動かない、という
意味ではない）:

| | 実測 | 何に使うか |
|---|---|---|
| `nbb` | 1.4.210 | この repo の検査器 2 本 |
| `node` | 26.3.0 | 同上 + vitest |
| `pnpm` | 10.26.2 | vitest を入れる（`npm` でもよい） |
| `git` | 2.51.0 | 出所 tree の再構成 |
| `gh` | — | `--origin` を付けるときだけ |

外向きの HTTPS が要る（GitHub から sdk-mock と vitest を取る）。圏外なら
検査器は **exit 3**（判定不能）で降りる。0 では降りない。

## 1. 取る

```bash
git clone git@github.com:cloud-itonami/app-gameka.git
cd app-gameka
```

west 管理下から使うなら `orgs/cloud-itonami/app-gameka` に既に在る。**その共有
checkout で編集や commit をしない**（CLAUDE.md 並行エージェント運用）。触るなら
superproject の外に worktree を切る。

## 2. 出所と一致しているか

この repo は `etzhayyim/root` からの抽出物なので、**足したもの以外は 1 バイトも
変わっていない**ことを確かめられる。

```bash
nbb docs/verify-custody.cljs            # ローカルだけ（network 不要）
nbb docs/verify-custody.cljs --origin   # 出所 GitHub の実 tree とも突き合わせる
```

実際の出力:

```
SCANNED	15 保管ファイル / 6 追加物 / 4 検査
  ok   出所 tree（再構成 vs 記録）
         got  8523aa3e90a0f5e4a780d2705dde8d18267880b9
  ok   保管ファイル数
         got  15
  ok   保管バイト数
         got  72071
  ok   出所 GitHub の実 tree（etzhayyim/root@57d57fc4:60-apps/etzhayyim-project-gameka）
         got  8523aa3e90a0f5e4a780d2705dde8d18267880b9
PASS — 保管対象 15 ファイルは出所と同一
```

「追加物」は `migration.edn` の `:identity :allowed-additions` に挙げた 6 つ
（`README.edn` / `migration.edn` / `README.md` と `docs/` の 3 ファイル）。**保管対象のファイルを
ここに紛れ込ませて検査を迂回しようとすると、その分だけ再構成 tree から消えて
ハッシュが合わなくなる。**

## 3. テストを走らせる

```bash
nbb docs/verify-tests.cljs
```

実際の出力（所要 9 秒、うちほとんどが sdk-mock の clone と vitest の取得）:

```
sdk-mock  https://github.com/etzhayyim/com-etzhayyim-sdk-mock.git @ c857ff9be531
vitest    ^4.1.0
include   test/**/*.test.ts
work      /var/folders/.../gameka-verify-tests-57378
SCANNED	1 テストファイル / 10 テスト
PASS — 10/10 のテストが実際に走って通った
```

`--keep` を付けると作業ディレクトリが残るので、`work` の中で `vitest` を直接
叩いて 1 本だけ回すこともできる。

### `npm install` はなぜ通らないのか

`kotoba/package.json` が宣言するとおりに入れようとすると入らない。3 つ重なって
いる（すべて 2026-08-18 実測）:

| # | どこで | 何が起きるか |
|---|---|---|
| 1 | npm 11.16.0 | git 依存の prepare を拒否する。`EALLOWSCRIPTS: --allow-scripts is not allowed in project-scoped installs` |
| 2 | pnpm 10.26.2 | 同じ理由で拒否（`ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED`）。`onlyBuiltDependencies` に載せると内部で `npm install` を呼ぶので **1 に戻る** |
| 3 | 依存の奥 | `@etzhayyim/sdk` → `kotoba-lang/ipfs#main` の package.json に `name` が無い（`ERR_PNPM_MISSING_PACKAGE_NAME`） |

つまり 1 と 2 を越えても 3 で止まる。**`@etzhayyim/sdk` はいま入らない。**

### なぜ回避してよいのか（テストの正しさを損なわない理由）

`verify-tests.cljs` は SDK を入れずに走らせる。これが誤魔化しでない根拠は
2 つで、どちらも読めば確かめられる:

1. `kotoba/src/lifecycle.ts` が SDK から取るのは **`import type { Etzhayyim }`
   だけ**。型注釈は実行時に消えるので、SDK の `dist/` は 1 度も読まれない。
2. テストが実行時に触るのは `@etzhayyim/sdk-mock` ただ 1 つで、その
   `src/index.ts` は **import を 1 つも持たない自己完結した 1 ファイル**
   （309 行）。SDK の型を再宣言しているだけである。

だから検査器は sdk-mock を **`package.json` が pin した commit のまま**取ってきて
alias で挿す。pin は焼き込まずその場で読む —— 焼き込むと、宣言が動いたときに
**宣言と違うものを検査して緑を出す**ことになる。

これは回避策であって修正ではない。上の 3 点が上流で直れば `pnpm test` が直接通る。

## 4. 出す（できない）

`xrpc-adapter/` は `wrangler deploy` の形をしているが、今日は出せない:

- `@etzhayyim/sdk-auth` が `@etzhayyim/sdk` を要求し、§3 の 3 で止まる
- `wrangler.jsonc` の route `gameka.etzhayyim.com/xrpc/*` の **ホストが存在しない**
  （`gameka.etzhayyim.com` は NXDOMAIN、実測 2026-08-18）
- 同じ理由で `publishGame` が返す `https://game-play.etzhayyim.com/<slug>` も
  解決しない

`xrpc-adapter/README.md` の `cd 60-apps/etzhayyim-project-gameka/xrpc-adapter` は
**抽出前のモノレポのパス**で、この repo には存在しない。そこも直っていない。

## 5. exit code の読み方

両方の検査器で共通:

| exit | 意味 |
|---|---|
| 0 | PASS |
| 1 | FAIL —— 実際に測って、合っていなかった |
| 3 | **判定できなかった** —— 圏外・道具が無い・記録が読めない・走ったテストが 0 件 |

**3 は 0 と別の値である。** 測れなかったことを「問題なし」と同じ顔で返さない
ためにこうしてある（CLAUDE.md「検査を書く前・緑を信じる前の 5 問」）。
`verify-tests.cljs` は **テストが 0 件走ったとき PASS と言わない** ——
vitest は 1 件も走らなかったとき件数を数字で出さず `Tests  no tests` と書くので、
そこを専用に受けている。

## 6. 検査器が本当に赤くなるか、自分で確かめる

信じる前に落とす。次の 3 つは実際にこうなることを確認済み:

```bash
# ① 実装を壊す → exit 1。落ちるテストが壊した箇所と一致する
sed -i '' 's/input.brief.length > 2000/input.brief.length > 3000/' kotoba/src/lifecycle.ts
nbb docs/verify-tests.cljs; echo $?
#   × rejects proposal with brief exceeding 2000 chars
#   FAIL — 1/10 が落ちた          … exit 1
git checkout kotoba/src/lifecycle.ts

# ② テストが 1 件も走らない状態 → exit 3（0 ではない）
#    kotoba/test/ を空の describe だけにすると:
#   SCANNED	1 テストファイル / 0 テスト
#   UNDETERMINED: 走ったテストが 0 件。   … exit 3

# ③ pin を存在しない commit にする → exit 3
#   UNDETERMINED: sdk-mock に pin 0000… が無い   … exit 3
```

保管検査も同じように落とせる —— 保管対象のファイルを 1 バイト編集すれば
「保管バイト数」が FAIL する。

## 7. 次に触るなら

- `CLAUDE.md` は現状の説明として誤っている（§「この repo に無いもの」）。
  設計意図の資料として残すか、実態に合わせて削るかは決まっていない。
- `kotoba/README.md` が張るリンク `../../../90-docs/adr/2605203000-*.md` は
  この repo に存在しない（抽出前のパス）。
- `docs/verify-custody.cljs` は `app-telecom` から持ってきたもので、
  `app-roukisho` / `app-saiban` / `app-shomeisyashin` / `app-sre` にも同型が
  在る。直すときは 1 本だけ直さないこと。
