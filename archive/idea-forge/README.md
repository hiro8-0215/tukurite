# IDEA FORGE

アイデアを保存し、端末内AIで企画を具体化して、Solana Devnetにハッシュを記録する日本語Webアプリです。

## 使い方
1. 「アイデアをつくる」から名前と内容を入力して保存。
2. 「AIで企画を育てる」を押すとQwen2.5 1.5Bを初回取得して端末内で推論。WebGPU対応のPCブラウザが必要です。初回は約1GBの取得に通信と数分かかる場合があります。
3. PhantomまたはSolflareを接続。DevnetのテストSOLを用意し、公開内容の確認にチェックして記録。署名時はDevnetのMemo命令であることを確認してください。
4. Explorerでトランザクションを確認できます。確認待ちは「確認状態を再取得」で照会できます。

本文はlocalStorageに保存され、他のブラウザ・端末には同期されません。定期的にJSONを書き出してください。ウォレット秘密鍵は扱いません。チェーンにはSHA-256ハッシュのみを送ります。記録は所有権証明ではなく、Devnetの履歴はリセットされる場合があります。

## ローカル起動
静的HTTPサーバーでdistを配信してください。ファイルを直接開く方法はESモジュールに対応しません。HTTPSまたはlocalhostが必要です。

## 構成
- dist/index.html : 日本語UI
- dist/style.css : レスポンシブスタイル
- dist/app.js : 保存・検索・JSON書き出し・AI・Solana
- AI: @mlc-ai/web-llm 0.2.79 / Qwen2.5-1.5B-Instruct-q4f16_1-MLC
- Solana: @solana/web3.js 1.98.4 / Devnet Memo
- 外部依存はesm.run、esm.sh、Hugging Face、Google Fontsから取得します。

## 確認状況
ブラウザで作成・保存・再読み込み後の保持・検索・記録前の確認チェックを検証済み。JSON書き出しと0.5Bモデルでの推論完了も確認。品質改善のため最終版は1.5Bに変更しており、このモデルでの推論完了・ウォレット署名・実際のDevnet記録は未検証です。

参考: https://github.com/mlc-ai/web-llm
参考: https://github.com/solana-foundation/developer-content/blob/main/content/cookbook/transactions/add-memo.md
