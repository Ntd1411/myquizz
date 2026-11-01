import type { Namespace } from 'socket.io'

let namespace: Namespace | undefined

export const registerGameNamespace = (value: Namespace) => {
  namespace = value
}

export const disconnectUserSockets = (userId: number) => {
  for (const socket of namespace?.sockets.values() ?? []) {
    if ((socket.data as { userId?: number }).userId === userId) socket.disconnect(true)
  }
}
