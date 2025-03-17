chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  if (message.action === "saveProducts") {
    // Tạo tên file
    const fileName = `${message.shopName.replace(/[^a-z0-9]/gi, '_')}_products_${message.shopId}.json`;
    
    // Chuyển đổi dữ liệu sang JSON và tạo Blob
    const jsonData = JSON.stringify(message.data, null, 2);
    const blob = new Blob([jsonData], {type: 'application/json'});
    
    // Tạo URL và download file
    const url = URL.createObjectURL(blob);
    chrome.downloads.download({
      url: url,
      filename: fileName,
      saveAs: false
    });
    
    // Thông báo kết quả lên popup
    chrome.runtime.sendMessage({
      action: "scrapeComplete",
      count: message.count
    });
    
    // Tạo CSV file
    createCSVFile(message.data, message.shopName, message.shopId);
  }
});

// Hàm tạo file CSV
function createCSVFile(data, shopName, shopId) {
  // Tạo header cho CSV
  const headers = [
    'Name', 'Price', 'Original Price', 'Stock', 
    'Sales', 'Rating', 'Image URL', 'Product URL', 'Product ID'
  ];
  
  // Tạo nội dung CSV
  let csvContent = headers.join(',') + '\n';
  
  data.forEach(product => {
    // Xử lý phòng tránh lỗi với dấu phẩy trong tên sản phẩm
    const name = `"${product.name.replace(/"/g, '""')}"`;
    
    const row = [
      name,
      product.price,
      product.price_before_discount,
      product.stock,
      product.sales,
      product.rating,
      product.image,
      product.product_url,
      product.product_id
    ];
    
    csvContent += row.join(',') + '\n';
  });
  
  // Tạo Blob và download file
  const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
  const fileName = `${shopName.replace(/[^a-z0-9]/gi, '_')}_products_${shopId}.csv`;
  
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: fileName,
    saveAs: false
  });
}
