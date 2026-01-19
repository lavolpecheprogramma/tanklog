<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: "Photos",
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Photos</h1>
      <p class="max-w-prose text-muted-foreground">
        Build a visual timeline of tank progress and compare changes over time.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Coming in Sprint 13–14</CardTitle>
        <CardDescription>We’ll upload to Google Drive and store metadata in Google Sheets.</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Planned:
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Upload photos (Drive)</li>
          <li>Timeline gallery (per tank)</li>
          <li>Basic compare mode</li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/tests">Go to Water tests</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/events">Go to Events</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

