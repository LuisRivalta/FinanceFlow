import { defineConfig } from 'vitest/config'

// Os testes cobrem apenas módulos puros (sem JSX, sem DOM), então o ambiente
// node basta e a config não precisa de plugin de React.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['src/**/*.test.js'],
    },
})
