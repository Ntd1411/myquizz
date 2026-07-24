import { Server, Socket } from 'socket.io'
import { socketAuth, type CustomSocketData } from './socket.middleware.js'

export class GameSocket {
  private io: Server

  constructor(io: Server) {
    this.io = io
    this.init()
  }

  private init() {
    const nsp = this.io.of('/game')
    nsp.use((socket, next) => {
      void socketAuth(socket, next)
    })

    nsp.on('connection', (socket: Socket) => {
      const socketData = socket.data as CustomSocketData
      const code = socketData.code
      const role = socketData.role
      if (code) {
        void socket.join(`game:${code}`)
        if (role === 'host') {
          void socket.join(`game:${code}:host`)
        }
      }

      socket.on('question:answer', (_data: unknown, _ack: unknown) => {
        // placeholder for question answering logic
      })
    })
  }
}
