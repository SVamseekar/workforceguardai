import { createContext, useContext } from 'react'

export interface SidebarSignal {
  title: string
  tone: string
  detail: string
}

export interface SidebarData {
  geographyLabel: string
  topSignal: SidebarSignal | null
  governanceEventCount: number
}

export const SidebarContext = createContext<SidebarData>({
  geographyLabel: '',
  topSignal: null,
  governanceEventCount: 0,
})

export function useSidebarData() {
  return useContext(SidebarContext)
}
