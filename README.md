# Threads Automation with Puppeteer

Multi-account Threads automation with human behavior simulation and anti-detect features.

## 🏗️ Project Structure

```
src/
├── config/
│   └── constants.js          # Application constants and configurations
├── controllers/
│   └── AutomationController.ts # Main automation orchestration
├── services/
│   ├── ProfileService.ts     # Profile management and browser connection
│   └── AuthenticationService.js # Login management
├── utils/
│   └── browserUtils.js       # Browser utilities
├── human-behavior.js         # Human behavior simulation
└── main.ts                   # Entry point
```

## 🚀 Features

- **Multi-account support** - Run automation for multiple profiles
- **Human behavior simulation** - Realistic mouse movements and typing
- **Profile management** - Automatic profile detection and loading
- **Browser automation** - Connect to existing Chrome instances via API
- **TypeScript support** - Modern development with type safety
- **Modular architecture** - Clean separation of concerns

## 📦 Installation

```bash
npm install
```

## ⚙️ Configuration

### Profile Setup

The system automatically detects profiles in the `profiles/` directory:

```
profiles/
├── profile 5_68b02d669ceba9e5857793b9/
│   ├── 68b02d669ceba9e5857793b9/     # Chrome profile data
│   ├── note.txt
│   ├── proxy.txt
│   └── version.txt
├── profile 6_68b129b8fe3431396321dcd5/
│   └── ...
└── profile 7_68b129bae4a5b50271d1f7b6/
    └── ...
```

### API Server Setup

The automation connects to a local API server on port `36969` that manages Chrome instances:

- **API Endpoint**: `http://localhost:36969/start`
- **Parameters**: `path`, `version`, `os`
- **Response**: `debuggerAddress` for Puppeteer connection

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

```typescript
import { AutomationController } from './src/main.ts';

const controller = new AutomationController();
await controller.runMultiAccountAutomation();
```

## 🔧 Architecture

### Services

- **ProfileService**: Manages profile loading and browser connection via API
- **AuthenticationService**: Handles login and session management

### Controllers

- **AutomationController**: Orchestrates the entire automation process

## 🛡️ Features

- **Human Behavior**: Realistic mouse movements and typing patterns
- **Profile Isolation**: Each profile uses a separate Chrome instance
- **API Integration**: Connects to external Chrome management API
- **TypeScript**: Modern development with type safety
- **Error Handling**: Graceful error handling and recovery

## 📝 Notes

- Each profile uses a separate Chrome user data directory
- Human behavior simulation prevents detection
- Requires external API server for Chrome management
- Profiles are automatically detected from the `profiles/` directory

## 🤝 Contributing

1. Follow the modular architecture
2. Add proper error handling
3. Use TypeScript for new files
4. Maintain separation of concerns
5. Use ES modules syntax

## 📄 License

ISC
