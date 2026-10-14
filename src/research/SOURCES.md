# Phantomresearch 収録論文の出典・データ契約

確認日：2026-09-25

## 編集方針

- `papers.ts` は実在する6論文の書誌情報と日本語の**編集要約**を収録する。日本語題名も編集上の見出しであり、公式邦題や逐語訳ではない。
- 全論文に `question / input / process / caution / observation / interpretation / conclusion` の7場面を収録する。`sourceNote` の版・節・表の参照先を下記に示す。
- 著者の問題設定・方法・報告と、編集部の注意・解釈を本文と `sourceNote` で区別する。数値は確認した版の当時の実験結果であり、本サイトで再実験した値ではない。
- `year` はarXivへの初回投稿年。著者は省略せず、arXiv抄録ページの表記・順序を採用する。本文の改訂年とは別である。
- `readingMinutes` はこの日本語要約を読む時間の編集上の目安。原論文全体の読了時間ではない。
- 全件 `audioStatus: "not-recorded"`。収録論文の音声は未収録であり、LPの既存音声デモはこれらの論文の解説音声ではない。
- 検索・要約閲覧は同梱データだけで動作する。arXivの抄録・本文・PDFへのリンクを開く際には通信が必要。

## 確認した一次資料

6件すべてについてarXivの抄録ページを取得し、タイトル、全著者、初回投稿年、arXiv ID、抄録を確認した。下記の版の本文HTMLを取得し、場面で参照する節・表・脚注の本文も確認した。PDFリンクはHTTP HEADで全件 `200 / application/pdf` を確認した。本文の内容確認はHTMLによるもので、PDFを別途精読したという意味ではない。

| ID | 初回投稿 | 確認した版 | 抄録・書誌情報 | 本文HTML | PDF |
| --- | --- | --- | --- | --- | --- |
| `attention` | 2017-06-12 | v7（2023-08-02） | [1706.03762](https://arxiv.org/abs/1706.03762) | [v7](https://arxiv.org/html/1706.03762v7) | [PDF](https://arxiv.org/pdf/1706.03762) |
| `bert` | 2018-10-11 | v2（2019-05-24） | [1810.04805](https://arxiv.org/abs/1810.04805) | [v2](https://arxiv.org/html/1810.04805v2) | [PDF](https://arxiv.org/pdf/1810.04805) |
| `lora` | 2021-06-17 | v2（2021-10-16） | [2106.09685](https://arxiv.org/abs/2106.09685) | [v2](https://arxiv.org/html/2106.09685v2) | [PDF](https://arxiv.org/pdf/2106.09685) |
| `ddpm` | 2020-06-19 | v2（2020-12-16） | [2006.11239](https://arxiv.org/abs/2006.11239) | [v2](https://arxiv.org/html/2006.11239v2) | [PDF](https://arxiv.org/pdf/2006.11239) |
| `clip` | 2021-02-26 | v1 | [2103.00020](https://arxiv.org/abs/2103.00020) | [v1](https://arxiv.org/html/2103.00020v1) | [PDF](https://arxiv.org/pdf/2103.00020) |
| `rag` | 2020-05-22 | v4（2021-04-12） | [2005.11401](https://arxiv.org/abs/2005.11401) | [v4](https://arxiv.org/html/2005.11401v4) | [PDF](https://arxiv.org/pdf/2005.11401) |

`sourceUrl` と `pdfUrl` はarXivの標準URLで最新の版を開く。要約の根拠となる版は `sourceNote` とこの表に固定して記録している。

## 場面ごとの根拠

### Attention Is All You Need

日本語概要の根拠：Abstract、§3、§6。全著者8名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [§1](https://arxiv.org/html/1706.03762v7#S1)：再帰による逐次計算と並列化の制約。 |
| input | [§3.4–3.5](https://arxiv.org/html/1706.03762v7#S3.SS4)、[§5.1](https://arxiv.org/html/1706.03762v7#S5.SS1)：埋め込み、位置情報、WMT 2014英独約450万文対。 |
| process | [§3.1–3.3](https://arxiv.org/html/1706.03762v7#S3.SS1)：多頭注意、Q/K/V、フィードフォワード層、デコーダーのマスク。 |
| caution | [§3](https://arxiv.org/html/1706.03762v7#S3)、[§4・Table 1](https://arxiv.org/html/1706.03762v7#S4)：自己回帰生成と自己注意のO(n²d)。そこからの費用に関する注意は編集部による。 |
| observation | [§6.1・Table 2](https://arxiv.org/html/1706.03762v7#S6.SS1)：英独のbig 28.4 BLEU、base 27.3 BLEU。 |
| interpretation | [§4](https://arxiv.org/html/1706.03762v7#S4)：経路長と並列化の比較を踏まえた編集部の読解。 |
| conclusion | [§6.3](https://arxiv.org/html/1706.03762v7#S6.SS3)、[§7](https://arxiv.org/html/1706.03762v7#S7)：構文解析、結論、他のモダリティや局所注意への将来課題。 |

### BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding

日本語概要の根拠：Abstract、§3。全著者4名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [§1](https://arxiv.org/html/1810.04805v2#S1)：一方向事前学習の制約と深い双方向表現。 |
| input | [§3](https://arxiv.org/html/1810.04805v2#S3)、[§3.1](https://arxiv.org/html/1810.04805v2#S3.SS1)：入力表現、BooksCorpus 800M語、英語Wikipedia 2,500M語。 |
| process | [§3.1](https://arxiv.org/html/1810.04805v2#S3.SS1)：15%を予測対象にし、その80/10/10%で置換方法を変える。次文予測も行う。 |
| caution | [§3.2](https://arxiv.org/html/1810.04805v2#S3.SS2)、[§4.1](https://arxiv.org/html/1810.04805v2#S4.SS1)：全パラメータ微調整、小規模データでの不安定さ。誤読を避ける説明は編集部による。 |
| observation | [§4.1](https://arxiv.org/html/1810.04805v2#S4.SS1)、[§4.3](https://arxiv.org/html/1810.04805v2#S4.SS3)：公式GLUE 80.5、SQuAD 2.0単一BERT LargeのTest F1 83.1、改善幅5.1。 |
| interpretation | [§3](https://arxiv.org/html/1810.04805v2#S3)、[§5.1](https://arxiv.org/html/1810.04805v2#S5.SS1)：課題別微調整と学習目標のアブレーションを踏まえた編集部の読解。 |
| conclusion | [Abstract](https://arxiv.org/abs/1810.04805)、[§6](https://arxiv.org/html/1810.04805v2#S6)：双方向の事前学習から多様な下流課題へ。 |

### LoRA: Low-Rank Adaptation of Large Language Models

日本語概要の根拠：Abstract、§4–5。全著者8名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [§1–2](https://arxiv.org/html/2106.09685v2#S1)：全体微調整の費用、低ランク更新の仮説。 |
| input | [§4.2](https://arxiv.org/html/2106.09685v2#S4.SS2)、[§5・5.1](https://arxiv.org/html/2106.09685v2#S5)：評価モデル・データと主な適用行列。 |
| process | [§4.1](https://arxiv.org/html/2106.09685v2#S4.SS1)：W₀の固定、低ランク更新、推論前の重み統合。 |
| caution | [§4.1–4.2](https://arxiv.org/html/2106.09685v2#S4.SS1)：基盤モデルが依然必要な点（脚注4）、重み統合と異種タスクのバッチの制約。編集部による整理。 |
| observation | [Abstract](https://arxiv.org/abs/2106.09685)、[§4.2](https://arxiv.org/html/2106.09685v2#S4.SS2)：GPT-3 175BとAdamによる比較で学習対象約1/10,000、GPUメモリ約1/3。モデル全体のパラメータ削減率ではない。 |
| interpretation | [§4.1](https://arxiv.org/html/2106.09685v2#S4.SS1)、[§7.2](https://arxiv.org/html/2106.09685v2#S7.SS2)：差分の自由度に着目する編集部の読解。小ランクが万能ではない点は脚注6で著者も述べている。 |
| conclusion | [§8](https://arxiv.org/html/2106.09685v2#S8)：共有パラメータ、タスク切り替え、適用行列選択などの将来課題。 |

### Denoising Diffusion Probabilistic Models

日本語概要の根拠：Abstract、§3–4。全著者3名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [§1](https://arxiv.org/html/2006.11239v2#S1)：拡散モデルの先行研究と高品質な生成への問題設定。 |
| input | [§2](https://arxiv.org/html/2006.11239v2#S2)、[§3.2](https://arxiv.org/html/2006.11239v2#S3.SS2)、[§4–4.1](https://arxiv.org/html/2006.11239v2#S4)：ノイズのある画像、時刻、評価データ。 |
| process | [§3.2・Algorithms 1–2](https://arxiv.org/html/2006.11239v2#S3.SS2)、[§3.4](https://arxiv.org/html/2006.11239v2#S3.SS4)：ノイズ予測と単純化した目的関数、確率的な逆過程。 |
| caution | [§1](https://arxiv.org/html/2006.11239v2#S1)、[§4](https://arxiv.org/html/2006.11239v2#S4)、[§4.3](https://arxiv.org/html/2006.11239v2#S4.SS3)：実験のT=1000、尤度とサンプル品質の違いに基づく編集部の注意。 |
| observation | [§4.1–4.2・Tables 1–2](https://arxiv.org/html/2006.11239v2#S4.SS1)：無条件CIFAR-10のFID 3.17（訓練集合参照）と5.24（テスト集合参照）、目的関数の比較。 |
| interpretation | [§2](https://arxiv.org/html/2006.11239v2#S2)、[§4.3](https://arxiv.org/html/2006.11239v2#S4.SS3)：段階的生成の特徴を踏まえた編集部の説明。特定の原画像の一意な復元という主張ではない。 |
| conclusion | [§6](https://arxiv.org/html/2006.11239v2#S6)：高品質画像、スコアマッチングや圧縮との関係、将来の応用。 |

### Learning Transferable Visual Models From Natural Language Supervision（CLIP）

日本語概要の根拠：Abstract、§2–3。全著者12名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [Abstract](https://arxiv.org/abs/2103.00020)、[§1](https://arxiv.org/html/2103.00020v1#S1)：固定カテゴリによる教師信号の制約。 |
| input | [§2.1–2.2](https://arxiv.org/html/2103.00020v1#S2.SS1)：4億の画像・テキスト対、WIT、収集時の検索語。 |
| process | [§2.3](https://arxiv.org/html/2103.00020v1#S2.SS3)、[§3.1.2](https://arxiv.org/html/2103.00020v1#S3.SS1.SSS2)：対照学習と候補テキストを使うゼロショット分類。 |
| caution | [§3.1.4](https://arxiv.org/html/2103.00020v1#S3.SS1.SSS4)、[§6](https://arxiv.org/html/2103.00020v1#S6)：プロンプトの影響、数え上げ・距離判定などの弱点を踏まえた編集部の注意。 |
| observation | [§3.1.3・Table 1](https://arxiv.org/html/2103.00020v1#S3.SS1.SSS3)、[§3.1.5・Figure 5](https://arxiv.org/html/2103.00020v1#S3.SS1.SSS5)：ImageNet Top-1 76.2%、線形分類器ベースラインに16/27データセットで勝る。 |
| interpretation | [§3.1.2–3.1.4](https://arxiv.org/html/2103.00020v1#S3.SS1.SSS2)、[§6](https://arxiv.org/html/2103.00020v1#S6)：言葉で候補を指定する仕組みについての編集部の解釈。 |
| conclusion | [§9](https://arxiv.org/html/2103.00020v1#S9)：大規模な自然言語による事前学習と転移の可能性・改善余地。 |

### Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks

日本語概要の根拠：Abstract、§2、§4.5。全著者12名。

| 場面 | 根拠と確認内容 |
| --- | --- |
| question | [Abstract](https://arxiv.org/abs/2005.11401)、[§1](https://arxiv.org/html/2005.11401v4#S1)：内部知識へのアクセス、更新、根拠の課題。 |
| input | [§2.2–2.4](https://arxiv.org/html/2005.11401v4#S2.SS2)、[§3](https://arxiv.org/html/2005.11401v4#S3)：DPR、BART-large、固定した文書索引、2018年12月Wikipediaの100語区間・約21M文書。 |
| process | [§2.1](https://arxiv.org/html/2005.11401v4#S2.SS1)：RAG-Sequence/Tokenの周辺化。両者とも入力xで得た上位文書群を使う。 |
| caution | [§4.3・Table 4](https://arxiv.org/html/2005.11401v4#S4.SS3)、本文末の[Broader Impact](https://arxiv.org/html/2005.11401v4)：誤りの残る生成と知識源の限界からの編集部の注意。 |
| observation | [§3.1](https://arxiv.org/html/2005.11401v4#S3.SS1)、[§4.1・Table 1](https://arxiv.org/html/2005.11401v4#S4.SS1)：NQテストのExact MatchはRAG-Sequence 44.5、DPR 41.5。 |
| interpretation | [§4.5 Index hot-swapping](https://arxiv.org/html/2005.11401v4#S4.SS5)：2016/2018年の索引交換実験を踏まえた編集部の設計上の解釈。 |
| conclusion | [§6](https://arxiv.org/html/2005.11401v4#S6)：内部・外部メモリの協調と将来の事前学習の研究。 |

## UIとの公開契約

- `PaperScene`、`Paper`、`PAPERS`、`searchPapers(papers, query, field = "all")`、`parseSavedPaperIds(raw)` をエクスポートする。
- IDは `attention / bert / lora / ddpm / clip / rag`。フィルター用の `field` は `自然言語処理 / 効率的学習 / 画像生成 / マルチモーダル / 情報検索`。UIは収録データから候補を生成できる。
- `searchPapers` はNFKC正規化と小文字化を行うリテラル部分一致検索。空白区切りの**すべての語**が同じ論文に一致する必要がある。英日タイトル、全著者、タグ、年、分野、日本語概要、arXiv IDが対象。`arxiv:ID` 表記でも検索できる。
- 検索対象配列とその順序を保持し、新しい結果配列を返す。分野は完全一致、`all` のみ全分野。空白のみの検索は分野に合う全件。検索語を正規表現として実行しない。
- 前後の空白を除いて512 UTF-16コード単位を超える検索、またはNFKC正規化後に512を超える検索は0件を返す。長すぎる検索の後半を黙って捨てることはない。
- `parseSavedPaperIds` はJSON配列形式の文字列を受け取る純粋関数。既知の文字列IDだけを最初の出現順に返す。重複、未知ID、文字列以外を除外し、上限100件（現在は既知IDが6件）とする。
- 保存値は最大16,384 UTF-16コード単位。超過・不正JSON・配列以外・`null` は空配列。localStorage自体へのアクセスは行わないため、読み書き時のブラウザ例外は呼び出し側で扱う。

## データと純粋関数の確認

追加依存なしの focused test：Node.js 24でプロジェクトルートから実行する。

```sh
node --test src/research/papers.validation.mjs
```

検査対象は、IDとarXivリンクの整合性、7場面の順序と出典、音声未収録状態、日英・全角・複数語・分野の検索、空入力・過長入力、保存値の破損・未知ID・重複・サイズ制限。出典本文の内容は上記の一次資料との目視照合で確認しており、テストが論文内容の正しさを証明するものではない。
