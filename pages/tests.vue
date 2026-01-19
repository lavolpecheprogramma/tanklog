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

const { t, tm } = useI18n()

useHead(() => ({
  title: t("pages.tests.metaTitle"),
}))

const plannedBullets = computed(() => {
  const value = tm("pages.tests.plannedBullets")
  return Array.isArray(value) ? value : []
})
</script>

<template>
  <section class="space-y-6">
    <div class="space-y-2">
      <h1 class="text-2xl font-semibold tracking-tight">{{ $t("pages.tests.title") }}</h1>
      <p class="max-w-prose text-muted-foreground">
        {{ $t("pages.tests.description") }}
      </p>
    </div>

    <Card>
      <CardHeader>
        <CardTitle>{{ $t("pages.tests.comingTitle") }}</CardTitle>
        <CardDescription>{{ $t("pages.tests.comingDescription") }}</CardDescription>
      </CardHeader>
      <CardContent class="text-sm text-muted-foreground">
        {{ $t("pages.tests.plannedLabel") }}
        <ul class="mt-2 list-disc space-y-1 pl-5">
          <li v-for="item in plannedBullets" :key="item">
            {{ item }}
          </li>
        </ul>
      </CardContent>
      <CardFooter class="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger as-child>
            <Button variant="secondary">{{ $t("actions.previewAddTest") }}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{{ $t("pages.tests.dialog.title") }}</DialogTitle>
              <UiDialogDescription>
                {{ $t("pages.tests.dialog.description") }}
              </UiDialogDescription>
            </DialogHeader>

            <div class="text-sm text-muted-foreground">
              {{ $t("pages.tests.dialog.body") }}
            </div>
          </DialogContent>
        </Dialog>

        <Button as-child>
          <NuxtLink to="/photos">{{ $t("actions.goToPhotos") }}</NuxtLink>
        </Button>
      </CardFooter>
    </Card>
  </section>
</template>

