import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow hook exports from context files (common pattern)
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true, allowExportNames: ['useTheme', 'useAuth', 'useNotifications', 'usePlayground'] },
      ],
      // Downgrade to warn — `any` is sometimes required for dynamic WebSocket/API data
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable overly strict purity checks — Date.now() in helper functions is intentional
      'react-hooks/purity': 'off',
      // Disable React Compiler memoization rule — this project does not use the React Compiler
      'react-hooks/preserve-manual-memoization': 'off',
    },
  },
])
