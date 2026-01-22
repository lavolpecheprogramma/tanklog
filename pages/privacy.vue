<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "auth",
})

const { t, locale } = useI18n()

useHead(() => ({
  title: t("pages.privacy.metaTitle"),
}))

const lastUpdated = "2026-01-22"
</script>

<template>
  <section class="mx-auto w-full max-w-3xl space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.privacy.title") }}</h1>
      <p class="text-sm text-muted-foreground">
        {{ $t("pages.privacy.lastUpdatedLabel", { date: lastUpdated }) }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>TankLog</CardTitle>
        <CardDescription>{{ $t("pages.privacy.cardDescription") }}</CardDescription>
      </CardHeader>
      <CardContent class="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <template v-if="locale === 'it'">
          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">1. Panoramica</h2>
            <p class="max-w-prose">
              TankLog è un’app <strong class="text-foreground">solo frontend</strong> (static site / PWA): non esiste un server applicativo
              gestito da TankLog che riceve o memorizza i tuoi dati.
            </p>
            <p class="max-w-prose">
              I dati che inserisci (test, eventi, promemoria, foto…) vengono salvati nel tuo account Google (Drive + Sheets) e rimangono sotto il
              tuo controllo.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">2. Dati trattati dall’app</h2>
            <p class="max-w-prose">TankLog tratta i dati necessari a funzionare, ad esempio:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li>Dati delle vasche (nome, tipo, note, ecc.).</li>
              <li>Test acqua, eventi, promemoria, attrezzatura, fauna e flora.</li>
              <li>Foto caricate su Google Drive e relativi metadati (data, note, id file Drive).</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">3. Accesso con Google e permessi (scopes)</h2>
            <p class="max-w-prose">
              Per usare Drive e Sheets, TankLog utilizza OAuth tramite Google Identity Services nel browser e richiede i seguenti permessi:
            </p>
            <ul class="list-disc space-y-1 pl-5">
              <li><code class="rounded bg-muted px-1 py-0.5">openid</code>, <code class="rounded bg-muted px-1 py-0.5">email</code>, <code class="rounded bg-muted px-1 py-0.5">profile</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/spreadsheets</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/drive.metadata.readonly</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/drive.file</code></li>
            </ul>
            <p class="max-w-prose">
              TankLog può leggere alcune informazioni di profilo (es. email/nome/foto) per mostrarle nell’interfaccia. Il token di accesso viene
              salvato in <strong class="text-foreground">session storage</strong> e viene cancellato quando chiudi la scheda del browser.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">4. Dati salvati localmente sul dispositivo</h2>
            <p class="max-w-prose">Per comodità, TankLog salva alcune preferenze nel tuo browser (local storage), ad esempio:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li>ID della cartella TankLog su Google Drive (per riconnettersi più velocemente).</li>
              <li>Client ID OAuth Google configurato dall’utente (identificativo pubblico).</li>
              <li>Vasca attiva selezionata.</li>
              <li>Lingua e tema (chiaro/scuro).</li>
            </ul>
            <p class="max-w-prose">
              Come PWA, TankLog può anche salvare in cache alcune risorse (file statici dell’app) tramite service worker per supportare il
              funzionamento offline dell’interfaccia.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">5. Condivisione e terze parti</h2>
            <p class="max-w-prose">
              TankLog non vende né condivide i tuoi dati con terze parti. I dati vengono scambiati direttamente tra il tuo browser e i servizi
              Google che hai scelto di usare (Drive, Sheets, Identity).
            </p>
            <p class="max-w-prose">
              Google tratta i dati secondo le proprie policy. Puoi consultare la
              <a
                class="underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer noopener"
              >
                Privacy Policy di Google
              </a>.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">6. Hosting (log tecnici)</h2>
            <p class="max-w-prose">
              TankLog è un sito statico: il provider che ospita i file dell’app (ad es. GitHub Pages / Netlify / Cloudflare Pages) può raccogliere
              log tecnici standard delle richieste (es. indirizzo IP, user agent) per motivi di sicurezza e funzionamento.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">7. Le tue scelte</h2>
            <ul class="list-disc space-y-1 pl-5">
              <li>Puoi disconnettere TankLog dalle Impostazioni e cancellare i dati locali del browser.</li>
              <li>Puoi revocare l’accesso a TankLog dal tuo account Google (Sicurezza → Accesso di terze parti).</li>
              <li>Puoi eliminare la cartella <code class="rounded bg-muted px-1 py-0.5">TankLog</code> dal tuo Google Drive per cancellare i dati.</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">8. Contatti</h2>
            <p class="max-w-prose">
              Per domande sulla privacy, contatta il gestore dell’istanza di TankLog che stai utilizzando.
            </p>
          </section>
        </template>

        <template v-else>
          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">1. Overview</h2>
            <p class="max-w-prose">
              TankLog is a <strong class="text-foreground">frontend-only</strong> app (static site / PWA). It does not run an application server
              operated by TankLog that receives or stores your TankLog data.
            </p>
            <p class="max-w-prose">
              The data you enter (tests, events, reminders, photos…) is stored in your own Google account (Drive + Sheets) and remains under your
              control.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">2. Data processed by the app</h2>
            <p class="max-w-prose">TankLog processes the data needed to work, such as:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li>Tank details (name, type, notes, etc.).</li>
              <li>Water tests, events, reminders, equipment, livestock.</li>
              <li>Photos uploaded to Google Drive and related metadata (date, notes, Drive file id).</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">3. Google sign-in and permissions (scopes)</h2>
            <p class="max-w-prose">
              To use Drive and Sheets, TankLog uses OAuth via Google Identity Services in your browser and requests the following scopes:
            </p>
            <ul class="list-disc space-y-1 pl-5">
              <li><code class="rounded bg-muted px-1 py-0.5">openid</code>, <code class="rounded bg-muted px-1 py-0.5">email</code>, <code class="rounded bg-muted px-1 py-0.5">profile</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/spreadsheets</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/drive.metadata.readonly</code></li>
              <li><code class="rounded bg-muted px-1 py-0.5">https://www.googleapis.com/auth/drive.file</code></li>
            </ul>
            <p class="max-w-prose">
              TankLog may read basic profile information (e.g., email/name/picture) to show it in the UI. The access token is stored in
              <strong class="text-foreground">session storage</strong> and is cleared when you close the browser tab.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">4. Data stored on your device</h2>
            <p class="max-w-prose">For convenience, TankLog stores some preferences in your browser (local storage), such as:</p>
            <ul class="list-disc space-y-1 pl-5">
              <li>Your TankLog Google Drive folder id (to reconnect faster).</li>
              <li>Your user-provided Google OAuth Client ID (public identifier).</li>
              <li>Your selected active tank.</li>
              <li>Language and theme (light/dark).</li>
            </ul>
            <p class="max-w-prose">
              As a PWA, TankLog may also cache some resources (static app files) via a service worker to support offline loading of the app shell.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">5. Sharing and third parties</h2>
            <p class="max-w-prose">
              TankLog does not sell or share your data with third parties. Data is exchanged directly between your browser and the Google services
              you choose to use (Drive, Sheets, Identity).
            </p>
            <p class="max-w-prose">
              Google processes data under its own policies. See the
              <a
                class="underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                href="https://policies.google.com/privacy"
                target="_blank"
                rel="noreferrer noopener"
              >
                Google Privacy Policy
              </a>.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">6. Hosting (technical logs)</h2>
            <p class="max-w-prose">
              TankLog is a static site. The provider hosting the app files (e.g., GitHub Pages / Netlify / Cloudflare Pages) may collect standard
              technical request logs (e.g., IP address, user agent) for security and operational purposes.
            </p>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">7. Your choices</h2>
            <ul class="list-disc space-y-1 pl-5">
              <li>You can disconnect TankLog from Settings and clear local browser data.</li>
              <li>You can revoke TankLog access from your Google Account (Security → Third-party access).</li>
              <li>You can delete the <code class="rounded bg-muted px-1 py-0.5">TankLog</code> folder from your Google Drive to remove your data.</li>
            </ul>
          </section>

          <section class="space-y-3">
            <h2 class="text-base font-semibold text-foreground">8. Contact</h2>
            <p class="max-w-prose">
              For privacy questions, contact the operator of the TankLog instance you are using.
            </p>
          </section>
        </template>
      </CardContent>
    </Card>
  </section>
</template>

