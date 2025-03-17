chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "scrapeShopProducts") {
    scrapeShopProducts(request.shopUrl);
    sendResponse({status: "started"});
  }
  return true;
});

async function scrapeShopProducts(shopUrl) {
  try {
    // Lấy shop ID từ URL
    let shopInfo = await extractShopIdFromUrl(shopUrl);
    if (!shopInfo || !shopInfo.shopId) {
      chrome.runtime.sendMessage({action: "scrapeError", error: "Không thể xác định Shop ID từ URL"});
      return;
    }
    
    let shopId = shopInfo.shopId;
    
    // Tạo URL API để lấy danh sách sản phẩm
    const baseApiUrl = getBaseApiUrl(shopUrl);
    let apiUrl = `${baseApiUrl}/api/v4/shop/get_shop_detail?shopid=${shopId}`;
    
    // Lấy thông tin shop
    let shopResponse = await fetch(apiUrl);
    let shopData = await shopResponse.json();
    let totalProducts = shopData.data.shop_stats.item_count;
    
    chrome.runtime.sendMessage({
      action: "scrapeProgress", 
      current: 0, 
      total: totalProducts
    });
    
    const limit = 100; // Số lượng sản phẩm trên mỗi trang 
    let allProducts = [];
    let offset = 0;
    
    // Lấy tất cả sản phẩm bằng cách phân trang
    while (offset < totalProducts) {
      let productsApiUrl = `${baseApiUrl}/api/v4/search/search_items?by=pop&limit=${limit}&match_id=${shopId}&newest=${offset}&order=desc&page_type=shop&scenario=PAGE_OTHERS&version=2`;
      
      let response = await fetch(productsApiUrl);
      let data = await response.json();
      
      if (data && data.items && data.items.length > 0) {
        const products = data.items.map(item => {
          const product = item.item_basic;
          return {
            name: product.name,
            price: product.price / 100000, // Chuyển đổi đơn vị tiền tệ
            price_before_discount: product.price_before_discount / 100000,
            stock: product.stock,
            sales: product.historical_sold,
            rating: product.item_rating.rating_star,
            image: `https://cf.shopee.vn/file/${product.image}`,
            product_url: `${baseApiUrl}/${product.name.replace(/\s+/g, '-')}-i.${shopId}.${product.itemid}`,
            product_id: product.itemid
          };
        });
        
        allProducts = allProducts.concat(products);
      } else {
        break; // Thoát nếu không có thêm sản phẩm
      }
      
      offset += limit;
      chrome.runtime.sendMessage({
        action: "scrapeProgress", 
        current: Math.min(offset, totalProducts), 
        total: totalProducts
      });
      
      // Delay để tránh bị chặn
      await delay(500);
    }
    
    // Gửi dữ liệu tới background script để lưu file
    chrome.runtime.sendMessage({
      action: "saveProducts",
      data: allProducts,
      shopName: shopData.data.name,
      shopId: shopId,
      count: allProducts.length
    });
    
  } catch (error) {
    console.error('Error scraping shop products:', error);
    chrome.runtime.sendMessage({action: "scrapeError", error: error.message});
  }
}

// Hàm trích xuất Shop ID từ URL
async function extractShopIdFromUrl(url) {
  // Xử lý nhiều định dạng URL của Shopee
  const urlObj = new URL(url);
  const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
  
  // Trường hợp URL có dạng: /shop/123456789
  if (pathParts.includes('shop')) {
    const shopIndex = pathParts.indexOf('shop');
    if (shopIndex >= 0 && shopIndex < pathParts.length - 1) {
      return { shopId: pathParts[shopIndex + 1] };
    }
  }
  
  // Trường hợp URL có dạng: /product_name-i.123456789.987654321
  for (let part of pathParts) {
    if (part.includes('i.')) {
      const matches = part.match(/i\.(\d+)/);
      if (matches && matches.length > 1) {
        return { shopId: matches[1] };
      }
    }
  }
  
  // Trường hợp URL có dạng: /username (ví dụ: /vinamilk10tantrao)
  if (pathParts.length === 1) {
    // Cần truy cập trang profile để lấy shopId
    const username = pathParts[0];
    try {
      // Fetch trang shop để lấy shop ID
      const response = await fetch(url);
      const htmlText = await response.text();
      
      // Tìm shopId trong nội dung HTML
      const shopIdMatch = htmlText.match(/"shopid":(\d+)/);
      if (shopIdMatch && shopIdMatch.length > 1) {
        return { shopId: shopIdMatch[1], username: username };
      }
      
      // Phương pháp khác: tìm trong dữ liệu JSON nhúng
      const jsonDataMatch = htmlText.match(/<script id="__NEXT_DATA__" type="application\/json">([^<]+)<\/script>/);
      if (jsonDataMatch && jsonDataMatch.length > 1) {
        try {
          const jsonData = JSON.parse(jsonDataMatch[1]);
          // Tìm shopId trong cấu trúc JSON
          const shopId = jsonData?.props?.pageProps?.shopInfo?.shopID || 
                        jsonData?.props?.pageProps?.data?.shopid;
          if (shopId) {
            return { shopId: shopId.toString(), username: username };
          }
        } catch (e) {
          console.error("Error parsing JSON data:", e);
        }
      }
    } catch (error) {
      console.error("Error fetching shop page:", error);
    }
  }
  
  return null;
}

// Lấy domain cơ bản từ URL
function getBaseApiUrl(url) {
  const urlObj = new URL(url);
  return `https://${urlObj.hostname}`;
}

// Hàm tạo delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}