# Building the Genny Log APK with GitHub

1. Publish the app in Lovable (the APK opens the published site, so the AI quick-entry keeps working).
2. Push this project to your GitHub repository (e.g. PrimeMax-100/genny-log).
3. On GitHub open **Actions → Build Android APK → Run workflow** (it also runs on every push to `main`).
4. When it finishes, open the run and download **genny-log-apk** — inside is `app-debug.apk`.
5. Copy it to your Android phone and install it (allow "Install unknown apps" when asked).

The app icon comes from `resources/icon.png`. App ID: `com.primemax.gennylog`.
