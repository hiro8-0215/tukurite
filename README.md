# つくりて

公開先: https://tsukurite-kitchen.expo.app/

## 資料

- [サイト紹介と現状（PDF）](docs/つくりて_サイト紹介と現状_2026-11-11.pdf)
- [最終発表スライド（PowerPoint）](presentation/つくりて_3分プレゼン_2026-11-02.pptx) / [閲覧用PDF](presentation/つくりて_3分プレゼン_2026-11-02.pdf) / [3分発表原稿](presentation/つくりて_発表原稿_2026-11-02.md)
- [仕様と実演](docs/つくりて_仕様と実演.md) / [レビュー対応と確認結果](docs/つくりて_レビュー対応と確認結果_2026-11-11.md) / [検証資料と画面画像](docs/)
- [過去の実装](archive/)（Sites版と初期のIDEA FORGE試作）

## ローカルで開く

Node.js を用意し、このディレクトリで `npm ci` と `npm run dev` を実行します。ビルドは `npm run build` です。本番バックエンドと別の環境に接続する場合は、アプリのSupabase接続設定とEdge Functionの配置を合わせてください。

レシピ棚と同じExpo Hosting・Supabase・Gemini 3.6 Flashを使う、独立したレシピSNSです。画面は既存つくりてのReact Web画面を維持し、Viteで静的出力してExpoへ配置します。Expoネイティブアプリへ作り直したものではありません。

- Expo: `oo0-hiro-0oos-team/tsukurite`, project `f06d20c4-9627-4cbe-baa3-76d165de05eb`
- Supabase: `tsukurite`, ref `lcgpgyncmdsidgbtpjoy`, Free / Tokyo
- Auth: 専用ID・パスワード。ChatGPT不要。レシピ棚のアカウントやデータとは別。
- DB: Postgres。21表でRLSを有効化し、ブラウザーからの直接アクセスは権限を撤回。JWTを検証するEdge Functionだけが、本人の条件を付けて処理。
- 写真: 非公開Supabase Storage。閲覧APIが本人・公開レシピ・公開中の作った投稿の参照を検査。原本や写真投稿を非公開化すると、他人への写真の配信も止まります。
- AI: 元レシピ棚の`import-recipe`を移植。Gemini 3.6 Flash。URL・共有本文・最大6枚のスクリーンショット。手入力でも保存可能。
- 自作レシピAI: Gemini 3.5 Flash-Liteで「こだわりポイント・料理メモ」から具材・分量・手順を提案し、最後に材料表記と工程を整えます。案のプレビューを確認して反映し、反映前への取り消しも可能です。外部の取り込みは従来通りGemini 3.6 Flashでの抽出のみで、創作提案とは別の処理です。503等の一時障害は追加枠を予約できた場合に1回だけ再試行します。
- 使用感: スマホの下部ナビ、読みやすい本文・入力欄、保存済み表示、複数食材での検索、未入力・不正な人数での公開防止を追加。外部の非公開メモでも手順をチェックできます。ログアウトはプロフィール・設定内です。
- 下書き: 端末のlocalStorageへ即時保存し、1秒の待機後にSupabaseへ自動同期。同じアカウントで別のスマホ・PCから再開できます。新規作成と各原本の改訂を分け、版番号の比較で他端末の変更を無断で上書きしません。競合時は両方を確認して選択。削除・再作成後も古い版番号を再利用しません。共用端末では端末内に下書きが残ることに注意してください。
- つながり: 作者をフォローし、新作と原本に紐づく「作った」をタイムラインへ表示。アプリ内のお知らせでフォロー・公開/改訂・保存・調理・コメントを確認できます。画面の更新かアプリへ戻った際に再取得します。OSのプッシュ通知ではありません。
- 作った投稿: 自分の料理写真と感想を、原本・作者への参照と一緒に公開。写真の公開同意と実際に調理した確認が必須です。コメント・作者の返信、投稿や自分のコメントの非公開化、問題の報告に対応。写真を追加しても調理ポイントは重複しません。
- 自分用AIアレンジ: 原本から人数・手持ち食材・好みをGemini 3.5 Flash-Liteへ送り、変更点を確認して非公開の棚へ保存。原作者・原本の版とハッシュをサーバーで確認し保持します。原本が更新された場合は再生成を案内。公開・チェーン登録・分配の対象にはしません。既存の作成/仕上げモデルと利用枠を共有します。
- 献立・買い物: 棚の原本、材料入りの外部メモ、自分用アレンジを朝・昼・夜の献立へ追加。人数を変更でき、週の材料を同じ食材・互換単位ごとに合算。kg/g、L/ml、分数に対応し、曖昧な分量は捏造しません。買い物チェックを端末間で同期し、リストのコピーもできます。献立は追加時の内容と出典を保存し、後の原本更新に影響されません。
- Solana: 元つくりてのDevnet登録・送金検証処理を維持。Mainnet送金や課金なし。

## 無料運用

2026-10-22にSupabase組織がFree、新規プロジェクト見積もり月0ドル、Expoの契約がFreeであることをAPIで確認。有料契約への切替はしていません。

無料枠には上限があります。Supabase Freeは利用がないと一時停止する場合があります。Expo Freeは学生・試作向けの制限があります。広告収入や有料サブスクを開始する前に各社の条件を再確認してください。

GeminiはGoogle側で課金を有効にしていないプロジェクトのキーを使ってください。アプリだけではGoogle契約の無料・有料を判定できません。別プロジェクトにキーを設定してもGoogle側の同じ無料枠を共有する場合があります。抽出用と作成・仕上げ用の各モデル20試行/直近24時間、両者合計40試行/直近24時間、合計5試行/分、利用者12試行/時で保守的に制限し、失敗・再試行も試行として数えます。モデル別の上限はai_jobsのmodelで追跡します。Google側の実際の上限はAI Studioで確認してください。429時には停止し、有料モデルへ切り替えません。検索グラウンディングは使いません。キー未設定時は503で停止します。

秘密キー設定先: https://supabase.com/dashboard/project/lcgpgyncmdsidgbtpjoy/functions/secrets
`GEMINI_API_KEY`だけを設定すれば抽出に`gemini-3.6-flash`、自作の作成・仕上げに無料枠のある`gemini-3.5-flash-lite`を使います。キーは画面コード、Git、EXPO_PUBLIC変数へ入れません。

## 開発・検証

```powershell
npm ci
npm run build
node scripts/test-live.mjs
node scripts/test-chef.mjs
node --experimental-strip-types scripts/test-experience.mjs
node --experimental-strip-types scripts/test-ai-failures.mjs
node --experimental-strip-types scripts/test-community.mjs
node scripts/test-core-community.mjs
node --experimental-strip-types scripts/test-planning.mjs
node --experimental-strip-types scripts/test-community-live.mjs
node scripts/test-refine-pasta.mjs
```

実環境のテストは専用QAアカウントを作り、テスト投稿を最後に非公開化します。AIキー未設定の停止も検査します。実際に調理していないテスト調理報告やチェーン送金は作りません。

コミュニティ・写真投稿・コメント・ポイント重複防止はPGliteの隔離Postgresで確認します。PGliteは開発用依存のみで、本番の保存先は引き続きSupabaseです。`test-community-live.mjs`は専用QA間のデータ分離・下書き競合・献立保存を実サーバーで確認し、Geminiを1回使用します。公開の調理報告やチェーン取引は作らず、その実行で作った非公開データだけを後片付けします。QAの認証情報はGit対象外の`.env*`に保存します。

`test-chef.mjs`はGeminiへ実リクエストを3回送ります。こだわりの反映、指定食材の除外、人数保持、仕上げ時の既知分量の保持、元の取り込み処理の継続を確認し、公開投稿は作成しません。`CHEF_ONLY=1`では抽出を省略し作成・仕上げだけを2回実行します。`test-refine-pasta.mjs`は画像の事象に合わせたタコのパスタを1回仕上げ、既知の分量と相対的な茹で時間を保つことを検査します。どちらも無料枠保護の回数を消費します。

失敗は混雑・利用上限・回答途中切れ・不正形式を区別して表示し、本文やキーを含めずリクエストIDと失敗コードをサーバーログへ記録します。失敗時の「AIなしで入力の表記を整理」は端末内で空行や余分な空白だけを整理し、AI未使用と明示してプレビューします。

## 配置

SupabaseのDDLは`supabase/migrations/`。Edge Functionは`supabase/functions/api`・`community`・`import-recipe`・`register-with-id`。`verify_jwt=false`は新しいPublishable keyとの互換性のためで、api・community・import-recipeの関数内で`auth.getUser(token)`を使って毎回JWTを検証します。register-with-idは新規登録専用の公開口です。`scripts/edge-bundle.mjs`は配置に必要な相対依存を含むJSONを標準出力へ生成します。

既存のセキュリティ診断には漏洩パスワード保護の未有効化が残ります（[Supabaseの説明](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)）。本変更で有料プランへの移行や認証設定の変更はしていません。RLSポリシーなしのINFOは、直接アクセス権限を撤回して認証済みEdge Function経由に限定する既存構成によるものです。

Expo配置は、このフォルダーのapp.jsonのprojectIdを保持して行います。既存レシピ棚のprojectIdを指定してはいけません。

```powershell
npm run build
eas deploy --prod --non-interactive --export-dir hosting
```

元のSites版は削除していません。新しい利用・共有にはExpoのURLを使います。旧サイトの削除や契約終了はこのソースからは実行できません。

## 2026-11-11 レビュー対応

- 全体の検索はサーバー検索・40件ずつのカーソルページ送り。棚の原本・自作は別取得し、共有リンクはIDで取得します。JSON書き出しも専用APIで全件取得します。
- 公開文書ハッシュに部分一意インデックスを追加。完全一致は全件対象、類似検査は500件ずつ走査。公開の版比較と更新は同一トランザクションです。古い版は409を返し、画面で差分を確認します。世界中の料理の一意性を保証する機能ではありません。
- /r/:id は登録なしで公開原本を読むページです。レシピ別OGPをサーバーで返します。公開原本に現在紐づく画像だけ配信し、非公開・未知のIDは404にします。旧 /?recipe=... 共有URLもゲスト画面へ対応。
- フロントは既存Viteのままです。ビルド後にscripts/package-hosting.mjsでExpo Hosting用のclient/server出力を作成し、server/share.cjsを公開原本用のGETルートとして追加します。確認済み出力はhosting/。dist/だけを配置すると共有HTMLルートが欠落するので、必ずhosting/を配置してください。
- プロフィール・設定から現在のパスワードを確認して192ビットの復旧コードを発行。保存した確認後に有効化します。サーバーはハッシュのみ保管し、使用後は消費。パスワードとコードの両方を失った場合の本人確認／復旧は提供していません。無料運用を維持するためメール配信サービスは追加していません。
- 復旧後は以前のセッションをアプリの各認証APIで拒否します。JWTの検証に加え、auth.sessionsの存続と復旧前に作成されたセッションでないことを確認します。
- 登録口は全体30試行/時・送信元識別値ごと5試行/時、復旧は全体60試行/時・送信元10試行/時・IDごと10試行/時です。送信元情報だけを信頼せず全体制限を併用します。高度な複数アカウント・報酬不正対策の代わりではありません。
- 新関数public-recipeは公開原本とhealthのGETのみ、account-securityは設定取得・発行・有効化に認証必須、復旧にはIDと復旧コードが必要です。
- 追加検証: node --experimental-strip-types scripts/test-reliability.mjs / node scripts/test-reliability-live.mjs。後者は専用QAアカウントの認証情報だけを.env.recovery-qa.jsonへ保存し、同アカウントのパスワードを実際に変更して旧セッション拒否を検査します。実ユーザーや本番レシピは変更しません。
