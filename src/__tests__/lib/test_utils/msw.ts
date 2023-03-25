import { setupServer } from 'msw/node'

export function mockGraphQLServer() {
  const server = setupServer()

  beforeEach(() => server.listen())
  afterEach(() => server.close())

  return server
}