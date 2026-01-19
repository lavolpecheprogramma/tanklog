<script setup lang="ts">
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: 'Settings'
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Settings</h1>
      <p class="max-w-prose text-muted-foreground">
        Sprint 1 placeholder. In later sprints this will host account, language, and spreadsheet connection.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Coming soon</CardTitle>
        <CardDescription>We’ll fill this in during Sprint 2+ (i18n) and Sprint 3+ (Auth).</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        For now, this page exists to validate navigation and SSG route generation.
      </CardContent>
    </Card>
  </section>
</template>

