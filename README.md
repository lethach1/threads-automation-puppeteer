# Threads Multi-Account Automation với Human Behavior

Hệ thống automation multi-account cho Threads sử dụng Puppeteer với puppeteer-extra-plugin-stealth và mô phỏng hành vi người dùng thật.

## 🚀 Tính năng

- **Multi-account management**: Quản lý nhiều profile với cookies và proxy riêng biệt
- **Human behavior simulation**: Mô phỏng hành vi người dùng thật sử dụng **ghost-cursor**
- **Stealth mode**: Sử dụng puppeteer-extra-plugin-stealth để bypass detection
- **Proxy support**: Hỗ trợ HTTP và SOCKS5 proxy
- **Cookie management**: Tự động lưu và load cookies
- **Manual login**: Hỗ trợ login thủ công khi cần thiết
- **Advanced mouse movements**: Đường đi cong tự nhiên với ghost-cursor

## 📦 Cài đặt

```bash
npm install
```

## ⚙️ Cấu hình

### 1. Cấu hình Profiles

Chỉnh sửa mảng `profiles` trong file `automation.js`:

```javascript
const profiles = [
  {
    name: 'account1',
    cookiesPath: './cookies_acc1.json',
    proxy: {
      server: 'http://your-proxy-server:8080',
      username: 'your-username',
      password: 'your-password'
    }
  },
  {
    name: 'account2', 
    cookiesPath: './cookies_acc2.json',
    proxy: {
      server: 'socks5://your-socks5-server:1080',
      username: 'your-username',
      password: 'your-password'
    }
  },
  {
    name: 'account3',
    cookiesPath: './cookies_acc3.json',
    proxy: null // Không dùng proxy
  }
];
```

### 2. Cấu hình Proxy

- **HTTP Proxy**: `http://server:port`
- **SOCKS5 Proxy**: `socks5://server:port`
- **Không dùng proxy**: Đặt `proxy: null`

## 🎯 Sử dụng

### Chạy automation cơ bản:

```bash
node automation.js
```

### Import và sử dụng trong code:

```javascript
const { runMultiAccountAutomation, runProfileAutomation } = require('./automation');

// Chạy tất cả profiles
await runMultiAccountAutomation();

// Hoặc chạy một profile cụ thể
const profile = {
  name: 'test_account',
  cookiesPath: './cookies_test.json',
  proxy: null
};
await runProfileAutomation(profile, 0);
```

## 🤖 Human Behavior Functions

File `src/human-behavior.js` chứa các hàm mô phỏng hành vi người dùng thật sử dụng thư viện **ghost-cursor**:

### Các hàm chính:

- `humanDelay(min, max)`: Delay ngẫu nhiên
- `humanType(page, selector, text)`: Type text với tốc độ người thật
- `humanClick(page, selector)`: Click với mouse movement tự nhiên
- `humanScroll(page, distance, direction)`: Scroll với tốc độ không đều
- `humanHover(page, selector, duration)`: Hover tự nhiên
- `humanMouseMove(page, selector)`: Di chuyển mouse với đường cong
- `humanSwipe(page, direction, distance)`: Swipe gesture
- `humanDoubleClick(page, selector)`: Double click
- `humanRightClick(page, selector)`: Right click
- `humanDragAndDrop(page, source, target)`: Drag and drop
- `humanZoom(page, direction, steps)`: Zoom in/out
- `humanRefresh(page)`: Refresh page
- `humanNavigate(page, url)`: Navigate với typing tự nhiên
- `humanSwitchTab(page, tabIndex)`: Switch tab
- `humanCopyPaste(page, selector, text)`: Copy/paste
- `humanUndoRedo(page, action)`: Undo/redo
- `humanRandomMouseMovement(page, duration)`: Random mouse movement
- `humanClickWithOffset(page, selector, options)`: Click với offset ngẫu nhiên
- `humanTypeWithMistakes(page, selector, text, mistakeRate)`: Type với lỗi và sửa lỗi
- `createGhostCursor(page)`: Tạo ghost cursor instance

### Sử dụng human behavior:

```javascript
const {
  humanDelay,
  humanClick,
  humanScroll,
  humanType
} = require('./src/human-behavior');

// Trong automation
await humanDelay(1000, 3000);
await humanClick(page, '#login-button');
await humanType(page, '#username', 'your_username');
await humanScroll(page, 500, 'down');
```

## 📁 Cấu trúc file

```
threads-automation-puppeteer/
├── automation.js          # File automation chính
├── src/
│   └── human-behavior.js  # Các hàm mô phỏng hành vi người dùng (sử dụng ghost-cursor)
├── package.json           # Dependencies
├── README.md             # Hướng dẫn sử dụng
├── cookies_acc1.json     # Cookies cho account 1
├── cookies_acc2.json     # Cookies cho account 2
├── cookies_acc3.json     # Cookies cho account 3
└── screenshot_*.png      # Screenshots được tạo tự động
```

## 🔧 Tùy chỉnh

### Thêm hành động mới:

```javascript
// Trong hàm performHumanActions
const performCustomActions = async (page, profileName) => {
  // Thêm logic tùy chỉnh ở đây
  await humanScroll(page, 1000, 'down');
  await humanDelay(2000, 4000);
  
  // Click vào element cụ thể
  await humanClick(page, '[data-testid="like-button"]');
  await humanDelay(1000, 2000);
};
```

### Thay đổi website target:

```javascript
// Thay đổi URL trong runProfileAutomation
await page.goto('https://your-target-website.com/', { 
  waitUntil: 'networkidle2',
  timeout: 60000 
});
```

## 🛡️ Bảo mật

- **Không commit cookies**: Thêm `cookies_*.json` vào `.gitignore`
- **Bảo vệ proxy credentials**: Không hardcode credentials trong code
- **Rate limiting**: Sử dụng `humanDelay()` để tránh spam
- **User agent rotation**: Thay đổi user agent định kỳ

## ⚠️ Lưu ý

1. **Tuân thủ ToS**: Đảm bảo tuân thủ Terms of Service của website
2. **Rate limiting**: Không spam hoặc gửi quá nhiều request
3. **Proxy quality**: Sử dụng proxy chất lượng cao để tránh bị block
4. **Cookie management**: Refresh cookies định kỳ
5. **Error handling**: Luôn có fallback cho các trường hợp lỗi

## 🐛 Troubleshooting

### Lỗi thường gặp:

1. **Proxy connection failed**:
   - Kiểm tra proxy server có hoạt động không
   - Verify credentials
   - Thử proxy khác

2. **Cookies expired**:
   - Xóa file cookies và login lại
   - Kiểm tra thời gian hết hạn

3. **Element not found**:
   - Website có thể đã thay đổi structure
   - Update selectors trong code

4. **Detection triggered**:
   - Tăng delay giữa các actions
   - Sử dụng proxy khác
   - Thay đổi user agent

## 📝 Logs

Hệ thống tạo logs chi tiết:

```
🚀 Starting automation for account1 (1/3)
🔗 Using proxy: http://proxy1.example.com:8080
🍪 Cookies loaded successfully
🌐 Navigating to https://www.threads.net/
✅ Already logged in
📊 Getting user information...
👤 User: John Doe
🤖 Performing human-like actions...
✅ Human actions completed
📸 Screenshot saved: ./screenshot_account1_1703123456789.png
✅ Completed automation for account1
🔒 Browser closed for account1
```

## 🤝 Đóng góp

1. Fork repository
2. Tạo feature branch
3. Commit changes
4. Push to branch
5. Tạo Pull Request

## 📄 License

MIT License - xem file LICENSE để biết thêm chi tiết.
