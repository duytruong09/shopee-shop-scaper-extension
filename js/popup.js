document.addEventListener('DOMContentLoaded', function() {
  const scrapeButton = document.getElementById('scrapeButton');
  const shopUrlInput = document.getElementById('shopUrl');
  const statusDiv = document.getElementById('status');
  
  // Lấy URL hiện tại từ tab đang mở
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    const currentUrl = tabs[0].url;
    if (currentUrl.includes('shopee.vn') || currentUrl.includes('shopee.com')) {
      shopUrlInput.value = currentUrl;
    }
  });
  
  scrapeButton.addEventListener('click', function() {
    let shopUrl = shopUrlInput.value.trim();
    
    if (!shopUrl) {
      statusDiv.textContent = 'Vui lòng nhập URL shop trên Shopee';
      return;
    }
    
    // Kiểm tra URL có phải Shopee không
    if (!shopUrl.includes('shopee.vn') && !shopUrl.includes('shopee.com')) {
      statusDiv.textContent = 'URL không phải từ Shopee';
      return;
    }
    
    statusDiv.textContent = 'Đang lấy thông tin sản phẩm...';
    
    // Gửi message đến content script để bắt đầu quá trình lấy dữ liệu
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "scrapeShopProducts", shopUrl: shopUrl}, function(response) {
        if (chrome.runtime.lastError) {
          statusDiv.textContent = 'Lỗi: Vui lòng tải lại trang và thử lại';
        }
      });
    });
    
    // Lắng nghe kết quả từ background script
    chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
      if (message.action === "scrapeComplete") {
        statusDiv.textContent = `Hoàn thành! Đã lấy ${message.count} sản phẩm.`;
      } else if (message.action === "scrapeProgress") {
        statusDiv.textContent = `Đang lấy dữ liệu... (${message.current}/${message.total})`;
      } else if (message.action === "scrapeError") {
        statusDiv.textContent = `Lỗi: ${message.error}`;
      }
    });
  });
});
