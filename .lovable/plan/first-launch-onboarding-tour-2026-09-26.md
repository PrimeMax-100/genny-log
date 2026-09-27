# First-launch onboarding tour

## What will be added
- Show a five-step onboarding tour only when the app has no saved entries and the independent completion marker is absent.
- Welcome with the supplied privacy-focused copy, then spotlight the log buttons, optional AI quick-entry, cost card, and Settings icon.
- Skip the AI step automatically when AI quick-entry is hidden.
- Provide **Next**, **Get Started**, **Done**, and an always-visible **Skip** action using the existing button style.
- Treat a tap outside the spotlight or tour panel as **Skip**.
- Add **Replay tour** in Settings; replay does not clear or change the completion marker.

## Persistence and behavior
- Keep the onboarding marker in the existing storage utility, but under a separate localStorage key from generator and entry data.
- Record completion immediately when the user skips or finishes.
- Clearing app entries now or through a future in-app reset will not make onboarding return.
- Wiping all browser site storage externally may remove the marker; that is the only automatic reset path.

## Visual treatment
- Use a dark semi-transparent full-screen overlay, amber-accented focus rings, and short step transitions under 300ms.
- Position each tooltip near its highlighted element while keeping it within the mobile viewport.
- Preserve accessibility with clear labels, focus management, and reduced-motion support.

## Verification
- Check first launch, Skip, Done, conditional AI-step omission, outside-tap dismissal, persistence after reload, and Settings replay.
- Verify mobile and desktop layouts and confirm the app builds without errors.
