let isSelecting = false;

// 対象要素からできるだけ一意なクエリセレクタ文字列を生成
function buildSelector(target) {
  // 自身にIDがあればそれを最優先
  if (target.id) {
    return `document.getElementById('${target.id}')`;
  }

  const parts = [];
  let el = target;
  let depth = 0;

  while (el && el.nodeType === 1 && depth < 6) {
    let part = el.tagName.toLowerCase();

    // 拡張機能用クラスを除いたクラスを付与
    const classes = Array.from(el.classList).filter(
      (c) => c !== 'chrome-ext-hover'
    );
    if (classes.length > 0) {
      part += '.' + classes.join('.');
    } else if (el !== document.body && el !== document.documentElement) {
      // クラスがない場合は nth-of-type で位置指定
      let index = 1;
      let sibling = el;
      while ((sibling = sibling.previousElementSibling)) {
        if (sibling.tagName === el.tagName) {
          index++;
        }
      }
      part += `:nth-of-type(${index})`;
    }

    parts.unshift(part);

    // 親にIDがあればそこで打ち切り
    el = el.parentElement;
    if (el && el.id) {
      parts.unshift(`#${el.id}`);
      break;
    }

    depth++;
  }

  const selector = parts.join(' > ');
  return `document.querySelector('${selector}')`;
}

// クリックした要素の「形」（周辺HTML）を取得（親がブロックコンテナなら親のHTML）
function getElementShapeHtml(element) {
  const BLOCK_CONTAINERS = ['DL', 'DIV', 'SECTION', 'ARTICLE', 'UL', 'OL', 'MAIN', 'ASIDE', 'FIGURE', 'TABLE'];
  const parent = element.parentElement;
  const target = parent && BLOCK_CONTAINERS.includes(parent.tagName)
    ? parent
    : element;
  let html = target.outerHTML || '';
  if (html.length > 2000) html = html.slice(0, 2000) + '\n...';
  // 簡易整形: タグの直後に改行
  return html.replace(/></g, '>\n<').trim();
}

// 結果パネルをページに表示（要素の形 / GTM用 / コンソール用をそれぞれ枠で表示、コピーはユーザーが行う）
function showResultPanel(elementShape, gtmCode, consoleCode) {
  const existing = document.getElementById('scg-result-panel');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.id = 'scg-result-panel';
  panel.className = 'scg-result-panel';

  const section = (title, content) => {
    const block = document.createElement('div');
    block.className = 'scg-result-section';
    const heading = document.createElement('div');
    heading.className = 'scg-result-heading';
    heading.textContent = title;
    const body = document.createElement('div');
    body.className = 'scg-result-body';
    const pre = document.createElement('pre');
    pre.className = 'scg-result-pre';
    pre.textContent = content;
    body.appendChild(pre);
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'scg-result-copy';
    copyBtn.textContent = 'コピー';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(content).then(() => {
        copyBtn.textContent = 'コピーしました';
        setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1500);
      });
    });
    block.appendChild(heading);
    block.appendChild(body);
    block.appendChild(copyBtn);
    return block;
  };

  panel.appendChild(section('要素の形', elementShape, 'shape'));
  panel.appendChild(section('GTM用', gtmCode, 'gtm'));
  panel.appendChild(section('コンソール用', consoleCode, 'console'));

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'scg-result-close';
  closeBtn.textContent = '閉じる';
  closeBtn.addEventListener('click', () => panel.remove());
  panel.appendChild(closeBtn);

  document.body.appendChild(panel);
}

// ポップアップからの指示を受け取る（選択モードのON/OFF）
chrome.runtime.onMessage.addListener((request) => {
  isSelecting = Boolean(request && request.activate);
  console.log('[Selector Code Generator] selecting mode:', isSelecting);
});

document.addEventListener('mouseover', (e) => {
  if (!isSelecting) return;
  e.target.classList.add('chrome-ext-hover');
});

document.addEventListener('mouseout', (e) => {
  e.target.classList.remove('chrome-ext-hover');
});

document.addEventListener('click', (e) => {
  if (!isSelecting) return;
  
  e.preventDefault();
  e.stopPropagation();

  const element = e.target;
  const selector = buildSelector(element);
  console.log('[Selector Code Generator] selector:', selector);

  // GTM の「カスタム JavaScript」変数でそのまま使える形式のコード
  // 商品コード（英数字 + ハイフン）と価格（数値）をいい感じに拾う
  const gtmCode = `function() {
  var element = ${selector};
  if (!element) return '';

  var text = (element.textContent || '').trim();

  // 商品コード候補を優先して返す
  // 1. ハイフンを含む品番形式（例: CT1535-5P）
  var codeMatch = text.match(/[0-9A-Za-z]+[-‐‑–−][0-9A-Za-z-]+/);
  if (codeMatch) {
    return codeMatch[0];
  }
  // 2. 英字と数字を両方含む英数字列（例: BQ16740129, ABC123）
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

  // どちらも該当しなければ元のテキスト
  return text;
}`;

  // コンソールで即実行して値を確認する用コード
  const consoleCode = `(function() {
  var element = ${selector};
  if (!element) return;

  var text = (element.textContent || '').trim();

  // 商品コード候補を優先してログ出力
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
})();`;

  const elementShape = getElementShapeHtml(element);
  showResultPanel(elementShape, gtmCode, consoleCode);

  isSelecting = false;
  element.classList.remove('chrome-ext-hover');
});