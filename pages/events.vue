<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: "Events",
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Events</h1>
      <p class="max-w-prose text-muted-foreground">
        Track interventions like water changes, dosing, equipment swaps, and maintenance.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Coming in Sprint 10</CardTitle>
        <CardDescription>Events will be stored in the user’s Google Sheet.</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Planned:
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Create events (type, date, notes, tank)</li>
          <li>List and filter per tank</li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/reminders">Go to Reminders</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/photos">Go to Photos</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

