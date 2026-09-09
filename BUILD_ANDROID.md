# Orbit PRO — Capacitor Android Build

## Requirements
- Node.js 18+
- npm
- Android SDK / Android build tools
- Java JDK 17+
- For the first Android project generation, run the commands below from this folder.

## Commands

```bash
npm install
npx cap add android
npx cap sync android
npx cap open android
```

If Android Studio is not installed, you can still generate the Android project with:

```bash
npm install
npx cap add android
npx cap sync android
```

Then use your preferred Android build environment to build an APK.

## Important
The frontend and backend are separate. A production Android app should call a deployed HTTPS backend rather than `localhost`.

For local testing, change the API base handling in `frontend/js/app.js` when you deploy the backend. The current project uses relative `/api/...` requests, which work when served by the same web server.

Before public release, add:
- HTTPS production backend
- production database
- image upload/storage
- email/phone verification
- password reset
- moderation/admin tools
- rate limiting
- privacy/terms/legal compliance
- secure production secrets
