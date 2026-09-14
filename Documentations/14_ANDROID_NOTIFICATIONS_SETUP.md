# Android phone notifications — next steps

**Mobile work is now active.** Start with [38_ANDROID_READINESS_HANDOFF.md](./38_ANDROID_READINESS_HANDOFF.md) for the first development APK. Firebase is optional for that build and local welcome notifications. The steps below focus on remote phone push; package installation is already complete.

The notification packages are now installed (`expo-notifications` 57.0.18 and `expo-device` 57.0.2), and the native adapter and config plugin are active in source. Client type checks/lint, all 115 tests, and web/iOS/Android bundle exports passed after installation. Real push delivery still requires an Expo project, Firebase credentials, and a development build on the phone.

The user chose Android. The prepared app ID is **`com.lanternpost.app`**, the Firebase Android configuration path is **`client/google-services.json`**, and `client/eas.json` contains an internal development APK profile. The Firebase file is not present yet. Expo Go and web continue supporting the app's in-app invitations; use the development APK for remote phone notifications.

## 1. Install the development client and link Expo

Start in `D:\Mobile dev\The Lantern Post` and run these commands in one PowerShell terminal:

```powershell
# Optional no-VCS workflow: keep the whole npm workspace in EAS builds.
$env:EAS_NO_VCS = '1'
$env:EAS_PROJECT_ROOT = (Get-Location).Path
Set-Location client

npx.cmd expo install expo-dev-client
eas.cmd login
eas.cmd init
```

The global EAS CLI is already installed. Sign into your own Expo account and create or select the Lantern Post project. `eas init` writes the real project UUID under `expo.extra.eas.projectId` in `client/app.json`; the notification adapter reads that automatically. `EXPO_PUBLIC_EAS_PROJECT_ID` in `client/.env` is an alternative, not an additional required copy.

Keep this terminal open for the remaining EAS commands. If starting another terminal, set `EAS_NO_VCS` and `EAS_PROJECT_ROOT` from the workspace root again before entering `client/`. This keeps `packages/shared-types`, the root lockfile, and workspace manifests available to the cloud builder. `.easignore` excludes private environment files, caches, generated builds, and signing/service-account keys.

## 2. Register the Android app with Firebase

1. Open [Firebase Console](https://console.firebase.google.com/) and create or choose your Firebase project.
2. Add an **Android app** with package name **`com.lanternpost.app`**, exactly matching `client/app.json`.
3. Download **`google-services.json`** and save it as `D:\Mobile dev\The Lantern Post\client\google-services.json`.
4. Expo's managed config handles the native Gradle setup; do not paste Firebase Gradle snippets into this project.

This JSON is the Android app configuration and is included in the APK. It is separate from the private FCM service-account credential in the next step. If using an existing Firebase Android app with another package name, update `expo.android.package` to that registered name before building and download its matching configuration.

## 3. Configure FCM V1 delivery credentials

Firebase **Project settings → Service accounts** can generate a private service-account JSON. Keep that private file outside this project and use it only for Expo's FCM credential upload. Do not place it in `client/`, a public environment variable, or browser test fixtures.

In the same terminal, still inside `client/`:

```powershell
eas.cmd credentials --platform android
```

Choose the **development** profile, then the **Google Service Account / FCM V1 push notifications** option and upload the private service-account key for the same Firebase project. Menu wording can vary by EAS CLI version. Ensure Firebase Cloud Messaging API V1 is enabled for that project and the account has the Firebase Cloud Messaging API Admin role. The legacy FCM server-key flow is not used.

The Android application configuration and FCM private credential must belong to the same Firebase project. The Nest API sends through Expo; it does not need the Firebase private key.

## 4. Build and install the Android development APK

After linking Expo and supplying the Firebase configuration and credentials:

```powershell
eas.cmd build --platform android --profile development
```

Install the resulting APK on your Android phone from the EAS build link. This creates a development app; it does not publish a Play Store release. Expo may request any remaining Android signing setup interactively. Installing dependencies or exporting a JavaScript bundle alone does not create this APK.

## 5. Connect the phone to the API and Metro

Set `EXPO_PUBLIC_API_URL` in **`client/.env`** to your computer's Wi-Fi/LAN address, for example:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.20:3000
```

Replace the example with your actual computer IP. A physical phone cannot use the Android emulator's `10.0.2.2` address or the computer's `localhost`. Keep the phone and computer on the same network. Keep your existing Clerk publishable key; no server credential is needed in the client. Release builds require an HTTPS API; this profile runs Metro in development mode.

In **`server/.env`**, enable dispatch:

```dotenv
EXPO_PUSH_ENABLED=true
```

Only add `EXPO_ACCESS_TOKEN` if your Expo project uses enhanced push security; that credential belongs exclusively in `server/.env`. Apply the Phase 5 migration first if it is still pending, as described in `13_PHASE_5_HANDOFF.md`.

From the workspace root, use separate terminals:

```powershell
npm.cmd run dev:server
```

```powershell
npm.cmd start -- --dev-client --clear
```

Open **Lantern Post's development app** on your phone and connect it to Metro. Sign in and open **The friendship court → The palace bells → Enable device alerts**. Allow the Android notification permission when asked.

## 6. Verify with two accounts

Keep account A signed in on the phone with alerts enabled. Send it a friendship invitation from account B in a separate browser/account. The phone should receive the invitation notice within about 30 seconds while the server worker is running. Tap it and confirm it opens A's friendship court.

To test acceptance alerts, send an invitation from A to B, then accept it as B. Only A should receive that acceptance alert. Also verify permission denial, disabling alerts, sign-out, and switching accounts. No real notification has been sent or device build launched by the agent; these final checks need your linked project and phone.
# Current Android starting point

Use [38_ANDROID_READINESS_HANDOFF.md](./38_ANDROID_READINESS_HANDOFF.md) for the first development APK. Firebase is optional for that first build and local welcome notifications. The instructions below are historical remote-push setup notes; package installation is already complete, the repository now uses Git, and `setup:expo-project` handles linking with the dynamic app configuration.
