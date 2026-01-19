<script setup lang="ts">
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription as UiDialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

useHead({
  title: "Water tests",
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">Water tests</h1>
      <p class="max-w-prose text-muted-foreground">
        Log measurements, review history, and spot trends over time.
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>Coming in Sprint 5–8</CardTitle>
        <CardDescription>In Sprint 1 we’re just building the page skeletons and navigation.</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        Planned:
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li>Add a test (write to Google Sheets)</li>
          <li>History list + detail view</li>
          <li>Out-of-range highlighting + charts</li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger as-child>
            <Button variant="secondary">Preview “Add test”</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add water test (placeholder)</DialogTitle>
              <UiDialogDescription>
                This becomes the real form in Sprint 5. For now, it validates the Dialog primitive (focus,
                keyboard, escape to close).
              </UiDialogDescription>
            </DialogHeader>

            <div class="text-sm text-muted-foreground">
              Nothing is saved yet — TankLog remains frontend-only and user-controlled.
            </div>
          </DialogContent>
        </Dialog>

        <Button as-child>
          <NuxtLink to="/photos">Go to Photos</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

