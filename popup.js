document.addEventListener('DOMContentLoaded', () => {
  const button = document.getElementById('start-select');
  if (!button) return;

  button.addEventListener('click', async () => {
    try {
      button.disabled = true;
      button.innerHTML =
        '<span class="primary-button-icon">✓</span><span>選択モードを開始しました</span>';

      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab || !tab.id) {
        window.close();
        return;
      }

      // content.js に選択モードONを通知（応答は待たずにすぐ閉じる）
      chrome.tabs.sendMessage(tab.id, { activate: true });
      window.close();
    } catch (e) {
      console.error(e);
      window.close();
    }
  });
});
