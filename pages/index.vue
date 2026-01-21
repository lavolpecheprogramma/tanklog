<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

definePageMeta({
  layout: "auth",
})

const { t } = useI18n()
const localePath = useLocalePath()

useHead(() => ({
  title: t("pages.landing.metaTitle"),
}))
</script>

<template>
  <section class="mx-auto w-full max-w-5xl space-y-8">
    <header class="space-y-3">
      <p class="text-sm font-medium text-muted-foreground">{{ $t("pages.landing.kicker") }}</p>
      <h1 class="text-3xl font-semibold tracking-tight sm:text-4xl">
        {{ $t("pages.landing.title") }}
      </h1>
      <p class="max-w-prose text-base text-muted-foreground sm:text-lg">
        {{ $t("pages.landing.description") }}
      </p>

      <div class="flex flex-wrap gap-3 pt-2">
        <Button as-child>
          <NuxtLink :to="localePath('/dashboard')">{{ $t("pages.landing.actions.openDashboard") }}</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink :to="localePath('/privacy')">{{ $t("pages.landing.actions.privacy") }}</NuxtLink>
        </Button>
      </div>
    </header>

    <div class="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.landing.cards.what.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.landing.cards.what.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3 text-sm text-muted-foreground">
          <ul class="list-disc space-y-1 pl-5">
            <li>{{ $t("pages.landing.cards.what.bullets.tests") }}</li>
            <li>{{ $t("pages.landing.cards.what.bullets.trends") }}</li>
            <li>{{ $t("pages.landing.cards.what.bullets.events") }}</li>
            <li>{{ $t("pages.landing.cards.what.bullets.reminders") }}</li>
            <li>{{ $t("pages.landing.cards.what.bullets.photos") }}</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{{ $t("pages.landing.cards.how.title") }}</CardTitle>
          <CardDescription>{{ $t("pages.landing.cards.how.description") }}</CardDescription>
        </CardHeader>
        <CardContent class="space-y-3 text-sm text-muted-foreground">
          <ol class="list-decimal space-y-1 pl-5">
            <li>{{ $t("pages.landing.cards.how.steps.signIn") }}</li>
            <li>{{ $t("pages.landing.cards.how.steps.connectDrive") }}</li>
            <li>{{ $t("pages.landing.cards.how.steps.createTank") }}</li>
            <li>{{ $t("pages.landing.cards.how.steps.startLogging") }}</li>
          </ol>
        </CardContent>
        <CardFooter class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p class="text-xs text-muted-foreground">
            {{ $t("pages.landing.footerNote") }}
          </p>
          <Button variant="secondary" size="sm" as-child>
            <NuxtLink :to="localePath('/dashboard/login')">{{ $t("actions.signInWithGoogle") }}</NuxtLink>
          </Button>
        </CardFooter>
      </Card>
    </div>
  </section>
</template>
