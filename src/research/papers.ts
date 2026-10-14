/**
 * Curated, offline paper catalog. Japanese copy is an edited summary, not a
 * verbatim translation. Source versions and verification notes: ./SOURCES.md.
 * readingMinutes estimates time for these summaries, not the original paper.
 * No paper in this catalog has recorded narration.
 */
export type PaperScene = {
  key: "question" | "input" | "process" | "caution" | "observation" | "interpretation" | "conclusion";
  label: string;
  heading: string;
  body: string;
  sourceNote: string;
};

export type Paper = {
  id: string;
  title: string;
  titleJa: string;
  authors: string[];
  year: number;
  field: string;
  sourceUrl: string;
  pdfUrl: string;
  arxivId: string;
  abstractJa: string;
  readingMinutes: number;
  tags: string[];
  scenes: PaperScene[];
  audioStatus: "not-recorded";
};

export const PAPERS: Paper[] = [
  {
    id: "attention",
    title: "Attention Is All You Need",
    titleJa: "Transformer：Attentionを中心にした系列変換",
    authors: [
      "Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit",
      "Llion Jones", "Aidan N. Gomez", "Lukasz Kaiser", "Illia Polosukhin",
    ],
    year: 2017,
    field: "自然言語処理",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    pdfUrl: "https://arxiv.org/pdf/1706.03762",
    arxivId: "1706.03762",
    abstractJa: "編集要約：再帰や畳み込みを使わず、Attentionを中心に入力と出力の関係を学ぶTransformerを提案した論文。位置情報と複数のAttentionヘッドを組み合わせ、WMT 2014の英独・英仏の機械翻訳で、品質と学習の並列化を両立できることを示した。",
    readingMinutes: 5,
    tags: ["Transformer", "Attention", "自己注意", "機械翻訳", "NLP"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "文を、順番どおりに計算する必要はある？",
        body: "著者が取り組むのは、再帰型モデルでは系列の前の計算を待つ必要があり、学習を並列化しにくいという問題。離れた単語の関係を直接扱うAttentionを中心にすれば、翻訳の品質を保ちながら、この逐次計算の制約を減らせるだろうか。",
        sourceNote: "出典：arXiv:1706.03762v7 §1 Introduction。著者の問題設定の編集要約。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "翻訳の文対と、単語の位置を受け取る",
        body: "学習にはWMT 2014の英独・英仏データを用いる。英独データは約450万の文対。文をサブワードのトークンに分けてベクトルに変換し、入力の並び順を扱えるよう位置情報を加える。Attentionに渡す前の、この表現づくりもモデルの一部になる。",
        sourceNote: "出典：arXiv:1706.03762v7 §3.4 Embeddings and Softmax、§3.5 Positional Encoding、§5.1 Training Data and Batching。",
      },
      {
        key: "process",
        label: "思考",
        heading: "関連する位置の情報を、複数の視点で集める",
        body: "QueryとKeyの適合度から重みを作り、Valueの情報を重み付きで集める。これを複数のヘッドで並行して行い、位置ごとのフィードフォワード層と組み合わせる。デコーダーには、予測する位置より先の正解を見ないようマスクをかける。",
        sourceNote: "出典：arXiv:1706.03762v7 §3.1 Encoder and Decoder Stacks、§3.2 Attention、§3.3 Position-wise Feed-Forward Networks。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "並列化しやすさと、長い入力の費用は別",
        body: "編集部の注意：全位置どうしを結ぶ自己注意の計算量は、系列長nに対して二次的に増える。論文のTable 1でもO(n²d)と整理されている。また、このモデルの生成は1トークンずつ進む。学習を並列化できることを、長文や生成が無条件に安くなるという意味には取れない。",
        sourceNote: "編集部の注意。根拠：arXiv:1706.03762v7 §3 Model Architecture、§4 Why Self-Attention・Table 1。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "英独翻訳で28.4 BLEUを報告",
        body: "WMT 2014の英独翻訳で、bigモデルは28.4 BLEU、baseモデルは27.3 BLEUを記録した。著者はbigモデルが、当時の既報モデルをアンサンブルも含めて上回ったと報告している。これは同論文の翻訳タスクと評価条件における結果である。",
        sourceNote: "出典：arXiv:1706.03762v7 §6.1 Machine Translation・Table 2。数値は著者の報告。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "情報が届くまでの距離を、設計し直した",
        body: "編集部の解釈：この論文の読みどころは、離れた位置どうしが情報を交換する経路を短くした点にある。逐次処理の少なさ、位置間の経路長、計算量を一緒に見ると、Transformerの設計上の狙いがつかみやすい。Attentionの重みを、そのまま人間の理解の証拠とみなす解釈ではない。",
        sourceNote: "編集部の解釈。根拠：arXiv:1706.03762v7 §4 Why Self-Attention。著者の実験結果とは区別した読解。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "Attentionを系列変換の中心に置けた",
        body: "著者は、再帰層を多頭自己注意に置き換えた構成で、高い翻訳品質と短い学習時間を実現できると結論づける。英語の構文解析への適用も示した。テキスト以外への拡張や、大きな入力を扱う局所的なAttentionは、今後の研究課題として挙げている。",
        sourceNote: "出典：arXiv:1706.03762v7 §6.3 English Constituency Parsing、§7 Conclusion。著者の結論の編集要約。",
      },
    ],
  },
  {
    id: "bert",
    title: "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    titleJa: "BERT：左右の文脈から学ぶ言語理解の事前学習",
    authors: ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    year: 2018,
    field: "自然言語処理",
    sourceUrl: "https://arxiv.org/abs/1810.04805",
    pdfUrl: "https://arxiv.org/pdf/1810.04805",
    arxivId: "1810.04805",
    abstractJa: "編集要約：BERTは、左右両方の文脈を各層で利用するTransformerの言語表現を、ラベルなしの文章から事前学習する。単語の一部を予測する学習などを経て、タスクに応じた出力層を追加しモデル全体を微調整することで、質問応答や自然言語推論など11の課題で当時の最高性能を報告した。",
    readingMinutes: 5,
    tags: ["BERT", "Transformer", "事前学習", "双方向", "Masked LM", "NLP"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "単語の意味を、左側だけから決めてよい？",
        body: "著者は、一方向の言語モデルでは各トークンが参照できる文脈が制約されると指摘する。特に質問応答のような単語単位の判断では、前後の情報が重要になる。深いネットワークの各層で左右の文脈を同時に使い、汎用的な言語表現を学べないだろうか。",
        sourceNote: "出典：arXiv:1810.04805v2 §1 Introduction。著者の問題設定の編集要約。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "ラベルなしの文章を、共通の入力形式へ",
        body: "事前学習にはBooksCorpusの約8億語と英語Wikipediaの約25億語を使う。単一の文章も文章の組も、WordPieceで分割し、[CLS]や[SEP]を含む一つの系列で表現する。トークン、文章の区分、位置の埋め込みを足し合わせて入力にする。",
        sourceNote: "出典：arXiv:1810.04805v2 §3 Input/Output Representations、§3.1 Pre-training BERT。",
      },
      {
        key: "process",
        label: "思考",
        heading: "隠れた語と、文章どうしの関係を学ぶ",
        body: "トークンの15%を予測対象に選ぶ。そのうち80%を[MASK]に、10%をランダムな語に置き換え、10%は元のままにして、元の語を予測する。さらに、二つの文章が元の文書で続いていたかを判定する次文予測も、事前学習に組み込む。",
        sourceNote: "出典：arXiv:1810.04805v2 §3.1 Pre-training BERT（Masked LM、Next Sentence Prediction）。割合は著者の設定。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "出力層を足しても、学習はそこで終わらない",
        body: "編集部の注意：「出力層を一つ追加する」という説明は、追加した層だけを学習するという意味ではない。論文の主要な下流タスクでは、正解付きデータを用いて全パラメータを微調整する。また著者は、小規模データでBERT Largeの微調整が不安定になる場合も報告している。",
        sourceNote: "編集部の注意。根拠：arXiv:1810.04805v2 §3.2 Fine-tuning BERT、§4.1 GLUE。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "異なる言語理解課題で性能を確認",
        body: "著者はBERT Largeで公式GLUEスコア80.5、SQuAD 2.0のTest F1で83.1を報告した。後者は単一モデルの結果で、論文が比較する従来の最高スコアから5.1ポイントの改善。これらはベンチマーク上の指標であり、会話全般の正答率を示すものではない。",
        sourceNote: "出典：arXiv:1810.04805v2 §4.1 GLUE、§4.3 SQuAD v2.0・Table 3。末尾は編集部による指標の補足。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "共通の事前学習から、課題ごとに育てる",
        body: "編集部の解釈：BERTは、さまざまな言語理解課題に共通の出発点を用意したと読める。ただし各課題には別々に微調整したモデルを使う。§5.1の比較実験も合わせて読むと、モデルの大きさだけでなく、どの文脈を参照して何を予測させるかという学習目標の重要性が見えてくる。",
        sourceNote: "編集部の解釈。根拠：arXiv:1810.04805v2 §3 BERT、§5.1 Effect of Pre-training Tasks。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "深い双方向の事前学習を、転移の土台に",
        body: "著者の結論は、ラベルなしの文章で学んだ深い双方向表現を、幅広いNLP課題の初期値として利用できるというもの。大きな課題固有の構造変更をせずに、文単位の分類から単語単位の質問応答まで適応できることを実験で示した。",
        sourceNote: "出典：arXiv:1810.04805v2 Abstract、§6 Conclusion。著者の結論の編集要約。",
      },
    ],
  },
  {
    id: "lora",
    title: "LoRA: Low-Rank Adaptation of Large Language Models",
    titleJa: "LoRA：小さな低ランク更新で大規模モデルを適応させる",
    authors: [
      "Edward J. Hu", "Yelong Shen", "Phillip Wallis", "Zeyuan Allen-Zhu",
      "Yuanzhi Li", "Shean Wang", "Lu Wang", "Weizhu Chen",
    ],
    year: 2021,
    field: "効率的学習",
    sourceUrl: "https://arxiv.org/abs/2106.09685",
    pdfUrl: "https://arxiv.org/pdf/2106.09685",
    arxivId: "2106.09685",
    abstractJa: "編集要約：LoRAは事前学習済みの重みを固定し、重みの更新を低ランク行列の積として学ぶ手法。下流タスクで学習するパラメータと保存する差分を小さくする。RoBERTa、DeBERTa、GPT-2、GPT-3の実験では、全体微調整に匹敵する、または上回る品質を報告している。",
    readingMinutes: 5,
    tags: ["LoRA", "低ランク", "パラメータ効率", "微調整", "Fine-tuning", "NLP"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "適応のたびに、全パラメータを動かす必要は？",
        body: "大きな事前学習モデルをタスクごとに全体微調整すると、学習のメモリも、モデルの保存・切り替えも高くつく。著者は、適応で必要になる重みの変化には低ランクの構造があるのではないかと仮定し、少ない学習対象で品質を保つ方法を検討する。",
        sourceNote: "出典：arXiv:2106.09685v2 §1 Introduction、§2 Problem Statement。低ランク性は著者の仮説。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "事前学習モデルと、適応先のデータを用意する",
        body: "出発点は学習済みのTransformerと、下流タスクの訓練データ。論文ではRoBERTaやDeBERTaでGLUE、GPT-2で文章生成、GPT-3でWikiSQLや会話要約などを評価する。主な実験ではAttentionのQueryとValueの重みにLoRAを適用する。",
        sourceNote: "出典：arXiv:2106.09685v2 §4.2 Applying LoRA to Transformer、§5 Empirical Experiments、§5.1 Baselines。",
      },
      {
        key: "process",
        label: "思考",
        heading: "大きな重みを固定し、小さな差分を学ぶ",
        body: "元の重みW₀は固定し、更新ΔWを二つの小さな行列の積で表す。学習ではその低ランクの行列を最適化し、元の層の出力に更新分を足す。推論時には学習済みの更新を元の重みに統合できるため、統合後は追加の層を順番に計算する必要がない。",
        sourceNote: "出典：arXiv:2106.09685v2 §4.1 Low-Rank-Parametrized Update Matrices。式(3)と重み統合の説明を編集要約。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "小さくなるのは主に学習・保存する差分",
        body: "編集部の注意：LoRAでも元の大規模モデルは必要であり、モデル本体が小さくなるわけではない。「追加の推論遅延なし」は更新を重みに統合する構成に対応する。著者も、統合した状態で異なるタスクの入力を一つのバッチに混ぜることは容易でないと述べている。",
        sourceNote: "編集部の注意。根拠：arXiv:2106.09685v2 §4.1、§4.2 Practical Benefits and Limitations・脚注4。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "GPT-3の設定で、学習対象を大幅削減",
        body: "GPT-3 175BをAdamで全体微調整する場合との比較で、学習対象パラメータを約1万分の1、GPUメモリ要求を約3分の1にできると報告。これらは論文中の設定での削減幅であり、すべてのモデルやタスクに共通する倍率ではない。",
        sourceNote: "出典：arXiv:2106.09685v2 Abstract、§4.2 Applying LoRA to Transformer。末尾の適用範囲は編集部の補足。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "タスクへの変化を、少ない自由度で表す",
        body: "編集部の解釈：LoRAは、既存モデルの知識を活かしながら、適応に必要な変化を限られた自由度で表す考え方として読める。小さなランクで良い結果が出たことは興味深いが、著者自身もすべてのタスクで小さなランクが十分とは期待していない。",
        sourceNote: "編集部の解釈。根拠：arXiv:2106.09685v2 §4.1、§7.2 What is the Optimal Rank r for LoRA?・脚注6。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "共有モデルに、軽量な適応を重ねる",
        body: "著者はLoRAを、モデルの大部分を共有しながら品質を維持し、保存やタスク切り替えの負担を減らせる適応法と位置づける。一方、どの重みに適用するかの選び方や、低ランク更新が働く仕組みには、さらに研究の余地があるとしている。",
        sourceNote: "出典：arXiv:2106.09685v2 §8 Conclusion and Future Work。著者の結論の編集要約。",
      },
    ],
  },
  {
    id: "ddpm",
    title: "Denoising Diffusion Probabilistic Models",
    titleJa: "DDPM：ノイズを少しずつ取り除いて画像を生成する",
    authors: ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
    year: 2020,
    field: "画像生成",
    sourceUrl: "https://arxiv.org/abs/2006.11239",
    pdfUrl: "https://arxiv.org/pdf/2006.11239",
    arxivId: "2006.11239",
    abstractJa: "編集要約：画像へ徐々にノイズを加える過程に対応して、ノイズを除く逆過程を学習する拡散確率モデルを研究した論文。ノイズ予測を使った学習とスコアマッチングの関係を示し、無条件のCIFAR-10やLSUNの画像生成で高いサンプル品質を報告した。",
    readingMinutes: 6,
    tags: ["DDPM", "Diffusion", "拡散モデル", "ノイズ除去", "生成モデル", "画像"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "ノイズを取り除く学習から、画像を作れる？",
        body: "著者は、データを徐々にガウスノイズへ近づける拡散過程の逆向きの遷移を学べば、高品質な画像を生成できるかを検討する。拡散モデルそのものには先行研究があり、本論文は学習の定式化とサンプル品質の改善に焦点を当てている。",
        sourceNote: "出典：arXiv:2006.11239v2 §1 Introduction。著者の問題設定と先行研究への言及の編集要約。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "画像、ノイズ、どれだけ汚したかを入力に",
        body: "訓練画像に所定の強さのガウスノイズを加え、ノイズの混ざった画像と時刻tをネットワークへ渡す。時刻によってノイズ量が変わるため、モデルは複数のノイズ水準を扱う。実験にはCIFAR-10や256×256のLSUN画像などを用いている。",
        sourceNote: "出典：arXiv:2006.11239v2 §2 Background、§3.2 Algorithm 1、§4 Experiments、§4.1 Sample quality。",
      },
      {
        key: "process",
        label: "思考",
        heading: "加えたノイズを予測することを学ぶ",
        body: "訓練ではランダムに選んだ時刻で加えたノイズを予測し、その誤差を小さくする。生成ではガウスノイズから始め、学習した予測を用いて確率的な逆過程を繰り返す。著者はこのノイズ予測による表現と、単純化した学習目的を組み合わせる。",
        sourceNote: "出典：arXiv:2006.11239v2 §3.2 Reverse process・Algorithms 1–2、§3.4 Simplified training objective。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "画質だけでなく、生成のステップ数も見る",
        body: "編集部の注意：論文の実験では、生成に1,000ステップの逆過程を使う。高いサンプル品質は、少ない計算で生成できることと同じではない。また著者は、良い見た目を得たモデルでも対数尤度は他の尤度ベースのモデルに及ばないと述べる。画質と確率モデルとしての評価を分けて読む必要がある。",
        sourceNote: "編集部の注意。根拠：arXiv:2006.11239v2 §1 Introduction、§4 Experiments、§4.3 Progressive coding。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "無条件CIFAR-10でFID 3.17を報告",
        body: "著者は無条件CIFAR-10生成でFID 3.17を報告した。これは訓練データを参照した値で、テストデータを参照すると5.24になる。また、単純化したノイズ予測の学習目的が、標準の変分下限を用いる場合より良いサンプル品質を得たと報告している。",
        sourceNote: "出典：arXiv:2006.11239v2 §4.1 Sample quality・Table 1、§4.2・Table 2。参照データを含め著者の報告。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "大まかな形から、細部へと情報が現れる",
        body: "編集部の解釈：逆過程を「情報を段階的に取り戻す生成」と見ると理解しやすい。著者は途中の画像予測を調べ、大域的な特徴が先に、細部が後から現れると報告している。ただし、新しいノイズからの生成を、特定の訓練画像を一意に元どおりにする操作とは捉えない。",
        sourceNote: "編集部の解釈。根拠：arXiv:2006.11239v2 §2 Background、§4.3 Progressive generation・Figures 6–7。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "ノイズ除去を、高品質な確率的生成へつなぐ",
        body: "著者は拡散モデルによる高品質な画像生成を示し、変分推論、ノイズ除去のスコアマッチング、段階的な非可逆圧縮とのつながりを整理した。画像で得られた性質を、他のデータ形式や生成モデルの部品へ広げることを今後の方向として挙げている。",
        sourceNote: "出典：arXiv:2006.11239v2 §6 Conclusion。著者の結論の編集要約。",
      },
    ],
  },
  {
    id: "clip",
    title: "Learning Transferable Visual Models From Natural Language Supervision",
    titleJa: "CLIP：自然言語を手がかりに学ぶ画像表現",
    authors: [
      "Alec Radford", "Jong Wook Kim", "Chris Hallacy", "Aditya Ramesh",
      "Gabriel Goh", "Sandhini Agarwal", "Girish Sastry", "Amanda Askell",
      "Pamela Mishkin", "Jack Clark", "Gretchen Krueger", "Ilya Sutskever",
    ],
    year: 2021,
    field: "マルチモーダル",
    sourceUrl: "https://arxiv.org/abs/2103.00020",
    pdfUrl: "https://arxiv.org/pdf/2103.00020",
    arxivId: "2103.00020",
    abstractJa: "編集要約：CLIPは、インターネットから集めた4億組の画像とテキストの対応を学ぶ。画像と文章を比較できる表現にすることで、分類したい概念を自然言語で指定し、対象データセットで追加学習しないゼロショット転移を可能にする。30以上の画像認識データセットで性能と限界を調べた。",
    readingMinutes: 5,
    tags: ["CLIP", "画像と言語", "対照学習", "ゼロショット", "画像認識", "Multimodal"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "決められたラベル以外の概念も扱える？",
        body: "固定したカテゴリを当てる画像モデルでは、新しい視覚概念を扱うたびに追加のラベル付きデータが必要になりやすい。著者は、画像に付随する自然言語を学習信号にすれば、より広い概念を学び、学習後にも言葉で課題を指定できるかを問う。",
        sourceNote: "出典：arXiv:2103.00020v1 Abstract、§1 Introduction and Motivating Work。著者の問題設定の編集要約。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "4億組の画像と、その周囲にある言葉",
        body: "著者はインターネット上の公開情報から4億組の画像・テキスト対を集め、WITという事前学習データを構築した。教師信号は固定された分類ラベルではなく、各画像と対になったテキスト。幅広い視覚概念を含めるため、収集時には検索語の集合を用いている。",
        sourceNote: "出典：arXiv:2103.00020v1 §2.1 Natural Language Supervision、§2.2 Creating a Sufficiently Large Dataset。",
      },
      {
        key: "process",
        label: "思考",
        heading: "正しい画像と文章の組を、近づける",
        body: "画像エンコーダーとテキストエンコーダーを一緒に学習し、同じバッチ内で正しい組の類似度を高め、誤った組と区別する。分類時は候補の名前や説明文も埋め込みに変換し、入力画像との類似度で選ぶ。画像の説明文を一語ずつ生成する学習とは異なる。",
        sourceNote: "出典：arXiv:2103.00020v1 §2.3 Selecting an Efficient Pre-Training Method、§3.1.2 Using CLIP for Zero-Shot Transfer。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "ゼロショットの強さにも、得意不得意がある",
        body: "編集部の注意：ゼロショットは、対象データセットで追加学習しないという条件であり、事前学習なしを意味しない。著者は物体の数え上げや距離の判断などに弱さを報告している。候補の説明文やプロンプトも結果に影響するため、使いたい課題ごとの評価が重要になる。",
        sourceNote: "編集部の注意。根拠：arXiv:2103.00020v1 §3.1.4 Prompt Engineering and Ensembling、§6 Limitations。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "ImageNetへ、追加学習なしで転移",
        body: "最良のCLIPはImageNetでゼロショットTop-1正解率76.2%を記録し、原版ResNet-50と同程度の精度を報告した。また27データセットの比較では、ResNet-50の特徴に教師ありで線形分類器を学習するベースラインを、16データセットで上回った。",
        sourceNote: "出典：arXiv:2103.00020v1 §3.1.3・Table 1、§3.1.5・Figure 5。モデルと比較対象を含め著者の報告。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "言葉が、分類器を指定する入口になる",
        body: "編集部の解釈：CLIPは画像と自然言語を同じ比較の場に置き、分類したい概念を文章で渡せるようにした点が重要だと読める。便利さと同時に、どんな候補をどんな言葉で提示したかも評価条件になる。類似度の高さを、その概念を完全に理解した証拠とはみなせない。",
        sourceNote: "編集部の解釈。根拠：arXiv:2103.00020v1 §3.1.2、§3.1.4、§6 Limitations。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "自然言語による大規模学習を、視覚にも",
        body: "著者は、自然言語を使う大規模で課題に依存しない事前学習を、画像認識にも展開できると結論づける。十分な規模では、ゼロショットでも課題専用の教師ありモデルに競争力を持つ例を示した。一方、転移性能にはなお大きな改善の余地があるとしている。",
        sourceNote: "出典：arXiv:2103.00020v1 §9 Conclusion。著者の結論の編集要約。",
      },
    ],
  },
  {
    id: "rag",
    title: "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    titleJa: "RAG：検索した知識とモデルの記憶を組み合わせて生成する",
    authors: [
      "Patrick Lewis", "Ethan Perez", "Aleksandra Piktus", "Fabio Petroni",
      "Vladimir Karpukhin", "Naman Goyal", "Heinrich Küttler", "Mike Lewis",
      "Wen-tau Yih", "Tim Rocktäschel", "Sebastian Riedel", "Douwe Kiela",
    ],
    year: 2020,
    field: "情報検索",
    sourceUrl: "https://arxiv.org/abs/2005.11401",
    pdfUrl: "https://arxiv.org/pdf/2005.11401",
    arxivId: "2005.11401",
    abstractJa: "編集要約：RAGは、事前学習した文章生成モデルの内部知識と、Wikipediaの文書を検索する外部メモリを組み合わせる。検索文書を条件に回答を生成する二つの定式化を比較し、オープンドメイン質問応答や知識を要する文章生成で有効性を調べた。参照する索引の交換による知識更新も検証している。",
    readingMinutes: 6,
    tags: ["RAG", "検索拡張生成", "質問応答", "外部知識", "DPR", "BART", "NLP"],
    audioStatus: "not-recorded",
    scenes: [
      {
        key: "question",
        label: "問いかけ",
        heading: "必要な知識を、重みの中だけに持たせる？",
        body: "著者は、大きな言語モデルが知識を記憶していても、それを正確に取り出し、更新し、判断の根拠を示すことは難しいと指摘する。そこで、モデル内の知識に加えて、外部文書を検索して参照できる生成モデルを検討する。対象は外部知識を要するNLP課題である。",
        sourceNote: "出典：arXiv:2005.11401v4 Abstract、§1 Introduction。著者の問題設定の編集要約。",
      },
      {
        key: "input",
        label: "受け取り",
        heading: "質問、検索索引、事前学習した生成器",
        body: "検索にはDPR、生成にはBART-largeを使う。外部メモリは2018年12月のWikipediaを100語ずつの区間に分けた約2,100万文書の索引。下流学習では文書側のエンコーダーと索引を固定し、質問側のエンコーダーと生成器を調整する。",
        sourceNote: "出典：arXiv:2005.11401v4 §2.2 Retriever: DPR、§2.3 Generator: BART、§2.4 Training、§3 Experiments。",
      },
      {
        key: "process",
        label: "思考",
        heading: "検索文書を、生成確率の中で扱う",
        body: "検索文書を潜在変数として、文書ごとの生成確率を足し合わせる。RAG-Sequenceは出力列全体で同じ文書を使う場合を評価し、RAG-Tokenは各トークンで異なる文書に依存できる。どちらも入力から先に得た上位文書群を用い、トークンごとに検索をやり直す設計ではない。",
        sourceNote: "出典：arXiv:2005.11401v4 §2.1 Models（RAG-Sequence、RAG-Token）。末尾は数式の読解を助ける編集補足。",
      },
      {
        key: "caution",
        label: "注意",
        heading: "検索したことと、正しさの保証は別",
        body: "編集部の注意：検索結果があっても、生成文の全主張がその文書に支えられるとは限らない。著者の人手評価でも不正確な生成は残り、外部知識源の誤りや偏りも限界として述べられている。根拠を確認するときは、回答と取得文書を照合して読む必要がある。",
        sourceNote: "編集部の注意。根拠：arXiv:2005.11401v4 §4.3 Jeopardy Question Generation・Table 4、Broader Impact。",
      },
      {
        key: "observation",
        label: "観測",
        heading: "Natural Questionsで完全一致率44.5",
        body: "Natural Questionsのテストで、RAG-Sequenceは回答の完全一致率44.5を報告し、比較対象のDPRは41.5だった。著者は、抽出型の質問応答に限らず生成型でも検索を活用できると示した。ただし、この数値は同論文のデータ分割と評価方法における結果である。",
        sourceNote: "出典：arXiv:2005.11401v4 §3.1 Open-domain Question Answering、§4.1・Table 1。数値は著者の報告。",
      },
      {
        key: "interpretation",
        label: "整理",
        heading: "モデルの学習と、知識の更新を分けて考える",
        body: "編集部の解釈：モデルの重みと外部の索引を別に持つことで、知識更新の設計に新しい選択肢が生まれる。著者は2016年と2018年の索引を交換し、時期によって変わる世界の指導者への回答を調べた。この実験は更新の可能性を示すが、あらゆる知識が索引だけで正しく更新されるという保証ではない。",
        sourceNote: "編集部の解釈。根拠：arXiv:2005.11401v4 §4.5 Additional Results（Index hot-swapping）。",
      },
      {
        key: "conclusion",
        label: "結論",
        heading: "内部の記憶と、読める外部知識を組み合わせる",
        body: "著者は、モデルのパラメータにある記憶と検索できる外部メモリを組み合わせ、質問応答と知識集約的な生成で有効性を示したと結論づける。二種類の記憶がどう協調するか、どう事前学習するのがよいかは、引き続き研究すべき課題としている。",
        sourceNote: "出典：arXiv:2005.11401v4 §6 Discussion。著者の結論の編集要約。",
      },
    ],
  },
];

const MAX_SEARCH_QUERY_LENGTH = 512;
const MAX_SAVED_STORAGE_LENGTH = 16_384;
const MAX_SAVED_PAPER_COUNT = 100;
const KNOWN_PAPER_IDS = new Set(PAPERS.map((paper) => paper.id));

function normalizeSearchText(value: string): string {
  return value.normalize("NFKC").toLowerCase();
}

/**
 * Offline, literal AND search; preserves input order and does not mutate it.
 * NFKC handles full-width Latin text, half-width kana and composed characters.
 * All whitespace-separated tokens must match the same paper. Fields are exact.
 * Overlong nonblank queries return no matches rather than silently losing tokens.
 */
export function searchPapers(papers: readonly Paper[], query: string, field: string = "all"): Paper[] {
  const trimmedQuery = query.trim();
  if (trimmedQuery.length > MAX_SEARCH_QUERY_LENGTH) return [];

  const normalizedQuery = normalizeSearchText(trimmedQuery);
  if (normalizedQuery.length > MAX_SEARCH_QUERY_LENGTH) return [];
  const tokens = normalizedQuery.split(/\s+/u).filter(Boolean);

  return papers.filter((paper) => {
    if (field !== "all" && paper.field !== field) return false;
    if (tokens.length === 0) return true;

    const searchableText = normalizeSearchText([
      paper.title,
      paper.titleJa,
      ...paper.authors,
      String(paper.year),
      paper.field,
      ...paper.tags,
      paper.abstractJa,
      paper.arxivId,
      `arxiv:${paper.arxivId}`,
    ].join("\n"));
    return tokens.every((token) => searchableText.includes(token));
  });
}

/**
 * Reads the JSON array stored for favorites, never localStorage itself.
 * Malformed/oversized values are discarded; unknown IDs and nonstrings are
 * ignored. Keeps the first occurrence of each known ID, at most 100 IDs.
 */
export function parseSavedPaperIds(raw: string | null): string[] {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_SAVED_STORAGE_LENGTH) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of parsed) {
      if (typeof value !== "string" || !KNOWN_PAPER_IDS.has(value) || seen.has(value)) continue;
      seen.add(value);
      result.push(value);
      if (result.length >= MAX_SAVED_PAPER_COUNT) break;
    }
    return result;
  } catch {
    return [];
  }
}
