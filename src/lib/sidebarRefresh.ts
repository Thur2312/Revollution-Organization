export const SIDEBAR_REFRESH_EVENT = 'sidebar:refresh'

export function refreshSidebar() {
  window.dispatchEvent(new Event(SIDEBAR_REFRESH_EVENT))
}
