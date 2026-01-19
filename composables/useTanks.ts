import { computed, readonly } from "vue"

export type TankKind = "freshwater" | "marine"

export type Tank = {
  id: string
  name: string
  kind: TankKind
}

const mockTanks: Tank[] = [
  { id: "reef-300l", name: "Reef 300L", kind: "marine" },
  { id: "nano-40l", name: "Nano Reef 40L", kind: "marine" },
  { id: "fresh-120l", name: "Freshwater 120L", kind: "freshwater" },
]

export function useTanks() {
  const tanks = useState<Tank[]>("tanks", () => mockTanks)
  return readonly(tanks)
}

export function useActiveTankId() {
  return useState<string>("activeTankId", () => mockTanks[0]?.id ?? "tank")
}

export function useActiveTank() {
  const tanks = useTanks()
  const activeTankId = useActiveTankId()

  const activeTank = computed(() => {
    const selected = tanks.value.find((tank) => tank.id === activeTankId.value)
    return selected ?? tanks.value[0]
  })

  function setActiveTankId(id: string) {
    activeTankId.value = id
  }

  return {
    tanks,
    activeTankId,
    activeTank,
    setActiveTankId,
  }
}

