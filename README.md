# SportHub

A cross-platform sports community app built with Expo SDK 58, React Native, Expo Router, and Supabase. It supports web, Android, and iOS.

## Run locally

1. Install Node.js LTS and VS Code.
2. Copy `.env.example` to `.env` and set the Supabase URL, Supabase publishable key, and Google Maps API key.
3. In this folder, run:

   ```bash
   npm install
   npx expo start
   ```

4. Open Expo Go on your phone and scan the QR code. Keep the project on Expo SDK 58 for this Expo Go setup.
5. For the web version, run `npx expo start --web`.

Restart Expo after changing `.env`.

## Supabase setup

Run every SQL migration in `supabase/migrations` once, in filename order, using the Supabase SQL Editor. This creates the profile, event, RSVP, image storage, event chat, social feed, public profile policies, event/post photo galleries, direct messages, profile cover photos, private training log, moderator permissions, event chat history access, and consent-based wellness answers. Image uploads need the `sporthub-media` bucket and policies from the media migration. Direct messages use `20261023000600_direct_messages_and_post_galleries.sql`; if you already ran it, also run `20261023000700_fix_direct_conversation_insert_policy.sql` to apply the current insert policy.

The moderation migration (`20261023001000_moderation.sql`) grants moderator access to the Supabase account whose verified email is `mirovgogo@gmail.com`. After applying it, sign out and back in; the **Moderator tools** button appears on that account's profile. The panel can ban/unban accounts (banned users can still sign in but cannot create events/posts, join events, comment, or send messages) and delete any event or social post. Moderation authorization and these restrictions are enforced by Supabase RLS, not only by the app UI.


### SportHub Wellness and AI coach

The optional wellness onboarding is shown after a new account signs in and the first time an existing account signs in after this update. People can skip it; answers are stored only after separate consent and each account can read or delete only its own answers. Apply `supabase/migrations/20261028000100_wellness_intake.sql` in the Supabase SQL Editor.

In the Supabase Dashboard, open **Edge Functions → Secrets** and add `OPENAI_API_KEY` there. Then deploy the authenticated AI coach after linking the Supabase CLI to your project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase functions deploy wellness-coach
```

Set the key only as a Supabase Edge Function secret. Do not add it to `.env`, `EXPO_PUBLIC_*`, app config, or the mobile app. The coach will show a setup message until the function is deployed and the secret exists. `OPENAI_MODEL` is optional; by default the function uses `gpt-4.1-mini`.

The coach provides general wellness education, not medical care. It does not diagnose or recommend tests, and it advises users with possible alcohol withdrawal to seek medical care.
The app uses Supabase Auth. Email/password sign-in is available after configuring the project’s email settings. To enable Google and Apple, open **Authentication → Providers** in Supabase, enable both providers, and add credentials from Google Cloud and Apple Developer. In Google Cloud, set the authorized redirect URI to the Supabase callback URL shown in the Google provider settings (`https://<project-ref>.supabase.co/auth/v1/callback`), not `localhost`. In Supabase **Authentication → URL Configuration → Redirect URLs**, allow `http://localhost:8081/auth/callback` for local web, `sporthub://**` for an installed app, and `exp://**` for Expo Go's generated iPhone callback. Add your deployed web app's exact `/auth/callback` URL too.

Google and Apple sign-in cannot complete until those provider credentials and redirect URLs are configured in your own accounts.

## Google Maps setup

The native iOS and Android maps use the key in `app.json`. Web maps and address search read `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` from `.env`. Enable Maps JavaScript API and Places API (New) for web, plus Maps SDK for Android and Maps SDK for iOS. Restrict keys to the right app IDs and web origins before publishing.

Opening the map requests foreground location permission if it has not already been decided. On approval, the map centers on the device and sorts events by distance; no extra in-app permission button is needed. If the OS permission was previously denied, enable it in the phone's app settings. Nearby events are grouped using a 2 km radius.

## Main features

- Browse, search, filter, and open event details with location and map.
- Create events with an optional cover photo and map location.
- Join or leave events, subject to event capacity.
- Community feed with photo or text activity posts, likes, and comments.
- Edit a profile name, photo, biography, city, skill level, and sports interests.
- Google and Apple provider sign-in, once configured in Supabase.
- Private event group chats for organizers and joined participants.
- Share event links with the device share sheet or clipboard.
- Optional wellbeing onboarding, private consent-based answers, evidence-linked wellness guidance, and an authenticated AI habit coach.
- Bulgarian and English interface.
- Purple, white, and black visual theme, with Liquid Glass cards on supported iOS versions.

The Supabase diagnostics panel shown in the supplied screenshot is not rendered in the app screens.
