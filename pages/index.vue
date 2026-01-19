<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: 'Home'
})

const { activeTank } = useActiveTank()
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">TankLog</h1>
      <p class="max-w-prose text-muted-foreground">
        A frontend-only aquarium logbook to capture tests, events, photos, and spot trends over time.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Sprint 1</CardTitle>
        <CardDescription>
          Page skeletons + coherent navigation (with a mocked “active tank” selector).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul class="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          <li>All main routes exist: tanks, tests, photos, events, reminders, settings</li>
          <li>Active tank selector is visible in the header (mock list)</li>
          <li>Mobile-friendly nav (scrollable tabs)</li>
        </ul>
      </CardContent>
      <CardFooter class="flex gap-2">
        <Button as-child>
          <NuxtLink :to="activeTank ? `/vasques/${activeTank.id}` : '/'">Open active tank</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/tests">Open Water tests</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

