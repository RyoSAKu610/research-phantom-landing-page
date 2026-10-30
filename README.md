# ResearchPhantom Studio

論文を **7つの場面** で読み解く、日本語のリサーチスタジオ（LP＋無料論文ライブラリ）。

## 🔗 すぐ開く

| | リンク |
| --- | --- |
| ▶️ **デモを開く（単一HTML・オフライン版）** | [standalone-offline.html](https://raw.githack.com/RyoSAKu610/research-phantom-landing-page/main/standalone-offline.html) |
| 🎧 音声試聴ノート（28本） | [voice-audition.html](https://raw.githack.com/RyoSAKu610/research-phantom-landing-page/main/voice-audition.html) |
| 📦 ZIPでダウンロード | [main.zip](https://github.com/RyoSAKu610/research-phantom-landing-page/archive/refs/heads/main.zip) |

> オフライン版では arXiv ライブ検索は使えません（外部 arXiv へのリンクを案内）。ライブ検索はローカルサーバー版で。

## できること

- **収録6論文を無料で閲覧** — 日本語の編集要約＋出典付き7場面。登録・決済なし、通信不要
- **検索・分野絞り込み・お気に入り・おすすめ**（端末内のみで計算）
- **案内役4人**（Phantom / Kitsune / Owl / Meiji）の演出とテキスト再生
- **arXiv ライブ検索＋Unpaywall OA確認**（サーバー版のみ）
- 有料プラン・AI Agent決済は **構想段階**（申込・決済は未接続）

## ローカルで動かす

Node 24 推奨。

```bash
npm install
npm run dev          # 開発サーバー（Vite）
```

```bash
npm run build && npm run start   # http://localhost:4173（API付き）
```

任意：`UNPAYWALL_EMAIL=あなたのメール npm run start` で OA 確認が有効に。

## ドキュメント

- [体験・接続設計](PHANTOMRESEARCH_PLAN.md)
- [オンライン検索（arXiv / Unpaywall）](ONLINE_RESEARCH_SETUP.md)
- [Agent相談と決済構想](AGENT_PAYMENT_SETUP.md)
- [収録論文の出典](src/research/SOURCES.md)
- 音声まわり: [ローカル音声の取り込み](ONDOKU_SETUP.md) / [ローカルTTSバンドル](LOCAL_TTS_BUNDLE.md) / [参照音声台本](VOICE_REFERENCE.md)
