
## Selector Code Generator

ページ上の要素（商品コード・価格など）をクリックするだけで、

- 要素の元HTML
- GTMのカスタムJavaScript変数用コード
- ブラウザコンソール用コード

を自動生成して表示する Chrome 拡張です。

GTM での計測実装やデバッグ作業を、できるだけ「コピペだけ」で完結させることを目的としています。

## セットアップ

### 1. リポジトリをダウンロード
```
git clone https://github.com/AzuWatsan/Selector-Code-Generator.git
```
```
cd your-repo
```

（または Zip ダウンロード → 展開でもOK）

### 2. Chrome に読み込む

1. Chrome で `chrome://extensions/` を開く  
2. 右上の **「デベロッパーモード」** をオンにする  
3. **「パッケージ化されていない拡張機能を読み込む」** をクリック  
4. このプロジェクトのフォルダ（`manifest.json` があるディレクトリ）を選択  

これで拡張機能バーにアイコンが表示されます。

---

## 使い方

### 1. 選択モードを開始

1. 対象サイトを開く  
2. 拡張アイコンをクリックしてポップアップを開く  
3. ポップアップの **「選択モードを開始」** ボタンを押す  
   → ページ上の要素にマウスオーバーすると、青い枠でハイライトされます。

### 2. 取得したい要素をクリック

- 例）
  - 商品コード
  - 価格
  - 注文コード など

クリックすると、ページ中央に結果パネルが表示されます。

---

## 結果パネルの見方

クリック後、ページ中央に次の3つの枠が表示されます（それぞれ右下に「コピー」ボタン付き）。

### 1. 要素の形

クリックした要素、もしくはその親のブロック要素の **HTML断片** を表示します。

```
例：

<dl class="product-code">
  <dt>商品番号</dt>
  <dd class="">5T01-628</dd>
</dl>
```

実装時の確認や、チームメンバーへの共有に使えます。

### 2. GTM用（カスタムJavaScript変数）

GTM の「カスタム JavaScript」変数に、そのまま貼り付けて使える関数です。

```
例：
function() {
  var element = document.querySelector('...'); // 実際は拡張が生成したセレクタ
  if (!element) return '';

  var text = (element.textContent || '').trim();

  // 商品コード優先（例: CT1535-5P）
  var codeMatch = text.match(/[0-9A-Za-z]+[-‐‑–−][0-9A-Za-z-]+/);
  if (codeMatch) {
    return codeMatch[0];
  }

  // 英字+数字を含むコード（例: BQ16740129, ABC123）
  var codeCandidates =
    text.match(/[0-9A-Za-z_-]*[A-Za-z][0-9A-Za-z_-]*[0-9][0-9A-Za-z_-]*/g) || [];
  if (codeCandidates.length > 0) {
    return codeCandidates[codeCandidates.length - 1];
  }

  // それ以外は価格など「数字だけ欲しい」ケース向け
  // 例: 「¥33,990 (税抜¥30,900)」 → 最長の数値「33990」のみを取得
  // 全角数字も対象にし、カンマなどは除去する
  var numbers = text.match(/[0-9０-９.,-]+/g) || [];
  if (numbers.length > 0) {
    var best = numbers.reduce(function (acc, cur) {
      var accDigits = (acc || '').replace(/[^0-9０-９]/g, '');
      var curDigits = (cur || '').replace(/[^0-9０-９]/g, '');
      return curDigits.length > accDigits.length ? cur : acc;
    }, '');

    var primary = (best || '').replace(/[^0-9０-９]/g, '');
    return primary;
  }
```
### 3. コンソール用

ブラウザの DevTools コンソールに貼って、**その場で値を確認するためのコード**です。
```
(function() {
  var element = document.querySelector('...'); // 実際は拡張が生成したセレクタ
  if (!element) return;

  var text = (element.textContent || '').trim();

  // 商品コード優先
  var codeMatch = text.match(/[0-9A-Za-z]+[-‐‑–−][0-9A-Za-z-]+/);
  if (codeMatch) {
    console.log(codeMatch[0]);
    return;
  }

  var codeCandidates =
    text.match(/[0-9A-Za-z_-]*[A-Za-z][0-9A-Za-z_-]*[0-9][0-9A-Za-z_-]*/g) || [];
  if (codeCandidates.length > 0) {
    console.log(codeCandidates[codeCandidates.length - 1]);
    return;
  }

  // 価格優先
  var numbers = text.match(/[0-9０-９.,-]+/g) || [];
  if (numbers.length > 0) {
    var best = numbers.reduce(function (acc, cur) {
      var accDigits = (acc || '').replace(/[^0-9０-９]/g, '');
      var curDigits = (cur || '').replace(/[^0-9０-９]/g, '');
      return curDigits.length > accDigits.length ? cur : acc;
    }, '');

    var primary = (best || '').replace(/[^0-9０-９]/g, '');
    console.log(primary);
    return;
  }

  console.log(text);
})();
```
コンソール上では:

- 上の `console.log(...)` の行に、実際の値（例: `5T01-628`, `9900`）が出ます。
- その下に表示される `undefined` は「即時関数の戻り値」なので、無視して大丈夫です。

---

## GTM での利用例

1. GTM 管理画面で **「変数 > ユーザー定義変数 > 新規」** を作成  
2. 種類を **「カスタム JavaScript」** にする  
3. 本拡張の「GTM用」枠のコードをそのまま貼り付けて保存  
4. 任意のタグ（例: GA4 イベント、カスタムHTML など）で、その変数を参照する  

### 発火タイミングの注意点

- 変数は **「タグが発火したタイミング」** で評価されます。  
- DOM から要素を取得する場合、トリガーは `All Pages` ではなく、
  - `DOM Ready`
  - `Window Loaded`
  - あるいはサイト側で `dataLayer.push` されたカスタムイベント  
  に合わせるのがおすすめです。

---

## 制限・注意事項

- すべてのサイト / すべてのレイアウトで「完全に意図した値」になることは保証できません。
  - DOM 構造や文言に依存するため、あくまで「品番 / 価格をいい感じに拾うための補助ツール」です。
- SPA や動的レンダリングのサイトでは、要素が出るタイミングによっては値が空になる場合があります。
  - その場合は、GTM 側でトリガーを `DOM Ready` / カスタムイベントなどに調整してください。

---

## ライセンス
MITとかでいいかも
