import { Server, Socket } from 'socket.io'
import { socketAuth } from './socket.middleware.js'

export class GameSocket {
  private io: Server

  constructor(io: Server) {
    this.io = io
    this.init()
  }

  private init() {
    const nsp = this.io.of('/game')
    nsp.use(socketAuth)

    nsp.on('connection', (socket: Socket) => {
      const { code, role } = socket.data
      socket.join(`game:${code}`)
      if (role === 'host') socket.join(`game:${code}:host`)

      socket.on('question:answer', async (data, ack) => {
        const playerId = socket.data.playerSessionId
      })
    })
  }
}