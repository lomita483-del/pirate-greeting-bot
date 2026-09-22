# Ahoy standalone app distribution

Ahoy is being prepared for private distribution before Play Store or App Store publication.

Android releases use the native application shell in android-app. Each release increments versionName and versionCode, produces a signed APK, and updates public/app-release.json with the new version, build, download URL, release notes, and minimum supported version.

The installed Android app checks the release manifest with cache-bypass headers on launch and periodically while installed. When a newer build is published it can notify the user to download the update.

iOS can use the same release metadata and update UI, but its private distribution and signing must use an Apple-supported method.

Never commit Android signing keys or Apple signing credentials to the repository.
