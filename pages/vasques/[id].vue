<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

useHead({
  title: "Tank",
})

const route = useRoute()
const { tanks, activeTankId, setActiveTankId } = useActiveTank()

const tankId = computed(() => {
  const raw = route.params.id
  return Array.isArray(raw) ? raw[0] : raw
})

const tank = computed(() => tanks.value.find((t) => t.id === tankId.value))

watchEffect(() => {
  if (!tank.value) return
  if (activeTankId.value !== tank.value.id) setActiveTankId(tank.value.id)
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">
        <span>Tank</span>
        <span v-if="tank" class="text-muted-foreground">· {{ tank.name }}</span>
      </h1>
      <p class="max-w-prose text-muted-foreground">
        This will become the main per-tank dashboard (latest values, alerts, charts, photos, and events).
      </p>
    </div>

    <Card v-if="tank">
      <CardHeader>
        <CardTitle>Sprint 1 skeleton</CardTitle>
        <CardDescription>
          You’re viewing a mocked tank route: <code class="rounded bg-muted px-1 py-0.5">{{ tank.id }}</code>
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Next up:
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Read real tanks from the user’s Google Sheet (Sprint 4)</li>
          <li>Bring together tests, ranges, and charts here (Sprint 6–9)</li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/tests">Water tests</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/photos">Photos</NuxtLink>
        </Button>
        <Button variant="secondary" as-child>
          <NuxtLink to="/events">Events</NuxtLink>
        </Button>
      </CardFooter>
    </Card>

    <Card v-else>
      <CardHeader>
        <CardTitle>Unknown tank</CardTitle>
        <CardDescription>
          We don’t recognize this tank id yet: <code class="rounded bg-muted px-1 py-0.5">{{ tankId }}</code>
        </CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        For Sprint 1 we’re using a temporary mock list. Pick an “Active tank” from the header to navigate
        to a valid tank page.
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Button as-child>
          <NuxtLink to="/">Back to Home</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

