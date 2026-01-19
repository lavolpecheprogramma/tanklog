<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: "Reminders",
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Reminders</h1>
      <p class="max-w-prose text-muted-foreground">
        Set recurring tasks (water change, dosing, batteries) and get best-effort notifications.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Coming in Sprint 11–12</CardTitle>
        <CardDescription>Reminders will be stored in Sheets and evaluated client-side.</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Planned:
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Create reminders (one-time or recurring)</li>
          <li>Upcoming + overdue views</li>
          <li>Notification permission UX (only after user action)</li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/events">Go to Events</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/settings">Go to Settings</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

