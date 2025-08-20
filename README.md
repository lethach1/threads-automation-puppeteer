# Threads Automation with Puppeteer

Multi-account Threads automation with human behavior simulation and anti-detect features.

## 🏗️ Project Structure

```
src/
├── config/
│   └── constants.js          # Application constants and configurations
├── controllers/
│   └── AutomationController.js # Main automation orchestration
├── models/
│   └── Profile.js            # Profile data model
├── services/
│   ├── ProfileService.js     # Profile management
│   ├── CookieService.js      # Cookie handling
│   ├── AntiDetectService.js  # Browser fingerprinting
│   └── AuthenticationService.js # Login management
├── utils/
│   ├── fileUtils.js          # File operations
│   └── browserUtils.js       # Browser utilities
├── human-behavior.js         # Human behavior simulation
└── main.js                   # Entry point
```

## 🚀 Features

- **Multi-account support** - Run automation for multiple profiles
- **Human behavior simulation** - Realistic mouse movements and typing
- **Anti-detect measures** - Stealth plugin, proxy support, fingerprint spoofing
- **Auto login** - Automatic credential management
- **Cookie persistence** - Save and restore session cookies
- **Modular architecture** - Clean separation of concerns

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

### Profile Setup

Create profile directories in `profiles/`:

```
profiles/
├── acc1/
│   ├── cookies.json          # Session cookies (auto-generated)
│   └── proxy.json           # Profile configuration
├── acc2/
│   ├── cookies.json
│   └── proxy.json
└── ...
```

### Proxy Configuration

Example `profiles/acc1/proxy.json`:

```json
{
  "server": "http://your-proxy-server:port",
  "username": "proxy-username",
  "password": "proxy-password",
  "threads_username": "your-threads-username",
  "threads_password": "your-threads-password",
  "lang": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
  "timezone": "Asia/Ho_Chi_Minh",
  "latitude": 10.7769,
  "longitude": 106.7009,
  "accuracy": 20
}
```

## 🎯 Usage

### Run Automation

```bash
npm start
```

### Development Mode

```bash
npm run dev
```

### Programmatic Usage

```javascript
import { AutomationController } from './src/main.js';

const controller = new AutomationController();
await controller.runMultiAccountAutomation();
```

## 🔧 Architecture

### Services

- **ProfileService**: Manages profile loading and configuration
- **CookieService**: Handles cookie persistence and validation
- **AntiDetectService**: Manages browser fingerprinting and stealth
- **AuthenticationService**: Handles login and session management

### Models

- **Profile**: Encapsulates profile data with validation methods

### Controllers

- **AutomationController**: Orchestrates the entire automation process

## 🛡️ Anti-Detect Features

- **Stealth Plugin**: Hides automation signatures
- **Proxy Support**: IP rotation and geolocation spoofing
- **Human Behavior**: Realistic mouse movements and typing patterns
- **Fingerprint Spoofing**: Timezone, language, and geolocation manipulation
- **WebRTC Protection**: Prevents IP leakage through WebRTC

## 📝 Notes

- Each profile uses a separate Chrome user data directory
- Cookies are automatically saved and restored
- Human behavior simulation prevents detection
- Supports both proxy and direct connections

## 🤝 Contributing

1. Follow the modular architecture
2. Add proper error handling
3. Use ES modules syntax
4. Maintain separation of concerns

## 📄 License

ISC
